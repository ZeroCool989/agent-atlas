/**
 * Multi-agent orchestration — the smallest honest version of "a composition of agents"
 * (plan §3 L4 capstone, ADR-0005). This is the TOP of the autonomy spectrum: not a new
 * capability, but a *composition* of the lower tiers. A single **supervisor** decomposes a
 * goal into subtasks and delegates each to a role-specialized **worker** agent; it collects
 * their results, re-delegates around failures, and composes a final answer.
 *
 * It is deterministic on purpose (ADR-0005: understand the loop, don't hide it). No model is
 * called: the supervisor's decomposition is an injected `Planner` (reused verbatim from the
 * planning concept — a subtask's `tool` field names the specialist ROLE to hand it to), and
 * each worker is a scripted policy. Swap the planner and workers for real model calls and the
 * message-passing shape is identical; that substitution is the whole point.
 *
 * The reuse is load-bearing, not decorative:
 *   - Decomposition and re-planning reuse `Planner`/`PlanStep` from `src/lib/planning/`.
 *   - A delegation is literally a `ToolCall` (the supervisor treats a worker as a callable
 *     tool: toolName = role); a worker's answer is a `ToolResultMessage`. This is the honest
 *     framing of "agents-as-tools": one agent calling another is the same wire shape as one
 *     agent calling a function (`src/lib/model/`).
 *   - The context a worker sees is the accumulated tool results — the same "append the result
 *     to the conversation" rule the agent runtime uses (`src/lib/agent/`).
 *
 * Everything the run does is in the returned `events`: a full, replayable trace the visualizer
 * renders directly, so the picture can never disagree with the mechanism.
 */
import type { ToolCall, ToolResultMessage } from '../model';
import type { PlanStep, Planner } from '../planning/plan-execute';

// --- Agents ------------------------------------------------------------------------------

/**
 * The supervisor decomposes the goal into subtasks. It is exactly the planning `Planner`:
 * goal → ordered steps, and on a failure it re-plans the REMAINDER around it. Here a step's
 * `tool` field is read as the worker ROLE the subtask is delegated to.
 */
export type SupervisorPlanner = Planner;

export interface WorkerOutcome {
  /** `false` signals a recoverable failure — it triggers a re-delegation, never a throw. */
  readonly ok: boolean;
  readonly result: string;
  /** Model calls this worker spent. The honest core: a system multiplies these. */
  readonly modelCalls: number;
}

/**
 * A role-specialized worker: its own role, its own "tools"/context, its own scripted policy.
 * `context` is the results of prior subtasks the supervisor chose to forward — a worker never
 * sees the whole world, only what it is handed (context isolation, the reason to split at all).
 */
export interface Worker {
  readonly role: string;
  readonly specialty: string;
  run(input: { readonly task: string; readonly context: readonly string[] }): WorkerOutcome;
}

/** Composes the final answer from the collected subtask results — an injected pure function. */
export type Composer = (input: {
  readonly goal: string;
  readonly results: readonly { readonly subtaskId: string; readonly role: string; readonly result: string }[];
}) => string;

export interface OrchestrationInput {
  readonly goal: string;
  readonly planner: SupervisorPlanner;
  /** Workers keyed by role — the roster the supervisor can delegate to. */
  readonly workers: Readonly<Record<string, Worker>>;
  readonly compose: Composer;
}

// --- Render-ready views (snapshotted into every event) -----------------------------------

export type AgentState = 'idle' | 'delegating' | 'working' | 'done' | 'failed';

export interface AgentView {
  /** `supervisor` for the coordinator, otherwise the worker's role. */
  readonly id: string;
  readonly label: string;
  readonly kind: 'supervisor' | 'worker';
  readonly specialty?: string;
  readonly state: AgentState;
  /** Cumulative model calls attributed to this agent. */
  readonly modelCalls: number;
}

export type SubtaskState = 'pending' | 'in-progress' | 'done' | 'failed';

export interface SubtaskView {
  readonly id: string;
  readonly description: string;
  /** The role this subtask is assigned to (the supervisor's `tool` choice). */
  readonly role: string;
  readonly state: SubtaskState;
  readonly result?: string;
}

