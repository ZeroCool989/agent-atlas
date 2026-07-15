/**
 * Deterministic demonstration cases for the Structured Outputs lesson. Each case drives
 * the REAL extractStructured pipeline with a ScriptedProvider returning a canned model
 * output, so the lesson's visualization shows the actual mechanism handling each failure
 * mode — clearly labelled as scripted demonstrations, not measured model behavior.
 */
import { z } from 'zod';

import { parseScenario, ScriptedProvider } from '../model';
import { extractStructured } from './extract';
import type { StructuredStage } from './extract';

/** The target shape for the demonstrations: a person record. */
export const PERSON_SCHEMA = z
  .object({
    name: z.string().min(1),
    age: z.number().int().nonnegative(),
    city: z.string().min(1),
  })
  .strict();

export const PERSON_SCHEMA_DESCRIPTION = '{ "name": string, "age": integer, "city": string }';

const PROMPT = 'Extract the person as JSON: "Ada Lovelace, 36, lives in London."';
const VALID = '{"name":"Ada Lovelace","age":36,"city":"London"}';

export interface StructuredCase {
  key: 'clean' | 'fenced' | 'prose' | 'invalid-json' | 'schema-invalid' | 'unrecoverable';
  label: string;
  summary: string;
  provenance: 'scripted';
  ok: boolean;
  attempts: number;
  value?: unknown;
  stages: StructuredStage[];
}

/** A scenario whose turns return the given raw model outputs, in order. */
function scenarioOf(id: string, outputs: string[]) {
  return parseScenario({
    id,
    description: `Structured-output demonstration: ${id}`,
    turns: outputs.map((text) => ({ respond: { text, stopReason: 'completed' } })),
  });
}

async function runCase(id: string, outputs: string[], maxAttempts = 3) {
  return extractStructured({
    provider: new ScriptedProvider(scenarioOf(id, outputs)),
    prompt: PROMPT,
    schema: PERSON_SCHEMA,
    schemaDescription: PERSON_SCHEMA_DESCRIPTION,
    maxAttempts,
  });
}

export async function buildStructuredCases(): Promise<StructuredCase[]> {
  const clean = await runCase('clean', [VALID]);
  const fenced = await runCase('fenced', ['```json\n' + VALID + '\n```']);
  const prose = await runCase('prose', [`Sure! Here is the extracted person:\n${VALID}\nLet me know if you need anything else.`]);
  const invalidJson = await runCase('invalid-json', ['{"name":"Ada Lovelace","age":,"city":"London"}', VALID]);
  const schemaInvalid = await runCase('schema-invalid', ['{"name":"Ada Lovelace","city":"London"}', VALID]);
  const unrecoverable = await runCase('unrecoverable', ['not json at all', 'still not json'], 2);

  return [
    {
      key: 'clean',
      label: 'Clean JSON',
      summary: 'The model returned exactly the JSON asked for. Parse and validate both pass on the first attempt.',
      provenance: 'scripted',
      ...clean,
    },
    {
      key: 'fenced',
      label: 'Markdown-fenced JSON',
      summary: 'The model wrapped the JSON in a ```json code fence — a naive JSON.parse would fail. Isolating the JSON fixes it.',
      provenance: 'scripted',
      ...fenced,
    },
    {
      key: 'prose',
      label: 'JSON wrapped in prose',
      summary: 'The model added a friendly sentence around the JSON. The pipeline extracts the balanced JSON block, then validates.',
      provenance: 'scripted',
      ...prose,
    },
    {
      key: 'invalid-json',
      label: 'Invalid JSON → retry',
      summary: 'The first response is not valid JSON. The pipeline feeds the parse error back and the retry returns valid JSON.',
      provenance: 'scripted',
      ...invalidJson,
    },
    {
      key: 'schema-invalid',
      label: 'Schema mismatch → retry',
      summary: 'Valid JSON, but "age" is missing. Schema validation rejects it; the retry, told what was wrong, returns a conforming object.',
      provenance: 'scripted',
      ...schemaInvalid,
    },
    {
      key: 'unrecoverable',
      label: 'Never valid → typed failure',
      summary: 'The model never produces valid JSON. After the retry budget is exhausted the pipeline returns a typed failure — never a fabricated value.',
      provenance: 'scripted',
      ...unrecoverable,
    },
  ];
}
