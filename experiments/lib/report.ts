/**
 * Markdown report generator: the structured skeleton every experiment produces.
 * Computed sections (results, aggregate observations) are filled automatically;
 * judgment sections (Lessons Learned, Future Questions) get computed starting points
 * plus explicit curator prompts — the framework never fabricates conclusions.
 */
import type { ExperimentResult, RunRecord } from './types';

const mean = (values: number[]) =>
  values.length === 0 ? undefined : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

export function generateReport(result: ExperimentResult): string {
  const { experiment, runs, skipped } = result;
  const groups = groupBy(runs, (r) => `${r.provider} · ${r.model} · ${r.variant}`);

  const resultRows = [...groups.entries()].map(([label, group]) => {
    const successRate = `${group.filter((r) => r.success).length}/${group.length}`;
    const latency = mean(group.map((r) => r.latencyMsTotal).filter((v): v is number => v !== undefined));
    const tokens = mean(group.map((r) => r.totalTokens).filter((v): v is number => v !== undefined));
    const toolCalls = mean(group.map((r) => r.toolCallCount));
    const outcomes = [...new Set(group.map((r) => r.outcome))].join(', ');
    return `| ${label} | ${successRate} | ${outcomes} | ${toolCalls ?? '—'} | ${latency ?? '—'} | ${tokens ?? '—'} |`;
  });

  const observations = computeObservations(runs, skipped);

  return `# Experiment ${experiment.id} (v${experiment.version})

_Generated ${result.generatedAt} by the Agent Atlas experiment framework (v${result.frameworkVersion}). Runtime: src/lib/agent (maxSteps ${experiment.maxSteps}); repeats: ${experiment.repeats}. This report records OBSERVABLE behavior only — no claims about internal reasoning._

## Summary

**Goal.** ${experiment.goal}

## Question

${experiment.question}

**Expected observation (pre-registered).** ${experiment.expectedObservation}

## Method

Every run executes through the identical agent runtime (\`src/lib/agent/runner.ts\`)
with the identical tool registry and validation. Only the matrix row (provider/model/
temperature) and prompt variant differ. Fresh provider instance per run; no shared
state. Success criteria are machine-checked and listed per run in \`result.json\`.

## Results

| provider · model · variant | success | outcomes | mean tool calls | mean latency (ms) | mean total tokens |
|---|---|---|---|---|---|
${resultRows.join('\n')}

${skipped.length > 0 ? `Skipped rows: ${skipped.map((s) => `**${s.label}** (${s.reason})`).join(' · ')}\n` : ''}
## Observations (computed)

${observations.map((o) => `- ${o}`).join('\n')}

## Limitations

- Scripted rows validate the framework, not model behavior — their results say nothing about real models.
- Sample sizes are small (${experiment.repeats} repeat(s)); treat differences as observations to investigate, not conclusions.
- Latency includes network conditions at run time; costs are estimates from the definition's pricing table (absent = not computed).
- The runtime intentionally ends runs on invalid tool requests and tool failures (no retry) — retry behavior is out of scope until the reliability concept.

## Lessons Learned

_Curator: replace after reviewing the runs and traces. Starting points from the data:_
${observations.slice(0, 3).map((o) => `- ${o}`).join('\n')}

## Future Questions

_Curator: what did this raise? Candidates: repeat with more samples; vary one factor the results made interesting; promote a finding into a lesson update via docs/INTAKE.md._
`;
}

function computeObservations(runs: RunRecord[], skipped: ExperimentResult['skipped']): string[] {
  if (runs.length === 0) return ['No runs executed (all rows skipped) — add API keys per .env.example.'];
  const observations: string[] = [];

  const byProvider = groupBy(runs, (r) => r.provider);
  for (const [provider, group] of byProvider) {
    const successes = group.filter((r) => r.success).length;
    observations.push(`${provider}: ${successes}/${group.length} runs met all success criteria.`);
    const noTool = group.filter((r) => r.toolCallCount === 0).length;
    if (noTool > 0 && group.some((r) => r.toolCallCount > 0)) {
      observations.push(`${provider}: ${noTool}/${group.length} runs never selected a tool (answered from weights).`);
    }
  }
  const malformed = runs.filter((r) => r.malformedToolCalls > 0);
  if (malformed.length > 0) {
    observations.push(`${malformed.length} run(s) produced malformed tool-call arguments (adapter warnings recorded).`);
  }
  const rejected = runs.filter((r) => r.validationFailures > 0);
  if (rejected.length > 0) {
    observations.push(`${rejected.length} run(s) had tool requests rejected by runtime validation.`);
  }
  const limited = runs.filter((r) => r.outcome === 'max-steps-reached');
  if (limited.length > 0) {
    observations.push(`${limited.length} run(s) hit the step limit.`);
  }
  const byVariant = groupBy(runs, (r) => r.variant);
  if (byVariant.size > 1) {
    const rates = [...byVariant.entries()]
      .map(([variant, group]) => `${variant} ${group.filter((r) => r.success).length}/${group.length}`)
      .join(', ');
    observations.push(`Success by prompt variant: ${rates}.`);
  }
  if (skipped.length > 0) observations.push(`${skipped.length} matrix row(s) skipped (missing keys).`);
  return observations;
}
