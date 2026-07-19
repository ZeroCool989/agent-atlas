/**
 * Plan-then-execute — the smallest honest version of "agent planning" (plan §3 L3,
 * ADR-0005). A plain tool-using agent (see `src/lib/agent/runner.ts`) decides ONE step at
 * a time. Planning adds a phase before acting: produce a whole multi-step plan up front,
 * then execute the steps in order — and, when a step fails, *re-plan* the remainder.
 *
 * This module is deterministic on purpose. A real system's planner is a model call; here
 * the `Planner` is an injected pure function (a fixture or a decomposition rule), so the
 * mechanism — plan → execute → observe failure → re-plan → recover — can be read and
 * unit-tested without a model. Swap the planner for a model call and the shape is identical;
 * that substitution is the whole point (ADR-0005: understand the loop, don't hide it).
 *
 * A plan step is an INTENDED action: conceptually a `ToolCall` the executor will carry out
 * (the same model=decides / runtime=executes split the tool-calling concept establishes).
 * We keep a self-contained `PlanStep` type rather than importing the model layer, because
 * planning is about the *ordering* of actions, not the wire format of any one call.
 */

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** One intended action in a plan. `tool` names the capability the executor will invoke. */
export interface PlanStep {
  readonly id: string;
  readonly description: string;
  readonly tool: string;
  status: StepStatus;
  result?: string;
}

/** A planner turns a goal into ordered steps. On a re-plan it also sees what failed and
 * the steps already completed, so it can route around the failure instead of repeating it. */
export type Planner = (input: {
  goal: string;
  failure?: { step: PlanStep; reason: string };
  completed: readonly PlanStep[];
}) => Array<Pick<PlanStep, 'id' | 'description' | 'tool'>>;

/** Executes one step. Returns `ok:false` to signal a recoverable failure (which triggers a
 * re-plan) — it never throws for expected failure, mirroring the runtime-owns-outcomes rule. */
export type StepExecutor = (step: PlanStep) => { ok: boolean; result: string };

export type ExecutionEventKind =
  | 'planned'
  | 'step-started'
  | 'step-done'
  | 'step-failed'
  | 'replanned'
  | 'finished';

/** An event in the run. `plan` is a snapshot of every step's status AT THIS MOMENT, so a
 * viewer can render the plan filling in over time without recomputing anything. */
export interface ExecutionEvent {
  readonly kind: ExecutionEventKind;
  readonly detail: string;
  readonly plan: readonly PlanStep[];
}

export type PlanExecuteOutcome = 'completed' | 'failed' | 'step-limit';

export interface PlanExecuteResult {
  readonly outcome: PlanExecuteOutcome;
  readonly events: readonly ExecutionEvent[];
  readonly finalPlan: readonly PlanStep[];
  /** How many times the remainder of the plan was regenerated after a failure. */
  readonly replans: number;
}

export interface PlanExecuteOptions {
  /** Hard cap on total step executions — the defense against a re-plan loop. */
  readonly maxSteps?: number;
  /** Hard cap on re-plans. Exhausting it ends the run `failed`, never hangs. */
  readonly maxReplans?: number;
}

const DEFAULT_MAX_STEPS = 20;
const DEFAULT_MAX_REPLANS = 3;

const snapshot = (steps: readonly PlanStep[]): PlanStep[] => steps.map((s) => ({ ...s }));

function materialize(
  raw: ReturnType<Planner>,
  status: StepStatus = 'pending',
): PlanStep[] {
  return raw.map((s) => ({ ...s, status }));
}

/**
 * Run plan-then-execute with re-planning. Deterministic given deterministic `planner` and
 * `executor`. The returned `events` are the full, replayable trace — nothing happens that
 * isn't in them.
 */
export function planAndExecute(
  goal: string,
  planner: Planner,
  executor: StepExecutor,
  options: PlanExecuteOptions = {},
): PlanExecuteResult {
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxReplans = options.maxReplans ?? DEFAULT_MAX_REPLANS;
  const events: ExecutionEvent[] = [];

  // `history` is every step that reached a terminal state (done OR failed), in execution
  // order — so the failed step that triggered a re-plan stays visible in the trace and the
  // final plan. `completed` is only the *successful* steps, which is what the planner is told
  // it has to build on. A snapshot is `[...history, ...remainder]`, reading top-to-bottom.
  const history: PlanStep[] = [];
  const completed: PlanStep[] = [];
  let remainder = materialize(planner({ goal, completed }));
  events.push({
    kind: 'planned',
    detail: `Plan produced: ${remainder.length} step(s) decided up front, before any action.`,
    plan: snapshot([...history, ...remainder]),
  });

  let executions = 0;
  let replans = 0;

  while (remainder.length > 0) {
    if (executions >= maxSteps) {
      events.push({
        kind: 'finished',
        detail: `Step limit (${maxSteps}) reached — the runtime bounds execution; it never loops forever.`,
        plan: snapshot([...history, ...remainder]),
      });
      return { outcome: 'step-limit', events, finalPlan: snapshot([...history, ...remainder]), replans };
    }

    const step = remainder[0]!;
    step.status = 'running';
    events.push({
      kind: 'step-started',
      detail: `Executing step "${step.id}": ${step.description} (tool: ${step.tool}).`,
      plan: snapshot([...history, ...remainder]),
    });

    const outcome = executor(step);
    executions += 1;

    if (outcome.ok) {
      step.status = 'done';
      step.result = outcome.result;
      history.push(step);
      completed.push(step);
      remainder = remainder.slice(1);
      events.push({
        kind: 'step-done',
        detail: `Step "${step.id}" succeeded: ${outcome.result}`,
        plan: snapshot([...history, ...remainder]),
      });
      continue;
    }

    // Recoverable failure: mark it, then re-plan the REMAINDER around it.
    step.status = 'failed';
    step.result = outcome.result;
    history.push(step);
    remainder = remainder.slice(1);
    events.push({
      kind: 'step-failed',
      detail: `Step "${step.id}" failed: ${outcome.result}. A greedy agent would be stuck here; a planner re-plans.`,
      plan: snapshot([...history, ...remainder]),
    });

    if (replans >= maxReplans) {
      events.push({
        kind: 'finished',
        detail: `Re-plan limit (${maxReplans}) reached — some tasks a plan cannot rescue. The run ends honestly as failed.`,
        plan: snapshot([...history, ...remainder]),
      });
      return { outcome: 'failed', events, finalPlan: snapshot([...history, ...remainder]), replans };
    }

    const failedStep = { ...step };
    const newRaw = planner({ goal, failure: { step: failedStep, reason: outcome.result }, completed });
    remainder = materialize(newRaw);
    replans += 1;
    events.push({
      kind: 'replanned',
      detail: `Re-planned after the failure: ${remainder.length} new step(s) replace the rest of the plan.`,
      plan: snapshot([...history, ...remainder]),
    });
  }

  events.push({
    kind: 'finished',
    detail: `Goal reached in ${completed.length} executed step(s)` + (replans > 0 ? ` and ${replans} re-plan(s).` : '.'),
    plan: snapshot(history),
  });
  return { outcome: 'completed', events, finalPlan: snapshot(history), replans };
}
