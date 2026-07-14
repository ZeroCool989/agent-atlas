import type { ExperimentDefinition } from '../lib/types';

/**
 * Temperature experiment: same task, same model, sweep temperature. Because each real
 * matrix row fixes a temperature, the sweep is expressed as multiple rows. Repeats > 1
 * so consistency (do repeated runs agree?) is observable at each temperature.
 */
const experiment: ExperimentDefinition = {
  id: '003-temperature-sweep',
  version: 1,
  goal: 'Observe how sampling temperature affects tool-use consistency and token usage on a deterministic task.',
  question: 'As temperature rises from 0 to 1, does tool selection stay consistent across repeats, and do tokens or outcomes drift?',
  expectedObservation:
    'On a task with one correct action, low temperature should be highly consistent; higher temperatures may introduce variation in phrasing or occasional tool-use lapses. Observations only.',
  notes: 'Repeats capture consistency. Scripted row is deterministic by construction and anchors the framework self-test.',
  tools: ['calculator'],
  maxSteps: 6,
  repeats: 3,
  variants: [{ key: 'plain', system: 'Use the calculator tool for arithmetic.', prompt: 'What is 127 * 49?' }],
  matrix: [
    { kind: 'scripted', label: 'scripted-agent', scenario: 'calculator-tool-use' },
    { kind: 'real', label: 'claude-t0', provider: 'claude', model: 'claude-sonnet-4-5-20250929', temperature: 0, pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: 'USD' } },
    { kind: 'real', label: 'claude-t02', provider: 'claude', model: 'claude-sonnet-4-5-20250929', temperature: 0.2, pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: 'USD' } },
    { kind: 'real', label: 'claude-t05', provider: 'claude', model: 'claude-sonnet-4-5-20250929', temperature: 0.5, pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: 'USD' } },
    { kind: 'real', label: 'claude-t08', provider: 'claude', model: 'claude-sonnet-4-5-20250929', temperature: 0.8, pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: 'USD' } },
    { kind: 'real', label: 'claude-t10', provider: 'claude', model: 'claude-sonnet-4-5-20250929', temperature: 1.0, pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: 'USD' } },
  ],
  successCriteria: { expectedOutcome: 'completed', mustUseTool: 'calculator' },
};

export default experiment;
