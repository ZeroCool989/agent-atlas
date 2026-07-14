/**
 * Experiment 001 — Tool-calling baseline.
 * The foundational question every other experiment builds on: given a tool and an
 * arithmetic task, does the model actually use it? The scripted row validates the
 * framework end-to-end without keys; real rows activate as keys are added
 * (.env.example). Update model ids to current ones before real runs.
 */
import type { ExperimentDefinition } from '../lib/types';

const definition: ExperimentDefinition = {
  id: 'tool-calling-baseline',
  version: 1,
  goal: 'Establish whether each model selects the offered calculator tool for multi-digit arithmetic, or answers from weights.',
  question: 'Given an explicit calculator tool, which models use it for 127 × 49 — and which answer (possibly wrongly) from weights?',
  expectedObservation:
    'Tool-trained models select the calculator and return 6,223; weights-only answers risk the documented multi-digit multiplication failure. Prompt structure may change tool-use rates.',
  notes:
    'The flagship lesson (workflows-vs-agents) scripts the weights-only failure; this experiment replaces that scripted claim with evidence.',
  tools: ['calculator'],
  maxSteps: 4,
  repeats: 1,
  variants: [
    { key: 'minimal', prompt: 'What is 127 * 49?' },
    {
      key: 'structured',
      system: 'You are a careful assistant. Use tools for arithmetic.',
      prompt: 'What is 127 * 49?',
    },
  ],
  matrix: [
    { kind: 'scripted', label: 'scripted-baseline', scenario: 'calculator-tool-use' },
    { kind: 'real', label: 'claude', provider: 'claude', model: 'claude-sonnet-4-5', temperature: 0 },
    { kind: 'real', label: 'openai', provider: 'openai', model: 'gpt-5.1', temperature: 0 },
    { kind: 'real', label: 'gemini', provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0 },
  ],
  successCriteria: {
    mustIncludeText: '6,223',
    mustUseTool: 'calculator',
  },
};

export default definition;
