import type { ExperimentDefinition } from '../lib/types';

/**
 * Prompt-engineering experiment: hold the model and task fixed, vary the PROMPT STYLE,
 * observe whether phrasing changes tool selection, success, tokens, and latency.
 * Scripted row runs one shared scenario for framework self-test; the real rows are
 * where the comparison becomes meaningful (add keys to run).
 */
const experiment: ExperimentDefinition = {
  id: '002-prompting-styles',
  version: 1,
  goal: 'Measure how much prompt STYLE alone changes tool-use behavior on an identical task and model.',
  question: 'Do minimal, structured, role, and few-shot prompts produce different tool selection, success rates, or token usage?',
  expectedObservation:
    'A capable model uses the calculator under all styles; token usage rises with prompt verbosity; success should be stable. Differences, if any, are observations to investigate — not conclusions from one run.',
  notes: 'Vary only the prompt. The scripted row uses the same scenario for every variant, so it is a framework check, not a style comparison.',
  tools: ['calculator'],
  maxSteps: 6,
  repeats: 1,
  variants: [
    { key: 'minimal', prompt: 'What is 127 * 49?' },
    {
      key: 'structured',
      system: 'You are a careful assistant. Use the calculator tool for any arithmetic. Answer with the exact result.',
      prompt: 'Task: compute a product.\nInput: 127 * 49\nRequirement: use the calculator tool.',
    },
    {
      key: 'role',
      system: 'You are a meticulous accountant who never does mental arithmetic and always verifies with a calculator.',
      prompt: 'Please calculate 127 * 49.',
    },
    {
      key: 'few-shot',
      system: 'Use the calculator tool for arithmetic. Example: for "12 * 3" you call calculator(expression="12 * 3") and report 36.',
      prompt: 'Now compute 127 * 49.',
    },
  ],
  matrix: [
    { kind: 'scripted', label: 'scripted-agent', scenario: 'calculator-tool-use' },
    { kind: 'real', label: 'claude', provider: 'claude', model: 'claude-sonnet-4-5-20250929', temperature: 0, pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: 'USD' } },
  ],
  successCriteria: { expectedOutcome: 'completed', mustUseTool: 'calculator' },
};

export default experiment;
