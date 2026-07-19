import { describe, expect, it } from 'vitest';

import { createGenerationScene, GENERATION_DEMO_INPUT } from './generation-scene';

describe('createGenerationScene', () => {
  it('step 0 shows the prompt with no candidates yet', () => {
    const scene = createGenerationScene(GENERATION_DEMO_INPUT, 0);
    expect(scene.phase).toBe('prompt');
    expect(scene.sequence).toEqual(['the', 'cat', 'sat']);
    expect(scene.promptLength).toBe(3);
    expect(scene.candidates).toHaveLength(0);
  });

  it('predict steps expose a real distribution that sums to ~1 and marks the chosen token', () => {
    const scene = createGenerationScene(GENERATION_DEMO_INPUT, 1);
    expect(scene.phase).toBe('predict');
    expect(scene.candidates.length).toBeGreaterThan(0);
    const chosen = scene.candidates.filter((c) => c.chosen);
    expect(chosen).toHaveLength(1);
    // Candidates are the top of the distribution, most likely first.
    for (let i = 1; i < scene.candidates.length; i++) {
      expect(scene.candidates[i - 1]!.prob).toBeGreaterThanOrEqual(scene.candidates[i]!.prob);
    }
    // Greedy picks the most likely candidate.
    expect(scene.candidates[0]!.chosen).toBe(true);
  });

  it('the sequence grows by one token per predict step (autoregression)', () => {
    const first = createGenerationScene(GENERATION_DEMO_INPUT, 1);
    const second = createGenerationScene(GENERATION_DEMO_INPUT, 2);
    // Step 2's context is step 1's context plus the token step 1 appended.
    expect(second.sequence.length).toBe(first.sequence.length + 1);
    expect(second.sequence.slice(0, first.sequence.length)).toEqual(first.sequence);
  });

  it('the final step shows the completed generation and no candidates', () => {
    const last = createGenerationScene(GENERATION_DEMO_INPUT, 999); // clamps to last
    expect(last.phase).toBe('done');
    expect(last.candidates).toHaveLength(0);
    expect(last.sequence.length).toBeGreaterThan(last.promptLength);
    expect(last.sequence.slice(0, 3)).toEqual(['the', 'cat', 'sat']);
  });

  it('is deterministic: same input + step yields an identical scene', () => {
    expect(createGenerationScene(GENERATION_DEMO_INPUT, 1)).toEqual(
      createGenerationScene(GENERATION_DEMO_INPUT, 1),
    );
  });

  it('clamps out-of-range steps instead of throwing', () => {
    expect(createGenerationScene(GENERATION_DEMO_INPUT, -5).step).toBe(0);
    const last = createGenerationScene(GENERATION_DEMO_INPUT, 1000);
    expect(last.step).toBe(last.totalSteps - 1);
  });
});
