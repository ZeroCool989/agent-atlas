import { describe, expect, it } from 'vitest';

import { buildAgentFrameworksScenes } from './agent-frameworks-scene';

describe('buildAgentFrameworksScenes', () => {
  it('opens with the two surfaces and nothing run yet', async () => {
    const scenes = await buildAgentFrameworksScenes();
    const first = scenes[0]!;
    expect(first.step).toBe(0);
    expect(first.title).toBe('Same task, two ways');
    expect(first.visibleInHandBuilt).toBe(0);
    expect(first.rows.every((r) => r.state === 'inactive')).toBe(true);
    // Both authoring surfaces are present from the start.
    expect(first.handBuilt.authoring.length).toBeGreaterThan(0);
    expect(first.framework.authoring.length).toBeGreaterThan(0);
  });

  it('reveals the shared trace one runtime step at a time, in lockstep across both columns', async () => {
    const scenes = await buildAgentFrameworksScenes();
    for (const [i, scene] of scenes.entries()) {
      expect(scene.step).toBe(i);
      // The tally is always in lockstep: the framework hides exactly what the hand-built shows.
      expect(scene.hiddenInFramework).toBe(scene.visibleInHandBuilt);
      if (i > 0) {
        expect(scene.rows[i - 1]!.state).toBe('active');
        expect(scene.visibleInHandBuilt).toBe(i);
      }
    }
  });

  it('surfaces the equivalence and the hidden list only on the final step', async () => {
    const scenes = await buildAgentFrameworksScenes();
    const last = scenes.at(-1)!;
    expect(last.revealed).toBe(true);
    expect(last.tracesMatch).toBe(true);
    expect(last.hidden.length).toBeGreaterThanOrEqual(3);
    expect(last.finalText).toContain('6,223');
    // No earlier scene claims the reveal.
    for (const scene of scenes.slice(0, -1)) {
      expect(scene.revealed).toBe(false);
    }
  });

  it('every runtime step is owned by you on the left and by the framework on the right', async () => {
    const scenes = await buildAgentFrameworksScenes();
    // The framework authoring surface hands at least one concern to the framework.
    expect(scenes[0]!.framework.authoring.some((l) => l.owns === 'framework')).toBe(true);
    expect(scenes[0]!.handBuilt.authoring.every((l) => l.owns === 'you')).toBe(true);
  });
});
