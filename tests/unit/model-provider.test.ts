import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ModelError,
  parseScenario,
  ScenarioMismatchError,
  ScriptedProvider,
} from '../../src/lib/model';
import type {
  Message,
  ModelRequest,
  Scenario,
  ToolDefinition,
} from '../../src/lib/model';

// --- fixtures ----------------------------------------------------------------------------

const calculatorTool: ToolDefinition = {
  name: 'calculator',
  description: 'Evaluates an arithmetic expression deterministically.',
  inputSchema: {
    type: 'object',
    properties: { expression: { type: 'string' } },
    required: ['expression'],
  },
};
const lookupTool: ToolDefinition = {
  name: 'lookup',
  description: 'Deterministic key-value lookup.',
  inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
};

const acceptanceScenario: Scenario = parseScenario(
  JSON.parse(
    readFileSync(
      join(process.cwd(), 'src/lib/model/scenarios/calculator-tool-use.scenario.json'),
      'utf8',
    ),
  ),
);

/** Minimal single-turn scenario: plain completion, no tools, no declared metadata. */
const plainScenario: Scenario = parseScenario({
  id: 'plain-completion',
  description: 'One text-only turn with no declared usage.',
  turns: [
    {
      expect: { roleSequence: ['user'] },
      respond: { text: 'Paris.', stopReason: 'completed' },
    },
  ],
});

/** Runs the full acceptance replay, manually playing the future agent runtime's part. */
async function replayAcceptance(provider: ScriptedProvider) {
  const messages: Message[] = [{ role: 'user', text: 'What is 127 * 49?' }];
  const request = (): ModelRequest => ({
    system: 'You are a careful assistant. Use tools for arithmetic.',
    messages,
    tools: [calculatorTool],
  });

  const first = await provider.complete(request());
  // Simulate the agent runtime: append the assistant turn, execute the tool, append the result.
  messages.push({ role: 'assistant', text: first.text, toolCalls: first.toolCalls });
  messages.push({
    role: 'tool',
    toolCallId: first.toolCalls[0]!.id,
    toolName: first.toolCalls[0]!.toolName,
    result: 6223,
  });
  const second = await provider.complete(request());
  return { first, second };
}

// --- happy paths ---------------------------------------------------------------------------

describe('ScriptedProvider — valid replays', () => {
  it('plain completion returns text only, stop reason completed', async () => {
    const response = await new ScriptedProvider(plainScenario).complete({
      messages: [{ role: 'user', text: 'Capital of France?' }],
    });
    expect(response.text).toBe('Paris.');
    expect(response.toolCalls).toEqual([]);
    expect(response.stopReason).toBe('completed');
  });

  it('multi-step tool-use scenario replays end-to-end (two calls, tool round-trip)', async () => {
    const { first, second } = await replayAcceptance(new ScriptedProvider(acceptanceScenario));

    expect(first.stopReason).toBe('tool-call');
    expect(first.toolCalls).toEqual([
      { id: 'call-1', toolName: 'calculator', arguments: { expression: '127 * 49' } },
    ]);
    expect(second.stopReason).toBe('completed');
    expect(second.text).toContain('6,223');
    expect(second.toolCalls).toEqual([]);
    expect(first.stopReason).not.toBe(second.stopReason); // distinct stop reasons demonstrated
  });

  it('accepts requests offering multiple tool definitions', async () => {
    const scenario = parseScenario({
      id: 'two-tools',
      description: 'Expects both tools to be offered.',
      turns: [
        {
          expect: { toolsInclude: ['calculator', 'lookup'] },
          respond: { text: 'ok', stopReason: 'completed' },
        },
      ],
    });
    const response = await new ScriptedProvider(scenario).complete({
      messages: [{ role: 'user', text: 'hi' }],
      tools: [calculatorTool, lookupTool],
    });
    expect(response.text).toBe('ok');
  });

  it('declared metadata is returned verbatim; provider/model are labeled', async () => {
    const { first } = await replayAcceptance(new ScriptedProvider(acceptanceScenario));
    expect(first.usage).toEqual({
      latencyMs: 420,
      inputTokens: 63,
      outputTokens: 24,
      totalTokens: 87,
      cost: { amount: 0.00071, currency: 'USD', basis: 'declared' },
    });
    expect(first.provider).toBe('scripted');
    expect(first.model).toBe('scripted-tool-user-v1');
  });

  it('unknown values stay undefined — never fabricated', async () => {
    const response = await new ScriptedProvider(plainScenario).complete({
      messages: [{ role: 'user', text: 'Capital of France?' }],
    });
    expect(response.usage).toEqual({}); // no declared usage → no invented tokens/latency/cost
    expect(response.model).toBeUndefined(); // scenario declares no model label
  });
});

