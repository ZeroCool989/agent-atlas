/**
 * The agent runtime's contract (ADR-0005: plain TypeScript, written to be read — this
 * is the L3 build project and the flagship lesson's implementation). The runtime owns
 * everything the MODEL must not: state, validation, execution, limits, outcomes.
 *
 * Boundary (continues docs/MODEL_PROVIDER.md): the model SELECTS a tool; the runtime
 * VALIDATES and EXECUTES it. Model stop reasons ('tool-call', 'completed') describe
 * why one model call ended; runtime outcomes describe how the whole RUN ended — and
 * neither proves the user's real-world goal was achieved (that's evaluation, a later
 * concept).
 */
import type { JsonObject, JsonValue, Message, ModelUsage, StopReason, ToolDefinition } from '../model';

// --- Tools -------------------------------------------------------------------------------

export type ToolExecutionResult =
  | { ok: true; value: JsonValue }
  | { ok: false; error: string };

/**
 * A tool the runtime may execute on the model's request. `parseArgs` is the validation
 * gate (typed, strict — unknown keys rejected); `execute` only ever receives arguments
 * that passed it. Tools are deterministic functions over their arguments — never
 * arbitrary code, shell access, or network calls.
 */
export interface AgentTool<Args = unknown> {
  definition: ToolDefinition;
  parseArgs(args: JsonObject): { ok: true; value: Args } | { ok: false; error: string };
  execute(args: Args): ToolExecutionResult;
}

// --- Runtime outcomes -----------------------------------------------------------------------

/**
 * How a RUN ended — deliberately separate from model stop reasons. `completed` means
 * the loop ended with a plain model answer, not that the answer is correct or the
 * user's goal achieved. ('escalation-required' is a documented future outcome for
 * human-approval gates — not implemented until a lesson needs it.)
 */
export type RunOutcome =
  | 'completed'
  | 'max-steps-reached'
  | 'tool-error'
  | 'model-error'
  | 'invalid-tool-request';

// --- Trace ------------------------------------------------------------------------------------

/** Who determined this step — the load-bearing teaching dimension of the whole lesson. */
export type DecidedBy = 'developer' | 'model' | 'runtime';

export type TraceEventType =
  | 'run-started'
  | 'fixed-step' // deterministic/model-assisted workflows: a developer-defined step ran
  | 'branch-selected' // model-assisted workflow: the model picked a predefined branch
  | 'model-requested'
  | 'model-responded'
  | 'tool-selected'
  | 'tool-validated'
  | 'tool-rejected'
  | 'tool-executed'
  | 'observation-appended'
  | 'run-completed'
  | 'run-stopped-limit'
  | 'run-failed';

/**
 * One observable runtime event. Only observable system behavior — never hidden
 * chain-of-thought, never fabricated reasoning. `detail` is the concise teaching
 * explanation rendered by the lesson's visualization.
 */
export interface TraceEvent {
  /** Model-call number this event belongs to (0 = before the first model call). */
  step: number;
  type: TraceEventType;
  decidedBy: DecidedBy;
  toolName?: string;
  toolCallId?: string;
  stopReason?: StopReason;
  outcome?: RunOutcome;
  /** Declared/reported metadata only — absent when the provider reports none. */
  usage?: ModelUsage;
  detail: string;
}

// --- Run API ------------------------------------------------------------------------------------

export interface AgentRunOptions {
  system?: string;
  /** The user's goal — the initial user message. */
  goal: string;
  /** Hard ceiling on model calls; the defense against infinite loops. */
  maxSteps?: number;
}

export interface AgentRunResult {
  outcome: RunOutcome;
  /** The final assistant text, when the run completed with one. */
  finalText?: string;
  /** Full conversation state at the end of the run. */
  messages: Message[];
  trace: TraceEvent[];
  /** Model calls actually made. */
  modelCalls: number;
}
