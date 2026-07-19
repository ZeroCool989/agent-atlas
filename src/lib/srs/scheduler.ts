/**
 * SRS state over the whole interview bank (plan §9, Phase 2). This layer sits ON TOP of
 * the grade history (`src/lib/interview/history.ts`) — it does not duplicate it. History
 * records *what* the learner graded; the SRS state records *when each card is next due*.
 *
 * Shape and rules mirror the existing local-first modules (history.ts, storage/progress.ts):
 *  - versioned, Zod-validated;
 *  - corrupt/missing/older blobs degrade to empty rather than throwing;
 *  - pure functions (the caller injects `now`), so scheduling is deterministic;
 *  - JSON export/import for the app's backup story.
 *
 * The card transitions themselves live in `sm2.ts`; this file folds grades into a map of
 * per-question `CardState` and selects what is due.
 */
import { z } from 'astro/zod';
import { GRADES, type Grade, type HistoryState } from '../interview/history';
import { isDue, schedule, type CardState } from './sm2';

export const SRS_SCHEMA_VERSION = 1;

const CardStateSchema = z.object({
  reps: z.number().int().nonnegative(),
  ease: z.number().positive(),
  intervalDays: z.number().nonnegative(),
  due: z.string(),
  lastGrade: z.enum(GRADES),
  lastReviewedAt: z.string(),
});

const SrsStateSchema = z.object({
  version: z.literal(SRS_SCHEMA_VERSION),
  /** Map of question id → scheduling state. An absent id has never been reviewed. */
  cards: z.record(z.string(), CardStateSchema),
});

export type SrsState = z.infer<typeof SrsStateSchema>;

export function emptySrs(): SrsState {
  return { version: SRS_SCHEMA_VERSION, cards: {} };
}

/** Degrade unknown/corrupt/prior-version blobs to empty, consistent with history.ts. */
export function migrateSrs(raw: unknown): SrsState {
  const parsed = SrsStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptySrs();
}

/**
 * Record a grade for one question and advance its card. Pure. `now` is the review time
 * and drives the new due date. Never mutates the input.
 */
export function applyGradeToSrs(
  state: SrsState,
  questionId: string,
  grade: Grade,
  now: string | Date,
): SrsState {
  const next = schedule(state.cards[questionId], grade, now);
  return {
    ...state,
    cards: { ...state.cards, [questionId]: next },
  };
}

export interface DueCard {
  id: string;
  card: CardState;
}

/**
 * The review queue: every card whose due time has arrived at `now`, earliest-due first
 * (ties broken by id, so the order is deterministic). Cards for questions no longer in
 * the bank are dropped when `knownIds` is supplied.
 */
export function dueCards(
  state: SrsState,
  now: string | Date,
  knownIds?: Iterable<string>,
): DueCard[] {
  const allowed = knownIds ? new Set(knownIds) : null;
  const out: DueCard[] = [];
  for (const [id, card] of Object.entries(state.cards)) {
    if (allowed && !allowed.has(id)) continue;
    if (isDue(card, now)) out.push({ id, card });
  }
  out.sort((a, b) => {
    const d = new Date(a.card.due).getTime() - new Date(b.card.due).getTime();
    return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return out;
}

/** How many cards are due at `now` (optionally restricted to `knownIds`). */
export function dueCount(
  state: SrsState,
  now: string | Date,
  knownIds?: Iterable<string>,
): number {
  return dueCards(state, now, knownIds).length;
}

/**
 * Seed SRS state from the existing drill history. The history layer keeps only the
 * *latest* grade per question (not the full sequence), so this is an honest best-effort
 * bootstrap: each graded question becomes a single-review card scheduled from the
 * timestamp of that grade. It exists so a learner who drilled BEFORE SRS shipped still
 * gets a schedule. Pure and deterministic (uses each record's own `at` time).
 */
export function foldHistory(history: HistoryState): SrsState {
  const cards: Record<string, CardState> = {};
  for (const [id, record] of Object.entries(history.grades)) {
    cards[id] = schedule(undefined, record.grade, record.at);
  }
  return { version: SRS_SCHEMA_VERSION, cards };
}

/**
 * Merge any history grades that have no SRS card yet into the current SRS state, WITHOUT
 * overwriting cards SRS already tracks. Used on load to reconcile pre-SRS drill history
 * with live scheduling. Returns the same reference when nothing changed (cheap no-op).
 */
export function reconcileWithHistory(state: SrsState, history: HistoryState): SrsState {
  let cards = state.cards;
  let changed = false;
  for (const [id, record] of Object.entries(history.grades)) {
    if (cards[id]) continue;
    if (!changed) {
      cards = { ...cards };
      changed = true;
    }
    cards[id] = schedule(undefined, record.grade, record.at);
  }
  return changed ? { ...state, cards } : state;
}

/** Serialize for the export button. Stable, pretty JSON. */
export function exportSrs(state: SrsState): string {
  return JSON.stringify(state, null, 2);
}

/** Parse an imported blob, tolerating malformed JSON and older/partial shapes. */
export function importSrs(json: string): SrsState {
  try {
    return migrateSrs(JSON.parse(json));
  } catch {
    return emptySrs();
  }
}
