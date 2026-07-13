import { describe, expect, it } from 'vitest';

import {
  clampStep,
  computeContextWindow,
  createTokenScene,
  TOKEN_SCENE_TIMELINE,
  TOKENIZATION_DEMO_INPUT,
} from '../../src/lib/viz';

const input = TOKENIZATION_DEMO_INPUT;
const TOTAL = TOKEN_SCENE_TIMELINE.steps.length;

describe('clampStep', () => {
  it('clamps negatives, overshoot, and non-finite values', () => {
    expect(clampStep(-3, 5)).toBe(0);
    expect(clampStep(99, 5)).toBe(4);
    expect(clampStep(2.9, 5)).toBe(2);
    expect(clampStep(Number.NaN, 5)).toBe(0);
    expect(clampStep(Number.POSITIVE_INFINITY, 5)).toBe(4);
    expect(clampStep(3, 0)).toBe(0);
  });
});

describe('createTokenScene', () => {
  it('identical input produces identical scenes', () => {
    expect(createTokenScene(input, 3)).toEqual(createTokenScene(input, 3));
  });

  it('first step: raw text only — no boundaries, no ids, no window', () => {
    const scene = createTokenScene(input, 0);
    expect(scene.title).toBe('Raw text');
    expect(scene.showBoundaries).toBe(false);
    expect(scene.showIds).toBe(false);
    expect(scene.window).toBeUndefined();
    expect(scene.tokens.every((t) => t.state === 'inactive')).toBe(true);
    expect(scene.description.length).toBeGreaterThan(0); // meaningful without animation
  });

  it('middle step (boundaries): tokens visible, ids withheld', () => {
    const scene = createTokenScene(input, 1);
    expect(scene.showBoundaries).toBe(true);
    expect(scene.showIds).toBe(false);
    expect(scene.tokens.map((t) => t.id)).toEqual(Array(7).fill(undefined));
  });

  it('ids step associates vocabulary ids', () => {
    const scene = createTokenScene(input, 2);
    expect(scene.showIds).toBe(true);
    expect(scene.tokens[0]).toMatchObject({ text: 'Token', id: 3771, state: 'inactive' });
  });

  it('window step: partial fill with completed, one active, rest inactive', () => {
    const scene = createTokenScene(input, 3);
    expect(scene.tokens.map((t) => t.state)).toEqual([
      'completed',
      'completed',
      'completed',
      'completed',
      'active',
      'inactive',
      'inactive',
    ]);
    expect(scene.window).toMatchObject({ usedTokens: 4, capacityTokens: 16, status: 'ok' });
  });

  it('final step: all tokens completed, window reflects full sample', () => {
    const scene = createTokenScene(input, TOTAL - 1);
    expect(scene.tokens.every((t) => t.state === 'completed')).toBe(true);
    expect(scene.window).toMatchObject({ usedTokens: 7, remainingTokens: 9, percentUsed: 43.8 });
  });

  it('negative and beyond-range steps clamp to complete renderable scenes', () => {
    expect(createTokenScene(input, -5)).toEqual(createTokenScene(input, 0));
    expect(createTokenScene(input, 999)).toEqual(createTokenScene(input, TOTAL - 1));
  });

  it('tampering with a returned scene does not affect subsequent scenes', () => {
    const scene = createTokenScene(input, 3);
    scene.tokens[0]!.state = 'inactive';
    scene.tokens[0]!.text = 'TAMPERED';
    expect(createTokenScene(input, 3).tokens[0]).toMatchObject({ text: 'Token', state: 'completed' });
  });

  it('scenes are JSON-serializable (screenshots, a11y descriptions, transcripts)', () => {
    const scene = createTokenScene(input, 4);
    expect(JSON.parse(JSON.stringify(scene))).toEqual(scene);
  });
});

describe('computeContextWindow', () => {
  it('computes used/remaining/percent deterministically', () => {
    expect(computeContextWindow({ usedTokens: 4, capacityTokens: 16 })).toMatchObject({
      remainingTokens: 12,
      percentUsed: 25,
      status: 'ok',
      problems: [],
    });
  });

  it('zero used tokens is ok at 0%', () => {
    expect(computeContextWindow({ usedTokens: 0, capacityTokens: 8 })).toMatchObject({
      percentUsed: 0,
      remainingTokens: 8,
      status: 'ok',
    });
  });

  it('near-capacity at ≥90%', () => {
    expect(computeContextWindow({ usedTokens: 90, capacityTokens: 100 }).status).toBe('near-capacity');
    expect(computeContextWindow({ usedTokens: 89, capacityTokens: 100 }).status).toBe('ok');
  });

  it('exactly full', () => {
    expect(computeContextWindow({ usedTokens: 16, capacityTokens: 16 })).toMatchObject({
      status: 'full',
      remainingTokens: 0,
      percentUsed: 100,
    });
  });

  it('overflow keeps honest numbers (percent > 100, remaining 0)', () => {
    expect(computeContextWindow({ usedTokens: 20, capacityTokens: 16 })).toMatchObject({
      status: 'overflow',
      percentUsed: 125,
      remainingTokens: 0,
    });
  });

  it('zero capacity is invalid with a readable problem, not a division blow-up', () => {
    const view = computeContextWindow({ usedTokens: 4, capacityTokens: 0 });
    expect(view.status).toBe('invalid');
    expect(view.problems[0]).toContain('capacityTokens');
  });

  it('negative values are invalid', () => {
    const view = computeContextWindow({ usedTokens: -1, capacityTokens: -5 });
    expect(view.status).toBe('invalid');
    expect(view.problems).toHaveLength(2);
  });

  it('segment totals that disagree with usedTokens surface a problem, not silence', () => {
    const view = computeContextWindow({
      usedTokens: 10,
      capacityTokens: 20,
      segments: [
        { label: 'system', tokenCount: 3, kind: 'system' },
        { label: 'chat', tokenCount: 4, kind: 'conversation' },
      ],
    });
    expect(view.status).toBe('ok'); // used/capacity math stands
    expect(view.problems[0]).toContain('segment totals (7) do not match usedTokens (10)');
    expect(view.segments.map((s) => s.percent)).toEqual([15, 20]);
  });
});
