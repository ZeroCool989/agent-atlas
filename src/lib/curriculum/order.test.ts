import { describe, expect, it } from 'vitest';
import {
  orderedCurriculum,
  readingSequence,
  unreadPrerequisites,
  type CurriculumConcept,
} from './order';

const c = (
  id: string,
  layer: CurriculumConcept['layer'],
  prerequisites: string[] = [],
  title = id,
): CurriculumConcept => ({ id, title, layer, status: 'complete', prerequisites });

describe('orderedCurriculum', () => {
  it('groups by layer in canonical order and drops empty layers', () => {
    const groups = orderedCurriculum([
      c('rag', 'core-mechanism', ['embeddings']),
      c('tokens', 'foundation'),
      c('embeddings', 'core-mechanism', ['tokens']),
    ]);
    expect(groups.map((g) => g.layer)).toEqual(['foundation', 'core-mechanism']);
  });

  it('topologically orders within a layer (a same-layer prerequisite comes first)', () => {
    const groups = orderedCurriculum([
      c('rag', 'core-mechanism', ['embeddings', 'vector-search']),
      c('vector-search', 'core-mechanism', ['embeddings']),
      c('embeddings', 'core-mechanism'),
    ]);
    const order = groups[0]!.concepts.map((x) => x.id);
    expect(order.indexOf('embeddings')).toBeLessThan(order.indexOf('vector-search'));
    expect(order.indexOf('vector-search')).toBeLessThan(order.indexOf('rag'));
  });

  it('is deterministic (stable across calls and input order)', () => {
    const input = [c('b', 'foundation'), c('a', 'foundation'), c('c', 'foundation', ['a'])];
    const a = readingSequence(input).map((x) => x.id);
    const b = readingSequence([...input].reverse()).map((x) => x.id);
    expect(a).toEqual(b);
    expect(a[0]).toBe('a'); // alphabetical tie-break
  });

  it('does not loop on an accidental cycle (defensive)', () => {
    const seq = readingSequence([
      c('x', 'foundation', ['y']),
      c('y', 'foundation', ['x']),
    ]);
    expect(seq.map((s) => s.id).sort()).toEqual(['x', 'y']);
  });
});

describe('unreadPrerequisites', () => {
  const all = [
    c('tokens', 'foundation'),
    c('embeddings', 'core-mechanism', ['tokens']),
    c('rag', 'core-mechanism', ['embeddings', 'tokens']),
  ];

  it('returns prerequisites not yet marked read, in reading order', () => {
    const rag = all.find((x) => x.id === 'rag')!;
    expect(unreadPrerequisites(rag, new Set(), all)).toEqual(['tokens', 'embeddings']);
  });

  it('excludes prerequisites already read', () => {
    const rag = all.find((x) => x.id === 'rag')!;
    expect(unreadPrerequisites(rag, new Set(['tokens']), all)).toEqual(['embeddings']);
    expect(unreadPrerequisites(rag, new Set(['tokens', 'embeddings']), all)).toEqual([]);
  });
});
