import { describe, expect, it } from 'vitest';

import { buildComparison, runDeterministicWorkflow } from '../../src/lib/agent';
import { createTraceScene } from '../../src/lib/viz';

const { trace } = runDeterministicWorkflow('What is 127 * 49?');

describe('createTraceScene', () => {
  it('step 0: first event active, rest inactive-but-visible (whole shape shown)', () => {
    const scene = createTraceScene(trace, 0);
    expect(scene.rows[0]!.state).toBe('active');
    expect(scene.rows.slice(1).every((r) => r.state === 'inactive')).toBe(true);
    expect(scene.rows).toHaveLength(trace.length); // future steps visible, not hidden
  });

  it('middle step: past completed, current active, future inactive', () => {
    const scene = createTraceScene(trace, 2);
    expect(scene.rows.map((r) => r.state)).toEqual([
      'completed',
      'completed',
      'active',
      ...Array(trace.length - 3).fill('inactive'),
    ]);
  });

  it('carries the event teaching text as the description', () => {
    const scene = createTraceScene(trace, 1);
    expect(scene.description).toBe(trace[1]!.detail);
    expect(scene.title).toContain('Fixed step');
  });

  it('maps actors and deciders for the teaching comparison', async () => {
    const runs = await buildComparison();
    const agent = runs.find((r) => r.key === 'agent')!;
    const scene = createTraceScene(agent.trace, 0);
    const selected = scene.rows.find((r) => r.label.startsWith('Model selected tool'))!;
    expect(selected.actor).toBe('model');
    expect(selected.decidedBy).toBe('model');
    const executed = scene.rows.find((r) => r.label.startsWith('Runtime executed tool'))!;
    expect(executed.actor).toBe('tool');
    expect(executed.decidedBy).toBe('runtime');
  });

  it('exposes usage only when the event carries declared metadata', async () => {
    const runs = await buildComparison();
    const direct = runs.find((r) => r.key === 'direct')!;
    const respondedIndex = direct.trace.findIndex((e) => e.type === 'model-responded');
    expect(createTraceScene(direct.trace, respondedIndex).usage).toMatchObject({ latencyMs: 350 });
    expect(createTraceScene(direct.trace, 0).usage).toBeUndefined();
  });

  it('clamps out-of-range steps and is deterministic', () => {
    expect(createTraceScene(trace, -3)).toEqual(createTraceScene(trace, 0));
    expect(createTraceScene(trace, 99)).toEqual(createTraceScene(trace, trace.length - 1));
    expect(createTraceScene(trace, 2)).toEqual(createTraceScene(trace, 2));
  });
});
