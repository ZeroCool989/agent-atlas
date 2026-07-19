import { describe, expect, it } from 'vitest';

import { COMPUTER_USE_DEMO, createComputerUseScene } from './computer-use-scene';

const sceneAt = (step: number) => createComputerUseScene(COMPUTER_USE_DEMO, step);

describe('createComputerUseScene', () => {
  it('step 0 is the first screenshot of the inbox — the SSR first frame', () => {
    const scene = sceneAt(0);
    expect(scene.step).toBe(0);
    expect(scene.kind).toBe('perceived');
    expect(scene.view).toBe('inbox');
    expect(scene.status).toBe('perceiving');
  });

  it('clamps out-of-range steps to a renderable scene', () => {
    expect(sceneAt(-5).step).toBe(0);
    const last = sceneAt(9999);
    expect(last.step).toBe(last.totalSteps - 1);
  });

  it('every step carries a title and description (doubles as the a11y text)', () => {
    const total = sceneAt(0).totalSteps;
    for (let i = 0; i < total; i += 1) {
      const scene = sceneAt(i);
      expect(scene.title.length).toBeGreaterThan(0);
      expect(scene.description.length).toBeGreaterThan(0);
    }
  });

  it('has a beat where the injected instruction is refused', () => {
    const total = sceneAt(0).totalSteps;
    const refused = Array.from({ length: total }, (_, i) => sceneAt(i)).find((s) => s.status === 'refused');
    expect(refused).toBeDefined();
    expect(refused!.risk).toBe('destructive');
    // The injected element is marked on that screen.
    expect(refused!.elements.some((e) => e.injected)).toBe(true);
  });

  it('has a beat where a consequential action pauses for confirmation, then is confirmed', () => {
    const scenes = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i));
    const awaiting = scenes.find((s) => s.status === 'awaiting-confirmation' && s.elements.some((e) => e.targeted && e.label === 'Send'));
    expect(awaiting).toBeDefined();
    expect(scenes.some((s) => s.status === 'confirmed')).toBe(true);
  });

  it('highlights the targeted element and exposes a click point when an action is proposed', () => {
    const scenes = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i));
    // On a "proposed" beat the target is still on the current screen, so it can be highlighted.
    const proposed = scenes.find((s) => s.status === 'proposed' && s.elements.some((e) => e.targeted));
    expect(proposed).toBeDefined();
    expect(proposed!.point).toBeDefined();
  });

  it('an "acted" beat shows the updated screen (the target it clicked is gone by then)', () => {
    const scenes = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i));
    const acted = scenes.find((s) => s.status === 'acted');
    expect(acted).toBeDefined();
    expect(acted!.point).toBeDefined();
  });

  it('ends on the goal-reached beat with the run outcome and refusal count', () => {
    const last = sceneAt(sceneAt(0).totalSteps - 1);
    expect(last.kind).toBe('completed');
    expect(last.outcome).toBe('completed');
    expect(last.refusals).toBe(1);
  });
});
