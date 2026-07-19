import { describe, expect, it } from 'vitest';

import { computeGraphLayout, type LayoutConceptInput } from './layout';

const c = (
  slug: string,
  layer: LayoutConceptInput['layer'],
  extra: Partial<LayoutConceptInput> = {},
): LayoutConceptInput => ({
  slug,
  label: slug,
  layer,
  status: 'complete',
  oneLiner: `${slug} one-liner`,
  prerequisites: [],
  related: [],
  ...extra,
});

describe('computeGraphLayout', () => {
  it('places foundation nearer the centre than outer layers (radial banding)', () => {
    const layout = computeGraphLayout([
      c('tokens', 'foundation'),
      c('rag', 'core-mechanism'),
      c('langchain', 'framework-abstraction'),
    ]);
    const byId = new Map(layout.nodes.map((n) => [n.slug, n]));
    const cx = layout.width / 2;
    const cy = layout.height / 2;
    const r = (slug: string) => {
      const n = byId.get(slug)!;
      return Math.hypot(n.x - cx, n.y - cy);
    };
    expect(r('tokens')).toBeLessThan(r('rag'));
    expect(r('rag')).toBeLessThan(r('langchain'));
    // ring indices follow canonical layer order among present layers
    expect(byId.get('tokens')!.ring).toBe(0);
    expect(byId.get('langchain')!.ring).toBe(2);
  });

  it('produces finite coordinates for every node (no NaN)', () => {
    const layout = computeGraphLayout([
      c('a', 'foundation'),
      c('b', 'foundation'),
      c('d', 'core-mechanism'),
    ]);
    for (const n of layout.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it('is deterministic: same input → identical positions', () => {
    const input = [c('a', 'foundation'), c('b', 'core-mechanism')];
    expect(computeGraphLayout(input).nodes).toEqual(computeGraphLayout(input).nodes);
  });

  it('derives edges only between present nodes; drops dangling references', () => {
    const layout = computeGraphLayout([
      c('rag', 'core-mechanism', { prerequisites: ['embeddings', 'ghost'], related: ['tokens'] }),
      c('embeddings', 'core-mechanism'),
      c('tokens', 'foundation'),
    ]);
    const keys = layout.edges.map((e) => `${e.from}->${e.to}:${e.type}`);
    expect(keys).toContain('rag->embeddings:prerequisite');
    expect(keys).toContain('rag->tokens:related');
    expect(keys.some((k) => k.includes('ghost'))).toBe(false); // dangling dropped
  });

  it('edge endpoints match node coordinates', () => {
    const layout = computeGraphLayout([
      c('rag', 'core-mechanism', { prerequisites: ['embeddings'] }),
      c('embeddings', 'core-mechanism'),
    ]);
    const byId = new Map(layout.nodes.map((n) => [n.slug, n]));
    const e = layout.edges[0]!;
    expect([e.x1, e.y1]).toEqual([byId.get('rag')!.x, byId.get('rag')!.y]);
    expect([e.x2, e.y2]).toEqual([byId.get('embeddings')!.x, byId.get('embeddings')!.y]);
  });
});
