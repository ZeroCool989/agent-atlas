import { describe, expect, it } from 'vitest';

import {
  applyTopK,
  applyTopP,
  mulberry32,
  sample,
  softmax,
  softmaxTokens,
  type TokenProb,
} from './sampling';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('softmax', () => {
  it('returns a valid probability distribution that sums to 1', () => {
    const probs = softmax([2, 1, 0]);
    expect(sum(probs)).toBeCloseTo(1, 10);
    expect(probs.every((p) => p >= 0 && p <= 1)).toBe(true);
  });

  it('preserves the ordering of the logits', () => {
    const probs = softmax([0.5, 3, 1]);
    expect(probs[1]).toBeGreaterThan(probs[2]!);
    expect(probs[2]).toBeGreaterThan(probs[0]!);
  });

  it('matches the closed form for a known case', () => {
    // logits [1, 0]: p0 = e/(e+1), p1 = 1/(e+1).
    const probs = softmax([1, 0]);
    expect(probs[0]).toBeCloseTo(Math.E / (Math.E + 1), 10);
    expect(probs[1]).toBeCloseTo(1 / (Math.E + 1), 10);
  });

  it('is invariant to adding a constant to every logit (stability shift)', () => {
    const a = softmax([2, 1, 0]);
    const b = softmax([102, 101, 100]);
    a.forEach((p, i) => expect(p).toBeCloseTo(b[i]!, 10));
  });

  it('lower temperature sharpens toward the top token', () => {
    const cold = softmax([2, 1, 0], 0.5);
    const warm = softmax([2, 1, 0], 2);
    expect(cold[0]).toBeGreaterThan(warm[0]!); // more mass on the winner
  });

  it('higher temperature flattens toward uniform', () => {
    const hot = softmax([2, 1, 0], 100);
    hot.forEach((p) => expect(p).toBeCloseTo(1 / 3, 2));
  });

  it('temperature <= 0 is greedy: all mass on the argmax', () => {
    expect(softmax([2, 1, 0], 0)).toEqual([1, 0, 0]);
    expect(softmax([0, 5, 1], -1)).toEqual([0, 1, 0]);
  });

  it('greedy splits ties evenly', () => {
    expect(softmax([3, 3, 1], 0)).toEqual([0.5, 0.5, 0]);
  });

  it('handles the empty case', () => {
    expect(softmax([])).toEqual([]);
  });
});

describe('softmaxTokens', () => {
  it('labels probabilities with their tokens', () => {
    const dist = softmaxTokens([
      { token: 'a', logit: 1 },
      { token: 'b', logit: 0 },
    ]);
    expect(dist.map((d) => d.token)).toEqual(['a', 'b']);
    expect(sum(dist.map((d) => d.prob))).toBeCloseTo(1, 10);
  });
});

const dist: TokenProb[] = [
  { token: 'sunny', prob: 0.5 },
  { token: 'cloudy', prob: 0.25 },
  { token: 'warm', prob: 0.15 },
  { token: 'purple', prob: 0.1 },
];

describe('applyTopK', () => {
  it('keeps exactly k tokens and renormalizes the survivors to 1', () => {
    const out = applyTopK(dist, 2);
    const kept = out.filter((c) => c.kept);
    expect(kept.map((c) => c.token)).toEqual(['sunny', 'cloudy']);
    expect(sum(out.map((c) => c.prob))).toBeCloseTo(1, 10);
    expect(out.find((c) => c.token === 'warm')!.prob).toBe(0);
  });

  it('preserves input order in the output', () => {
    expect(applyTopK(dist, 2).map((c) => c.token)).toEqual([
      'sunny',
      'cloudy',
      'warm',
      'purple',
    ]);
  });

  it('renormalized survivors keep their relative proportions', () => {
    const out = applyTopK(dist, 2);
    // 0.5 and 0.25 renormalize to 2/3 and 1/3.
    expect(out[0]!.prob).toBeCloseTo(2 / 3, 10);
    expect(out[1]!.prob).toBeCloseTo(1 / 3, 10);
  });

  it('k >= length keeps everything unchanged (already normalized)', () => {
    const out = applyTopK(dist, 10);
    expect(out.every((c) => c.kept)).toBe(true);
    out.forEach((c, i) => expect(c.prob).toBeCloseTo(dist[i]!.prob, 10));
  });

  it('k <= 0 keeps nothing', () => {
    expect(applyTopK(dist, 0).every((c) => !c.kept && c.prob === 0)).toBe(true);
  });
});

describe('applyTopP (nucleus)', () => {
  it('keeps the smallest set whose cumulative probability reaches p', () => {
    // sorted: 0.5, 0.25, 0.15, 0.1 — cumulative reaches 0.9 at the third token.
    const out = applyTopP(dist, 0.9);
    expect(out.filter((c) => c.kept).map((c) => c.token)).toEqual([
      'sunny',
      'cloudy',
      'warm',
    ]);
    expect(sum(out.map((c) => c.prob))).toBeCloseTo(1, 10);
  });

  it('is dynamic: a confident distribution keeps fewer tokens than a flat one', () => {
    const confident: TokenProb[] = [
      { token: 'a', prob: 0.95 },
      { token: 'b', prob: 0.03 },
      { token: 'c', prob: 0.02 },
    ];
    const flat: TokenProb[] = [
      { token: 'a', prob: 0.34 },
      { token: 'b', prob: 0.33 },
      { token: 'c', prob: 0.33 },
    ];
    const keptCount = (cs: ReturnType<typeof applyTopP>) => cs.filter((c) => c.kept).length;
    expect(keptCount(applyTopP(confident, 0.9))).toBe(1);
    expect(keptCount(applyTopP(flat, 0.9))).toBe(3);
  });

  it('always keeps at least the single most likely token, even at p = 0', () => {
    const out = applyTopP(dist, 0);
    expect(out.filter((c) => c.kept).map((c) => c.token)).toEqual(['sunny']);
    expect(out[0]!.prob).toBeCloseTo(1, 10);
  });

  it('clamps p above 1 to keep everything', () => {
    expect(applyTopP(dist, 5).every((c) => c.kept)).toBe(true);
  });
});

describe('sample', () => {
  it('is reproducible for a fixed seed', () => {
    const draw = () => sample(dist, mulberry32(42));
    expect(draw()).toBe(draw());
  });

  it('never draws a token that truncation cut (prob 0)', () => {
    const truncated = applyTopK(dist, 1); // only "sunny" survives
    for (let seed = 0; seed < 200; seed++) {
      expect(sample(truncated, mulberry32(seed))).toBe('sunny');
    }
  });

  it('empirically approximates the distribution over many draws', () => {
    const rng = mulberry32(7);
    const counts: Record<string, number> = {};
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const t = sample(dist, rng);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    expect((counts.sunny ?? 0) / N).toBeCloseTo(0.5, 1);
    expect((counts.cloudy ?? 0) / N).toBeCloseTo(0.25, 1);
  });
});

describe('mulberry32', () => {
  it('produces a deterministic stream in [0, 1)', () => {
    const rng = mulberry32(1);
    const xs = Array.from({ length: 100 }, () => rng());
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    // Same seed, same stream.
    const rng2 = mulberry32(1);
    expect(Array.from({ length: 100 }, () => rng2())).toEqual(xs);
  });
});
