import { describe, it, expect } from 'vitest';
import {
  emptyHistory,
  applyGrade,
  migrateHistory,
  memoryBackend,
  HISTORY_SCHEMA_VERSION,
} from './history';

describe('applyGrade', () => {
  it('records a grade and starts the count at 1', () => {
    const s = applyGrade(emptyHistory(), 'q1', 'good', '2026-01-01T00:00:00.000Z');
    expect(s.grades.q1).toEqual({ grade: 'good', at: '2026-01-01T00:00:00.000Z', count: 1 });
  });
  it('overwrites the grade and increments the count on re-grade', () => {
    let s = applyGrade(emptyHistory(), 'q1', 'again', 't1');
    s = applyGrade(s, 'q1', 'easy', 't2');
    expect(s.grades.q1).toEqual({ grade: 'easy', at: 't2', count: 2 });
  });
  it('is immutable (does not mutate the input)', () => {
    const a = emptyHistory();
    applyGrade(a, 'q1', 'good', 't');
    expect(a.grades).toEqual({});
  });
});

describe('migrateHistory', () => {
  it('accepts a valid current-version blob', () => {
    const valid = { version: HISTORY_SCHEMA_VERSION, grades: { q: { grade: 'good', at: 't', count: 1 } } };
    expect(migrateHistory(valid).grades.q?.grade).toBe('good');
  });
  it('degrades junk/corrupt/older blobs to empty rather than throwing', () => {
    expect(migrateHistory(null).grades).toEqual({});
    expect(migrateHistory({ version: 0 }).grades).toEqual({});
    expect(migrateHistory('garbage').grades).toEqual({});
    expect(migrateHistory({ version: 1, grades: { q: { grade: 'nope' } } }).grades).toEqual({});
  });
});

describe('memoryBackend', () => {
  it('round-trips a saved state', async () => {
    const backend = memoryBackend();
    const s = applyGrade(emptyHistory(), 'q1', 'hard', 't');
    await backend.save(s);
    expect(await backend.load()).toEqual(s);
  });
});
