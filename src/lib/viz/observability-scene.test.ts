import { describe, expect, it } from 'vitest';

import { createObservabilityScene, OBSERVABILITY_DEMO_INPUT } from './observability-scene';

describe('createObservabilityScene', () => {
  const input = OBSERVABILITY_DEMO_INPUT;
  // root + 5 child spans → 5 + 2 = 7 steps (intro, one per child, metrics).
  const totalSteps = 7;

  it('step 0 opens the root span with nothing measured yet', () => {
    const scene = createObservabilityScene(input, 0);
    expect(scene.step).toBe(0);
    expect(scene.totalSteps).toBe(totalSteps);
    expect(scene.runningTokens).toBe(0);
    expect(scene.runningCostUsd).toBe(0);
    expect(scene.metricsRevealed).toBe(false);
    const root = scene.rows.find((r) => r.depth === 0)!;
    expect(root.state).toBe('active');
    // No child span is revealed yet.
    expect(scene.rows.filter((r) => r.depth > 0).every((r) => r.state === 'inactive')).toBe(true);
  });

  it('reveals the model-call span with real per-step tokens and cost', () => {
    const scene = createObservabilityScene(input, 1);
    const plan = scene.rows.find((r) => r.name === 'model-call: plan')!;
    expect(plan.state).toBe('active');
    expect(plan.tokens).toBe(1180);
    expect(plan.costUsd).toBeCloseTo(0.0042, 10);
    expect(scene.runningTokens).toBe(1180);
    expect(scene.runningDurationMs).toBe(520);
  });

  it('marks the slow tool call as errored when it is revealed', () => {
    const scene = createObservabilityScene(input, 2);
    const search = scene.rows.find((r) => r.name === 'tool-call: web_search')!;
    expect(search.state).toBe('active');
    expect(search.hasError).toBe(true);
    expect(search.durationMs).toBe(2500);
    // It has not been named "slowest" yet — that highlight lands with the metrics step.
    expect(search.isSlowest).toBe(false);
    expect(scene.title).toMatch(/timed out/i);
  });

  it('accumulates totals up to the compose step', () => {
    const scene = createObservabilityScene(input, 4);
    expect(scene.runningTokens).toBe(2700);
    expect(scene.runningCostUsd).toBeCloseTo(0.0133, 10);
    expect(scene.runningDurationMs).toBe(4610);
  });

  it('final step resolves the metrics and highlights the slow, errored span', () => {
    const scene = createObservabilityScene(input, totalSteps - 1);
    expect(scene.metricsRevealed).toBe(true);
    expect(scene.metrics.totalDurationMs).toBe(4660);
    expect(scene.metrics.totalTokens).toBe(2700);
    expect(scene.metrics.totalCostUsd).toBeCloseTo(0.0133, 10);
    expect(scene.metrics.errorRatePercent).toBe(16.7);
    expect(scene.metrics.retryCount).toBe(1);
    expect(scene.metrics.slowestName).toBe('tool-call: web_search');
    expect(scene.metrics.slowestSelfMs).toBe(2500);

    const search = scene.rows.find((r) => r.name === 'tool-call: web_search')!;
    expect(search.isSlowest).toBe(true);
    expect(search.hasError).toBe(true);
    // Every span is completed on the final step.
    expect(scene.rows.every((r) => r.state === 'completed')).toBe(true);
  });

  it('gives each span timeline geometry that sums the run', () => {
    const scene = createObservabilityScene(input, totalSteps - 1);
    const root = scene.rows.find((r) => r.depth === 0)!;
    expect(root.offsetPercent).toBe(0);
    expect(root.widthPercent).toBe(100);
    const search = scene.rows.find((r) => r.name === 'tool-call: web_search')!;
    // web_search starts at 520/4660 and runs 2500/4660 of the timeline.
    expect(search.offsetPercent).toBeCloseTo(11.2, 1);
    expect(search.widthPercent).toBeCloseTo(53.6, 1);
  });

  it('clamps out-of-range steps', () => {
    expect(createObservabilityScene(input, 99).step).toBe(totalSteps - 1);
    expect(createObservabilityScene(input, -5).step).toBe(0);
  });
});
