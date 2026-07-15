import { describe, expect, it } from 'vitest';

import {
  buildToolCallingCases,
  buildValidationLayerCases,
  calculatorTool,
  evaluateExpression,
  unreliableLookupTool,
} from '../../src/lib/agent';

describe('buildValidationLayerCases — the three gates, computed by the real tool', () => {
  const cases = buildValidationLayerCases();
  const byLabel = Object.fromEntries(cases.map((c) => [c.label, c]));

  it('a supported calculation clears all three gates and yields a result', () => {
    const c = byLabel['A calculation the tool supports']!;
    expect([c.message.pass, c.schema.pass, c.semantic.pass]).toEqual([true, true, true]);
    expect(c.result).toBe('6223');
    expect(c.provenance).toBe('measured');
  });

  it('the signature case "2 ** 0.5": message ✓, schema ✓, semantic ✗ (the real error)', () => {
    const c = byLabel['A power operator the grammar lacks']!;
    expect([c.message.pass, c.schema.pass, c.semantic.pass]).toEqual([true, true, false]);
    expect(c.semantic.detail).toBe('unexpected character "*" at position 3');
    expect(c.evidence).toBe('Experiment 006');
    // This IS what Experiment 006 measured — cross-check against the real tool.
    expect(evaluateExpression('2 ** 0.5').ok).toBe(false);
  });

  it('a wrong argument key fails at schema; semantic is never reached', () => {
    const c = byLabel['A wrong argument key']!;
    expect(c.schema.pass).toBe(false);
    expect(c.semantic.pass).toBe(false);
    expect(c.semantic.detail).toContain('never gets past schema');
    expect(c.result).toBeUndefined();
  });

  it('division by zero passes schema but fails execution', () => {
    const c = byLabel['Division by zero']!;
    expect([c.schema.pass, c.semantic.pass]).toEqual([true, false]);
    expect(c.semantic.detail).toContain('division by zero');
  });
});

describe('buildToolCallingCases — one trace per outcome class, through the real runtime', () => {
  it('produces the five outcome classes with correct runtime outcomes', async () => {
    const cases = await buildToolCallingCases();
    const byKey = Object.fromEntries(cases.map((c) => [c.key, c]));
    expect(cases.map((c) => c.key)).toEqual([
      'success',
      'schema-failure',
      'semantic-failure',
      'unknown-tool',
      'tool-error',
    ]);
    expect(byKey['success']!.outcome).toBe('completed');
    expect(byKey['schema-failure']!.outcome).toBe('invalid-tool-request');
    expect(byKey['semantic-failure']!.outcome).toBe('tool-error');
    expect(byKey['unknown-tool']!.outcome).toBe('invalid-tool-request');
    expect(byKey['tool-error']!.outcome).toBe('tool-error');
  });

  it('the semantic-failure trace shows schema passing then execution failing', async () => {
    const cases = await buildToolCallingCases();
    const trace = cases.find((c) => c.key === 'semantic-failure')!.trace;
    expect(trace.some((e) => e.type === 'tool-validated')).toBe(true); // schema passed
    const executed = trace.find((e) => e.type === 'tool-executed')!;
    expect(executed.outcome).toBe('tool-error'); // execution failed
  });

  it('the unknown-tool trace shows the allowlist rejection before any execution', async () => {
    const cases = await buildToolCallingCases();
    const trace = cases.find((c) => c.key === 'unknown-tool')!.trace;
    expect(trace.some((e) => e.type === 'tool-rejected')).toBe(true);
    expect(trace.some((e) => e.type === 'tool-executed')).toBe(false);
  });

  it('is deterministic and has no shared mutable state across builds', async () => {
    const a = await buildToolCallingCases();
    const b = await buildToolCallingCases();
    expect(b).toEqual(a);
  });
});

describe('unreliableLookupTool (the external-failure teaching tool)', () => {
  it('accepts a valid query but always fails execution', () => {
    expect(unreliableLookupTool.parseArgs({ query: 'x' }).ok).toBe(true);
    expect(unreliableLookupTool.execute({ query: 'x' })).toEqual({
      ok: false,
      error: expect.stringContaining('external failure'),
    });
  });
  it('still rejects invalid arguments at the schema layer', () => {
    expect(unreliableLookupTool.parseArgs({}).ok).toBe(false);
    expect(calculatorTool.definition.name).toBe('calculator'); // sanity: both tools exported
  });
});
