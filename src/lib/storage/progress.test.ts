import { describe, expect, it } from 'vitest';

import {
  conceptProgress,
  emptyProgress,
  exportProgress,
  importProgress,
  migrate,
  PROGRESS_SCHEMA_VERSION,
  readCount,
  setConceptProgress,
} from './progress';

describe('progress state', () => {
  it('empty progress is valid and versioned', () => {
    const s = emptyProgress('2026-01-01T00:00:00.000Z');
    expect(s.version).toBe(PROGRESS_SCHEMA_VERSION);
    expect(s.concepts).toEqual({});
  });

  it('set and read a concept, and clear it', () => {
    let s = emptyProgress();
    s = setConceptProgress(s, 'tokens', 'read', 't1');
    expect(conceptProgress(s, 'tokens')).toBe('read');
    expect(s.updatedAt).toBe('t1');
    s = setConceptProgress(s, 'tokens', null, 't2');
    expect(conceptProgress(s, 'tokens')).toBeNull();
    expect(s.concepts).toEqual({});
  });

  it('readCount counts only read, not seen', () => {
    let s = emptyProgress();
    s = setConceptProgress(s, 'a', 'read', 't');
    s = setConceptProgress(s, 'b', 'seen', 't');
    s = setConceptProgress(s, 'c', 'read', 't');
    expect(readCount(s)).toBe(2);
  });

  it('does not mutate the input state', () => {
    const s = emptyProgress();
    const next = setConceptProgress(s, 'x', 'read', 't');
    expect(s.concepts).toEqual({});
    expect(next).not.toBe(s);
  });
});

describe('migrate / import — corrupt-tolerant', () => {
  it('accepts a valid current-version blob', () => {
    const good = { version: 1, concepts: { tokens: 'read' }, updatedAt: 't' };
    expect(migrate(good).concepts.tokens).toBe('read');
  });

  it('degrades unknown / future / corrupt input to empty, never throws', () => {
    expect(migrate({ version: 999 }).concepts).toEqual({});
    expect(migrate({ concepts: 'not-an-object' }).concepts).toEqual({});
    expect(migrate(null).concepts).toEqual({});
    expect(migrate('garbage').concepts).toEqual({});
    expect(migrate({ version: 1, concepts: { x: 'bogus-value' } }).concepts).toEqual({});
  });

  it('export → import round-trips', () => {
    let s = emptyProgress('2026-02-02T00:00:00.000Z');
    s = setConceptProgress(s, 'embeddings', 'read', 't');
    const round = importProgress(exportProgress(s));
    expect(round.concepts).toEqual(s.concepts);
    expect(round.version).toBe(PROGRESS_SCHEMA_VERSION);
  });

  it('import of malformed JSON yields empty progress', () => {
    expect(importProgress('{ not json').concepts).toEqual({});
  });
});
