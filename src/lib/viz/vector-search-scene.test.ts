import { describe, expect, it } from 'vitest';

import { buildVectorSearchScenes } from './vector-search-scene';

describe('buildVectorSearchScenes', () => {
  const scenes = buildVectorSearchScenes();

  it('has four ordered steps: setup, flat, and two approximate probes', () => {
    expect(scenes.map((s) => s.mode)).toEqual(['setup', 'flat', 'approx', 'approx']);
    expect(scenes.map((s) => s.step)).toEqual([0, 1, 2, 3]);
    expect(scenes.every((s) => s.totalSteps === 4)).toBe(true);
  });

  it('setup scans nothing', () => {
    const setup = scenes[0]!;
    expect(setup.comparisons).toBe(0);
    expect(setup.rows.every((r) => r.score === null)).toBe(true);
    expect(setup.corpusSize).toBe(16);
  });

  it('flat search is exact: every vector compared, recall 1, true top-3 returned', () => {
    const flat = scenes[1]!;
    expect(flat.comparisons).toBe(16);
    expect(flat.recall).toBe(1);
    expect(flat.rows.filter((r) => r.returned).map((r) => r.text).sort()).toEqual(
      ['coupe', 'motorbike', 'sedan'],
    );
    expect(flat.rows.some((r) => r.missed)).toBe(false);
  });

  it('probing one cluster is cheaper but misses a true neighbor', () => {
    const approx = scenes[2]!;
    expect(approx.comparisons).toBe(8);
    expect(approx.comparisons).toBeLessThan(scenes[1]!.comparisons);
    expect(approx.probedClusters).toEqual(['east']);
    expect(approx.recall).toBeCloseTo(0.67, 2);
    const missed = approx.rows.filter((r) => r.missed).map((r) => r.text);
    expect(missed).toEqual(['motorbike']);
  });

  it('probing two clusters recovers full recall at a higher cost', () => {
    const approx = scenes[3]!;
    expect(approx.comparisons).toBe(12);
    expect(approx.comparisons).toBeGreaterThan(scenes[2]!.comparisons);
    expect(approx.probedClusters).toEqual(['east', 'north-east']);
    expect(approx.recall).toBe(1);
    expect(approx.rows.some((r) => r.missed)).toBe(false);
  });

  it('every row carries its cluster label', () => {
    expect(scenes[0]!.rows.every((r) => r.cluster.length > 0)).toBe(true);
  });
});
