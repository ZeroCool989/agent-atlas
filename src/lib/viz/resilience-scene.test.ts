import { describe, expect, it } from 'vitest';

import { runAllScenarios } from '../resilience/demo';
import { buildResilienceScenes } from './resilience-scene';

describe('buildResilienceScenes', () => {
  it('flattens all three scenarios into one contiguous, correctly-numbered walkthrough', async () => {
    const scenes = buildResilienceScenes(await runAllScenarios());
    expect(scenes.length).toBeGreaterThan(0);
    // step is 0-based and contiguous; every beat agrees on totalSteps.
    scenes.forEach((s, i) => {
      expect(s.step).toBe(i);
      expect(s.totalSteps).toBe(scenes.length);
    });
    // Three scenarios, in teaching order.
    const order = [...new Set(scenes.map((s) => s.scenarioId))];
    expect(order).toEqual(['retry', 'timeout-fallback', 'circuit']);
    expect(scenes.every((s) => s.scenarioCount === 3)).toBe(true);
  });

  it('opens on the retry scenario’s first attempt (the SSR first frame)', async () => {
    const scenes = buildResilienceScenes(await runAllScenarios());
    const first = scenes[0]!;
    expect(first.scenarioId).toBe('retry');
    expect(first.isScenarioStart).toBe(true);
    expect(first.event.kind).toBe('call');
    expect(first.elapsedMs).toBe(0);
  });

  it('shows real backoff numbers from the module — jittered delay never exceeds the ceiling', async () => {
    const scenes = buildResilienceScenes(await runAllScenarios());
    const backoffs = scenes.filter((s) => s.event.kind === 'backoff');
    expect(backoffs.length).toBe(2); // two waits before the winning third attempt
    for (const b of backoffs) {
      if (b.event.kind !== 'backoff') continue;
      expect(b.event.delayMs).toBeLessThanOrEqual(b.event.ceilingMs);
      expect(b.description).toContain(`${b.event.delayMs}ms`);
      expect(b.description).toContain(`${b.event.ceilingMs}ms`);
    }
    // Ceilings double: 200 → 400.
    const ceilings = backoffs.map((b) => (b.event.kind === 'backoff' ? b.event.ceilingMs : 0));
    expect(ceilings).toEqual([200, 400]);
  });

  it('names the repair-prompt retry — the honest LLM twist', async () => {
    const scenes = buildResilienceScenes(await runAllScenarios());
    const repairBeat = scenes.find(
      (s) => s.scenarioId === 'retry' && s.event.kind === 'call' && s.attempt === 3,
    );
    expect(repairBeat?.description).toMatch(/repair prompt/i);
  });

  it('walks timeout → fallback with the real deadline and degraded answer', async () => {
    const scenes = buildResilienceScenes(await runAllScenarios());
    const tf = scenes.filter((s) => s.scenarioId === 'timeout-fallback');
    const timeout = tf.find((s) => s.event.kind === 'timeout');
    expect(timeout?.elapsedMs).toBe(2000);
    const fallbackSuccess = tf.find((s) => s.event.kind === 'success');
    expect(fallbackSuccess?.elapsedMs).toBe(2300);
    expect(fallbackSuccess?.tone).toBe('warn'); // degraded, not celebrated as "ok"
    expect(fallbackSuccess?.description).toMatch(/lower quality|silently/i);
  });

  it('walks the circuit breaker through closed → open → fast-fail → half-open → closed', async () => {
    const scenes = buildResilienceScenes(await runAllScenarios());
    const circuit = scenes.filter((s) => s.scenarioId === 'circuit');
    const states = circuit
      .filter((s) => s.event.kind === 'circuit-transition')
      .map((s) => (s.event.kind === 'circuit-transition' ? s.event.to : ''));
    expect(states).toEqual(['open', 'half-open', 'closed']);
    // At least one call was fast-failed while open, without touching the dependency.
    expect(circuit.some((s) => s.event.kind === 'circuit-rejected')).toBe(true);
    // The breaker opened after exactly 3 consecutive failures.
    const failuresBeforeOpen = circuit.filter(
      (s) => s.event.kind === 'failure' && s.elapsedMs === 0,
    );
    expect(failuresBeforeOpen).toHaveLength(3);
  });

  it('marks each scenario’s final beat with its outcome and honest takeaway', async () => {
    const scenes = buildResilienceScenes(await runAllScenarios());
    const ends = scenes.filter((s) => s.isScenarioEnd);
    expect(ends).toHaveLength(3);
    expect(ends.map((s) => s.outcomeKind)).toEqual(['recovered', 'degraded', 'protected']);
    expect(ends.every((s) => (s.takeaway?.length ?? 0) > 0)).toBe(true);
  });

  it('is deterministic — identical builds produce identical scenes', async () => {
    const a = buildResilienceScenes(await runAllScenarios());
    const b = buildResilienceScenes(await runAllScenarios());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
