/**
 * The `(input, step) => Scene` function for the tokenization demo — the reference
 * implementation of the step-scene pattern (ADR-0004). Pure and deterministic:
 * identical input + step always yields an identical, complete scene; no clocks, no
 * randomness; out-of-range steps clamp (see timeline.ts). Each call returns fresh
 * objects, so a consumer mutating one scene cannot affect the next.
 */
import { computeContextWindow } from './context-window';
import { clampStep } from './timeline';
import type { Timeline, TokenScene, TokenView } from './types';

export interface TokenSceneInput {
  sourceText: string;
  /** Pre-tokenized, deterministic sample data — explicitly illustrative (see demo). */
  tokens: Array<{ text: string; id: number }>;
  capacityTokens: number;
}

export const TOKEN_SCENE_TIMELINE: Timeline = {
  steps: [
    {
      label: 'Raw text',
      description:
        'The model never sees this string as you wrote it. Before anything else happens, the text must be split into tokens.',
    },
    {
      label: 'Token boundaries',
      description:
        'A tokenizer splits the text into tokens — word pieces, not words. Note how "Tokenization" becomes two tokens and the apostrophe splits "isn’t".',
    },
    {
      label: 'Token ids',
      description:
        'Each token maps to an id in a fixed vocabulary. The model computes over these ids — it never sees characters, which is why letter-counting questions can fail.',
    },
    {
      label: 'Entering the context window',
      description:
        'Tokens are consumed into the context window one by one. Each token spends a slot of finite capacity — this is what you pay for and what fills up.',
    },
    {
      label: 'Capacity used',
      description:
        'All tokens are in the window. Remaining capacity is what is left for the rest of the conversation and the model’s answer.',
    },
  ],
};

/** How many tokens have entered the window at the "entering" step (the rest follow at the final step). */
const PARTIAL_FILL = 4;

export function createTokenScene(input: TokenSceneInput, step: number): TokenScene {
  const totalSteps = TOKEN_SCENE_TIMELINE.steps.length;
  const current = clampStep(step, totalSteps);
  const timelineStep = TOKEN_SCENE_TIMELINE.steps[current]!;

  const showBoundaries = current >= 1;
  const showIds = current >= 2;

  const consumedCount =
    current < 3 ? 0 : current === 3 ? Math.min(PARTIAL_FILL, input.tokens.length) : input.tokens.length;

  const tokens: TokenView[] = input.tokens.map((token, index) => ({
    index,
    text: token.text,
    ...(showIds ? { id: token.id } : {}),
    state:
      index < consumedCount
        ? 'completed'
        : current === 3 && index === consumedCount
          ? 'active'
          : 'inactive',
  }));

  return {
    step: current,
    totalSteps,
    title: timelineStep.label,
    description: timelineStep.description ?? '',
    sourceText: input.sourceText,
    showBoundaries,
    showIds,
    tokens,
    ...(current >= 3
      ? {
          window: computeContextWindow({
            usedTokens: consumedCount,
            capacityTokens: input.capacityTokens,
          }),
        }
      : {}),
  };
}

/**
 * Deterministic sample data for the P0.5 composition demo. ILLUSTRATIVE tokenization —
 * hand-chosen to teach subword splits honestly ("Tokenization" → "Token"+"ization"),
 * not produced by a real tokenizer. The real BPE tokenizer arrives with the Tokens
 * lesson (P0.9 / L0 build project); the demo page states this notice visibly.
 */
export const TOKENIZATION_DEMO_INPUT: TokenSceneInput = {
  sourceText: "Tokenization isn't lossless.",
  tokens: [
    { text: 'Token', id: 3771 },
    { text: 'ization', id: 2065 },
    { text: ' isn', id: 421 },
    { text: "'t", id: 88 },
    { text: ' loss', id: 6749 },
    { text: 'less', id: 1503 },
    { text: '.', id: 13 },
  ],
  capacityTokens: 16,
};
