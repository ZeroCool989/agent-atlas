import type { ExperimentDefinition } from '../lib/types';

/**
 * Live validation experiment (2026-07-14): the first real-model run of the agent
 * runtime. Same task and runtime as 001, but only scripted + Claude, temperature 0,
 * repeats 3 — so a single experiment covers the first real run AND the repeatability
 * study (Steps 3–5 of the live-validation brief). Claude row runs only when
 * ANTHROPIC_API_KEY is present; otherwise it is skipped and this reduces to a scripted
 * self-test.
 */
const experiment: ExperimentDefinition = {
  id: '005-live-claude-calculator',
  version: 1,
  goal: 'Prove the Phase 0/1 architecture (ModelProvider → runtime → tools → trace) works against a real provider, and measure repeatability at temperature 0.',
  question: 'Given a calculator tool, does Claude select and use it for arithmetic, and is that behavior consistent across three temperature-0 runs?',
  expectedObservation:
    'Claude selects the calculator, the runtime executes it, and the model reports 6,223. Runtime behavior is deterministic; token counts and latency vary with the model and network.',
  notes: 'First live run. Model id verified against the live API on 2026-07-14. Costs are estimated from list pricing in the row.',
  tools: ['calculator'],
  maxSteps: 6,
  repeats: 3,
  variants: [{ key: 'plain', system: 'You are a careful assistant. Use tools for arithmetic.', prompt: 'What is 127 * 49?' }],
  matrix: [
    { kind: 'scripted', label: 'scripted-agent', scenario: 'calculator-tool-use' },
    {
      kind: 'real',
      label: 'claude',
      provider: 'claude',
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0,
      maxOutputTokens: 512,
      pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: 'USD' },
    },
  ],
  successCriteria: { expectedOutcome: 'completed', mustUseTool: 'calculator', mustIncludeText: '6,223' },
};

export default experiment;
