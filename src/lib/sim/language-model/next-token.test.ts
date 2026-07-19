import { describe, expect, it } from 'vitest';

import {
  generate,
  greedy,
  nextTokenDistribution,
  tokenize,
  trainNgram,
  type TokenProb,
} from './next-token';

describe('tokenize', () => {
  it('lowercases, splits on whitespace, and isolates sentence punctuation', () => {
    expect(tokenize('The cat sat. The dog ran!')).toEqual([
      'the',
      'cat',
      'sat',
      '.',
      'the',
      'dog',
      'ran',
      '!',
    ]);
  });

  it('drops empty tokens from extra whitespace', () => {
    expect(tokenize('  a   b  ')).toEqual(['a', 'b']);
  });
});

describe('trainNgram', () => {
  it('counts next-token frequencies as a real conditional distribution (the "weights")', () => {
    // "the" is followed by "cat" once and "dog" once → 50/50.
    const model = trainNgram('the cat sat the dog ran', 2);
    const dist = nextTokenDistribution(model, ['the']);
    const byToken = Object.fromEntries(dist.map((d) => [d.token, d.prob]));
    expect(byToken['cat']).toBeCloseTo(0.5);
    expect(byToken['dog']).toBeCloseTo(0.5);
  });

  it('a distribution always sums to ~1', () => {
    const model = trainNgram('a b a c a b a d', 2);
    const dist = nextTokenDistribution(model, ['a']);
    const total = dist.reduce((s, d) => s + d.prob, 0);
    expect(total).toBeCloseTo(1);
  });

  it('rejects order < 1', () => {
    expect(() => trainNgram('x y', 0)).toThrow(/order/);
  });

  it('supports trigram context (order 3 conditions on the previous two tokens)', () => {
    const model = trainNgram('i like cats and i like dogs', 3);
    // Context "i like" was followed by "cats" and "dogs" → 50/50.
    const dist = nextTokenDistribution(model, ['i', 'like']);
    const byToken = Object.fromEntries(dist.map((d) => [d.token, d.prob]));
    expect(byToken['cats']).toBeCloseTo(0.5);
    expect(byToken['dogs']).toBeCloseTo(0.5);
  });
});

describe('nextTokenDistribution', () => {
  it('backs off to the unigram distribution for an unseen context (never fails)', () => {
    const model = trainNgram('the cat sat', 2);
    const dist = nextTokenDistribution(model, ['zebra']); // never seen as a context
    // Falls back to overall token frequencies; every corpus token appears once → uniform.
    expect(dist.length).toBe(model.vocab.length);
    const total = dist.reduce((s, d) => s + d.prob, 0);
    expect(total).toBeCloseTo(1);
  });

  it('is sorted most-likely first', () => {
    const model = trainNgram('a b a b a c', 2);
    const dist = nextTokenDistribution(model, ['a']);
    for (let i = 1; i < dist.length; i++) {
      expect(dist[i - 1]!.prob).toBeGreaterThanOrEqual(dist[i]!.prob);
    }
  });
});

describe('generate (the autoregressive inference loop)', () => {
  const corpus = 'the sky is blue . the grass is green . the sky is clear .';

  it('extends the prompt one token at a time and records each step', () => {
    const model = trainNgram(corpus, 2);
    const out = generate(model, 'the sky is', 3);
    // Each step exposes the context, the real distribution, and the chosen token.
    expect(out.steps.length).toBeGreaterThan(0);
    expect(out.steps[0]!.context).toEqual(['the', 'sky', 'is']);
    expect(out.steps[0]!.distribution.reduce((s, d) => s + d.prob, 0)).toBeCloseTo(1);
    // The generated sequence starts with the prompt.
    expect(out.tokens.slice(0, 3)).toEqual(['the', 'sky', 'is']);
  });

  it('greedy decoding is deterministic', () => {
    const model = trainNgram(corpus, 2);
    const a = generate(model, 'the sky is', 4);
    const b = generate(model, 'the sky is', 4);
    expect(a.tokens).toEqual(b.tokens);
  });

  it('stops at a sentence-ending token', () => {
    const model = trainNgram('go home now .', 2);
    const out = generate(model, 'go home now', 10);
    expect(out.tokens[out.tokens.length - 1]).toBe('.');
    expect(out.tokens.length).toBeLessThan(10 + 3);
  });

  it('the weights are frozen during inference — generating does not change the model', () => {
    const model = trainNgram(corpus, 2);
    const before = nextTokenDistribution(model, ['the', 'sky']);
    generate(model, 'the sky is', 5);
    const after = nextTokenDistribution(model, ['the', 'sky']);
    expect(after).toEqual(before);
  });

  it('accepts an injected pick function so decoding stays factored out (the sampling concept)', () => {
    const model = trainNgram(corpus, 2);
    // A pick that always takes the LAST candidate proves generate delegates the choice.
    const pickLast = (dist: TokenProb[]) => dist[dist.length - 1]!.token;
    const out = generate(model, 'the sky is', 1, pickLast);
    const dist = nextTokenDistribution(model, ['the', 'sky', 'is']);
    expect(out.steps[0]!.chosen).toBe(dist[dist.length - 1]!.token);
  });
});

describe('greedy', () => {
  it('returns the most probable token', () => {
    expect(greedy([{ token: 'a', prob: 0.2 }, { token: 'b', prob: 0.8 }])).toBe('b');
  });
});
