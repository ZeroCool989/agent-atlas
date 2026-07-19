import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { check, groundingCheck, policyCheck, schemaCheck, valueCheck } from './checks';
import { runChecks, type Candidate, type Check } from './pipeline';

const RefundDecision = z
  .object({
    decision: z.enum(['approve', 'deny']),
    amountUsd: z.number().nonnegative(),
    currency: z.string(),
    rationale: z.string(),
  })
  .strict();

const provided = ['refund-policy', 'shipping-policy'];

describe('schemaCheck (reuses structured-outputs isolate + Zod validate)', () => {
  const c = schemaCheck('shape: RefundDecision', RefundDecision);

  it('passes a well-shaped output and reports the schema kind', () => {
    const out = c.run({ text: '{"decision":"approve","amountUsd":40,"currency":"USD","rationale":"ok [refund-policy]."}' });
    expect(out.passed).toBe(true);
    expect(c.kind).toBe('schema');
  });

  it('isolates JSON from surrounding prose before validating', () => {
    const out = c.run({ text: 'Sure! {"decision":"deny","amountUsd":0,"currency":"USD","rationale":"no [refund-policy]."}' });
    expect(out.passed).toBe(true);
  });

  it('fails a missing-key output and names the offending path', () => {
    const out = c.run({ text: '{"decision":"approve","rationale":"ok [refund-policy]."}' });
    expect(out.passed).toBe(false);
    expect(out.offending).toContain('amountUsd');
  });

  it('fails non-JSON with a parse detail, not a crash', () => {
    const out = c.run({ text: 'I approve this refund.' });
    expect(out.passed).toBe(false);
    expect(out.detail).toMatch(/not valid JSON/i);
  });
});

describe('valueCheck (reuses the eval assertion kinds)', () => {
  // Policy: refunds must be issued in USD — a value rule a schema (currency: string) cannot express.
  const c = valueCheck('policy: USD only', {
    kind: 'json',
    requiredKeys: ['currency'],
    expectedValues: { currency: 'USD' },
  });

  it('passes a schema-valid AND value-correct output', () => {
    expect(c.run({ text: '{"currency":"USD"}' }).passed).toBe(true);
  });

  it('catches the schema-valid-but-wrong-value output (the shape ≠ value lesson)', () => {
    const out = c.run({ text: '{"currency":"EUR"}' });
    expect(out.passed).toBe(false);
    expect(out.offending).toContain('wrong-value');
  });
});

describe('groundingCheck (reuses the reliability citation checker)', () => {
  const c = groundingCheck('grounding: rationale cites retrieved policy', { field: 'rationale' });

  it('passes when the cited source was actually provided', () => {
    const out = c.run({ text: '{"rationale":"Within the window [refund-policy]."}', providedSourceIds: provided });
    expect(out.passed).toBe(true);
  });

  it('catches a fabricated citation (an id never retrieved)', () => {
    const out = c.run({ text: '{"rationale":"14 days [refund-policy-2020]."}', providedSourceIds: provided });
    expect(out.passed).toBe(false);
    expect(out.offending).toContain('refund-policy-2020');
  });

  it('honest limit: a RESOLVING citation is marked grounded even if it does not support the claim', () => {
    // The source is real/provided, so grounding passes — verifying actual support is out of scope.
    const out = c.run({ text: '{"rationale":"The tower is sky blue [refund-policy]."}', providedSourceIds: provided });
    expect(out.passed).toBe(true);
  });
});

describe('policyCheck (deterministic guardrail)', () => {
  const c = policyCheck('guardrail: no internal-only leakage', {
    forbidden: [/internal[- ]only/i, /do not tell the customer/i],
  });

  it('passes clean text', () => {
    expect(c.run({ text: '{"rationale":"Approved [refund-policy]."}' }).passed).toBe(true);
  });

  it('blocks text containing a forbidden pattern and reports the match', () => {
    const out = c.run({ text: '{"rationale":"Deny — internal-only note [refund-policy]."}' });
    expect(out.passed).toBe(false);
    expect(out.offending?.length).toBeGreaterThan(0);
  });
});

