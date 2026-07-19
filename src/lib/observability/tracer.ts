/**
 * The observability build project (plan §3 L5 seed): a tiny, dependency-free tracer.
 * You open a SPAN around each unit of work in an agent run — the whole run, a model
 * call, a tool call, a retry, the final response — and close it when the work ends. The
 * spans nest, so what you get back is a TREE: the shape of the run, with a duration,
 * token count and cost on every node.
 *
 * This is the durationful generalization of the runtime's point-in-time trace events
 * (`src/lib/agent/types.ts` `TraceEvent`): an event says "a tool was selected"; a span
 * says "the tool call started at t and ended 2500 ms later, cost nothing, and errored".
 * Observability formalizes tracing over exactly those runtime events — a stack trace
 * tells you where the code was; a span tree tells you what the *run* did and where the
 * time and money went.
 *
 * Everything here is pure and deterministic. The one impure thing a tracer needs — a
 * clock — is INJECTED (`Clock`), so a run is perfectly reproducible in a test. No
 * globals, no `Date.now()`, no I/O. Read it top to bottom; it is the whiteboard answer
 * to "how would you instrument an agent from scratch?"
 */

/** The five kinds of work a span can wrap in this model. Kept small on purpose: these
 * are exactly the beats of a tool-using agent run (see `src/lib/agent/runner.ts`). */
export type SpanKind = 'agent' | 'model-call' | 'tool-call' | 'retry' | 'response';

/** Measurements attached to a span. All optional — a span that does no LLM work reports
 * no tokens or cost, and a span that succeeds reports no error. Never fabricated: an
 * absent field means "not measured", not "zero". */
export interface SpanAttributes {
  /** Tokens attributed to THIS span's own work (not its children). */
  tokens?: number;
  /** Cost in USD attributed to THIS span's own work. Declared, not derived here. */
  costUsd?: number;
  /** Present iff this span's work failed; the human-readable reason. */
  error?: string;
}

/** One recorded span. `endMs` is absent until the span is closed. */
export interface Span {
  id: string;
  parentId?: string;
  name: string;
  kind: SpanKind;
  startMs: number;
  endMs?: number;
  attributes: SpanAttributes;
}

/** The only impurity a tracer needs, injected so runs are reproducible. */
export interface Clock {
  now(): number;
}

/**
 * A clock you drive by hand — set the time, then open or close a span. Used by the demo
 * run and by tests so every span boundary lands on an exact millisecond. Production code
 * would pass a real clock (`{ now: () => performance.now() }`); the tracer never knows
 * the difference.
 */
export function manualClock(start = 0): Clock & { set(t: number): void; advance(dt: number): void } {
  let t = start;
  return {
    now: () => t,
    set: (value: number) => {
      t = value;
    },
    advance: (dt: number) => {
      t += dt;
    },
  };
}

/**
 * Records spans against an injected clock. Deliberately minimal: `startSpan` stamps a
 * start time and returns an id, `endSpan` stamps the end time and merges final
 * attributes. Ids are a deterministic counter (`s1`, `s2`, …) so a run is byte-for-byte
 * reproducible. The tracer only records — it does not build the tree or compute metrics;
 * that is `buildTrace`, a pure function over the recorded spans.
 */
export class Tracer {
  private readonly clock: Clock;
  private readonly recorded: Span[] = [];
  private readonly open = new Map<string, Span>();
  private counter = 0;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  startSpan(input: { name: string; kind: SpanKind; parentId?: string; attributes?: SpanAttributes }): string {
    const id = `s${++this.counter}`;
    const span: Span = {
      id,
      name: input.name,
      kind: input.kind,
      startMs: this.clock.now(),
      attributes: { ...input.attributes },
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    };
    this.recorded.push(span);
    this.open.set(id, span);
    return id;
  }

