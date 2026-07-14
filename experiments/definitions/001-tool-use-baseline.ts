import type { ExperimentDefinition } from '../lib/types';

/**
 * The framework's reference experiment. The scripted row runs with zero API keys, so
 * this experiment (and the whole framework) is exercisable and CI-checkable by anyone.
 * The real rows activate automatically once the matching keys are in .env.
 */
const experiment: ExperimentDefinition = {
  id: '001-tool-use-baseline',
  version: 1,
  goal: 'Establish that the same runtime drives scripted and real providers, and capture baseline tool-use behavior on a task where a calculator is the correct move.',
  question: 'Given a calculator tool, does the model select and use it for arithmetic — and what does that cost in calls, tokens, and latency?',
  expectedObservation:
    'A capable model selects the calculator, the runtime executes it, and the model reports the exact result (6,223). The scripted row demonstrates this deterministically.',
  notes: 'Reference/self-test experiment. Real rows are pre-wired; they run when ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY are present.',
  tools: ['calculator'],
  maxSteps: 6,
  repeats: 1,
  variants: [{ key: 'plain', system: 'You are a careful assistant. Use tools for arithmetic.', prompt: 'What is 127 * 49?' }],
  matrix: [
    { kind: 'scripted', label: 'scripted-agent', scenario: 'calculator-tool-use' },
    {
      kind: 'real',
      label: 'claude',
      provider: 'claude',
      model: 'claude-sonnet-5',
      temperature: 0,
      pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: 'USD' },
    },
    {
      kind: 'real',
      label: 'openai',
      provider: 'openai',
      model: 'gpt-5',
      temperature: 0,
      pricing: { inputPerMTok: 2.5, outputPerMTok: 10, currency: 'USD' },
    },
    {
      kind: 'real',
      label: 'gemini',
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      temperature: 0,
      pricing: { inputPerMTok: 1.25, outputPerMTok: 5, currency: 'USD' },
    },
  ],
  successCriteria: { expectedOutcome: 'completed', mustUseTool: 'calculator', mustIncludeText: '6,223' },
};

export default experiment;
