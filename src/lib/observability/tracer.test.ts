import { describe, expect, it } from 'vitest';

import { buildDemoTrace, buildTrace, manualClock, Tracer, type Span } from './tracer';

describe('Tracer', () => {
  it('stamps start and end times from the injected clock and returns deterministic ids', () => {
    const clock = manualClock(0);
    const tracer = new Tracer(clock);

    const a = tracer.startSpan({ name: 'agent-run', kind: 'agent' });
    clock.set(100);
    const b = tracer.startSpan({ name: 'model-call', kind: 'model-call', parentId: a });
    clock.set(400);
    tracer.endSpan(b, { tokens: 50, costUsd: 0.001 });
    clock.set(410);
    tracer.endSpan(a);

    expect(a).toBe('s1');
    expect(b).toBe('s2');
    const spans = tracer.spans();
    expect(spans.map((s) => s.id)).toEqual(['s1', 's2']);
    const model = spans[1]!;
    expect(model.startMs).toBe(100);
    expect(model.endMs).toBe(400);
    expect(model.attributes).toEqual({ tokens: 50, costUsd: 0.001 });
  });

  it('throws when ending a span that is not open', () => {
    const tracer = new Tracer(manualClock(0));
    const id = tracer.startSpan({ name: 'x', kind: 'agent' });
    tracer.endSpan(id);
    expect(() => tracer.endSpan(id)).toThrow(/not open/);
    expect(() => tracer.endSpan('nope')).toThrow(/not open/);
  });
});

describe('buildTrace', () => {
  it('nests spans by parentId and orders children by start time', () => {
    const clock = manualClock(0);
    const tracer = new Tracer(clock);
    const root = tracer.startSpan({ name: 'root', kind: 'agent' });
    const first = tracer.startSpan({ name: 'first', kind: 'model-call', parentId: root });
    clock.set(10);
    tracer.endSpan(first);
    const second = tracer.startSpan({ name: 'second', kind: 'tool-call', parentId: root });
    clock.set(30);
    tracer.endSpan(second);
    clock.set(30);
    tracer.endSpan(root);

    const { root: node } = buildTrace(tracer.spans());
    expect(node.children.map((c) => c.span.name)).toEqual(['first', 'second']);
    expect(node.depth).toBe(0);
    expect(node.children[0]!.depth).toBe(1);
  });

  it('rolls tokens and cost up to the root and computes self (exclusive) duration', () => {
    const { root } = buildDemoTrace();
    // The root closes over the whole run: its subtree totals are the grand totals.
    expect(root.subtreeTokens).toBe(2700);
    expect(root.subtreeCostUsd).toBeCloseTo(0.0133, 10);
    // Children fully account for the root's wall time, so the root's SELF time is ~0.
    expect(root.durationMs).toBe(4660);
    expect(root.selfDurationMs).toBe(0);
  });

  it('rejects a trace without exactly one root', () => {
    const twoRoots: Span[] = [
      { id: 's1', name: 'a', kind: 'agent', startMs: 0, endMs: 1, attributes: {} },
      { id: 's2', name: 'b', kind: 'agent', startMs: 0, endMs: 1, attributes: {} },
    ];
    expect(() => buildTrace(twoRoots)).toThrow(/exactly one root/);
    expect(() => buildTrace([])).toThrow(/no spans/);
  });
});

describe('buildDemoTrace metrics', () => {
  const { metrics } = buildDemoTrace();

  it('reports real totals computed from the spans', () => {
    expect(metrics.totalDurationMs).toBe(4660);
    expect(metrics.totalTokens).toBe(2700);
    expect(metrics.totalCostUsd).toBeCloseTo(0.0133, 10);
    expect(metrics.spanCount).toBe(6);
  });

  it('derives the error rate from the one failed span', () => {
    expect(metrics.errorCount).toBe(1);
    expect(metrics.retryCount).toBe(1);
    // 1 error over 6 spans, rounded to three decimals.
    expect(metrics.errorRate).toBe(0.167);
  });

  it('names the slow, timed-out tool call as the bottleneck by self time', () => {
    expect(metrics.slowestSpan).not.toBeNull();
    expect(metrics.slowestSpan!.name).toBe('tool-call: web_search');
    expect(metrics.slowestSpan!.kind).toBe('tool-call');
    expect(metrics.slowestSpan!.selfDurationMs).toBe(2500);
    // The errored span and the slowest span are the same one — the whole point.
    const errored = buildDemoTrace().flat.find((n) => n.hasError)!;
    expect(errored.span.id).toBe(metrics.slowestSpan!.id);
  });
});
