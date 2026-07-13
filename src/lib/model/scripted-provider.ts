/**
 * ScriptedProvider: deterministic replay of a scenario through the ModelProvider
 * contract. One instance = one replay session — the turn position lives on the
 * instance (never module state), so a fresh replay is simply `new
 * ScriptedProvider(scenario)`, and accidental reuse fails loudly with
 * `scenario-exhausted` instead of silently looping.
 *
 * Divergence detection: before answering, each turn's `expect` matchers are checked
 * against the actual request. Only stable, educationally relevant properties are
 * matched (role sequence, a substring of the last message, presence of a specific
 * tool result, offered tool names) — never full-string equality of prompts. A
 * mismatch throws `ScenarioMismatchError` with scenario id, turn index, the failed
 * condition, expected vs actual, and a remediation hint.
 *
 * Determinism: responses, stop reasons, metadata, and mismatch behavior derive only
 * from the scenario data and the request — no clocks (`latencyMs` is declared, not
 * measured), no randomness, no environment reads. Responses are deep-cloned so a
 * consumer mutating one cannot corrupt later replays of a shared Scenario object.
 */
import { ModelError, ScenarioMismatchError } from './errors';
import type { Scenario, TurnExpectation } from './scenario';
import type {
  JsonValue,
  Message,
  ModelProvider,
  ModelRequest,
  ModelResponse,
} from './types';

export class ScriptedProvider implements ModelProvider {
  readonly scenario: Scenario;
  #position = 0;

  constructor(scenario: Scenario) {
    this.scenario = scenario;
  }

  /** How many turns this session has already replayed. */
  get turnsConsumed(): number {
    return this.#position;
  }

  get isExhausted(): boolean {
    return this.#position >= this.scenario.turns.length;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    validateRequest(request);

    if (this.isExhausted) {
      throw new ModelError(
        'scenario-exhausted',
        `scenario "${this.scenario.id}" has only ${this.scenario.turns.length} turn(s) and all were consumed — ` +
          'create a new ScriptedProvider for a fresh replay, or extend the scenario.',
        { scenarioId: this.scenario.id, turns: this.scenario.turns.length },
      );
    }

    const turn = this.scenario.turns[this.#position]!;
    if (turn.expect) {
      this.#checkExpectation(turn.expect, request, this.#position);
    }
    this.#position += 1;

    return structuredClone({
      text: turn.respond.text,
      toolCalls: turn.respond.toolCalls ?? [],
      stopReason: turn.respond.stopReason,
      usage: turn.respond.usage ?? {},
      provider: 'scripted',
      model: this.scenario.model, // undefined when the scenario declares none — never fabricated
    });
  }

  #checkExpectation(expect: TurnExpectation, request: ModelRequest, turnIndex: number): void {
    const fail = (condition: string, expected: JsonValue, actual: JsonValue, remediation: string) => {
      throw new ScenarioMismatchError({
        scenarioId: this.scenario.id,
        turnIndex,
        condition,
        expected,
        actual,
        remediation,
      });
    };

    if (expect.roleSequence) {
      const actual = request.messages.map((m) => m.role);
      if (actual.length !== expect.roleSequence.length || actual.some((r, i) => r !== expect.roleSequence![i])) {
        fail(
          'roleSequence',
          expect.roleSequence,
          actual,
          'The conversation shape diverged from the script — check turn order and that the agent runtime appended the messages the scenario expects.',
        );
      }
    }

    if (expect.lastMessageContains) {
      const last = request.messages[request.messages.length - 1];
      const text = last ? lastMessageText(last) : '';
      if (!text.includes(expect.lastMessageContains)) {
        fail(
          'lastMessageContains',
          expect.lastMessageContains,
          text,
          'The last message does not contain the expected content — the request was built differently than the scenario assumes.',
        );
      }
    }

    if (expect.toolResultForCallId) {
      const ids = request.messages
        .filter((m): m is Extract<Message, { role: 'tool' }> => m.role === 'tool')
        .map((m) => m.toolCallId);
      if (!ids.includes(expect.toolResultForCallId)) {
        fail(
          'toolResultForCallId',
          expect.toolResultForCallId,
          ids,
          'The scripted model expected to see a tool result for this call id — the agent runtime must execute the tool and append a tool message before calling the model again.',
        );
      }
    }

    if (expect.toolsInclude) {
      const offered = (request.tools ?? []).map((t) => t.name);
      const missing = expect.toolsInclude.filter((name) => !offered.includes(name));
      if (missing.length > 0) {
        fail(
          'toolsInclude',
          expect.toolsInclude,
          offered,
          `The request must offer tool(s): ${missing.join(', ')} — pass their ToolDefinitions in request.tools.`,
        );
      }
    }
  }
}

function validateRequest(request: ModelRequest): void {
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    throw new ModelError('invalid-request', 'request.messages must be a non-empty ordered array', {
      messageCount: Array.isArray(request.messages) ? request.messages.length : null,
    });
  }
}

function lastMessageText(message: Message): string {
  switch (message.role) {
    case 'user':
      return message.text;
    case 'assistant':
      return message.text ?? JSON.stringify(message.toolCalls ?? []);
    case 'tool':
      return JSON.stringify(message.result);
  }
}
