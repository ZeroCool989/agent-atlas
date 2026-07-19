import { describe, expect, it } from 'vitest';

import { createSamplingScene, SAMPLING_DEMO_INPUT, SAMPLING_SCENE_TIMELINE } from './sampling-scene';

const sumProb = (bars: { prob: number }[]) => bars.reduce((a, b) => a + b.prob, 0);

describe('createSamplingScene', () => {
  it('every step is a complete, normalized distribution', () => {
    for (let step = 0; step < SAMPLING_SCENE_TIMELINE.steps.length; step++) {
      const scene = createSamplingScene(SAMPLING_DEMO_INPUT, step);
      expect(scene.bars).toHaveLength(SAMPLING_DEMO_INPUT.candidates.length);
      expect(sumProb(scene.bars)).toBeCloseTo(1, 10);
    }
  });

  it('clamps out-of-range steps', () => {
    expect(createSamplingScene(SAMPLING_DEMO_INPUT, -5).step).toBe(0);
    expect(createSamplingScene(SAMPLING_DEMO_INPUT, 99).step).toBe(
      SAMPLING_SCENE_TIMELINE.steps.length - 1,
    );
  });

  it('is pure — identical input and step yield identical scenes', () => {
    expect(createSamplingScene(SAMPLING_DEMO_INPUT, 3)).toEqual(
      createSamplingScene(SAMPLING_DEMO_INPUT, 3),
    );
  });

  it('step 0 is the raw distribution with every token kept', () => {
    const scene = createSamplingScene(SAMPLING_DEMO_INPUT, 0);
    expect(scene.method).toBe('raw');
    expect(scene.keptCount).toBe(SAMPLING_DEMO_INPUT.candidates.length);
    // basisProb equals prob at the raw step by definition.
    scene.bars.forEach((b) => expect(b.prob).toBeCloseTo(b.basisProb, 10));
  });

  it('lower temperature concentrates more mass on the top token than the raw step', () => {
    const raw = createSamplingScene(SAMPLING_DEMO_INPUT, 0);
    const cold = createSamplingScene(SAMPLING_DEMO_INPUT, 1);
    expect(cold.method).toBe('temperature');
    expect(cold.bars[0]!.prob).toBeGreaterThan(raw.bars[0]!.prob);
    expect(cold.keptCount).toBe(SAMPLING_DEMO_INPUT.candidates.length); // reshape, not cut
  });

  it('higher temperature spreads mass off the top token', () => {
    const raw = createSamplingScene(SAMPLING_DEMO_INPUT, 0);
    const hot = createSamplingScene(SAMPLING_DEMO_INPUT, 2);
    expect(hot.bars[0]!.prob).toBeLessThan(raw.bars[0]!.prob);
  });

  it('top-k keeps exactly k drawable candidates and cuts the rest to zero', () => {
    const scene = createSamplingScene(SAMPLING_DEMO_INPUT, 3);
    expect(scene.method).toBe('top-k');
    expect(scene.keptCount).toBe(SAMPLING_DEMO_INPUT.topK);
    scene.bars.filter((b) => !b.kept).forEach((b) => expect(b.prob).toBe(0));
  });

  it('top-p keeps a dynamic candidate set that still sums to 1', () => {
    const scene = createSamplingScene(SAMPLING_DEMO_INPUT, 4);
    expect(scene.method).toBe('top-p');
    expect(scene.keptCount).toBeGreaterThanOrEqual(1);
    expect(scene.parameterLabel).toBe('p = 0.9');
    expect(sumProb(scene.bars.filter((b) => b.kept))).toBeCloseTo(1, 10);
  });

  it('exposes the parameter in play for each step', () => {
    expect(createSamplingScene(SAMPLING_DEMO_INPUT, 1).parameterLabel).toBe('T = 0.5');
    expect(createSamplingScene(SAMPLING_DEMO_INPUT, 3).parameterLabel).toBe('k = 3');
  });
});
