/**
 * The `(input, step) => Scene` function for the observability demo (ADR-0004, plan §8).
 * Pure and deterministic. It takes a real `Trace` from the tracer build project
 * (`src/lib/observability/`) and reveals it one span at a time: the root request opens,
 * then each model call, tool call and retry lands with its own duration, tokens and cost
 * accumulating up the tree, and finally the aggregate metrics resolve — total cost and
 * latency, the error rate, and the slowest span.
 *
 * The pivotal beat is the tool call that runs slow and TIMES OUT: it is both the
 * bottleneck (largest self time) and the failure (the one errored span), so the visual
 * marks the same row as slowest and errored. That is the whole reason observability is
 * its own concept — a stack trace could not show you which span cost the time and the
 * correctness. Every number comes from `buildTrace`, so the picture can never drift from
 * the code that measures it.
 */
import { buildDemoTrace, type SpanKind, type Trace, type TraceMetrics } from '../observability';
import { clampStep } from './timeline';

/** One span as a render-ready row: a tree line (indent by depth) that is also a timeline
 * bar (offset + width across the run). */
export interface ObservabilitySpanRow {
  id: string;
  depth: number;
  name: string;
  kind: SpanKind;
  /** Wall-clock duration of this span. */
  durationMs: number;
  /** Self (exclusive) duration — the honest bottleneck measure. */
  selfDurationMs: number;
  tokens: number;
  costUsd: number;
  /** 'inactive' = not yet reached, 'active' = the current step's span, 'completed' = done. */
  state: 'inactive' | 'active' | 'completed';
  hasError: boolean;
  /** True for the span the metrics name as slowest — highlighted on the final step. */
  isSlowest: boolean;
  /** Timeline geometry across the whole run, 0–100. */
  offsetPercent: number;
  widthPercent: number;
}

export interface ObservabilityScene {
  step: number;
  totalSteps: number;
  title: string;
  /** Teaching text for the step; doubles as the accessible scene description. */
  description: string;
  rows: ObservabilitySpanRow[];
  /** Running totals over the spans revealed so far. */
  runningTokens: number;
  runningCostUsd: number;
  runningDurationMs: number;
  /** True on the final step, when the aggregate metrics are presented. */
  metricsRevealed: boolean;
  metrics: {
    totalDurationMs: number;
    totalTokens: number;
    totalCostUsd: number;
    spanCount: number;
    errorCount: number;
    /** errorRate as a percentage, one decimal (0.167 → 16.7). */
    errorRatePercent: number;
    retryCount: number;
    slowestName: string;
    slowestSelfMs: number;
  };
}

export type ObservabilitySceneInput = Trace;

/** The demo trace, built once from the tracer. Exported so the island and tests share it. */
export const OBSERVABILITY_DEMO_INPUT: ObservabilitySceneInput = buildDemoTrace();

function usd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function metricsView(m: TraceMetrics): ObservabilityScene['metrics'] {
  return {
    totalDurationMs: m.totalDurationMs,
    totalTokens: m.totalTokens,
    totalCostUsd: m.totalCostUsd,
    spanCount: m.spanCount,
    errorCount: m.errorCount,
    errorRatePercent: Math.round(m.errorRate * 1000) / 10,
    retryCount: m.retryCount,
    slowestName: m.slowestSpan?.name ?? '',
    slowestSelfMs: m.slowestSpan?.selfDurationMs ?? 0,
  };
}

/**
 * Reveal order: the root first (it is open for the whole run), then its child spans in
 * start order. Steps:
 *   0            — the request arrives; the root span opens, nothing measured yet.
 *   1..children  — one child span lands per step, totals accumulating.
 *   children+1   — the aggregate metrics resolve; slowest + errored span highlighted.
 */
