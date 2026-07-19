/**
 * A concrete, deterministic plan-then-execute scenario used by the lesson's visual and its
 * tests. The task is intentionally mundane so the *mechanism* is what stands out: a plan is
 * made up front, one step fails, and the planner routes around it instead of giving up.
 *
 * Nothing here calls a model — the `Planner` is a fixed decomposition and the `StepExecutor`
 * is a scripted world in which one specific action fails. That is what makes the demo
 * replayable and the point falsifiable: swap in a model planner and the harness is unchanged.
 */
import type { Planner, PlanStep, StepExecutor } from './plan-execute';

export const DEMO_GOAL = 'Book a room for the team stand-up at 9:00.';

/**
 * The scripted planner. The first plan assumes a 9:00 slot is free. On the failure of the
 * availability check it re-plans the remainder: find the next free slot, then book that —
 * exactly what a person does when the obvious plan hits a wall.
 */
export const demoPlanner: Planner = ({ failure }) => {
  if (!failure) {
    return [
      { id: 'team-size', description: 'Look up how many people are on the team', tool: 'get_team_size' },
      { id: 'find-rooms', description: 'Find rooms big enough for the team', tool: 'find_rooms' },
      { id: 'check-9', description: 'Check whether a suitable room is free at 9:00', tool: 'check_availability' },
      { id: 'book-9', description: 'Book the room for 9:00', tool: 'book_room' },
    ];
  }
  // Re-plan: the 9:00 slot was not available. Stop insisting on 9:00; find the next opening.
  return [
    { id: 'next-slot', description: 'Find the next time a suitable room is free', tool: 'find_next_slot' },
    { id: 'book-next', description: 'Book the room for that slot and notify the team', tool: 'book_room' },
  ];
};

/** A scripted world: everything succeeds except the 9:00 availability check. */
export const demoExecutor: StepExecutor = (step: PlanStep) => {
  switch (step.tool) {
    case 'get_team_size':
      return { ok: true, result: '6 people' };
    case 'find_rooms':
      return { ok: true, result: 'Rooms “Birch” and “Cedar” each seat 8' };
    case 'check_availability':
      return { ok: false, result: 'No suitable room is free at 9:00 (both booked)' };
    case 'find_next_slot':
      return { ok: true, result: 'Next opening: “Cedar” at 9:30' };
    case 'book_room':
      return { ok: true, result: 'Booked “Cedar” at 9:30; team notified' };
    default:
      return { ok: false, result: `Unknown tool: ${step.tool}` };
  }
};

/**
 * A greedy, planless baseline over the SAME world, for the lesson's contrast beat: a plain
 * step-at-a-time agent that fixates on the original 9:00 goal. It succeeds at the first two
 * actions, hits the 9:00 wall, and — with no plan to revise — has nothing better to do than
 * keep asking about 9:00. This is the drift planning is meant to prevent; it is a fixed
 * script (not a run of the harness) precisely because a greedy loop has no plan object.
 */
export interface GreedyBeat {
  readonly action: string;
  readonly result: string;
  readonly stuck: boolean;
}

export const GREEDY_BASELINE: readonly GreedyBeat[] = [
  { action: 'check team size', result: '6 people', stuck: false },
  { action: 'find a room for 9:00', result: '“Cedar” seats 8', stuck: false },
  { action: 'book “Cedar” for 9:00', result: 'Rejected — already booked at 9:00', stuck: true },
  { action: 'book “Cedar” for 9:00 (retry)', result: 'Rejected again — no memory that 9:00 is the problem', stuck: true },
];
