/**
 * The minimum tool-using agent loop — the mechanism every agent framework wraps
 * (ADR-0005). Read it top to bottom; it is the whiteboard answer:
 *
 *   goal → [ model observes messages + tools → selects action
 *            → runtime validates → executes → appends observation ] repeat
 *        → stop (plain answer | step limit | rejection | error)
 *
 * Policy choices, made visible because they ARE the design space:
 *  - Invalid tool requests (unknown tool, bad arguments, duplicate call id) END the
 *    run with 'invalid-tool-request'. Feeding the error back for the model to retry
 *    is a real production pattern — it belongs to the reliability concept, and adding
 *    it here would hide how often models get tools wrong.
 *  - Tool execution failures END the run with 'tool-error' for the same reason.
 *  - `maxSteps` bounds MODEL CALLS — the defense against infinite loops. Hitting it
 *    is an outcome, never an exception.
 * No hidden state: everything the run did is in `messages` and `trace`.
 */
import type { Message, ModelProvider } from '../model';
import { ModelError } from '../model';
import type { ToolRegistry } from './tools';
import type { AgentRunOptions, AgentRunResult, RunOutcome, TraceEvent } from './types';

export const DEFAULT_MAX_STEPS = 6;

export async function runAgent(
  provider: ModelProvider,
  tools: ToolRegistry,
  options: AgentRunOptions,
): Promise<AgentRunResult> {
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const messages: Message[] = [{ role: 'user', text: options.goal }];
  const trace: TraceEvent[] = [];
  const seenCallIds = new Set<string>();
  let modelCalls = 0;

  const finish = (outcome: RunOutcome, finalText?: string): AgentRunResult => ({
    outcome,
    ...(finalText !== undefined ? { finalText } : {}),
    messages,
    trace,
    modelCalls,
  });

  trace.push({
    step: 0,
    type: 'run-started',
    decidedBy: 'runtime',
    detail: `Goal received. The runtime holds the state; the model will decide the actions (limit: ${maxSteps} model calls).`,
  });

  while (modelCalls < maxSteps) {
    const step = modelCalls + 1;
    trace.push({
      step,
      type: 'model-requested',
      decidedBy: 'runtime',
      detail: `Model call ${step}: the model sees ${messages.length} message(s) and ${tools.definitions().length} available tool(s).`,
    });

    let response;
    try {
      response = await provider.complete({
        ...(options.system !== undefined ? { system: options.system } : {}),
        messages,
        tools: tools.definitions(),
      });
    } catch (error) {
      const reason = error instanceof ModelError ? `${error.code}: ${error.message}` : String(error);
      trace.push({
        step,
        type: 'run-failed',
        decidedBy: 'runtime',
        outcome: 'model-error',
        detail: `The model call failed (${reason}). The runtime surfaces failures as outcomes — it never converts them into fake answers.`,
      });
      return finish('model-error');
    }
    modelCalls += 1;

    trace.push({
      step,
      type: 'model-responded',
      decidedBy: 'model',
      stopReason: response.stopReason,
      ...(Object.keys(response.usage).length > 0 ? { usage: response.usage } : {}),
      ...(response.warnings && response.warnings.length > 0 ? { warnings: response.warnings } : {}),
      detail:
        response.toolCalls.length > 0
          ? `The model chose to act: ${response.toolCalls.length} tool call(s), stop reason "${response.stopReason}" — it is waiting for something outside itself.`
          : `The model answered in plain text, stop reason "${response.stopReason}".`,
    });

    messages.push({
      role: 'assistant',
      ...(response.text !== undefined ? { text: response.text } : {}),
      ...(response.toolCalls.length > 0 ? { toolCalls: response.toolCalls } : {}),
    });

    if (response.toolCalls.length === 0) {
      trace.push({
        step,
        type: 'run-completed',
        decidedBy: 'runtime',
        outcome: 'completed',
        detail:
          'No tool call → the loop ends. "Completed" means the loop ended with an answer — not that the answer is correct. Verifying THAT is evaluation, a separate concept.',
      });
      return finish('completed', response.text);
    }

    for (const call of response.toolCalls) {
      trace.push({
        step,
        type: 'tool-selected',
        decidedBy: 'model',
        toolName: call.toolName,
        toolCallId: call.id,
        detail: `The MODEL selected "${call.toolName}" with arguments ${JSON.stringify(call.arguments)}. Selection is the model's only power — nothing has executed yet.`,
      });

      if (seenCallIds.has(call.id)) {
        trace.push({
          step,
          type: 'tool-rejected',
          decidedBy: 'runtime',
          toolName: call.toolName,
          toolCallId: call.id,
          outcome: 'invalid-tool-request',
          detail: `Duplicate tool call id "${call.id}" — replaying a call id could double-execute an action, so the runtime rejects it.`,
        });
        return finish('invalid-tool-request');
      }
      seenCallIds.add(call.id);

      const tool = tools.get(call.toolName);
      if (!tool) {
        trace.push({
          step,
          type: 'tool-rejected',
          decidedBy: 'runtime',
          toolName: call.toolName,
          toolCallId: call.id,
          outcome: 'invalid-tool-request',
          detail: `"${call.toolName}" is not in the registry. The registry is an allowlist: the model can ask for anything, the runtime executes only what the developer registered.`,
        });
        return finish('invalid-tool-request');
      }

      const parsed = tool.parseArgs(call.arguments);
      if (!parsed.ok) {
        trace.push({
          step,
          type: 'tool-rejected',
          decidedBy: 'runtime',
          toolName: call.toolName,
          toolCallId: call.id,
          outcome: 'invalid-tool-request',
          detail: `Arguments failed validation (${parsed.error}). Input validation happens HERE, at the runtime boundary — never inside the model.`,
        });
        return finish('invalid-tool-request');
      }
      trace.push({
        step,
        type: 'tool-validated',
        decidedBy: 'runtime',
        toolName: call.toolName,
        toolCallId: call.id,
        detail: 'Arguments passed strict validation against the tool’s schema.',
      });

      const result = tool.execute(parsed.value as never);
      if (!result.ok) {
        trace.push({
          step,
          type: 'tool-executed',
          decidedBy: 'runtime',
          toolName: call.toolName,
          toolCallId: call.id,
          outcome: 'tool-error',
          detail: `Execution failed: ${result.error}. The runtime ends the run honestly rather than hiding the failure. (Feeding errors back for retry is a reliability pattern — a later addition, not part of the minimum loop.)`,
        });
        return finish('tool-error');
      }
      trace.push({
        step,
        type: 'tool-executed',
        decidedBy: 'runtime',
        toolName: call.toolName,
        toolCallId: call.id,
        detail: `The RUNTIME executed the tool deterministically → ${JSON.stringify(result.value)}.`,
      });

      messages.push({
        role: 'tool',
        toolCallId: call.id,
        toolName: call.toolName,
        result: result.value,
      });
      trace.push({
        step,
        type: 'observation-appended',
        decidedBy: 'runtime',
        toolName: call.toolName,
        toolCallId: call.id,
        detail:
          'The result becomes an observation in the conversation state. The next model call will see it — this append is what closes the loop.',
      });
    }
  }

  trace.push({
    step: modelCalls,
    type: 'run-stopped-limit',
    decidedBy: 'runtime',
    outcome: 'max-steps-reached',
    detail: `Step limit (${maxSteps} model calls) reached. The limit is the runtime's guarantee that no run loops forever — hitting it is an outcome to handle, not an exception.`,
  });
  return finish('max-steps-reached');
}
