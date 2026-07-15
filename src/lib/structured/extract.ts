/**
 * Structured-output extraction — the L1 build project (plan §3): turn a model's free
 * text into a schema-validated value, or fail honestly. Plain TypeScript on the
 * ModelProvider interface (ADR-0005), written to be read.
 *
 * This is the general case that tool calling is a provider-enforced instance of: the
 * same parse → validate → (retry) pipeline the runtime runs on a tool call's arguments,
 * applied here to a free-form response. Every stage is recorded so the lesson can show
 * exactly where an output passes or fails — the same three concerns as tool-call
 * validation: is it well-formed text, is it valid JSON, does it match the schema.
 */
import type { ZodType } from 'zod';

import type { Message, ModelProvider } from '../model';

export type StructuredStageStatus = 'info' | 'ok' | 'fixed' | 'fail';

export interface StructuredStage {
  attempt: number;
  label: string;
  status: StructuredStageStatus;
  detail: string;
  /** The text/JSON at this stage, when useful to show. */
  content?: string;
}

export interface ExtractResult<T> {
  ok: boolean;
  value?: T;
  stages: StructuredStage[];
  attempts: number;
}

export interface ExtractOptions<T> {
  provider: ModelProvider;
  system?: string;
  prompt: string;
  schema: ZodType<T>;
  /** A human/JSON-schema description shown to the model so it knows the target shape. */
  schemaDescription: string;
  /** Retry-on-invalid budget (the retry loop is the mechanism's whole point). */
  maxAttempts?: number;
}

/**
 * Isolate the JSON from a model response: strip a leading/trailing markdown code fence,
 * then, if prose still surrounds it, extract the first balanced {...} or [...] block.
 * Returns the isolated text and whether any stripping was needed (the teaching signal:
 * a naive JSON.parse fails on fenced or prose-wrapped output).
 */
export function isolateJson(text: string): { text: string; changed: boolean } {
  const original = text.trim();
  let t = original;

  const fence = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(t);
  if (fence) t = fence[1]!.trim();

  if (!(t.startsWith('{') || t.startsWith('['))) {
    const start = t.search(/[{[]/);
    if (start >= 0) {
      const open = t[start]!;
      const close = open === '{' ? '}' : ']';
      let depth = 0;
      for (let i = start; i < t.length; i++) {
        if (t[i] === open) depth++;
        else if (t[i] === close) {
          depth--;
          if (depth === 0) {
            t = t.slice(start, i + 1);
            break;
          }
        }
      }
    }
  }
  return { text: t, changed: t !== original };
}

function buildUserPrompt(prompt: string, schemaDescription: string): string {
  return `${prompt}\n\nReturn ONLY a JSON value matching this schema, with no prose and no code fences:\n${schemaDescription}`;
}

export async function extractStructured<T>(options: ExtractOptions<T>): Promise<ExtractResult<T>> {
  const maxAttempts = options.maxAttempts ?? 3;
  const stages: StructuredStage[] = [];
  const messages: Message[] = [
    { role: 'user', text: buildUserPrompt(options.prompt, options.schemaDescription) },
  ];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await options.provider.complete({
      ...(options.system !== undefined ? { system: options.system } : {}),
      messages,
    });
    const raw = response.text ?? '';
    stages.push({ attempt, label: 'Model output', status: 'info', detail: 'the model returned free text', content: raw });

    const isolated = isolateJson(raw);
    if (isolated.changed) {
      stages.push({
        attempt,
        label: 'Isolate JSON',
        status: 'fixed',
        detail: 'stripped code fences / surrounding prose — a naive parse would have failed here',
        content: isolated.text,
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(isolated.text);
      stages.push({ attempt, label: 'Parse JSON', status: 'ok', detail: 'the text is valid JSON' });
    } catch (error) {
      stages.push({ attempt, label: 'Parse JSON', status: 'fail', detail: (error as Error).message });
      if (attempt < maxAttempts) {
        messages.push({ role: 'assistant', text: raw });
        messages.push({ role: 'user', text: `That was not valid JSON (${(error as Error).message}). Return ONLY the JSON value.` });
      }
      continue;
    }

    const result = options.schema.safeParse(parsed);
    if (result.success) {
      stages.push({ attempt, label: 'Validate schema', status: 'ok', detail: 'the JSON matches the schema' });
      stages.push({ attempt, label: 'Typed value', status: 'ok', detail: 'a validated, typed value is returned to the application' });
      return { ok: true, value: result.data, stages, attempts: attempt };
    }

    const detail = result.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    stages.push({ attempt, label: 'Validate schema', status: 'fail', detail });
    if (attempt < maxAttempts) {
      messages.push({ role: 'assistant', text: raw });
      messages.push({ role: 'user', text: `The JSON did not match the schema (${detail}). Return corrected JSON only.` });
    }
  }

  stages.push({ attempt: maxAttempts, label: 'Give up', status: 'fail', detail: `no valid result after ${maxAttempts} attempt(s) — the application gets a typed failure, never a fabricated value` });
  return { ok: false, stages, attempts: maxAttempts };
}
