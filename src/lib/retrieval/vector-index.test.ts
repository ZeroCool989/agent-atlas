import { describe, expect, it } from 'vitest';

import {
  ClusteredIndex,
  FlatIndex,
  meanVector,
  recall,
  VECTOR_SEARCH_CORPUS,
  VECTOR_SEARCH_QUERY,
  VECTOR_SEARCH_SEEDS,
} from './vector-index';
import type { Ranked } from './embeddings';

describe('meanVector', () => {
  it('averages component-wise', () => {
    expect(meanVector([[0, 0], [2, 4], [4, 8]])).toEqual([2, 4]);
  });
  it('throws on an empty set', () => {
    expect(() => meanVector([])).toThrow(/no vectors/);
  });
  it('throws on a dimension mismatch', () => {
    expect(() => meanVector([[1, 2], [1, 2, 3]])).toThrow(/dimension mismatch/);
  });
});

describe('recall', () => {
  const r = (text: string): Ranked => ({ text, score: 0 });
  it('is 1 when the approximate top-k contains the whole exact top-k', () => {
    expect(recall([r('a'), r('b'), r('c')], [r('a'), r('b')], 2)).toBe(1);
  });
  it('is the recovered fraction when a true neighbor is missed', () => {
    expect(recall([r('a'), r('x'), r('y')], [r('a'), r('b'), r('c')], 3)).toBeCloseTo(1 / 3);
  });
  it('is 1 for an empty target set', () => {
    expect(recall([], [], 3)).toBe(1);
  });
});

describe('FlatIndex', () => {
  const index = new FlatIndex(VECTOR_SEARCH_CORPUS);

  it('reports the corpus size', () => {
    expect(index.size).toBe(16);
  });

  it('is exact: returns the true top-k and compares against every vector', () => {
    const { results, comparisons } = index.search(VECTOR_SEARCH_QUERY, 3);
    expect(results.map((r) => r.text)).toEqual(['coupe', 'motorbike', 'sedan']);
    expect(comparisons).toBe(16);
  });
});

describe('ClusteredIndex (IVF-style approximate search)', () => {
  const index = ClusteredIndex.fromSeeds(VECTOR_SEARCH_CORPUS, VECTOR_SEARCH_SEEDS);
  const exact = new FlatIndex(VECTOR_SEARCH_CORPUS).search(VECTOR_SEARCH_QUERY, 3);

  it('buckets the corpus into the four seeded clusters', () => {
    expect(index.clusters.map((c) => c.name).sort()).toEqual(
      ['east', 'north-east', 'north-west', 'south'],
    );
    expect(index.clusters.every((c) => c.members.length === 4)).toBe(true);
  });

  it('probing one cluster is cheaper but misses a boundary neighbor (recall < 1)', () => {
    const approx = index.search(VECTOR_SEARCH_QUERY, 3, 1);
    expect(approx.probedClusters).toEqual(['east']);
    expect(approx.comparisons).toBe(8); // 4 centroids + 4 members
    expect(approx.comparisons).toBeLessThan(exact.comparisons);
    expect(approx.results.map((r) => r.text)).not.toContain('motorbike'); // lives in north-east
    expect(recall(approx.results, exact.results, 3)).toBeCloseTo(2 / 3);
  });

  it('probing two clusters recovers full recall at a higher cost', () => {
    const approx = index.search(VECTOR_SEARCH_QUERY, 3, 2);
    expect(approx.probedClusters).toEqual(['east', 'north-east']);
    expect(approx.comparisons).toBe(12); // 4 centroids + 8 members
    expect(recall(approx.results, exact.results, 3)).toBe(1);
    expect(approx.results.map((r) => r.text)).toContain('motorbike');
  });

  it('probing every cluster is exact — but costs more than a flat scan (overhead loses at small scale)', () => {
    const approx = index.search(VECTOR_SEARCH_QUERY, 3, 4);
    expect(recall(approx.results, exact.results, 3)).toBe(1);
    expect(approx.results.map((r) => r.text)).toEqual(exact.results.map((r) => r.text));
    expect(approx.comparisons).toBe(20); // 4 centroids + all 16 members > flat's 16
    expect(approx.comparisons).toBeGreaterThan(exact.comparisons);
  });

  it('clamps nProbe into range and rejects empty clusters', () => {
    expect(index.search(VECTOR_SEARCH_QUERY, 3, 0).probedClusters).toEqual(['east']);
    expect(index.search(VECTOR_SEARCH_QUERY, 3, 99).probedClusters.length).toBe(4);
    expect(() => new ClusteredIndex([{ name: 'empty', members: [] }])).toThrow(/empty/);
  });
});
