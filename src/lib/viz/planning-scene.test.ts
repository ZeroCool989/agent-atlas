import { describe, expect, it } from 'vitest';

import { PLANNING_DEMO_INPUT, createPlanningScene } from './planning-scene';

describe('createPlanningScene', () => {
  it('opens with the full plan, all steps pending, before any action', () => {
    const s = createPlanningScene(PLANNING_DEMO_INPUT, 0);
    expect(s.kind).toBe('planned');
    expect(s.plan.length).toBe(4);
    expect(s.plan.every((p) => p.status === 'pending')).toBe(true);
  });

  it('walks through a failure and a re-plan on the way to the goal', () => {
    const kinds: string[] = [];
    const total = createPlanningScene(PLANNING_DEMO_INPUT, 0).totalSteps;
    for (let i = 0; i < total; i += 1) kinds.push(createPlanningScene(PLANNING_DEMO_INPUT, i).kind);
    expect(kinds).toContain('step-failed');
    expect(kinds).toContain('replanned');
    expect(kinds).toContain('finished');
    expect(kinds.at(-1)).toBe('contrast');
  });

  it('the final beat contrasts with a greedy, planless run', () => {
    const total = createPlanningScene(PLANNING_DEMO_INPUT, 0).totalSteps;
    const last = createPlanningScene(PLANNING_DEMO_INPUT, total - 1);
    expect(last.kind).toBe('contrast');
    expect(last.greedy && last.greedy.length).toBeGreaterThan(0);
    expect(last.greedy!.some((b) => b.stuck)).toBe(true);
    expect(last.outcome).toBe('completed'); // planning path completed; greedy did not
  });

  it('clamps out-of-range steps and stays deterministic', () => {
    const a = createPlanningScene(PLANNING_DEMO_INPUT, 999);
    const b = createPlanningScene(PLANNING_DEMO_INPUT, 999);
    expect(a.kind).toBe('contrast');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