// --- divergence detection ---------------------------------------------------------------------

describe('ScriptedProvider — divergence detection', () => {
  it('missing expected tool result fails with full mismatch detail', async () => {
    const provider = new ScriptedProvider(acceptanceScenario);
    await provider.complete({
      messages: [{ role: 'user', text: 'What is 127 * 49?' }],
      tools: [calculatorTool],
    });
    // Forget to append the tool result — the classic agent-runtime bug.
    const bad = provider.complete({
      messages: [
        { role: 'user', text: 'What is 127 * 49?' },
        { role: 'assistant', toolCalls: [{ id: 'call-1', toolName: 'calculator', arguments: {} }] },
      ],
      tools: [calculatorTool],
    });
    await expect(bad).rejects.toThrow(ScenarioMismatchError);
    await bad.catch((error: ScenarioMismatchError) => {
      expect(error.detail).toMatchObject({
        scenarioId: 'calculator-tool-use',
        turnIndex: 1,
        condition: 'roleSequence', // shape check fires first: the tool message is absent
      });
      expect(error.detail.remediation).toBeTruthy();
    });
  });

  it('tool result with the WRONG call id fails on toolResultForCallId', async () => {
    const provider = new ScriptedProvider(acceptanceScenario);
    await provider.complete({
      messages: [{ role: 'user', text: 'What is 127 * 49?' }],
      tools: [calculatorTool],
    });
    const bad = provider.complete({
      messages: [
        { role: 'user', text: 'What is 127 * 49?' },
        { role: 'assistant', toolCalls: [{ id: 'call-1', toolName: 'calculator', arguments: {} }] },
        { role: 'tool', toolCallId: 'call-99', toolName: 'calculator', result: 6223 },
      ],
      tools: [calculatorTool],
    });
    await expect(bad).rejects.toMatchObject({
      code: 'scenario-mismatch',
      detail: { condition: 'toolResultForCallId', expected: 'call-1', actual: ['call-99'] },
    });
  });

  it('wrong tool name offered fails on toolsInclude, naming the missing tool', async () => {
    const bad = new ScriptedProvider(acceptanceScenario).complete({
      messages: [{ role: 'user', text: 'What is 127 * 49?' }],
      tools: [{ ...calculatorTool, name: 'abacus' }],
    });
    await expect(bad).rejects.toMatchObject({
      detail: { condition: 'toolsInclude', expected: ['calculator'], actual: ['abacus'] },
    });
    await bad.catch((e: ScenarioMismatchError) => expect(e.message).toContain('calculator'));
  });

  it('wrong turn order (conversation shape) fails on roleSequence', async () => {
    const bad = new ScriptedProvider(acceptanceScenario).complete({
      messages: [
        { role: 'user', text: 'What is 127 * 49?' },
        { role: 'user', text: 'hello again' }, // scenario expects exactly ["user"]
      ],
      tools: [calculatorTool],
    });
    await expect(bad).rejects.toMatchObject({
      detail: { condition: 'roleSequence', expected: ['user'], actual: ['user', 'user'] },
    });
  });

  it('divergent content fails on lastMessageContains', async () => {
    const bad = new ScriptedProvider(acceptanceScenario).complete({
      messages: [{ role: 'user', text: 'What is 2 + 2?' }], // scenario expects "127"
      tools: [calculatorTool],
    });
    await expect(bad).rejects.toMatchObject({ detail: { condition: 'lastMessageContains' } });
  });

  it('calling an exhausted scenario throws scenario-exhausted with remediation', async () => {
    const provider = new ScriptedProvider(plainScenario);
    await provider.complete({ messages: [{ role: 'user', text: 'Capital of France?' }] });
    const bad = provider.complete({ messages: [{ role: 'user', text: 'again?' }] });
    await expect(bad).rejects.toMatchObject({ code: 'scenario-exhausted' });
    await bad.catch((e: ModelError) => {
      expect(e.message).toContain('new ScriptedProvider');
      expect(e.context).toMatchObject({ scenarioId: 'plain-completion', turns: 1 });
    });
  });

  it('empty message list is an invalid-request error', async () => {
    await expect(new ScriptedProvider(plainScenario).complete({ messages: [] })).rejects.toMatchObject({
      code: 'invalid-request',
    });
  });
});

