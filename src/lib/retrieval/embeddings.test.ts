import { describe, expect, it } from 'vitest';

import {
  cosineSimilarity,
  dot,
  embeddingFor,
  ILLUSTRATIVE_EMBEDDINGS,
  magnitude,
  nearestNeighbors,
  normalize,
} from './embeddings';

describe('dot', () => {
  it('sums element-wise products', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });
  it('throws on a dimension mismatch rather than returning a silent wrong number', () => {
    expect(() => dot([1, 2], [1, 2, 3])).toThrow(/dimension mismatch/);
  });
});

describe('magnitude', () => {
  it('is the Euclidean length', () => {
    expect(magnitude([3, 4])).toBe(5);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical directions', () => {
    expect(cosineSimilarity([1, 1], [1, 1])).toBeCloseTo(1);
  });
  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('is -1 for opposite directions', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });
  it('is scale-invariant — length does not matter, only direction', () => {
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 2], [10, 20])).toBeCloseTo(1);
  });
  it('returns 0 for a zero vector instead of dividing by zero', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('normalize', () => {
  it('produces a unit vector in the same direction', () => {
    const unit = normalize([3, 4]);
    expect(magnitude(unit)).toBeCloseTo(1);
    expect(cosineSimilarity(unit, [3, 4])).toBeCloseTo(1);
  });
  it('leaves the zero vector unchanged', () => {
    expect(normalize([0, 0])).toEqual([0, 0]);
  });
});

describe('nearestNeighbors', () => {
  const corpus = [
    { text: 'a', vector: [1, 0] },
    { text: 'b', vector: [0.9, 0.1] },
    { text: 'c', vector: [0, 1] },
    { text: 'd', vector: [-1, 0] },
  ];

  it('ranks by cosine similarity, most similar first', () => {
    const ranked = nearestNeighbors([1, 0], corpus);
    expect(ranked.map((r) => r.text)).toEqual(['a', 'b', 'c', 'd']);
    expect(ranked[0]!.score).toBeCloseTo(1);
    expect(ranked[3]!.score).toBeCloseTo(-1);
  });

  it('limits to k results', () => {
    expect(nearestNeighbors([1, 0], corpus, 2).map((r) => r.text)).toEqual(['a', 'b']);
  });

  it('clamps k to the corpus size and to zero', () => {
    expect(nearestNeighbors([1, 0], corpus, 99)).toHaveLength(4);
    expect(nearestNeighbors([1, 0], corpus, 0)).toHaveLength(0);
  });

  it('breaks score ties by original corpus order (deterministic)', () => {
    const tied = [
      { text: 'first', vector: [1, 0] },
      { text: 'second', vector: [1, 0] },
    ];
    expect(nearestNeighbors([1, 0], tied).map((r) => r.text)).toEqual(['first', 'second']);
  });
});

describe('ILLUSTRATIVE_EMBEDDINGS', () => {
  it('clusters by meaning: a royalty query retrieves royalty before animals or fruit', () => {
    const king = embeddingFor('king', ILLUSTRATIVE_EMBEDDINGS)!;
    const top3 = nearestNeighbors(king, ILLUSTRATIVE_EMBEDDINGS, 3).map((r) => r.text);
    expect(top3).toEqual(['king', 'queen', 'prince']);
  });
});
