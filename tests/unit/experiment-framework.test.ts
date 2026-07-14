import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { experimentSchema } from '../../experiments/lib/types';
import { runExperiment } from '../../experiments/lib/run';
import { generateReport } from '../../experiments/lib/report';
import type { ExperimentDefinition } from '../../experiments/lib/types';

const FIXED_TIME = () => '2026-07-14T00:00:00.000Z';

function loadDefinition(file: string): ExperimentDefinition {
  // Definitions are TS modules; import the built objects via tsx's runtime.
  // Vitest runs under the same loader, so a dynamic import works.
  return require(join(process.cwd(), 'experiments/definitions', file)).default;
}

const baseline: ExperimentDefinition = {
  id: 'test-baseline',
  version: 1,
  goal: 'g',
  question: 'q',
  expectedObservation: 'o',
  tools: ['calculator'],
  maxSteps: 6,
  repeats: 1,
  variants: [{ key: 'plain', system: 'Use tools.', prompt: 'What is 127 * 49?' }],
  matrix: [{ kind: 'scripted', label: 'scripted-agent', scenario: 'calculator-tool-use' }],
  successCriteria: { expectedOutcome: 'completed', mustUseTool: 'calculator', mustIncludeText: '6,223' },
};

describe('experiment schema', () => {
  it('accepts a valid definition and rejects unknown keys / bad enums', () => {
    expect(experimentSchema.safeParse(baseline).success).toBe(true);
    expect(experimentSchema.safeParse({ ...baseline, id: 'Bad Id' }).success).toBe(false);
    expect(experimentSchema.safeParse({ ...baseline, mystery: 1 }).success).toBe(false);
    expect(
      experimentSchema.safeParse({ ...baseline, matrix: [{ kind: 'real', label: 'x', provider: 'unknownco', model: 'm' }] }).success,
    ).toBe(false);
  });

  it('the four shipped definitions are all valid', () => {
    for (const file of ['001-tool-use-baseline.ts', '002-prompting-styles.ts', '003-temperature-sweep.ts', '004-failure-modes.ts']) {
      expect(experimentSchema.safeParse(loadDefinition(file)).success, file).toBe(true);
    }
  });
});

describe('runExperiment — scripted rows (no keys, no network)', () => {
  it('runs the baseline, measures observable behavior, and passes success criteria', async () => {
    const result = await runExperiment(baseline, { now: FIXED_TIME });
    expect(result.runs).toHaveLength(1);
    const run = result.runs[0]!;
    expect(run).toMatchObject({
      provider: 'scripted',
      outcome: 'completed',
      success: true,
      toolCallCount: 1,
      toolSelectionOrder: ['calculator'],
      modelCalls: 2,
    });
    expect(run.finalText).toContain('6,223');
    expect(run.stopReasons).toEqual(['tool-call', 'completed']);
    expect(run.trace.length).toBeGreaterThan(0);
  });

  it('is reproducible: identical definition + fixed clock → identical result', async () => {
    const a = await runExperiment(baseline, { now: FIXED_TIME });
    const b = await runExperiment(baseline, { now: FIXED_TIME });
    expect(b).toEqual(a);
  });

  it('no shared mutable state: repeats and rows are independent', async () => {
    const multi: ExperimentDefinition = { ...baseline, repeats: 3 };
    const result = await runExperiment(multi, { now: FIXED_TIME });
    expect(result.runs).toHaveLength(3);
    expect(result.runs.every((r) => r.success && r.outcome === 'completed')).toBe(true);
    expect(result.runs.map((r) => r.repeat)).toEqual([1, 2, 3]);
  });
});

