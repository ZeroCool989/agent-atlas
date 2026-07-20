import { describe, expect, it } from 'vitest';

import { COST_DEMO_STEPS } from '../cost';
import { createCostScene } from './cost-scene';

describe('createCostScene', () => {
  it('step 0 is the baseline: five turns, all on the frontier model, nothing dropped', () => {
    const scene = createCostScene(COST_DEMO_STEPS, 0);
    expect(scene.isBaseline).toBe(true);
    expect(scene.rows).toHaveLength(5);
    expect(scene.rows.every((r) => !r.dropped)).toBe(true);
    expect(scene.rows.every((r) => !r.onSmallModel)).toBe(true);
    expect(scene.cumulativeSavingsPercent).toBe(0);
    expect(scene.costPercentOfBaseline).toBe(100);
  });

  it('clamps out-of-range steps to a valid, complete scene', () => {
    expect(createCostScene(COST_DEMO_STEPS, -5).step).toBe(0);
    expect(createCostScene(COST_DEMO_STEPS, 999).step).toBe(COST_DEMO_STEPS.length - 1);
    expect(createCostScene(COST_DEMO_STEPS, Number.NaN).step).toBe(0);
  });

  it('the routing step moves the easy turns to the small model', () => {
    const routeIndex = COST_DEMO_STEPS.findIndex((s) => s.id === 'route');
    const scene = createCostScene(COST_DEMO_STEPS, routeIndex);
    expect(scene.rows.some((r) => r.onSmallModel)).toBe(true);
    // At least one load-bearing turn stays on the frontier model.
    expect(scene.rows.some((r) => !r.onSmallModel && !r.dropped)).toBe(true);
  });

  it('running cost drops and cumulative saving grows across steps', () => {
    let prev = Infinity;
    for (let i = 0; i < COST_DEMO_STEPS.length; i++) {
      const scene = createCostScene(COST_DEMO_STEPS, i);
      expect(scene.perRequestCostUsd).toBeLessThanOrEqual(prev);
      prev = scene.perRequestCostUsd;
    }
    expect(createCostScene(COST_DEMO_STEPS, COST_DEMO_STEPS.length - 1).cumulativeSavingsPercent).toBeGreaterThan(60);
  });

  it('the final (cap) step marks the dropped turns and ends over half cheaper', () => {
    const scene = createCostScene(COST_DEMO_STEPS, COST_DEMO_STEPS.length - 1);
    expect(scene.isFinal).toBe(true);
    expect(scene.rows.some((r) => r.dropped)).toBe(true);
    expect(scene.rows.filter((r) => r.dropped).every((r) => r.costUsd === 0)).toBe(true);
    expect(scene.costPercentOfBaseline).toBeLessThan(40);
  });

  it('projects an illustrative monthly bill from the per-request cost', () => {
    const base = createCostScene(COST_DEMO_STEPS, 0);
    const last = createCostScene(COST_DEMO_STEPS, COST_DEMO_STEPS.length - 1);
    expect(base.monthlyCostUsd).toBeGreaterThan(last.monthlyCostUsd);
    expect(base.monthlyBaselineCostUsd).toBe(base.monthlyCostUsd);
  });
});
