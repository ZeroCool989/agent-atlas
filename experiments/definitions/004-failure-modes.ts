import type { ExperimentDefinition } from '../lib/types';

/**
 * Failure experiment: deliberately provoke each runtime failure class and confirm the
 * runtime handles it as a typed OUTCOME, never a crash or a fabricated answer. This is
 * entirely scripted — the failures are runtime behavior, fully deterministic, no keys
 * needed. It doubles as the framework's end-to-end failure-handling proof.
 */
const experiment: ExperimentDefinition = {
  id: '004-failure-modes',
  version: 1,
  goal: 'Demonstrate that every failure class resolves to an honest runtime outcome with an inspectable trace.',
  question: 'How does the runtime respond to an unknown tool, malformed arguments, a failing tool, and a runaway loop?',
  expectedObservation:
    'unknown tool → invalid-tool-request; bad arguments → invalid-tool-request; failing tool → tool-error; runaway loop → max-steps-reached. No crashes, no fabricated answers.',
  notes: 'All rows are scripted: these are runtime behaviors, not model behaviors, so they must be deterministic. Per-row expectedOutcome overrides the default success check.',
  tools: ['calculator', 'unreliable-lookup'],
  maxSteps: 2,
  repeats: 1,
  variants: [{ key: 'provoke', prompt: 'Trigger the scripted failure.' }],
  matrix: [
    { kind: 'scripted', label: 'unknown-tool', scenario: 'failure-unknown-tool', expectedOutcome: 'invalid-tool-request' },
    { kind: 'scripted', label: 'bad-arguments', scenario: 'failure-bad-arguments', expectedOutcome: 'invalid-tool-request' },
    { kind: 'scripted', label: 'tool-exception', scenario: 'failure-tool-exception', expectedOutcome: 'tool-error' },
    { kind: 'scripted', label: 'step-limit', scenario: 'failure-step-limit', expectedOutcome: 'max-steps-reached' },
  ],
  successCriteria: { expectedOutcome: 'completed' },
};

export default experiment;
