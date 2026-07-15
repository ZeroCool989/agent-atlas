/**
 * Data builders for the Tool Calling lesson. Everything here runs the REAL tool
 * validation and the REAL runtime — nothing is hand-drawn. Two builders:
 *
 *  - buildValidationLayerCases(): pushes example tool calls through the three gates a
 *    request actually passes (message validity → schema → semantic execution), using
 *    the real calculator, so the signature "why 2 ** 0.5 fails" visual is computed.
 *  - buildToolCallingCases(): runs the runtime on scripted scenarios to produce one
 *    trace per outcome class (success, schema failure, semantic failure, unknown tool,
 *    tool error). The lesson page overrides `success` and `semantic-failure` with the
 *    MEASURED Claude traces from Experiments 005/006 when available.
 */
import { calculatorTool, evaluateExpression } from './calculator';
import { unreliableLookupTool } from './demo-tools';
import badArgumentsScenario from '../model/scenarios/failure-bad-arguments.scenario.json';
import unknownToolScenario from '../model/scenarios/failure-unknown-tool.scenario.json';
import toolExceptionScenario from '../model/scenarios/failure-tool-exception.scenario.json';
import successScenario from '../model/scenarios/calculator-tool-use.scenario.json';
import semanticFailureScenario from '../model/scenarios/tool-calling-semantic-failure.scenario.json';
import { parseScenario, ScriptedProvider } from '../model';
import type { JsonObject } from '../model';
import { runAgent } from './runner';
import { ToolRegistry } from './tools';
import type { AgentTool, RunOutcome, TraceEvent } from './types';

export const TOOL_CALLING_TASK = 'What is 127 * 49?';

// --- Three validation layers ---------------------------------------------------------------

export interface ValidationLayerCase {
  label: string;
  toolName: string;
  arguments: JsonObject;
  provenance: 'measured' | 'scripted' | 'illustrative';
  evidence?: string;
  /** Layer 1: is the request the model produced well-formed? */
  message: { pass: boolean; detail: string };
  /** Layer 2: do the arguments match the tool's schema? */
  schema: { pass: boolean; detail: string };
  /** Layer 3: can the tool actually execute the (schema-valid) arguments? */
  semantic: { pass: boolean; detail: string };
  /** The executed result, when all three layers pass. */
  result?: string;
}

function evaluateLayers(
  label: string,
  tool: AgentTool,
  args: JsonObject,
  provenance: ValidationLayerCase['provenance'],
  evidence?: string,
): ValidationLayerCase {
  // Layer 1 — message validity. In a real run the runtime rejects an empty/malformed
  // request before the model is even called; a well-formed tool call clears it.
  const message = { pass: true, detail: 'the request carries a non-empty conversation and a valid tool call' };

  // Layer 2 — schema validation (the real tool's strict parser).
  const parsed = tool.parseArgs(args);
  const schema = parsed.ok
    ? { pass: true, detail: 'arguments match the tool schema' }
    : { pass: false, detail: parsed.error };

  // Layer 3 — semantic execution (only reached if schema passed).
  let semantic: ValidationLayerCase['semantic'];
  let result: string | undefined;
  if (!parsed.ok) {
    semantic = { pass: false, detail: 'not reached — the request never gets past schema validation' };
  } else {
    const executed = tool.execute(parsed.value as never);
    if (executed.ok) {
      semantic = { pass: true, detail: 'the tool executed the arguments' };
      result = JSON.stringify(executed.value);
    } else {
      semantic = { pass: false, detail: executed.error };
    }
  }

  return {
    label,
    toolName: tool.definition.name,
    arguments: args,
    provenance,
    ...(evidence ? { evidence } : {}),
    message,
    schema,
    semantic,
    ...(result !== undefined ? { result } : {}),
  };
}

export function buildValidationLayerCases(): ValidationLayerCase[] {
  return [
    evaluateLayers('A calculation the tool supports', calculatorTool, { expression: '127 * 49' }, 'measured', 'Experiment 005'),
    // The signature case: valid JSON, valid schema, unexecutable meaning.
    evaluateLayers('A power operator the grammar lacks', calculatorTool, { expression: '2 ** 0.5' }, 'measured', 'Experiment 006'),
    evaluateLayers('A wrong argument key', calculatorTool, { expr: '1 + 1' } as unknown as JsonObject, 'illustrative'),
    evaluateLayers('Division by zero', calculatorTool, { expression: '1 / 0' }, 'illustrative'),
  ];
}

// --- Outcome-class traces (through the real runtime) ----------------------------------------------

export interface ToolCallingCase {
  key: 'success' | 'schema-failure' | 'semantic-failure' | 'unknown-tool' | 'tool-error';
  label: string;
  summary: string;
  provenance: 'measured' | 'scripted';
  evidence?: string;
  outcome: RunOutcome;
  finalText?: string;
  trace: TraceEvent[];
}

async function runScenario(
  scenario: unknown,
  tools: AgentTool[],
  goal: string,
  maxSteps = 4,
): Promise<{ outcome: RunOutcome; finalText?: string; trace: TraceEvent[] }> {
  const result = await runAgent(new ScriptedProvider(parseScenario(scenario)), new ToolRegistry(tools), {
    system: 'You are a careful assistant. Use tools for arithmetic.',
    goal,
    maxSteps,
  });
  return {
    outcome: result.outcome,
    ...(result.finalText !== undefined ? { finalText: result.finalText } : {}),
    trace: result.trace,
  };
}

export async function buildToolCallingCases(): Promise<ToolCallingCase[]> {
  const success = await runScenario(successScenario, [calculatorTool], TOOL_CALLING_TASK);
  const schema = await runScenario(badArgumentsScenario, [calculatorTool], 'Trigger a schema failure.');
  const semantic = await runScenario(semanticFailureScenario, [calculatorTool], 'What is the square root of 2?');
  const unknown = await runScenario(unknownToolScenario, [calculatorTool], 'Trigger an unknown tool.');
  const toolError = await runScenario(toolExceptionScenario, [calculatorTool, unreliableLookupTool], 'Trigger a tool error.');

  return [
    {
      key: 'success',
      label: 'Successful tool call',
      summary: 'The model selects the calculator, the runtime validates and executes it, and the model reports the result.',
      provenance: 'scripted',
      evidence: 'measured live in Experiment 005',
      ...success,
    },
    {
      key: 'schema-failure',
      label: 'Schema failure',
      summary: 'The model calls the calculator with the wrong argument key. Schema validation rejects it before execution — outcome invalid-tool-request.',
      provenance: 'scripted',
      ...schema,
    },
    {
      key: 'semantic-failure',
      label: 'Semantic failure',
      summary: 'Arguments are schema-valid ("2 ** 0.5") but the grammar cannot execute them. Execution fails — outcome tool-error.',
      provenance: 'scripted',
      evidence: 'measured live in Experiment 006',
      ...semantic,
    },
    {
      key: 'unknown-tool',
      label: 'Unknown tool',
      summary: 'The model requests a tool that is not in the registry. The allowlist rejects it — outcome invalid-tool-request.',
      provenance: 'scripted',
      ...unknown,
    },
    {
      key: 'tool-error',
      label: 'Tool error (external)',
      summary: 'A valid, schema-valid call to an external tool whose execution fails (service down). Outcome tool-error.',
      provenance: 'scripted',
      ...toolError,
    },
  ];
}

/** Ground truth for a supported expression, for lesson assertions. */
export function calculatorGroundTruth(expression: string): number | undefined {
  const result = evaluateExpression(expression);
  return result.ok ? (result.value as number) : undefined;
}
