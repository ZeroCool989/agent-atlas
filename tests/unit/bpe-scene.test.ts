import { describe, expect, it } from 'vitest';

import { SAMPLE_TEXT, TEACHING_MERGES, TRAINING_CORPUS, trainBpe } from '../../src/lib/sim/tokenizer';
import { createBpeScene } from '../../src/lib/viz';

const model = trainBpe(TRAINING_CORPUS, TEACHING_MERGES);

describe('createBpeScene', () => {
  it('step 0 is pure characters, no merge, all inactive', () => {
    const scene = createBpeScene(model, SAMPLE_TEXT, 0);
    expect(scene.merge).toBeUndefined();
    expect(scene.tokens.every((t) => t.text.length === 1 && t.state === 'inactive')).toBe(true);
    expect(scene.tokenCount).toBe(SAMPLE_TEXT.replace(/ /g, ' ').length); // one token per char (spaces attach to words)
    expect(scene.description).toContain('single-character');
  });

  it('each step re-encodes with exactly k merges and names the merge with its real frequency', () => {
    const scene = createBpeScene(model, SAMPLE_TEXT, 1);
    const firstMerge = model.merges[0]!;
    expect(scene.merge).toMatchObject({ merged: firstMerge.merged, frequency: firstMerge.frequency });
    expect(scene.description).toContain(`${firstMerge.frequency}×`);
  });

  it('tokens equal to the just-learned merge are active; earlier merges completed; chars inactive', () => {
    // Find a step whose merge actually appears in the sample encoding.
    for (let k = 1; k < model.merges.length + 1; k++) {
      const scene = createBpeScene(model, SAMPLE_TEXT, k);
      const merged = model.merges[k - 1]!.merged;
      for (const token of scene.tokens) {
        if (token.text === merged) expect(token.state).toBe('active');
        else if (token.text.length > 1) expect(token.state).toBe('completed');
        else expect(token.state).toBe('inactive');
      }
    }
  });

  it('token count is monotonically non-increasing across steps (compression is visible)', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let k = 0; k <= model.merges.length; k++) {
      const { tokenCount } = createBpeScene(model, SAMPLE_TEXT, k);
      expect(tokenCount).toBeLessThanOrEqual(previous);
      previous = tokenCount;
    }
  });

  it('final step shows real compression AND honest fragmentation of the rare word', () => {
    const scene = createBpeScene(model, SAMPLE_TEXT, model.merges.length);
    expect(scene.tokens.some((t) => t.text === ' token')).toBe(true); // learned subword
    expect(scene.tokens.some((t) => t.text === 'z')).toBe(true); // "tokenization" shards on rare z
  });

  it('clamps out-of-range steps and stays deterministic', () => {
    expect(createBpeScene(model, SAMPLE_TEXT, -5)).toEqual(createBpeScene(model, SAMPLE_TEXT, 0));
    expect(createBpeScene(model, SAMPLE_TEXT, 999)).toEqual(
      createBpeScene(model, SAMPLE_TEXT, model.merges.length),
    );
    expect(createBpeScene(model, SAMPLE_TEXT, 7)).toEqual(createBpeScene(model, SAMPLE_TEXT, 7));
  });
});
