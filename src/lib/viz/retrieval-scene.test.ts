import { describe, expect, it } from 'vitest';

import { buildRetrievalScenes } from './retrieval-scene';

describe('buildRetrievalScenes', () => {
  it('throws when the query is not in the corpus', () => {
    expect(() => buildRetrievalScenes('unicorn')).toThrow(/not in the corpus/);
  });

  it('has one setup step plus one step per neighbor', () => {
    const scenes = buildRetrievalScenes('king');
    // 9 illustrative words → 8 neighbors → 9 steps.
    expect(scenes).toHaveLength(9);
    expect(scenes[0]!.candidates).toHaveLength(8);
    expect(scenes[0]!.query).toBe('king');
  });

  it('reveals nothing at step 0 and everything at the last step', () => {
    const scenes = buildRetrievalScenes('king');
    expect(scenes[0]!.candidates.every((c) => !c.revealed)).toBe(true);
    expect(scenes.at(-1)!.candidates.every((c) => c.revealed)).toBe(true);
  });

  it('reveals exactly the top-k at step k, in ranked order', () => {
    const scenes = buildRetrievalScenes('king');
    const step2 = scenes[2]!;
    const revealed = step2.candidates.filter((c) => c.revealed).map((c) => c.text);
    expect(revealed).toEqual(['queen', 'prince']); // the two nearest to king
    expect(step2.candidates.every((c) => (c.rank <= 2) === c.revealed)).toBe(true);
  });

  it('orders candidates by descending real cosine score', () => {
    const scenes = buildRetrievalScenes('king');
    const scores = scenes.at(-1)!.candidates.map((c) => c.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
    // fruit sits at the bottom for a royalty query (opposite direction → negative cosine).
    expect(scenes.at(-1)!.candidates.at(-1)!.score).toBeLessThan(0);
  });
});