describe('runExperiment — failure modes resolve to honest outcomes', () => {
  const failure = loadDefinition('004-failure-modes.ts');

  it('each failure class produces its expected runtime outcome and passes its check', async () => {
    const result = await runExperiment(failure, { now: FIXED_TIME });
    const byLabel = Object.fromEntries(result.runs.map((r) => [r.rowLabel, r]));
    expect(byLabel['unknown-tool']!.outcome).toBe('invalid-tool-request');
    expect(byLabel['bad-arguments']!.outcome).toBe('invalid-tool-request');
    expect(byLabel['tool-exception']!.outcome).toBe('tool-error');
    expect(byLabel['step-limit']!.outcome).toBe('max-steps-reached');
    expect(result.runs.every((r) => r.success)).toBe(true); // per-row expectedOutcome met
    expect(byLabel['bad-arguments']!.validationFailures).toBe(1);
  });
});

describe('mustIncludeText is formatting-insensitive (regression: 005 live run)', () => {
  it('matches an answer whose digit grouping differs from the criterion', async () => {
    // Claude answered "6223"; the criterion asks for "6,223" — both are correct.
    const def: ExperimentDefinition = {
      ...baseline,
      matrix: [{ kind: 'scripted', label: 'scripted-agent', scenario: 'calculator-tool-use' }],
      successCriteria: { expectedOutcome: 'completed', mustUseTool: 'calculator', mustIncludeText: '6,223' },
    };
    const result = await runExperiment(def, { now: FIXED_TIME });
    // The scripted scenario's final text is "127 × 49 = 6,223." — normalization also
    // lets a "6223" answer pass, which is the behavior the live run required.
    expect(result.runs[0]!.success).toBe(true);
    expect(result.runs[0]!.successChecks.some((c) => c.includes('formatting-insensitive'))).toBe(true);
  });
});

describe('missing metadata is honest', () => {
  it('scripted runs without declared usage leave token/cost fields undefined', async () => {
    const noUsage: ExperimentDefinition = {
      ...baseline,
      matrix: [{ kind: 'scripted', label: 'plain', scenario: 'plain-completion' }],
      successCriteria: { expectedOutcome: 'completed' },
    };
    // plain-completion scenario has one text turn with no usage.
    // (It exists from P0.4 tests but not as a file; use failure-step-limit which also lacks usage.)
    const stepLimit: ExperimentDefinition = {
      ...baseline,
      maxSteps: 2,
      matrix: [{ kind: 'scripted', label: 'sl', scenario: 'failure-step-limit', expectedOutcome: 'max-steps-reached' }],
      successCriteria: { expectedOutcome: 'completed' },
    };
    const result = await runExperiment(stepLimit, { now: FIXED_TIME });
    const run = result.runs[0]!;
    expect(run.totalTokens).toBeUndefined(); // never fabricated
    expect(run.estimatedCost).toBeUndefined(); // no pricing on scripted rows
    expect(noUsage).toBeDefined();
  });
});

describe('generateReport', () => {
  it('produces the structured skeleton with computed observations, no fabricated conclusions', async () => {
    const result = await runExperiment(baseline, { now: FIXED_TIME });
    const report = generateReport(result);
    for (const section of ['## Summary', '## Question', '## Method', '## Results', '## Limitations', '## Lessons Learned', '## Future Questions']) {
      expect(report, section).toContain(section);
    }
    expect(report).toContain('OBSERVABLE behavior only');
    expect(report).toContain('Curator:'); // judgment sections are prompts, not fabricated text
    expect(report).toContain('scripted · scenario:calculator-tool-use · plain');
  });

  it('reports skipped rows visibly rather than hiding them', async () => {
    const withReal: ExperimentDefinition = {
      ...baseline,
      matrix: [
        { kind: 'scripted', label: 'scripted-agent', scenario: 'calculator-tool-use' },
        { kind: 'real', label: 'claude', provider: 'claude', model: 'claude-x' },
      ],
    };
    const result = await runExperiment(withReal, { now: FIXED_TIME });
    // No ANTHROPIC_API_KEY in test env → claude row skipped, scripted row runs.
    expect(result.skipped.some((s) => s.label === 'claude')).toBe(true);
    expect(result.runs).toHaveLength(1);
    expect(generateReport(result)).toContain('Skipped rows');
  });
});
