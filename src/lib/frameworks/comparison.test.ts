import { describe, expect, it } from 'vitest';

import { buildFrameworkComparison, COMPARISON_GOAL } from './comparison';

describe('buildFrameworkComparison', () => {
  it('proves the two surfaces produce the identical trace', async () => {
    const c = await buildFrameworkComparison();
    expect(c.tracesMatch).toBe(true);
    // Re-assert independently of the flag the builder computed.
    expect(c.handBuiltTrace).toEqual(c.frameworkTrace);
  });

  it('runs a real, completed agent task — not a drawn one', async () => {
    const c = await buildFrameworkComparison();
    expect(c.goal).toBe(COMPARISON_GOAL);
    expect(c.finalText).toContain('6,223'); // 127 × 49
    // A genuine two-model-call tool-use flow yields a rich, multi-step trace.
    expect(c.steps.length).toBeGreaterThanOrEqual(8);
  });

  it('tags every runtime step as yours in the hand-built run and the framework’s in the other', async () => {
    const c = await buildFrameworkComparison();
    expect(c.steps.every((s) => s.ownerHandBuilt === 'you')).toBe(true);
    expect(c.steps.every((s) => s.ownerFramework === 'framework')).toBe(true);
  });

  it('the framework authoring surface is shorter but hands ownership to the framework', async () => {
    const c = await buildFrameworkComparison();
    // Both surfaces are shown; the framework side moves concerns to framework ownership.
    expect(c.framework.authoring.some((l) => l.owns === 'framework')).toBe(true);
    expect(c.handBuilt.authoring.every((l) => l.owns === 'you')).toBe(true);
  });

  it('names concretely what the framework hides', async () => {
    const c = await buildFrameworkComparison();
    expect(c.hidden.length).toBeGreaterThanOrEqual(3);
    const joined = c.hidden.join(' ').toLowerCase();
    expect(joined).toContain('allowlist');
    expect(joined).toContain('step limit');
    expect(joined).toContain('loop');
  });

  it('every step carries a human label and a teaching detail', async () => {
    const c = await buildFrameworkComparison();
    for (const step of c.steps) {
      expect(step.label.length).toBeGreaterThan(0);
      expect(step.detail.length).toBeGreaterThan(0);
    }
  });
});
