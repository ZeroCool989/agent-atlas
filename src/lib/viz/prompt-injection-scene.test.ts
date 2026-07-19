import { describe, expect, it } from 'vitest';

import { PROMPT_INJECTION_DEMO, createPromptInjectionScene } from './prompt-injection-scene';

const sceneAt = (step: number) => createPromptInjectionScene(PROMPT_INJECTION_DEMO, step);

describe('createPromptInjectionScene', () => {
  it('step 0 is the setup framing — the SSR first frame', () => {
    const scene = sceneAt(0);
    expect(scene.step).toBe(0);
    expect(scene.phase).toBe('setup');
    expect(scene.status).toBe('assembling');
  });

  it('clamps out-of-range steps to a renderable scene', () => {
    expect(sceneAt(-5).step).toBe(0);
    const last = sceneAt(9999);
    expect(last.step).toBe(last.totalSteps - 1);
  });

  it('draws the one assembled stream at every step, with trust marked per segment', () => {
    const total = sceneAt(0).totalSteps;
    for (let i = 0; i < total; i += 1) {
      const scene = sceneAt(i);
      expect(scene.title.length).toBeGreaterThan(0);
      expect(scene.description.length).toBeGreaterThan(0);
      expect(scene.segments.length).toBe(3); // system + user + one untrusted article
      expect(scene.segments.some((s) => s.trust === 'untrusted')).toBe(true);
    }
  });

  it('has a naive HARM beat where the injected, untrusted action exfiltrates data', () => {
    const scenes = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i));
    const harm = scenes.find((s) => s.status === 'harm');
    expect(harm).toBeDefined();
    expect(harm!.phase).toBe('naive');
    expect(harm!.harmful).toBe(true);
    expect(harm!.call?.origin).toBe('untrusted');
  });

  it('has a mitigated BLOCK beat naming the layered controls that fired', () => {
    const scenes = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i));
    const block = scenes.find((s) => s.status === 'blocked');
    expect(block).toBeDefined();
    expect(block!.phase).toBe('mitigated');
    expect(block!.firedControls).toEqual(
      expect.arrayContaining(['trust-boundary', 'least-privilege', 'confirmation-gate']),
    );
  });

  it('has a mitigated ALLOW beat where the legitimate task completes', () => {
    const scenes = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i));
    const allowed = scenes.find((s) => s.status === 'allowed' && s.phase === 'mitigated');
    expect(allowed).toBeDefined();
    expect(allowed!.call?.tool).toBe('send_reply');
  });

  it('the naive outcome shows injection succeeded; the mitigated outcome shows it blocked', () => {
    const scenes = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i));
    const naive = scenes.find((s) => s.status === 'outcome' && s.phase === 'naive');
    const mitigated = scenes.find((s) => s.status === 'outcome' && s.phase === 'mitigated');
    expect(naive?.outcome?.injectionSucceeded).toBe(true);
    expect(mitigated?.outcome?.injectionSucceeded).toBe(false);
    expect(mitigated?.outcome?.legitimateActionCompleted).toBe(true);
  });
});
