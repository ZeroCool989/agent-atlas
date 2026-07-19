/**
 * The `(input, step) => Scene` function for the "what a language model is" demo
 * (ADR-0004, plan §8). Pure and deterministic: identical input + step yields an identical
 * scene, no clocks, no randomness. Every probability below is computed live by the L0
 * next-token build project (`src/lib/sim/language-model/next-token.ts`) — the same code
 * the lesson asks you to read — so the visual can never drift from the model it teaches.
 *
 * What it shows: **inference as an autoregressive loop.** Step 0 is the prompt. Each later
 * step is one turn of the loop — the model produces a real next-token distribution over
 * the vocabulary, the most likely token is appended (greedy, so the demo is deterministic;
 * the separate `sampling` concept is what would make this choice random), and the sequence
 * grows by one token. The final step shows the completed generation. Watching the same
 * operation repeat is the whole point: a language model does exactly one thing, many times.
 */
import { generate, tokenize, trainNgram } from '../sim/language-model/next-token';
import { clampStep } from './timeline';

export interface GenerationSceneInput {
  /** Training corpus for the toy n-gram model (illustrative, checked in). */
  corpus: string;
  /** The prompt whose continuation is generated. */
  prompt: string;
  /** n-gram order (2 = bigram). */
  order: number;
  /** Maximum tokens to generate. */
  maxTokens: number;
  /** How many top candidates to display in the distribution at each predict step. */
  topCandidates: number;
}

export interface GenerationCandidate {
  token: string;
  prob: number;
  /** True for the token greedy decoding appends this step. */
  chosen: boolean;
}

/** One step of the generation demo — the complete truth at that step. */
export interface GenerationScene {
  step: number;
  totalSteps: number;
  title: string;
  /** Teaching text for the step; doubles as the accessible scene description. */
  description: string;
  /** Which phase of inference this step shows. */
  phase: 'prompt' | 'predict' | 'done';
  /** The token sequence visible at this step (prompt + tokens generated so far). */
  sequence: string[];
  /** How many leading tokens of `sequence` are the original prompt (the rest are generated). */
  promptLength: number;
  /** Top next-token candidates with real probabilities; empty on the prompt and done steps. */
  candidates: GenerationCandidate[];
}

export function createGenerationScene(input: GenerationSceneInput, step: number): GenerationScene {
  const promptTokens = tokenize(input.prompt);
  const promptLength = promptTokens.length;
  const model = trainNgram(input.corpus, input.order);
  const run = generate(model, input.prompt, input.maxTokens);

  // Steps: [0] prompt, [1..N] one per prediction, [N+1] done.
  const predictSteps = run.steps.length;
  const totalSteps = predictSteps + 2;
  const current = clampStep(step, totalSteps);

  if (current === 0) {
    return {
      step: 0,
      totalSteps,
      title: 'The prompt',
      description:
        'Everything starts as a sequence of tokens. The model has read the prompt and is about to do the only thing it can do: predict what token comes next. It has not generated anything yet.',
      phase: 'prompt',
      sequence: promptTokens,
      promptLength,
      candidates: [],
    };
  }

  if (current === totalSteps - 1) {
    return {
      step: current,
      totalSteps,
      title: 'Inference is that loop, repeated',
      description:
        'The whole output was produced one token at a time, each token chosen from a fresh distribution over the vocabulary. Nothing else happened — no lookup of stored answers, no change to the model. Scale a model up and the distributions get far better; the loop stays identical.',
      phase: 'done',
      sequence: run.tokens,
      promptLength,
      candidates: [],
    };
  }

  const s = run.steps[current - 1]!;
  const candidates: GenerationCandidate[] = s.distribution
    .slice(0, input.topCandidates)
    .map((d) => ({ token: d.token, prob: d.prob, chosen: d.token === s.chosen }));

  return {
    step: current,
    totalSteps,
    title: `Predict token ${current}: “${s.chosen}”`,
    description:
      'From the tokens so far, the model produces a probability distribution over every token in its vocabulary — its opinion about what comes next. Greedy decoding appends the single most likely token; then the loop runs again on the longer sequence. (Choosing a token from this distribution is the separate “sampling” step.)',
    phase: 'predict',
    sequence: s.context,
    promptLength,
    candidates,
  };
}

/**
 * Deterministic sample data for the lesson. An ILLUSTRATIVE corpus — a handful of short,
 * repetitive sentences so a two-token-memory (bigram) model produces something coherent
 * for a few steps, then predictably runs out of memory (the honest limitation the lesson
 * names). The counting/prediction math is the real thing; only the corpus is a teaching
 * prop.
 */
export const GENERATION_DEMO_INPUT: GenerationSceneInput = {
  corpus:
    'the cat sat on the mat . the cat chased the mouse . the dog sat on the rug . ' +
    'the dog chased the cat . the mouse ran under the mat . the cat sat by the fire .',
  prompt: 'the cat sat',
  order: 2,
  maxTokens: 6,
  topCandidates: 5,
};