export function createObservabilityScene(input: ObservabilitySceneInput, step: number): ObservabilityScene {
  const { root, flat, metrics } = input;
  const children = root.children; // depth-1 spans in start order
  const childCount = children.length;
  const totalSteps = childCount + 2; // intro + one per child + metrics
  const current = clampStep(step, totalSteps);
  const isMetricsStep = current === totalSteps - 1;

  const rootStart = root.span.startMs;
  const total = metrics.totalDurationMs || 1;

  // How many child spans are revealed at this step (all of them on the metrics step).
  const revealedChildren = isMetricsStep ? childCount : Math.min(current, childCount);
  const slowestId = metrics.slowestSpan?.id;

  const rows: ObservabilitySpanRow[] = flat.map((node) => {
    const isRoot = node.depth === 0;
    // Child index among the depth-1 spans (root is not a "child").
    const childIndex = isRoot ? -1 : children.findIndex((c) => c.span.id === node.span.id);

    let state: ObservabilitySpanRow['state'];
    if (isRoot) {
      state = isMetricsStep ? 'completed' : 'active';
    } else if (childIndex >= revealedChildren) {
      state = 'inactive';
    } else if (!isMetricsStep && childIndex === current - 1) {
      state = 'active';
    } else {
      state = 'completed';
    }

    return {
      id: node.span.id,
      depth: node.depth,
      name: node.span.name,
      kind: node.span.kind,
      durationMs: node.durationMs,
      selfDurationMs: node.selfDurationMs,
      tokens: node.selfTokens,
      costUsd: node.selfCostUsd,
      state,
      hasError: node.hasError,
      isSlowest: isMetricsStep && node.span.id === slowestId,
      offsetPercent: Math.round(((node.span.startMs - rootStart) / total) * 1000) / 10,
      widthPercent: Math.round((node.durationMs / total) * 1000) / 10,
    };
  });

  // Running totals over revealed child spans (the root carries no self measurements).
  const revealed = children.slice(0, revealedChildren);
  const runningTokens = revealed.reduce((s, c) => s + c.selfTokens, 0);
  const runningCostUsd = Math.round(revealed.reduce((s, c) => s + c.selfCostUsd, 0) * 1e6) / 1e6;
  const runningDurationMs =
    revealed.length === 0 ? 0 : Math.max(...revealed.map((c) => c.span.endMs ?? c.span.startMs)) - rootStart;

  let title: string;
  let description: string;
  if (current === 0) {
    title = 'A request arrives';
    description =
      'The agent run opens a root span. Every model call, tool call and retry it makes will nest beneath it — the trace is that tree. Nothing has been measured yet; watch the spans, the tokens and the cost accumulate as the run unfolds.';
  } else if (isMetricsStep) {
    title = 'Roll it up: the metrics';
    const m = metricsView(metrics);
    description =
      `Aggregate the spans and you get what you actually operate on: ${m.totalDurationMs} ms total latency, ${m.totalTokens} tokens, ${usd(m.totalCostUsd)} in cost, and a ${m.errorRatePercent}% span error rate. ` +
      `The slowest span by self-time is "${m.slowestName}" at ${m.slowestSelfMs} ms — the same span that errored. Observability just turned "the agent was slow and sometimes wrong" into one specific span you can go fix.`;
  } else {
    const child = children[current - 1]!;
    const kind = child.span.kind;
    if (kind === 'model-call') {
      const which = child.span.name.includes('plan') ? 'plans and picks a tool' : 'composes the final answer';
      title = child.span.name;
      description = `A model call: the agent ${which}. The span logs its own cost — ${child.selfTokens} tokens, ${usd(child.selfCostUsd)}, ${child.durationMs} ms. Per-step tokens and cost are how a bill and a latency budget get explained.`;
    } else if (kind === 'tool-call') {
      title = `${child.span.name} — slow, then timed out`;
      description = `The tool call runs for ${child.durationMs} ms and TIMES OUT: the span records the error (${child.span.attributes.error}). This one span holds both the latency and the failure — exactly what a stack trace cannot show you, because the bug is in a tool result, not in your code.`;
    } else if (kind === 'retry') {
      title = `${child.span.name} — the retry succeeds`;
      description = `A retry re-runs the tool and succeeds in ${child.durationMs} ms. Because the retry is its own span, "it worked on the second attempt" is visible in the trace instead of hidden — the difference between a healthy run and a flaky one is right here.`;
    } else {
      title = child.span.name;
      description = `The response span returns the answer in ${child.durationMs} ms and the root span closes. The run is complete; now the whole tree can be rolled up.`;
    }
  }

  return {
    step: current,
    totalSteps,
    title,
    description,
    rows,
    runningTokens,
    runningCostUsd,
    runningDurationMs,
    metricsRevealed: isMetricsStep,
    metrics: metricsView(metrics),
  };
}