// --- determinism & state ownership --------------------------------------------------------------

describe('ScriptedProvider — determinism and session state', () => {
  it('repeated replays produce identical responses, stop reasons, and metadata', async () => {
    const a = await replayAcceptance(new ScriptedProvider(acceptanceScenario));
    const b = await replayAcceptance(new ScriptedProvider(acceptanceScenario));
    expect(b).toEqual(a);
  });

  it('mismatch behavior is identical across replays', async () => {
    const attempt = () =>
      new ScriptedProvider(acceptanceScenario)
        .complete({ messages: [{ role: 'user', text: 'What is 2 + 2?' }], tools: [calculatorTool] })
        .then(
          () => null,
          (e: ScenarioMismatchError) => e.detail,
        );
    expect(await attempt()).toEqual(await attempt());
  });

  it('position is per-instance: interleaved sessions on one Scenario object are independent', async () => {
    const one = new ScriptedProvider(acceptanceScenario);
    const two = new ScriptedProvider(acceptanceScenario);
    const start: ModelRequest = {
      messages: [{ role: 'user', text: 'What is 127 * 49?' }],
      tools: [calculatorTool],
    };
    const r1 = await one.complete(start);
    const r2 = await two.complete(start); // `two` must still be on turn 0
    expect(r2).toEqual(r1);
    expect(one.turnsConsumed).toBe(1);
    expect(two.turnsConsumed).toBe(1);
    expect(one.isExhausted).toBe(false);
  });

  it('a consumer mutating a response cannot corrupt later replays (deep-cloned output)', async () => {
    const first = await new ScriptedProvider(acceptanceScenario).complete({
      messages: [{ role: 'user', text: 'What is 127 * 49?' }],
      tools: [calculatorTool],
    });
    first.toolCalls[0]!.arguments['expression'] = 'TAMPERED';
    const again = await new ScriptedProvider(acceptanceScenario).complete({
      messages: [{ role: 'user', text: 'What is 127 * 49?' }],
      tools: [calculatorTool],
    });
    expect(again.toolCalls[0]!.arguments['expression']).toBe('127 * 49');
  });
});

// --- scenario format -------------------------------------------------------------------------------

describe('parseScenario', () => {
  it('rejects a schema-invalid scenario with a typed, located error', () => {
    expect(() =>
      parseScenario({
        id: 'Bad Id!',
        description: 'x',
        turns: [{ respond: { stopReason: 'because-i-said-so' } }],
      }),
    ).toThrow(ModelError);
    try {
      parseScenario({ id: 'Bad Id!', description: 'x', turns: [{ respond: { stopReason: 'nope' } }] });
    } catch (error) {
      const e = error as ModelError;
      expect(e.code).toBe('invalid-scenario');
      expect(e.message).toContain('id');
      expect(e.message).toContain('turns.0.respond.stopReason');
    }
  });

  it('rejects unknown keys (typo protection) and empty turn lists', () => {
    expect(() =>
      parseScenario({ id: 'ok-id', description: 'x', turns: [], extra: true }),
    ).toThrow(ModelError);
  });

  it('accepts the checked-in acceptance scenario', () => {
    expect(acceptanceScenario.id).toBe('calculator-tool-use');
    expect(acceptanceScenario.turns).toHaveLength(2);
  });
});
