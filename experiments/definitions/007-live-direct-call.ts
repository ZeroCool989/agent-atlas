import type { ExperimentDefinition } from '../lib/types';

/**
 * Live DIRECT-CALL experiment (2026-07-15). Purpose: replace the flagship lesson's one
 * remaining scripted assumption — that a direct model call answers arithmetic wrong —
 * with real evidence.
 *
 * "Direct call" is expressed as the agent runtime with NO tools: the model can only
 * answer in text, one model call, no loop (tools: []). Three problems of increasing
 * size, temperature 0, two repeats each, so we observe both correctness (vs ground
 * truth computed separately with the real calculator) and consistency. Claude only;
 * no scripted row, because one scripted scenario cannot match three different prompts.
 */
const experiment: ExperimentDefinition = {
  id: '007-live-direct-call',
  version: 1,
  goal: 'Measure whether a direct model call (no tools) answers arithmetic correctly, and how that degrades as the numbers grow — the evidence needed to reframe the flagship lesson honestly.',
  question: 'With no calculator available, does the model compute 127×49, a 4-digit product, and a 5-digit product correctly and consistently — or does weights-only arithmetic break down?',
  expectedObservation:
    'A capable model likely gets the small product right and becomes less reliable as digit count grows. The key teaching point is not "always wrong" but "unverifiable and not guaranteed": the direct-call architecture has nothing that could catch an error.',
  notes: 'Direct call = agent runtime with tools: []. Ground truth is computed separately with the repo calculator; this definition records only the model output. Costs estimated from list pricing.',
  tools: [],
  maxSteps: 2,
  repeats: 2,
  variants: [
    { key: 'small-127x49', system: 'Answer the question directly.', prompt: 'What is 127 * 49? Give only the number.' },
    { key: 'medium-4831x7692', system: 'Answer the question directly.', prompt: 'What is 4831 * 7692? Give only the number.' },
    { key: 'large-73948x61257', system: 'Answer the question directly.', prompt: 'What is 73948 * 61257? Give only the number.' },
  ],
  matrix: [
    {
      kind: 'real',
      label: 'claude',
      provider: 'claude',
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0,
      maxOutputTokens: 128,
      pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: 'USD' },
    },
  ],
  // Direct call asserts no tools were used; correctness is assessed against ground truth
  // in analysis, not by string-matching here (each variant has a different answer).
  successCriteria: { expectedOutcome: 'completed', mustNotUseTools: true },
};

export default experiment;