describe('runChecks — gate pipeline', () => {
  const checks: Check[] = [
    schemaCheck('shape: RefundDecision', RefundDecision),
    valueCheck('policy: USD only', { kind: 'json', requiredKeys: ['currency'], expectedValues: { currency: 'USD' } }),
    groundingCheck('grounding: rationale cites retrieved policy', { field: 'rationale' }),
    policyCheck('guardrail: no internal-only leakage', { forbidden: [/internal[- ]only/i] }),
  ];
  const run = (text: string, ids = provided): Candidate & { text: string } => ({ text, providedSourceIds: ids });

  it('a clean output passes every gate and may proceed', () => {
    const report = runChecks(
      run('{"decision":"approve","amountUsd":40,"currency":"USD","rationale":"Within the 30-day window [refund-policy]."}'),
      checks,
    );
    expect(report.passed).toBe(true);
    expect(report.mayProceed).toBe(true);
    expect(report.failedAt).toBeUndefined();
    expect(report.results.every((r) => r.status === 'passed')).toBe(true);
  });

  it('stops at the first failing gate and skips the rest (fail-fast)', () => {
    // Missing amountUsd/currency → schema gate fails; value/grounding/policy never run.
    const report = runChecks(run('{"decision":"approve","rationale":"ok [refund-policy]."}'), checks);
    expect(report.mayProceed).toBe(false);
    expect(report.failedAt?.kind).toBe('schema');
    expect(report.results[0]!.status).toBe('failed');
    expect(report.results.slice(1).every((r) => r.status === 'skipped')).toBe(true);
  });

  it('the value gate catches a schema-valid-but-wrong output', () => {
    const report = runChecks(
      run('{"decision":"approve","amountUsd":40,"currency":"EUR","rationale":"Approved [refund-policy]."}'),
      checks,
    );
    expect(report.failedAt?.kind).toBe('value');
    expect(report.results[0]!.status).toBe('passed'); // schema passed
  });

  it('the grounding gate catches a fabricated citation after schema+value pass', () => {
    const report = runChecks(
      run('{"decision":"deny","amountUsd":0,"currency":"USD","rationale":"Receipts within 14 days [refund-policy-2020]."}'),
      checks,
    );
    expect(report.failedAt?.kind).toBe('grounding');
    expect(report.failedAt?.offending).toContain('refund-policy-2020');
  });

  it('the policy gate catches leaked content after all earlier gates pass', () => {
    const report = runChecks(
      run('{"decision":"deny","amountUsd":0,"currency":"USD","rationale":"Deny — internal-only note [refund-policy]."}'),
      checks,
    );
    expect(report.failedAt?.kind).toBe('policy');
  });

  it('the honest limit: an output can pass EVERY gate and still be wrong', () => {
    // Schema-valid, USD, cites a real provided source, no banned content — yet the real
    // refund window is 14 days, so the correct decision was deny. No gate encodes that
    // rule, and the resolving citation does not actually support the "within window" claim.
    const report = runChecks(
      run('{"decision":"approve","amountUsd":40,"currency":"USD","rationale":"The order is within the refund window [refund-policy]."}'),
      checks,
    );
    expect(report.mayProceed).toBe(true); // green…
    // …but "may proceed" only means "tripped no check", never "is correct".
  });

  it('an empty pipeline vacuously proceeds (no check ran)', () => {
    expect(runChecks(run('anything'), []).mayProceed).toBe(true);
  });
});

describe('check — generic escape hatch for custom constraints', () => {
  it('wraps a cross-field invariant as a value check', () => {
    const totalMatches = check('invariant: total = sum(items)', 'value', (candidate) => {
      const obj = JSON.parse(candidate.text) as { total: number; items: number[] };
      const sum = obj.items.reduce((a, b) => a + b, 0);
      return obj.total === sum
        ? { passed: true, detail: 'total equals the sum of items' }
        : { passed: false, detail: `total ${obj.total} ≠ sum ${sum}`, offending: ['total'] };
    });
    expect(totalMatches.run({ text: '{"total":6,"items":[1,2,3]}' }).passed).toBe(true);
    expect(totalMatches.run({ text: '{"total":7,"items":[1,2,3]}' }).passed).toBe(false);
  });
});
