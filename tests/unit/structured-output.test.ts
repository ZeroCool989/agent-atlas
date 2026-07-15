import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  buildStructuredCases,
  extractStructured,
  isolateJson,
  PERSON_SCHEMA,
  PERSON_SCHEMA_DESCRIPTION,
} from '../../src/lib/structured';
import { parseScenario, ScriptedProvider } from '../../src/lib/model';
import type { Scenario } from '../../src/lib/model';

function providerReturning(...texts: string[]) {
  const scenario: Scenario = parseScenario({
    id: 'inline',
    description: 'inline',
    turns: texts.map((text) => ({ respond: { text, stopReason: 'completed' } })),
  });
  return new ScriptedProvider(scenario);
}

const VALID = '{"name":"Ada Lovelace","age":36,"city":"London"}';
const extract = (provider: ScriptedProvider, maxAttempts = 3) =>
  extractStructured({ provider, prompt: 'Extract the person.', schema: PERSON_SCHEMA, schemaDescription: PERSON_SCHEMA_DESCRIPTION, maxAttempts });

describe('isolateJson', () => {
  it('leaves clean JSON unchanged', () => {
    expect(isolateJson(VALID)).toEqual({ text: VALID, changed: false });
  });
  it('strips a ```json code fence', () => {
    expect(isolateJson('```json\n' + VALID + '\n```')).toEqual({ text: VALID, changed: true });
  });
  it('extracts a balanced object from surrounding prose', () => {
    const r = isolateJson(`Here you go: ${VALID} — hope that helps!`);
    expect(r.text).toBe(VALID);
    expect(r.changed).toBe(true);
  });
  it('handles nested braces correctly', () => {
    const nested = '{"a":{"b":1},"c":2}';
    expect(isolateJson(`prefix ${nested} suffix`).text).toBe(nested);
  });
});

describe('extractStructured', () => {
  it('clean JSON: parse and validate pass on attempt 1', async () => {
    const result = await extract(providerReturning(VALID));
    expect(result).toMatchObject({ ok: true, attempts: 1, value: { name: 'Ada Lovelace', age: 36, city: 'London' } });
    expect(result.stages.map((s) => `${s.label}:${s.status}`)).toEqual([
      'Model output:info',
      'Parse JSON:ok',
      'Validate schema:ok',
      'Typed value:ok',
    ]);
  });

  it('fenced output: an isolate stage appears before a successful parse', async () => {
    const result = await extract(providerReturning('```json\n' + VALID + '\n```'));
    expect(result.ok).toBe(true);
    expect(result.stages.some((s) => s.label === 'Isolate JSON' && s.status === 'fixed')).toBe(true);
  });

  it('invalid JSON then valid: retries and succeeds on attempt 2', async () => {
    const result = await extract(providerReturning('{"name":"Ada","age":,"city":"x"}', VALID));
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(result.stages.filter((s) => s.label === 'Parse JSON').map((s) => s.status)).toEqual(['fail', 'ok']);
  });

  it('schema mismatch then valid: validation fails, retry succeeds', async () => {
    const result = await extract(providerReturning('{"name":"Ada Lovelace","city":"London"}', VALID));
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    const validations = result.stages.filter((s) => s.label === 'Validate schema');
    expect(validations.map((s) => s.status)).toEqual(['fail', 'ok']);
    expect(validations[0]!.detail).toContain('age');
  });

  it('never valid: returns a typed failure, never a fabricated value', async () => {
    const result = await extract(providerReturning('nope', 'still nope'), 2);
    expect(result.ok).toBe(false);
    expect(result.value).toBeUndefined();
    expect(result.stages.at(-1)).toMatchObject({ label: 'Give up', status: 'fail' });
  });

  it('rejects unknown keys via the strict schema (extra field)', async () => {
    const result = await extract(providerReturning('{"name":"Ada","age":36,"city":"x","extra":true}', VALID), 2);
    // attempt 1 fails strict validation, attempt 2 clean → succeeds
    expect(result.ok).toBe(true);
    expect(result.stages.filter((s) => s.label === 'Validate schema')[0]!.status).toBe('fail');
  });

  it('coerces nothing silently — wrong type is a validation failure', async () => {
    const schema = z.object({ age: z.number() }).strict();
    const result = await extractStructured({
      provider: providerReturning('{"age":"thirty-six"}', '{"age":36}'),
      prompt: 'x',
      schema,
      schemaDescription: '{age:number}',
      maxAttempts: 2,
    });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
  });
});

describe('buildStructuredCases (demonstrations)', () => {
  it('produces the six failure-mode cases with correct outcomes', async () => {
    const cases = await buildStructuredCases();
    const byKey = Object.fromEntries(cases.map((c) => [c.key, c]));
    expect(cases.map((c) => c.key)).toEqual(['clean', 'fenced', 'prose', 'invalid-json', 'schema-invalid', 'unrecoverable']);
    expect(byKey['clean']!.ok).toBe(true);
    expect(byKey['fenced']!.stages.some((s) => s.label === 'Isolate JSON')).toBe(true);
    expect(byKey['invalid-json']!.attempts).toBe(2);
    expect(byKey['schema-invalid']!.attempts).toBe(2);
    expect(byKey['unrecoverable']!.ok).toBe(false);
    expect(cases.every((c) => c.provenance === 'scripted')).toBe(true);
  });

  it('is deterministic across builds (no shared state)', async () => {
    expect(await buildStructuredCases()).toEqual(await buildStructuredCases());
  });
});