export type MessageKind = 'delegate' | 'result' | 'failure' | 're-delegate' | 'compose';

/** One message flowing across the org chart — the edge the visualizer lights up. */
export interface OrchestrationMessage {
  readonly from: string;
  readonly to: string;
  readonly kind: MessageKind;
  readonly subtaskId?: string;
  readonly summary: string;
}

// --- Trace -------------------------------------------------------------------------------

export type OrchestrationEventKind =
  | 'planned'
  | 'delegated'
  | 'worker-succeeded'
  | 'worker-failed'
  | 're-delegated'
  | 'composed'
  | 'finished';

/**
 * One observable event. `agents` and `subtasks` are complete snapshots AT THIS MOMENT, so a
 * viewer can scrub to any step and render the whole system state without recomputing anything.
 */
export interface OrchestrationEvent {
  readonly kind: OrchestrationEventKind;
  readonly detail: string;
  /** The message that just flowed (absent on plan/finish beats). */
  readonly message?: OrchestrationMessage;
  readonly agents: readonly AgentView[];
  readonly subtasks: readonly SubtaskView[];
  /** Running total of model calls across every agent — the compounding cost. */
  readonly totalModelCalls: number;
}

export type OrchestrationOutcome = 'completed' | 'failed' | 'step-limit';

export interface OrchestrationResult {
  readonly outcome: OrchestrationOutcome;
  readonly events: readonly OrchestrationEvent[];
  readonly finalAnswer?: string;
  readonly subtasks: readonly SubtaskView[];
  readonly totalModelCalls: number;
  /** How many times the supervisor re-delegated after a worker failure. */
  readonly redelegations: number;
}

export interface OrchestrationOptions {
  /** Hard cap on total delegations — the defense against a delegation loop. */
  readonly maxDelegations?: number;
  /** Hard cap on re-delegations. Exhausting it ends the run `failed`, never hangs. */
  readonly maxRedelegations?: number;
  /** Model-call cost charged to the supervisor for each plan / re-plan. */
  readonly plannerModelCalls?: number;
  /** Model-call cost charged to the supervisor for the final composition. */
  readonly composeModelCalls?: number;
}

const DEFAULT_MAX_DELEGATIONS = 20;
const DEFAULT_MAX_REDELEGATIONS = 3;

const SUPERVISOR_ID = 'supervisor';

const STATE_TO_SUBTASK: Record<PlanStep['status'], SubtaskState> = {
  pending: 'pending',
  running: 'in-progress',
  done: 'done',
  failed: 'failed',
  skipped: 'pending',
};

function materialize(raw: ReturnType<Planner>): PlanStep[] {
  return raw.map((s) => ({ ...s, status: 'pending' as const }));
}

/**
 * Run the supervisor/worker orchestration. Deterministic given a deterministic planner and
 * workers. Mirrors plan-then-execute (`src/lib/planning/`) — decompose → execute → observe a
 * failure → re-plan the remainder → recover — but each step is DELEGATED to a specialist and
 * every hand-off is a real message, so the trace shows a *system* coordinating, not one loop.
 */
