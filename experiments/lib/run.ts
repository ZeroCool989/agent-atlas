/**
 * Experiment executor: matrix rows × prompt variants × repeats, every run through the
 * SAME agent runtime the lessons teach (src/lib/agent). All measurements are derived
 * from the run's trace and result — nothing is measured that the learner couldn't see
 * in the trace themselves.
 */
import { runAgent } from '../../src/lib/agent';
import type { AgentRunResult, TraceEvent } from '../../src/lib/agent';
import { buildProvider, rowModelName, rowProviderName } from './config';
import { buildRegistry } from './tools';
import type { ExperimentDefinition, ExperimentResult, MatrixRow, RunRecord, Variant } from './types';

function summarizeUsage(trace: TraceEvent[]) {
  let latency: number | undefined;
  let input: number | undefined;
  let output: number | undefined;
  let total: number | undefined;
  for (const event of trace) {
    if (!event.usage) continue;
    if (event.usage.latencyMs !== undefined) latency = (latency ?? 0) + event.usage.latencyMs;
    if (event.usage.inputTokens !== undefined) input = (input ?? 0) + event.usage.inputTokens;
    if (event.usage.outputTokens !== undefined) output = (output ?? 0) + event.usage.outputTokens;
    if (event.usage.totalTokens !== undefined) total = (total ?? 0) + event.usage.totalTokens;
  }
  return { latency, input, output, total };
}

function evaluateSuccess(
  definition: ExperimentDefinition,
  row: MatrixRow,
  result: AgentRunResult,
): { success: boolean; checks: string[] } {
  const criteria = definition.successCriteria;
  const checks: string[] = [];
  let success = true;
  const check = (ok: boolean, description: string) => {
    checks.push(`${ok ? 'PASS' : 'FAIL'}: ${description}`);
    if (!ok) success = false;
  };

  const expectedOutcome = row.expectedOutcome ?? criteria.expectedOutcome ?? 'completed';
  check(result.outcome === expectedOutcome, `outcome is "${expectedOutcome}" (got "${result.outcome}")`);

  if (criteria.mustIncludeText !== undefined && expectedOutcome === 'completed' && !row.expectedOutcome) {
    // Normalize digit-group separators and spaces before matching: the 005 live run
    // showed Claude answers "6223" while the scripted scenario wrote "6,223" — both
    // correct. Success criteria check semantic content, not a model's formatting.
    const normalize = (s: string) => s.replace(/[,\s]/g, '');
    check(
      normalize(result.finalText ?? '').includes(normalize(criteria.mustIncludeText)),
      `final text includes "${criteria.mustIncludeText}" (formatting-insensitive)`,
    );
  }
  const toolsUsed = result.trace.filter((e) => e.type === 'tool-executed' && e.outcome === undefined);
  if (criteria.mustUseTool !== undefined && !row.expectedOutcome) {
    check(
      toolsUsed.some((e) => e.toolName === criteria.mustUseTool),
      `tool "${criteria.mustUseTool}" was actually executed`,
    );
  }
  if (criteria.mustNotUseTools) {
    check(toolsUsed.length === 0, 'no tools were executed');
  }
  return { success, checks };
}

export async function runExperiment(
  definition: ExperimentDefinition,
  options: { now?: () => string } = {},
): Promise<ExperimentResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const runs: RunRecord[] = [];
  const skipped: ExperimentResult['skipped'] = [];

  for (const row of definition.matrix) {
    for (const variant of definition.variants) {
      for (let repeat = 1; repeat <= definition.repeats; repeat++) {
        const built = buildProvider(row); // fresh provider per run — no shared state
        if ('skip' in built) {
          if (repeat === 1 && variant === definition.variants[0]) {
            skipped.push({ label: row.label, reason: built.skip });
          }
          continue;
        }
        runs.push(await runOne(definition, row, variant, repeat, built.provider));
      }
    }
  }

  return {
    frameworkVersion: 1,
    experiment: {
      id: definition.id,
      version: definition.version,
      goal: definition.goal,
      question: definition.question,
      expectedObservation: definition.expectedObservation,
      ...(definition.notes !== undefined ? { notes: definition.notes } : {}),
      maxSteps: definition.maxSteps,
      repeats: definition.repeats,
    },
    generatedAt: now(),
    runs,
    skipped,
  };
}

async function runOne(
  definition: ExperimentDefinition,
  row: MatrixRow,
  variant: Variant,
  repeat: number,
  provider: import('../../src/lib/model').ModelProvider,
): Promise<RunRecord> {
  const registry = buildRegistry(definition.tools);
  const result = await runAgent(provider, registry, {
    ...(variant.system !== undefined ? { system: variant.system } : {}),
    goal: variant.prompt,
    maxSteps: definition.maxSteps,
  });

  const usage = summarizeUsage(result.trace);
  const warnings = result.trace.flatMap((e) => e.warnings ?? []);
  const { success, checks } = evaluateSuccess(definition, row, result);
  const pricing = row.kind === 'real' ? row.pricing : undefined;

  return {
    rowLabel: row.label,
    provider: rowProviderName(row),
    model: rowModelName(row),
    variant: variant.key,
    repeat,
    outcome: result.outcome,
    success,
    successChecks: checks,
    ...(result.finalText !== undefined ? { finalText: result.finalText } : {}),
    modelCalls: result.modelCalls,
    stopReasons: result.trace
      .filter((e) => e.type === 'model-responded')
      .map((e) => e.stopReason!)
      .filter(Boolean),
    toolSelectionOrder: result.trace.filter((e) => e.type === 'tool-selected').map((e) => e.toolName!),
    toolCallCount: result.trace.filter((e) => e.type === 'tool-selected').length,
    validationFailures: result.trace.filter((e) => e.type === 'tool-rejected').length,
    malformedToolCalls: warnings.filter((w) => w.includes('not valid JSON')).length,
    warnings,
    ...(usage.latency !== undefined ? { latencyMsTotal: usage.latency } : {}),
    ...(usage.input !== undefined ? { inputTokens: usage.input } : {}),
    ...(usage.output !== undefined ? { outputTokens: usage.output } : {}),
    ...(usage.total !== undefined ? { totalTokens: usage.total } : {}),
    ...(pricing && usage.input !== undefined && usage.output !== undefined
      ? {
          estimatedCost: {
            amount:
              Math.round(
                ((usage.input / 1_000_000) * pricing.inputPerMTok +
                  (usage.output / 1_000_000) * pricing.outputPerMTok) *
                  1e6,
              ) / 1e6,
            currency: pricing.currency,
            basis: 'estimated' as const,
          },
        }
      : {}),
    trace: result.trace,
  };
}
