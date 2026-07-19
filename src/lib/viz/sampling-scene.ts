/**
 * The `(input, step) => Scene` function for the sampling demo (ADR-0004, plan §8). Pure
 * and deterministic: identical input + step yields an identical scene, no clocks, no
 * randomness. Every probability below is computed live by the L0 sampling build project
 * (`src/lib/sim/sampling/sampling.ts`) — the same code the lesson asks you to read — so
 * the visual can never drift from the algorithm it teaches.
 *
 * The five steps deliberately separate the two things decoding does: steps 1–2 *reshape*
 * the whole distribution with temperature (every token keeps a nonzero chance); steps 3–4
 * *truncate* it to a candidate set with top-k / top-p (some tokens are cut to zero). That
 * reshape-vs-truncate distinction is the lesson.
 */
import { applyTopK, applyTopP, softmaxTokens, type TokenLogit } from '../sim/sampling/sampling';
import { clampStep } from './timeline';
import type { DistributionBar, SamplingScene, Timeline } from './types';

export interface SamplingSceneInput {
  /** The prompt whose next token is being decoded — for display only. */
  prompt: string;
  /** Candidate next tokens and their raw logits (illustrative, hand-chosen to teach). */
  candidates: TokenLogit[];
  /** Temperature for the "cooler" reshape step. */
  lowTemperature: number;
  /** Temperature for the "hotter" reshape step. */
  highTemperature: number;
  /** k for the top-k truncation step. */
  topK: number;
  /** p for the top-p (nucleus) truncation step. */
  topP: number;
}

export const SAMPLING_SCENE_TIMELINE: Timeline = {
  steps: [
    {
      label: 'The raw distribution',
      description:
        'The model outputs one score (a logit) per token; softmax turns those scores into probabilities that sum to 1. This is the model’s honest opinion about the next token — before any decoding choice is made.',
    },
    {
      label: 'Lower temperature — sharpen',
      description:
        'Temperature below 1 divides the logits by a small number, exaggerating the gaps: probability mass concentrates on the top tokens. At the limit (T→0) this becomes greedy — always the single most likely token. Same tokens, no new information — just a more confident shape.',
    },
    {
      label: 'Higher temperature — flatten',
      description:
        'Temperature above 1 shrinks the gaps, spreading mass toward the tail so unlikely tokens get a real chance. This buys diversity and surprise at the cost of coherence — and note it never makes an answer more correct, only less predictable.',
    },
    {
      label: 'Top-k — a fixed-size cut',
      description:
        'Top-k keeps only the k most probable tokens and renormalizes them, dropping the rest to zero. A blunt, fixed cut: always exactly k candidates, whether the model was confident or not.',
    },
    {
      label: 'Top-p (nucleus) — a dynamic cut',
      description:
        'Top-p keeps the smallest set of tokens whose probabilities add up to p, then renormalizes. When the model is confident it keeps few; when it is unsure it keeps more. That adaptivity is why nucleus sampling usually beats a fixed k.',
    },
  ],
};

function bars(
  raw: { token: string; prob: number }[],
  current: { token: string; prob: number; kept: boolean }[],
): DistributionBar[] {
  return raw.map((r, i) => ({
    token: r.token,
    basisProb: r.prob,
    prob: current[i]!.prob,
    kept: current[i]!.kept,
  }));
}

export function createSamplingScene(input: SamplingSceneInput, step: number): SamplingScene {
  const totalSteps = SAMPLING_SCENE_TIMELINE.steps.length;
  const current = clampStep(step, totalSteps);
  const timelineStep = SAMPLING_SCENE_TIMELINE.steps[current]!;

  const raw = softmaxTokens(input.candidates, 1);

  let barData: DistributionBar[];
  let method: SamplingScene['method'];
  let parameterLabel: string;

  switch (current) {
    case 1: {
      const reshaped = softmaxTokens(input.candidates, input.lowTemperature);
      barData = bars(raw, reshaped.map((r) => ({ ...r, kept: true })));
      method = 'temperature';
      parameterLabel = `T = ${input.lowTemperature}`;
      break;
    }
    case 2: {
      const reshaped = softmaxTokens(input.candidates, input.highTemperature);
      barData = bars(raw, reshaped.map((r) => ({ ...r, kept: true })));
      method = 'temperature';
      parameterLabel = `T = ${input.highTemperature}`;
      break;
    }
    case 3: {
      barData = bars(raw, applyTopK(raw, input.topK));
      method = 'top-k';
      parameterLabel = `k = ${input.topK}`;
      break;
    }
    case 4: {
      barData = bars(raw, applyTopP(raw, input.topP));
      method = 'top-p';
      parameterLabel = `p = ${input.topP}`;
      break;
    }
    default: {
      barData = bars(raw, raw.map((r) => ({ ...r, kept: true })));
      method = 'raw';
      parameterLabel = '';
    }
  }

  return {
    step: current,
    totalSteps,
    title: timelineStep.label,
    description: timelineStep.description ?? '',
    method,
    parameterLabel,
    bars: barData,
    keptCount: barData.filter((b) => b.kept).length,
  };
}

/**
 * Deterministic sample data for the sampling lesson. ILLUSTRATIVE logits — hand-chosen to
 * produce a realistically peaked next-token distribution for the prompt, not read from a
 * real model. The math applied to them (softmax, temperature, top-k, top-p) is the real
 * algorithm; only the logits are teaching props.
 */
export const SAMPLING_DEMO_INPUT: SamplingSceneInput = {
  prompt: 'The weather today is',
  candidates: [
    { token: ' sunny', logit: 3.2 },
    { token: ' cloudy', logit: 2.5 },
    { token: ' warm', logit: 2.1 },
    { token: ' cold', logit: 1.5 },
    { token: ' fine', logit: 0.9 },
    { token: ' purple', logit: -1.0 },
  ],
  lowTemperature: 0.5,
  highTemperature: 1.6,
  topK: 3,
  topP: 0.9,
};
