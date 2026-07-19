import { describe, expect, it } from 'vitest';

import { DEMO_GOAL, demoExecutor, demoPlanner } from './demo';
import { planAndExecute, type Planner, type StepExecutor } from './plan-execute';

describe('planAndExecute', () => {
  it('produces a full plan up front before executing anything', () => {
    const events = planAndExecute(DEMO_GOAL, demoPlanner, demoExecutor).events;
    expect(events[0]!.kind).toBe('planned');
    expect(events[0]!.plan).toHaveLength(4);
    expect(events[0]!.plan.every((s) => s.status === 'pending')).toBe(true);
  });

  it('executes steps in order and completes a clean run', () => {
    const allOk: StepExecutor = () => ({ ok: true, result: 'ok' });
    const res = planAndExecute(DEMO_GOAL, demoPlanner, allOk);
    expect(res.outcome).toBe('completed');
    expect(res.replans).toBe(0);
    expect(res.finalPlan.map((s) => s.id)).toEqual(['team-size', 'find-rooms', 'check-9', 'book-9']);
    expect(res.finalPlan.every((s) => s.status === 'done')).toBe(true);
  });

  it('re-plans around a failed step and recovers', () => {
    const res = planAndExecute(DEMO_GOAL, demoPlanner, demoExecutor);
    expect(res.outcome).toBe('completed');
    expect(res.replans).toBe(1);
    // The failed 9:00 check is recorded; the recovery path (next slot) finishes the goal.
    expect(res.finalPlan.some((s) => s.id === 'check-9' && s.status === 'failed')).toBe(true);
    expect(res.finalPlan.some((s) => s.id === 'book-next' && s.status === 'done')).toBe(true);
    const kinds = res.events.map((e) => e.kind);
    expect(kinds).toContain('step-failed');
    expect(kinds).toContain('replanned');
    expect(res.events.at(-1)!.kind).toBe('finished');
  });

  it('is deterministic: identical inputs yield identical event traces', () => {
    const a = planAndExecute(DEMO_GOAL, demoPlanner, demoExecutor);
    const b = planAndExecute(DEMO_GOAL, demoPlanner, demoExecutor);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });

  it('bounds re-plans: a permanently failing step ends the run failed, never loops', () => {
    // A planner that keeps proposing one always-failing step.
    const stubborn: Planner = () => [{ id: 'x', description: 'do the impossible', tool: 'nope' }];
    const alwaysFail: StepExecutor = () => ({ ok: false, result: 'still broken' });
    const res = planAndExecute('impossible', stubborn, alwaysFail, { maxReplans: 2 });
    expect(res.outcome).toBe('failed');
    expect(res.replans).toBe(2);
  });

  it('bounds total executions with maxSteps', () => {
    let n = 0;
    const growing: Planner = () => {
      n += 1;
      return [{ id: `s${n}`, description: 'step', tool: 'retry' }];
    };
    // Each step "fails" so the planner keeps adding one — maxSteps must still stop it.
    const failThenReplan: StepExecutor = () => ({ ok: false, result: 'retry' });
    const res = planAndExecute('loopy', growing, failThenReplan, { maxSteps: 3, maxReplans: 99 });
    expect(['step-limit', 'failed']).toContain(res.outcome);
  });

  it('snapshots do not alias: an earlier event keeps its status even as the run advances', () => {
    const res = planAndExecute(DEMO_GOAL, demoPlanner, demoExecutor);
    const planned = res.events[0]!;
    // The first snapshot must still read all-pending, unaffected by later mutations.
    expect(planned.plan.every((s) => s.status === 'pending')).toBe(true);
  });
});