  endSpan(id: string, attributes: SpanAttributes = {}): void {
    const span = this.open.get(id);
    if (!span) throw new Error(`endSpan: span "${id}" is not open (already ended, or never started)`);
    span.endMs = this.clock.now();
    span.attributes = { ...span.attributes, ...attributes };
    this.open.delete(id);
  }

  /** The recorded spans, in the order they were started. Callers must not mutate. */
  spans(): readonly Span[] {
    return this.recorded;
  }
}

// --- Tree + rollups -----------------------------------------------------------------------

/** A span placed in the tree, with its own measurements and the totals rolled up from
 * its subtree. `selfDurationMs` is the SRE "self time": wall time not accounted for by
 * children — the honest way to say which span is actually the bottleneck. */
export interface SpanNode {
  span: Span;
  depth: number;
  children: SpanNode[];
  /** Wall-clock duration of this span (endMs − startMs). */
  durationMs: number;
  /** Exclusive duration: durationMs minus the wall time of its children (clamped ≥ 0). */
  selfDurationMs: number;
  selfTokens: number;
  selfCostUsd: number;
  /** self + all descendants. The root's subtree totals are the run's grand totals. */
  subtreeTokens: number;
  subtreeCostUsd: number;
  hasError: boolean;
}

export interface SlowestSpan {
  id: string;
  name: string;
  kind: SpanKind;
  /** Self (exclusive) duration — why this span, not the all-encompassing root, is slowest. */
  selfDurationMs: number;
}

/** The aggregate signals you actually alert and dashboard on. Derived, never stored. */
export interface TraceMetrics {
  /** Wall-clock duration of the whole run (the root span). */
  totalDurationMs: number;
  totalTokens: number;
  totalCostUsd: number;
  spanCount: number;
  errorCount: number;
  /** errorCount / spanCount, 0–1, rounded to three decimals. */
  errorRate: number;
  retryCount: number;
  /** The bottleneck by self time; null only for an empty trace. */
  slowestSpan: SlowestSpan | null;
}

export interface Trace {
  root: SpanNode;
  /** Pre-order flattening (root first) — the render order for a tree/timeline view. */
  flat: SpanNode[];
  metrics: TraceMetrics;
}