export function orchestrate(
  input: OrchestrationInput,
  options: OrchestrationOptions = {},
): OrchestrationResult {
  const maxDelegations = options.maxDelegations ?? DEFAULT_MAX_DELEGATIONS;
  const maxRedelegations = options.maxRedelegations ?? DEFAULT_MAX_REDELEGATIONS;
  const plannerCost = options.plannerModelCalls ?? 1;
  const composeCost = options.composeModelCalls ?? 1;

  const events: OrchestrationEvent[] = [];

  // Per-agent bookkeeping. The supervisor plus every worker in the roster exist from the start,
  // so the org chart is stable and the viewer can lay it out once.
  const agentState = new Map<string, AgentState>();
  const agentCalls = new Map<string, number>();
  agentState.set(SUPERVISOR_ID, 'idle');
  agentCalls.set(SUPERVISOR_ID, 0);
  const roster = Object.values(input.workers);
  for (const w of roster) {
    agentState.set(w.role, 'idle');
    agentCalls.set(w.role, 0);
  }

  const charge = (id: string, calls: number) =>
    agentCalls.set(id, (agentCalls.get(id) ?? 0) + calls);
  const totalCalls = () => [...agentCalls.values()].reduce((a, b) => a + b, 0);

  const agentsSnapshot = (): AgentView[] => {
    const supervisor: AgentView = {
      id: SUPERVISOR_ID,
      label: 'Supervisor',
      kind: 'supervisor',
      state: agentState.get(SUPERVISOR_ID)!,
      modelCalls: agentCalls.get(SUPERVISOR_ID)!,
    };
    const workers = roster.map<AgentView>((w) => ({
      id: w.role,
      label: w.role,
      kind: 'worker',
      specialty: w.specialty,
      state: agentState.get(w.role)!,
      modelCalls: agentCalls.get(w.role)!,
    }));
    return [supervisor, ...workers];
  };

  // The subtask board: completed/failed history + the remaining plan, read top-to-bottom.
  const history: PlanStep[] = [];
  const completed: PlanStep[] = [];
  // Forwarded context = the successful results so far (the "conversation" workers inherit).
  const collected: { subtaskId: string; role: string; result: string }[] = [];
  // A worker's failure feedback (e.g. the critic's rejection) the supervisor forwards to the
  // NEXT worker so it can act on it, then clears once acted upon. This is how a critique reaches
  // the reviser — the debate/critic loop closing over the pipeline.
  let feedback: string[] = [];

  const boardSnapshot = (remainder: readonly PlanStep[]): SubtaskView[] =>
    [...history, ...remainder].map((s) => ({
      id: s.id,
      description: s.description,
      role: s.tool,
      state: STATE_TO_SUBTASK[s.status],
      ...(s.result ? { result: s.result } : {}),
    }));

  const emit = (
    kind: OrchestrationEventKind,
    detail: string,
    remainder: readonly PlanStep[],
    message?: OrchestrationMessage,
  ) => {
    events.push({
      kind,
      detail,
      ...(message ? { message } : {}),
      agents: agentsSnapshot(),
      subtasks: boardSnapshot(remainder),
      totalModelCalls: totalCalls(),
    });
  };

  // 1. The supervisor decomposes the goal (its first model call).
  charge(SUPERVISOR_ID, plannerCost);
  let remainder = materialize(input.planner({ goal: input.goal, completed }));
  emit(
    'planned',
    `The supervisor decomposes the goal into ${remainder.length} subtask(s) and assigns each to a specialist role. Splitting is only worth it if the parts are genuinely different work.`,
    remainder,
  );

  let delegations = 0;
  let redelegations = 0;
  let delegationSeq = 0;

  while (remainder.length > 0) {
    if (delegations >= maxDelegations) {
      agentState.set(SUPERVISOR_ID, 'failed');
      emit(
        'finished',
        `Delegation limit (${maxDelegations}) reached — the orchestrator bounds the system; it never loops forever. Unbounded delegation is a real multi-agent failure mode.`,
        remainder,
      );
      return {
        outcome: 'step-limit',
        events,
        subtasks: boardSnapshot(remainder),
        totalModelCalls: totalCalls(),
        redelegations,
      };
    }

    const step = remainder[0]!;
    const worker = input.workers[step.tool];

    // The context this worker inherits: prior successful results plus any pending feedback.
    const context = [...collected.map((c) => c.result), ...feedback];

    // Delegate: a ToolCall whose "tool" is the specialist role (agents-as-tools).
    const call: ToolCall = {
      id: `d${(delegationSeq += 1)}`,
      toolName: step.tool,
      arguments: { task: step.description, context },
    };
    step.status = 'running';
    agentState.set(SUPERVISOR_ID, 'delegating');
    if (worker) agentState.set(step.tool, 'working');
    emit(
      'delegated',
      `The supervisor hands "${step.id}" to the ${step.tool}: ${step.description}. It forwards ${context.length} message(s) as context — the ${step.tool} sees only what it needs.`,
      remainder,
      { from: SUPERVISOR_ID, to: step.tool, kind: 'delegate', subtaskId: step.id, summary: step.description },
    );

    // A subtask assigned to a role with no worker is a routing failure — treated as recoverable.
    const outcome: WorkerOutcome = worker
      ? worker.run({ task: step.description, context })
      : { ok: false, result: `No worker is registered for role "${step.tool}".`, modelCalls: 0 };
    delegations += 1;
    if (worker) charge(step.tool, outcome.modelCalls);

    // The worker's answer, as a ToolResultMessage handed back to the supervisor.
    const resultMessage: ToolResultMessage = {
      role: 'tool',
      toolCallId: call.id,
      toolName: step.tool,
      result: outcome.result,
      isError: !outcome.ok,
    };

    if (outcome.ok) {
      step.status = 'done';
      step.result = outcome.result;
      history.push(step);
      completed.push(step);
      collected.push({ subtaskId: step.id, role: step.tool, result: outcome.result });
      feedback = []; // the forwarded feedback (if any) has now been acted upon
      remainder = remainder.slice(1);
      if (worker) agentState.set(step.tool, 'done');
      agentState.set(SUPERVISOR_ID, 'idle');
      emit(
        'worker-succeeded',
        `The ${step.tool} returns: ${outcome.result}`,
        remainder,
        { from: step.tool, to: SUPERVISOR_ID, kind: 'result', subtaskId: step.id, summary: String(resultMessage.result) },
      );
      continue;
    }

    // Recoverable failure: mark it, surface it as a message, then let the supervisor re-delegate.
    step.status = 'failed';
    step.result = outcome.result;
    history.push(step);
    feedback.push(outcome.result); // forward the critique/error to whoever the supervisor tries next
    remainder = remainder.slice(1);
    if (worker) agentState.set(step.tool, 'failed');
    emit(
      'worker-failed',
      `The ${step.tool} reports a failure on "${step.id}": ${outcome.result}. A single agent would carry this error forward; a supervisor can route around it — if it notices.`,
      remainder,
      { from: step.tool, to: SUPERVISOR_ID, kind: 'failure', subtaskId: step.id, summary: outcome.result },
    );

    if (redelegations >= maxRedelegations) {
      agentState.set(SUPERVISOR_ID, 'failed');
      emit(
        'finished',
        `Re-delegation limit (${maxRedelegations}) reached — some failures no orchestrator can rescue. The run ends honestly as failed rather than looping.`,
        remainder,
      );
      return {
        outcome: 'failed',
        events,
        subtasks: boardSnapshot(remainder),
        totalModelCalls: totalCalls(),
        redelegations,
      };
    }

    // Re-plan the remainder around the failure — the supervisor's second decision (another call).
    charge(SUPERVISOR_ID, plannerCost);
    const failedStep = { ...step };
    remainder = materialize(
      input.planner({ goal: input.goal, failure: { step: failedStep, reason: outcome.result }, completed }),
    );
    redelegations += 1;
    agentState.set(SUPERVISOR_ID, 'delegating');
    emit(
      're-delegated',
      `The supervisor re-plans: ${remainder.length} new subtask(s) replace the rest, routing the work to recover from the failure. Each re-plan is another model call — coordination is not free.`,
      remainder,
      { from: SUPERVISOR_ID, to: SUPERVISOR_ID, kind: 're-delegate', summary: `re-plan (${remainder.length} new subtask(s))` },
    );
  }

  // 2. Compose the final answer from every collected result (the supervisor's last call).
  charge(SUPERVISOR_ID, composeCost);
  agentState.set(SUPERVISOR_ID, 'done');
  const finalAnswer = input.compose({ goal: input.goal, results: collected });
  emit(
    'composed',
    `The supervisor composes the final answer from ${collected.length} worker result(s). Composition is its own step — stitching partial answers together is where multi-agent systems quietly go wrong.`,
    [],
    { from: SUPERVISOR_ID, to: 'output', kind: 'compose', summary: finalAnswer },
  );

  emit(
    'finished',
    `Done in ${delegations} delegation(s)` +
      (redelegations > 0 ? ` and ${redelegations} re-delegation(s)` : '') +
      `, ${totalCalls()} model call(s) total — a single agent would have made far fewer. Count the calls before you reach for a system.`,
    [],
  );

  return {
    outcome: 'completed',
    events,
    finalAnswer,
    subtasks: boardSnapshot([]),
    totalModelCalls: totalCalls(),
    redelegations,
  };
}
