import { describe, expect, it } from 'vitest';

import { REFLECTION_DEMO_INPUT, createReflectionScene } from './reflection-scene';

describe('createReflectionScene', () => {
  it('opens with the initial draft and its critique, before any revision', () => {
    const s = createReflectionScene(REFLECTION_DEMO_INPUT, 0);
    expect(s.kind).toBe('initial');
    expect(s.iteration).toBe(0);
    expect(s.critique.pass).toBe(false);
    expect(s.critique.issues.length).toBeGreaterThan(0); // "what's wrong" is shown
    expect(s.description).toContain("What's wrong");
  });

  it('walks draft → critique → revision → regression → accept, then a caveat', () => {
    const total = createReflectionScene(REFLECTION_DEMO_INPUT, 0).totalSteps;
    const kinds: string[] = [];
    const deltas: string[] = [];
    for (let i = 0; i < total; i += 1) {
      const s = createReflectionScene(REFLECTION_DEMO_INPUT, i);
      kinds.push(s.kind);
      deltas.push(s.delta);
    }
    expect(kinds).toContain('initial');
    expect(kinds).toContain('revision');
    expect(kinds.at(-1)).toBe('caveat');
    // The honest beat: at least one revision scored worse than the one before it.
    expect(deltas).toContain('regressed');
  });

  it('reaches an accepted beat with real, passing critic scores from the module', () => {
    const total = createReflectionScene(REFLECTION_DEMO_INPUT, 0).totalSteps;
    let sawAccepted = false;
    for (let i = 0; i < total; i += 1) {
      const s = createReflectionScene(REFLECTION_DEMO_INPUT, i);
      if (s.accepted && s.kind !== 'caveat') {
        sawAccepted = true;
        expect(s.critique.pass).toBe(true);
        expect(s.critique.score).toBe(1);
        expect(s.outcome).toBe('accepted');
      }
    }
    expect(sawAccepted).toBe(true);
  });

  it('the caveat beat exposes a wrong answer the critic scored 100%', () => {
    const total = createReflectionScene(REFLECTION_DEMO_INPUT, 0).totalSteps;
    const caveat = createReflectionScene(REFLECTION_DEMO_INPUT, total - 1);
    expect(caveat.kind).toBe('caveat');
    expect(caveat.caveat).toBeDefined();
    // Critic fully confident, oracle says the "improved" answer is wrong, the original was right.
    expect(caveat.caveat!.criticPercent).toBe(100);
    expect(caveat.caveat!.oracleOnBestPercent).toBe(0);
    expect(caveat.caveat!.oracleOnInitialPercent).toBe(100);
    expect(caveat.caveat!.wrongDraft).toContain('Sydney');
    expect(caveat.caveat!.rightDraft).toContain('Canberra');
  });

  it('clamps out-of-range steps and stays deterministic', () => {
    const a = createReflectionScene(REFLECTION_DEMO_INPUT, 999);
    const b = createReflectionScene(REFLECTION_DEMO_INPUT, 999);
    expect(a.kind).toBe('caveat');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
