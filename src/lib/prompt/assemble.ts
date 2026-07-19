/**
 * The L1/prompt-engineering build project (ADR-0005, plan §3): deterministic prompt
 * ASSEMBLY. Prompt engineering is context construction, not magic words — the model only
 * ever sees the text you assemble into its context, so this module makes that assembly
 * explicit: parts in, a provider-neutral `ModelRequest` out, with an honest token budget.
 *
 * Plain TypeScript — no Astro, React, UI, or SDK imports. It maps onto the model layer's
 * `ModelRequest` (`src/lib/model/types.ts`), the same shape the ScriptedProvider consumes,
 * so what the lesson assembles is exactly what a model would receive. Read it as course
 * material: every stage is a named, testable function.
 */
import type { Message, ModelRequest } from '../model/types';

/** One demonstration for few-shot prompting: an input paired with the desired output. */
export interface FewShotExample {
  input: string;
  output: string;
}

/**
 * The parts a prompt is built from. Only `task` is required — the rest are the levers
 * prompt engineering actually pulls: a role/instruction (`system`), demonstrations
 * (`examples`), and an output-format contract (`formatSpec`).
 */
export interface PromptParts {
  /** Instructions and role — where "you are a…" and the rules live. */
  system?: string;
  /** Few-shot demonstrations; each becomes a user turn followed by an assistant turn. */
  examples?: FewShotExample[];
  /** The actual request — the one non-optional part. */
  task: string;
  /** How the answer should be shaped, appended to the task (see the structured-outputs concept). */
  formatSpec?: string;
}

/**
 * Standard estimation heuristic: ~4 characters per token for typical English. Real
 * tokenization is exact and model-specific (see the `tokens` concept and the BPE build
 * project); this approximation is what you use for *budgeting* when you don't want to run
 * the tokenizer. It is deliberately a rule of thumb, not a promise.
 */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Assemble the parts into a provider-neutral `ModelRequest`. The mapping is the lesson:
 *   - `system` text goes on `request.system` (providers disagree on where it lives; the
 *     model layer normalizes that, so we don't encode a vendor choice here).
 *   - each few-shot example becomes a `user` turn (the input) and an `assistant` turn (the
 *     desired output) — the model learns the pattern by seeing completed pairs.
 *   - the `task`, with the `formatSpec` appended, is the final `user` turn.
 * Deterministic: identical parts always produce an identical request.
 */
export function assemblePrompt(parts: PromptParts): ModelRequest {
  const messages: Message[] = [];

  for (const example of parts.examples ?? []) {
    messages.push({ role: 'user', text: example.input });
    messages.push({ role: 'assistant', text: example.output });
  }

  const task = parts.formatSpec ? `${parts.task}\n\n${parts.formatSpec}` : parts.task;
  messages.push({ role: 'user', text: task });

  const request: ModelRequest = { messages };
  if (parts.system) request.system = parts.system;
  return request;
}

/** One named piece of the assembled prompt, with its estimated token cost. */
export interface PromptSegment {
  label: string;
  kind: 'system' | 'examples' | 'task' | 'format';
  text: string;
  tokens: number;
}

/** The token budget of an assembled prompt against a context window. */
export interface PromptBudget {
  segments: PromptSegment[];
  totalTokens: number;
  windowTokens: number;
  /** Percent of the window the prompt consumes, one decimal. */
  percentUsed: number;
  /** True when the prompt alone meets or exceeds the window — no room for a reply. */
  overBudget: boolean;
  /** Set when the prompt crowds the window (default: ≥ 80% used). */
  warning?: string;
}

/** Warn once the prompt consumes this fraction of the window — no room left for output. */
export const NEAR_CAPACITY_FRACTION = 0.8;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Break the assembled prompt into its labelled segments and price each against the
 * window. This is the honest cost of a prompt: every instruction, example, and format
 * rule you add is tokens spent before the model writes a word — and the reply needs room
 * too. Longer is not automatically better.
 */
export function budgetFor(parts: PromptParts, windowTokens: number): PromptBudget {
  if (!Number.isInteger(windowTokens) || windowTokens <= 0) {
    throw new Error(`budgetFor: windowTokens must be a positive integer (got ${windowTokens})`);
  }

  const segments: PromptSegment[] = [];
  if (parts.system) {
    segments.push({ label: 'System / instructions', kind: 'system', text: parts.system, tokens: estimateTokens(parts.system) });
  }
  const exampleText = (parts.examples ?? []).map((e) => `${e.input}\n${e.output}`).join('\n');
  if (exampleText) {
    segments.push({ label: `Few-shot examples (${parts.examples!.length})`, kind: 'examples', text: exampleText, tokens: estimateTokens(exampleText) });
  }
  segments.push({ label: 'Task', kind: 'task', text: parts.task, tokens: estimateTokens(parts.task) });
  if (parts.formatSpec) {
    segments.push({ label: 'Output format', kind: 'format', text: parts.formatSpec, tokens: estimateTokens(parts.formatSpec) });
  }

  const totalTokens = segments.reduce((sum, s) => sum + s.tokens, 0);
  const percentUsed = round1((totalTokens / windowTokens) * 100);
  const overBudget = totalTokens >= windowTokens;

  const budget: PromptBudget = { segments, totalTokens, windowTokens, percentUsed, overBudget };
  if (overBudget) {
    budget.warning = `The prompt alone uses ${totalTokens} of ${windowTokens} tokens — there is no room left for the model's reply.`;
  } else if (totalTokens >= windowTokens * NEAR_CAPACITY_FRACTION) {
    budget.warning = `The prompt uses ${percentUsed}% of the window; little room remains for a long answer.`;
  }
  return budget;
}
