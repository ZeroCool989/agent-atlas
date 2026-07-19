import { describe, expect, it } from 'vitest';
import { emptyHistory, applyGrade, type HistoryState } from '../interview/history';
import {
  SRS_SCHEMA_VERSION,
  applyGradeToSrs,
  dueCards,
  dueCount,
  emptySrs,
  exportSrs,
  foldHistory,
  importSrs,
  migrateSrs,
  reconcileWithHistory,
  type SrsState,
} from './scheduler';
import { memorySrsBackend } from './backend';
import { schedule } from './sm2';

const T0 = '2026-01-01T00:00:00.000Z';
const day = (n: number) => new Date(Date.parse(T0) + n * 86400000).toISOString();

describe('emptySrs / migrateSrs — corrupt tolerant', () => {
  it('empty state is valid and versioned', () => {
    const s = emptySrs();
    expect(s.version).toBe(SRS_SCHEMA_VERSION);
    expect(s.cards).toEqual({});
  });
  it('accepts a valid current-version blob', () => {
    const card = schedule(undefined, 'good', T0);
    const valid = { version: SRS_SCHEMA_VERSION, cards: { q1: card } };
    expect(migrateSrs(valid).cards.q1?.reps).toBe(1);
  });
  it('degrades junk / older / corrupt blobs to empty rather than throwing', () => {
    expect(migrateSrs(null).cards).toEqual({});
    expect(migrateSrs('garbage').cards).toEqual({});
    expect(migrateSrs({ version: 0 }).cards).toEqual({});
    expect(migrateSrs({ version: 1, cards: { q: { reps: -1 } } }).cards).toEqual({});
    expect(migrateSrs({ version: 1, cards: { q: { reps: 1, ease: 2, intervalDays: 1, due: 't', lastGrade: 'nope', lastReviewedAt: 't' } } }).cards).toEqual({});
  });
});

describe('applyGradeToSrs', () => {
  it('creates a card for a never-seen question', () => {
    const s = applyGradeToSrs(emptySrs(), 'q1', 'good', T0);
    expect(s.cards.q1?.reps).toBe(1);
    expect(s.cards.q1?.due).toBe(day(1));
  });
  it('advances an existing card and does not mutate the input', () => {
    const s1 = applyGradeToSrs(emptySrs(), 'q1', 'good', T0);
    const s2 = applyGradeToSrs(s1, 'q1', 'good', s1.cards.q1!.due);
    expect(s2.cards.q1?.reps).toBe(2);
    expect(s1.cards.q1?.reps).toBe(1); // unchanged
  });
});

describe('dueCards / dueCount', () => {
  function seed(): SrsState {
    // q1 due day 1, q2 due day 6, q3 due day 1 — built deterministically.
    let s = emptySrs();
    s = applyGradeToSrs(s, 'q1', 'good', T0); // due day(1)
    s = applyGradeToSrs(s, 'q3', 'good', T0); // due day(1)
    s = applyGradeToSrs(s, 'q2', 'good', T0);
    s = applyGradeToSrs(s, 'q2', 'good', s.cards.q2!.due); // due day(1+6)=day(7)
    return s;
  }
  it('selects only cards whose due time has arrived', () => {
    const s = seed();
    expect(dueCount(s, T0)).toBe(0); // nothing due yet
    expect(dueCount(s, day(1))).toBe(2); // q1, q3
    expect(dueCount(s, day(30))).toBe(3); // all
  });
  it('orders due cards earliest-first, ties broken by id', () => {
    const s = seed();
    const ids = dueCards(s, day(30)).map((d) => d.id);
    expect(ids).toEqual(['q1', 'q3', 'q2']); // q1,q3 due day1 (id tiebreak), q2 day7
  });
  it('drops cards for questions no longer in the bank', () => {
    const s = seed();
    expect(dueCount(s, day(30), ['q1', 'q2'])).toBe(2); // q3 excluded
    expect(dueCards(s, day(30), ['q2']).map((d) => d.id)).toEqual(['q2']);
  });
});

describe('foldHistory — bootstrap SRS from prior drill history', () => {
  it('turns each graded question into a single-review card scheduled from its grade time', () => {
    let h: HistoryState = emptyHistory();
    h = applyGrade(h, 'q1', 'good', T0);
    h = applyGrade(h, 'q2', 'again', day(2));
    const s = foldHistory(h);
    expect(s.cards.q1).toEqual(schedule(undefined, 'good', T0));
    expect(s.cards.q2).toEqual(schedule(undefined, 'again', day(2)));
  });
  it('is deterministic and empty for empty history', () => {
    expect(foldHistory(emptyHistory()).cards).toEqual({});
  });
});

describe('reconcileWithHistory — merge without clobbering live cards', () => {
  it('adds only history questions the SRS state does not already track', () => {
    let h: HistoryState = emptyHistory();
    h = applyGrade(h, 'q1', 'easy', T0); // stale relative to SRS
    h = applyGrade(h, 'q2', 'good', T0); // only in history
    // SRS already advanced q1 twice; that card must be preserved.
    let srs = applyGradeToSrs(emptySrs(), 'q1', 'good', T0);
    srs = applyGradeToSrs(srs, 'q1', 'good', srs.cards.q1!.due);
    const merged = reconcileWithHistory(srs, h);
    expect(merged.cards.q1?.reps).toBe(2); // untouched, not reset to a fresh seed
    expect(merged.cards.q2?.reps).toBe(1); // seeded from history
  });
  it('returns the same reference when there is nothing to add', () => {
    const srs = applyGradeToSrs(emptySrs(), 'q1', 'good', T0);
    let h: HistoryState = emptyHistory();
    h = applyGrade(h, 'q1', 'good', T0);
    expect(reconcileWithHistory(srs, h)).toBe(srs);
    expect(reconcileWithHistory(srs, emptyHistory())).toBe(srs);
  });
});

describe('export / import round-trip', () => {
  it('round-trips a state through JSON', () => {
    const s = applyGradeToSrs(emptySrs(), 'q1', 'good', T0);
    expect(importSrs(exportSrs(s))).toEqual(s);
  });
  it('import of malformed JSON yields empty state', () => {
    expect(importSrs('{ not json').cards).toEqual({});
  });
});

describe('memorySrsBackend', () => {
  it('round-trips a saved state', async () => {
    const backend = memorySrsBackend();
    const s = applyGradeToSrs(emptySrs(), 'q1', 'hard', T0);
    await backend.save(s);
    expect(await backend.load()).toEqual(s);
  });
});
