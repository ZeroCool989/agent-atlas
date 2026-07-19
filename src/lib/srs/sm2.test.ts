import { describe, expect, it } from 'vitest';
import {
  FIRST_INTERVAL_DAYS,
  GRADE_QUALITY,
  INITIAL_EASE,
  MIN_EASE,
  SECOND_INTERVAL_DAYS,
  gradeToQuality,
  isDue,
  isRecall,
  nextEase,
  schedule,
  type CardState,
} from './sm2';

const T0 = '2026-01-01T00:00:00.000Z';
const day = (n: number) => new Date(Date.parse(T0) + n * 86400000).toISOString();

describe('grade → quality mapping', () => {
  it('maps the drill vocabulary onto SM-2 quality scores', () => {
    expect(GRADE_QUALITY).toEqual({ again: 2, hard: 3, good: 4, easy: 5 });
    expect(gradeToQuality('again')).toBe(2);
    expect(gradeToQuality('easy')).toBe(5);
  });
  it('treats only "again" (q < 3) as a lapse; hard/good/easy are recalls', () => {
    expect(isRecall('again')).toBe(false);
    expect(isRecall('hard')).toBe(true);
    expect(isRecall('good')).toBe(true);
    expect(isRecall('easy')).toBe(true);
  });
});

describe('nextEase (SM-2 ease update)', () => {
  it('holds EF for good, raises it for easy, lowers it for hard', () => {
    expect(nextEase(2.5, 4)).toBeCloseTo(2.5, 10); // good
    expect(nextEase(2.5, 5)).toBeCloseTo(2.6, 10); // easy
    expect(nextEase(2.5, 3)).toBeCloseTo(2.36, 10); // hard
    expect(nextEase(2.5, 2)).toBeCloseTo(2.18, 10); // again
  });
  it('never drops below the MIN_EASE floor', () => {
    expect(nextEase(1.3, 2)).toBe(MIN_EASE);
    expect(nextEase(1.31, 0)).toBe(MIN_EASE);
  });
});

describe('schedule — a first review of a new card', () => {
  it('good: reps 1, EF unchanged, interval 1 day, due tomorrow', () => {
    const c = schedule(undefined, 'good', T0);
    expect(c.reps).toBe(1);
    expect(c.ease).toBeCloseTo(INITIAL_EASE, 10);
    expect(c.intervalDays).toBe(FIRST_INTERVAL_DAYS);
    expect(c.due).toBe(day(1));
    expect(c.lastGrade).toBe('good');
    expect(c.lastReviewedAt).toBe(T0);
  });
  it('easy: still reps 1 / interval 1, but EF rises to 2.6', () => {
    const c = schedule(undefined, 'easy', T0);
    expect(c.reps).toBe(1);
    expect(c.intervalDays).toBe(FIRST_INTERVAL_DAYS);
    expect(c.ease).toBeCloseTo(2.6, 10);
  });
  it('hard: a recall (interval 1), but EF drops to 2.36', () => {
    const c = schedule(undefined, 'hard', T0);
    expect(c.reps).toBe(1);
    expect(c.intervalDays).toBe(FIRST_INTERVAL_DAYS);
    expect(c.ease).toBeCloseTo(2.36, 10);
  });
  it('again: a lapse — reps stay 0, interval resets to 1, EF drops', () => {
    const c = schedule(undefined, 'again', T0);
    expect(c.reps).toBe(0);
    expect(c.intervalDays).toBe(FIRST_INTERVAL_DAYS);
    expect(c.ease).toBeCloseTo(2.18, 10);
  });
});

describe('schedule — the interval ladder over successful recalls', () => {
  it('climbs 1 → 6 → round(prev × EF) for consecutive goods', () => {
    const c1 = schedule(undefined, 'good', T0);
    expect(c1.intervalDays).toBe(1);
    const c2 = schedule(c1, 'good', c1.due);
    expect(c2.reps).toBe(2);
    expect(c2.intervalDays).toBe(SECOND_INTERVAL_DAYS); // 6
    const c3 = schedule(c2, 'good', c2.due);
    expect(c3.reps).toBe(3);
    expect(c3.intervalDays).toBe(Math.round(6 * 2.5)); // 15
    const c4 = schedule(c3, 'good', c3.due);
    expect(c4.intervalDays).toBe(Math.round(c3.intervalDays * c4.ease)); // round(15 * 2.5) = 38
  });
});

describe('schedule — again resets the interval ladder', () => {
  it('collapses a long-interval card back to reps 0 / interval 1', () => {
    let c: CardState = schedule(undefined, 'good', T0);
    c = schedule(c, 'good', c.due); // interval 6
    c = schedule(c, 'good', c.due); // interval 15, reps 3
    expect(c.intervalDays).toBe(15);
    const relapsed = schedule(c, 'again', c.due);
    expect(relapsed.reps).toBe(0);
    expect(relapsed.intervalDays).toBe(FIRST_INTERVAL_DAYS);
    // EF is nudged down but never below the floor.
    expect(relapsed.ease).toBeGreaterThanOrEqual(MIN_EASE);
    expect(relapsed.ease).toBeLessThan(c.ease);
  });
  it('clamps EF at the floor under repeated agains', () => {
    let c = schedule(undefined, 'again', T0);
    for (let i = 0; i < 20; i++) c = schedule(c, 'again', c.due);
    expect(c.ease).toBe(MIN_EASE);
  });
});

describe('schedule — determinism', () => {
  it('is a pure function of (prior, grade, now)', () => {
    const a = schedule(undefined, 'good', T0);
    const b = schedule(undefined, 'good', T0);
    expect(a).toEqual(b);
  });
  it('accepts a Date and an ISO string interchangeably', () => {
    const fromString = schedule(undefined, 'good', T0);
    const fromDate = schedule(undefined, 'good', new Date(T0));
    expect(fromDate).toEqual(fromString);
  });
  it('does not mutate the prior card', () => {
    const prior = schedule(undefined, 'good', T0);
    const snapshot = { ...prior };
    schedule(prior, 'easy', prior.due);
    expect(prior).toEqual(snapshot);
  });
});

describe('isDue', () => {
  const card = schedule(undefined, 'good', T0); // due day(1)
  it('is not due before its due time', () => {
    expect(isDue(card, T0)).toBe(false);
  });
  it('is due exactly at and after its due time', () => {
    expect(isDue(card, card.due)).toBe(true);
    expect(isDue(card, day(5))).toBe(true);
  });
});