/** Round a money amount to whole cents-of-a-thousandth to keep float noise out of totals. */
function roundCost(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Turn a flat list of recorded spans into a tree with rolled-up totals and derived
 * metrics. Pure. Requires exactly one root (a span with no parent) — an agent run has a
 * single entry point; anything else is a bug worth throwing on rather than papering over.
 */
export function buildTrace(spans: readonly Span[]): Trace {
  if (spans.length === 0) throw new Error('buildTrace: no spans recorded');

  const byId = new Map<string, Span>();
  for (const s of spans) byId.set(s.id, s);

  const roots = spans.filter((s) => s.parentId === undefined);
  if (roots.length !== 1) {
    throw new Error(`buildTrace: expected exactly one root span, found ${roots.length}`);
  }
  const childrenOf = new Map<string | undefined, Span[]>();
  for (const s of spans) {
    const list = childrenOf.get(s.parentId) ?? [];
    list.push(s);
    childrenOf.set(s.parentId, list);
  }

  const flat: SpanNode[] = [];

  function build(span: Span, depth: number): SpanNode {
    const end = span.endMs ?? span.startMs; // an unclosed span has zero duration, never negative
    const durationMs = Math.max(0, end - span.startMs);
    const selfTokens = span.attributes.tokens ?? 0;
    const selfCostUsd = span.attributes.costUsd ?? 0;

    const node: SpanNode = {
      span,
      depth,
      children: [],
      durationMs,
      selfDurationMs: durationMs, // reduced by children below
      selfTokens,
      selfCostUsd,
      subtreeTokens: selfTokens,
      subtreeCostUsd: selfCostUsd,
      hasError: span.attributes.error !== undefined,
    };
    flat.push(node);

    const kids = (childrenOf.get(span.id) ?? []).slice().sort((a, b) => a.startMs - b.startMs);
    let childrenWall = 0;
    for (const child of kids) {
      const childNode = build(child, depth + 1);
      node.children.push(childNode);
      node.subtreeTokens += childNode.subtreeTokens;
      node.subtreeCostUsd = roundCost(node.subtreeCostUsd + childNode.subtreeCostUsd);
      childrenWall += childNode.durationMs;
    }
    node.selfDurationMs = Math.max(0, durationMs - childrenWall);
    return node;
  }

  const root = build(roots[0]!, 0);

  // Metrics roll straight off the flattened tree.
  const spanCount = flat.length;
  const errorCount = flat.filter((n) => n.hasError).length;
  const retryCount = flat.filter((n) => n.span.kind === 'retry').length;

  let slowestSpan: SlowestSpan | null = null;
  for (const n of flat) {
    if (!slowestSpan || n.selfDurationMs > slowestSpan.selfDurationMs) {
      slowestSpan = {
        id: n.span.id,
        name: n.span.name,
        kind: n.span.kind,
        selfDurationMs: n.selfDurationMs,
      };
    }
  }

  const metrics: TraceMetrics = {
    totalDurationMs: root.durationMs,
    totalTokens: root.subtreeTokens,
    totalCostUsd: roundCost(root.subtreeCostUsd),
    spanCount,
    errorCount,
    errorRate: Math.round((errorCount / spanCount) * 1000) / 1000,
    retryCount,
    slowestSpan,
  };

  return { root, flat, metrics };
}

/**
 * A deterministic, fully-instrumented sample run — the numbers the lesson and its
 * visualization show, computed live so they can never drift from this code. A research
 * agent answers a question:
 *
 *   agent-run                       ← the root span; everything nests beneath it
 *     ├─ model-call: plan           ← the model picks a tool (tokens, cost)
 *     ├─ tool-call: web_search      ← SLOW, then TIMES OUT — the bottleneck and the bug
 *     ├─ retry: web_search          ← re-run succeeds; the retry is its own span
 *     ├─ model-call: compose        ← the model writes the answer (more tokens, more cost)
 *     └─ response                   ← return the answer; the run closes
 *
 * Token and cost figures are illustrative DECLARED values (as a provider would report
 * them), the same honesty rule as `ModelUsage`; the durations, tree, rollups and metrics
 * are all real, computed by `buildTrace`.
 */
export function buildDemoTrace(): Trace {
  const clock = manualClock(0);
  const tracer = new Tracer(clock);

  const root = tracer.startSpan({ name: 'agent-run', kind: 'agent' });

  // The model plans and selects a tool.
  const plan = tracer.startSpan({ name: 'model-call: plan', kind: 'model-call', parentId: root });
  clock.set(520);
  tracer.endSpan(plan, { tokens: 1180, costUsd: 0.0042 });

  // The tool call hangs and finally times out — slow AND failed.
  const search = tracer.startSpan({ name: 'tool-call: web_search', kind: 'tool-call', parentId: root });
  clock.set(3020);
  tracer.endSpan(search, { error: 'timeout after 2500 ms' });

  // A retry re-runs the same tool and succeeds.
  const retry = tracer.startSpan({ name: 'retry: web_search', kind: 'retry', parentId: root });
  clock.set(3920);
  tracer.endSpan(retry, {});

  // The model composes the final answer from the tool result.
  const compose = tracer.startSpan({ name: 'model-call: compose', kind: 'model-call', parentId: root });
  clock.set(4610);
  tracer.endSpan(compose, { tokens: 1520, costUsd: 0.0091 });

  // Return the answer; the run ends.
  const response = tracer.startSpan({ name: 'response', kind: 'response', parentId: root });
  clock.set(4660);
  tracer.endSpan(response, {});

  tracer.endSpan(root, {});

  return buildTrace(tracer.spans());
}
