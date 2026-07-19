import { describe, expect, it } from 'vitest';

import {
  runEval,
  scoreAssertion,
  type EvalCase,
  type Subject,
} from './harness';

describe('scoreAssertion — exact', () => {
  it('passes on identical strings', () => {
    expect(scoreAssertion('positive', { kind: 'exact', expected: 'positive' }).pass).toBe(true);
  });
  it('fails with mismatch on any difference', () => {
    const v = scoreAssertion('Positive', { kind: 'exact', expected: 'positive' });
    expect(v.pass).toBe(false);
    expect(v.failReason).toBe('mismatch');
  });
});

describe('scoreAssertion — contains', () => {
  it('passes when the needle is present', () => {
    expect(
      scoreAssertion('the answer is 42', { kind: 'contains', needle: '42' }).pass,
    ).toBe(true);
  });
  it('fails with missing-substring otherwise', () => {
    const v = scoreAssertion('no number here', { kind: 'contains', needle: '42' });
    expect(v.pass).toBe(false);
    expect(v.failReason).toBe('missing-substring');
  });
});

describe('scoreAssertion — json (shape vs value)', () => {
  const assertion = {
    kind: 'json' as const,
    requiredKeys: ['sentiment'],
    expectedValues: { sentiment: 'negative' },
  };

  it('fails not-json when output does not parse', () => {
    const v = scoreAssertion('sentiment: negative', assertion);
    expect(v.pass).toBe(false);
    expect(v.failReason).toBe('not-json');
  });

  it('fails wrong-shape when a required key is missing', () => {
    const v = scoreAssertion('{"mood":"negative"}', assertion);
    expect(v.pass).toBe(false);
    expect(v.failReason).toBe('wrong-shape');
  });

  it('fails wrong-VALUE when the shape is valid but the value is wrong — the core lesson', () => {
    // Valid JSON, correct key — a schema validator would pass this. The eval catches it.
    const v = scoreAssertion('{"sentiment":"positive"}', assertion);
    expect(v.pass).toBe(false);
    expect(v.failReason).toBe('wrong-value');
    expect(v.detail).toMatch(/valid shape, wrong value/);
  });

  it('passes only when shape AND value are correct', () => {
    expect(scoreAssertion('{"sentiment":"negative"}', assertion).pass).toBe(true);
  });

  it('shape-only assertion (no expectedValues) passes any valid-keyed object', () => {
    const shapeOnly = { kind: 'json' as const, requiredKeys: ['sentiment'] };
    expect(scoreAssertion('{"sentiment":"anything"}', shapeOnly).pass).toBe(true);
  });
});

describe('runEval', () => {
  // A deliberately buggy subject: it gets one case's VALUE wrong while staying valid JSON.
  const subject: Subject = (input) =>
    ({
      'a: greet': 'hello',
      'b: contains': 'the total is 42 dollars',
      'c: valid-but-wrong': '{"sentiment":"positive"}', // valid shape, wrong value
      'd: correct-json': '{"sentiment":"negative"}',
    })[input] ?? '';

  const cases: EvalCase[] = [
    { id: 'a', input: 'a: greet', assertion: { kind: 'exact', expected: 'hello' } },
    { id: 'b', input: 'b: contains', assertion: { kind: 'contains', needle: '42' } },
    {
      id: 'c',
      input: 'c: valid-but-wrong',
      assertion: { kind: 'json', requiredKeys: ['sentiment'], expectedValues: { sentiment: 'negative' } },
    },
    {
      id: 'd',
      input: 'd: correct-json',
      assertion: { kind: 'json', requiredKeys: ['sentiment'], expectedValues: { sentiment: 'negative' } },
    },
  ];

  it('scores the suite and pinpoints the valid-but-wrong failure', () => {
    const report = runEval(subject, cases);
    expect(report.total).toBe(4);
    expect(report.passed).toBe(3);
    expect(report.score).toBe(0.75);
    const c = report.results.find((r) => r.id === 'c')!;
    expect(c.pass).toBe(false);
    expect(c.failReason).toBe('wrong-value');
  });

  it('returns score 0 for an empty suite without dividing by zero', () => {
    expect(runEval(subject, []).score).toBe(0);
  });

  it('every result carries a human-readable detail string', () => {
    for (const r of runEval(subject, cases).results) {
      expect(r.detail.length).toBeGreaterThan(0);
    }
  });
});
