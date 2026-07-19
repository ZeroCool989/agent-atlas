/**
 * The `(input, step) => Scene` function for the Planning lesson (ADR-0004, plan §8). Pure and
 * deterministic: it replays the trace of the plan-then-execute build project
 * (`src/lib/planning/`) one event at a time — plan produced → steps execute → a step fails →
 * re-plan → recover → done — then a final CONTRAST beat showing the same task run greedily,
 * with no plan to revise, drifting instead of recovering. Every status and line of text comes
 * from the harness, so the picture can never disagree with the mechanism it teaches.
 */
import {
  planAndExecute,
  type ExecutionEvent,
  type PlanExecuteOutcome,
  type PlanStep,
  type Planner,
  type StepExecutor,
} from '../planning/plan-execute';
import { DEMO_GOAL, GREEDY_BASELINE, demoExecutor, demoPlanner, type GreedyBeat } from '../planning/demo';
import { clampStep } from './timeline';

export interface PlanningSceneInput {
  readonly goal: string;
  readonly planner: Planner;
  readonly executor: StepExecutor;
  readonly greedy: readonly GreedyBeat[];
}

export const PLANNING_DEMO_INPUT: PlanningSceneInput = {
  goal: DEMO_GOAL,
  planner: demoPlanner,
  executor: demoExecutor,
  greedy: GREEDY_BASELINE,
};

export type PlanningSceneKind = ExecutionEvent['kind'] | 'contrast';

export interface PlanningScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  /** Teaching text; doubles as the accessible scene description. */
  readonly description: string;
  readonly kind: PlanningSceneKind;
  /** Snapshot of the plan (each step's status) at this moment. */
  readonly plan: readonly PlanStep[];
  /** The greedy contrast, present only on the final contrast beat. */
  readonly greedy?: readonly GreedyBeat[];
  /** The overall outcome, present on the contrast beat. */
  readonly outcome?: PlanExecuteOutcome;
}

const TITLES: Record<ExecutionEvent['kind'], string> = {
  planned: 'A whole plan, before acting',
  'step-started': 'Executing the next step',
  'step-done': 'Step succeeded',
  'step-failed': 'A step fails',
  replanned: 'Re-planning around the failure',
  finished: 'Goal reached',
};

export function createPlanningScene(input: PlanningSceneInput, step: number): PlanningScene {
  const run = planAndExecute(input.goal, input.planner, input.executor);
  const events = run.events;
  // One frame per trace event, plus a final contrast beat.
  const totalSteps = events.length + 1;
  const current = clampStep(step, totalSteps);

  if (current < events.length) {
    const event = events[current]!;
    return {
      step: current,
      totalSteps,
      kind: event.kind,
      title: TITLES[event.kind],
      description: event.detail,
      plan: event.plan,
    };
  }

  return {
    step: current,
    totalSteps,
    kind: 'contrast',
    title: 'The same task, greedily — no plan to revise',
    description:
      'A step-at-a-time agent has no plan object to edit, so when 9:00 is blocked it keeps ' +
      'proposing 9:00. Planning is what lets the system change course instead of drifting.',
    plan: run.finalPlan,
    greedy: input.greedy,
    outcome: run.outcome,
  };
}
