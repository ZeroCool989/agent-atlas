/**
 * SM-2 spaced-repetition core (plan §9, Phase 2). A pure, framework-free implementation
 * of the classic SuperMemo-2 algorithm that schedules the NEXT review of a card from a
 * self-grade and the card's prior state.
 *
 * Design constraints (so this stays teachable and testable):
 *  - No `Date.now()` inside the core. The caller injects `now`, so every transition is
 *    deterministic and unit-testable.
 *  - No React, no Astro, no I/O. Just numbers and dates. Persistence and folding over the
 *    drill history live in `scheduler.ts`; IndexedDB lives in `backend.ts`.
 *
 * SM-2 recap (what the learner should be able to explain):
 *  - Each card carries an *ease factor* (EF, how fast its interval grows), a *repetition
 *    count* (how many times in a row it was recalled), and an *interval* (days until the
 *    next review).
 *  - A review produces a *quality* score 0–5. q < 3 is a lapse: the repetition count
 *    resets and you start over. q ≥ 3 is a success: the interval grows (1 day → 6 days →
 *    previous × EF).
 *  - EF is nudged every review by q: recalling easily raises it, struggling lowers it,
 *    with a floor of 1.3 so a hard card never grows faster than it should.
 */
import { GRADES, type Grade } from '../interview/history';

/** Starting ease factor for a brand-new card (SuperMemo's default). */
export const INITIAL_EASE = 2.5;
/** EF floor. Below this an interval would barely grow; SM-2 clamps here. */
export const MIN_EASE = 1.3;
/** Interval (days) after the first successful review. */
export const FIRST_INTERVAL_DAYS = 1;
/** Interval (days) after the second successful review. */
export const SECOND_INTERVAL_DAYS = 6;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The scheduling state of a single card. Serialised as-is into the versioned SRS store
 * (see `scheduler.ts`). A question with no entry has simply never been reviewed.
 */
export interface CardState {
  /** Consecutive successful recalls (SM-2 `n`). Resets to 0 on a lapse. */
  reps: number;
  /** Ease factor (SM-2 `EF`), ≥ MIN_EASE. */
  ease: number;
  /** Days until the review scheduled by the last grade. */
  intervalDays: number;
  /** ISO-8601 (UTC) timestamp when this card next becomes due. */
  due: string;
  /** The grade recorded at the last review. */
  lastGrade: Grade;
  /** ISO-8601 (UTC) timestamp of the last review. */
  lastReviewedAt: string;
}

/**
 * Maps the drill's grade vocabulary (again/hard/good/easy) onto SM-2 quality scores.
 * `again` is the only lapse (q < 3); hard/good/easy are graded successes whose q drives
 * how EF moves: hard lowers EF, good holds it, easy raises it.
 */
export const GRADE_QUALITY: Record<Grade, number> = {
  again: 2,
  hard: 3,
  good: 4,
  easy: 5,
};

export function gradeToQuality(grade: Grade): number {
  return GRADE_QUALITY[grade];
}

/** True for grades treated as successful recall (q ≥ 3): hard, good, easy. */
export function isRecall(grade: Grade): boolean {
  return gradeToQuality(grade) >= 3;
}

function clampEase(ease: number): number {
  return ease < MIN_EASE ? MIN_EASE : ease;
}

function toDate(now: string | Date): Date {
  return now instanceof Date ? now : new Date(now);
}

function addDaysIso(now: string | Date, days: number): string {
  return new Date(toDate(now).getTime() + days * MS_PER_DAY).toISOString();
}

/**
 * The SM-2 ease update. Recalling with quality `q` nudges EF by
 * `0.1 - (5 - q)(0.08 + (5 - q)·0.02)`, floored at MIN_EASE. Exposed for unit tests and
 * teaching; the scheduler calls it internally.
 */
export function nextEase(ease: number, quality: number): number {
  const q = quality;
  return clampEase(ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
}

/**
 * Advance a card by one review. Pure: given the same `prior`, `grade`, and `now` it
 * always returns the same next state.
 *
 * @param prior  The card's state before this review, or `undefined`/`null` for a
 *               never-reviewed card (starts at reps 0, EF 2.5, interval 0).
 * @param grade  The learner's self-grade.
 * @param now    The review time (ISO string or Date). `due` is computed from it.
 */
export function schedule(
  prior: CardState | null | undefined,
  grade: Grade,
  now: string | Date,
): CardState {
  const quality = gradeToQuality(grade);
  const priorEase = prior?.ease ?? INITIAL_EASE;
  const priorReps = prior?.reps ?? 0;
  const priorInterval = prior?.intervalDays ?? 0;

  // EF is nudged on every review — success or lapse — then clamped (classic SM-2).
  const ease = nextEase(priorEase, quality);

  let reps: number;
  let intervalDays: number;
  if (quality < 3) {
    // Lapse: forget the streak and restart the interval ladder.
    reps = 0;
    intervalDays = FIRST_INTERVAL_DAYS;
  } else {
    reps = priorReps + 1;
    if (reps === 1) intervalDays = FIRST_INTERVAL_DAYS;
    else if (reps === 2) intervalDays = SECOND_INTERVAL_DAYS;
    else intervalDays = Math.round(priorInterval * ease);
  }

  const reviewedAt = toDate(now).toISOString();
  return {
    reps,
    ease,
    intervalDays,
    due: addDaysIso(now, intervalDays),
    lastGrade: grade,
    lastReviewedAt: reviewedAt,
  };
}

/** True when a card is due at `now` (its due time has arrived or passed). */
export function isDue(card: CardState, now: string | Date): boolean {
  return toDate(card.due).getTime() <= toDate(now).getTime();
}

/** Re-export the grade vocabulary so SRS consumers need only one import. */
export { GRADES, type Grade };
