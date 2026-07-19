/**
 * Drill-mode grade history (plan §9). Local-first, versioned; the learner self-grades a
 * question (again/hard/good/easy) and we keep the latest grade + attempt count per
 * question. NO spaced-repetition scheduling yet (out of MVP) — this only records.
 *
 * The pure state logic (applyGrade/migrate) is framework-free and unit-tested. I/O is
 * behind a `HistoryBackend` so the browser uses IndexedDB (plan §12) while tests use an
 * in-memory backend. IndexedDB access is guarded, so importing this module is SSR-safe.
 */
import { z } from 'astro/zod';

export const HISTORY_SCHEMA_VERSION = 1;
export const GRADES = ['again', 'hard', 'good', 'easy'] as const;
export type Grade = (typeof GRADES)[number];

const GradeRecordSchema = z.object({
  grade: z.enum(GRADES),
  at: z.string(),
  count: z.number().int().nonnegative(),
});
export type GradeRecord = z.infer<typeof GradeRecordSchema>;

const HistoryStateSchema = z.object({
  version: z.literal(HISTORY_SCHEMA_VERSION),
  grades: z.record(z.string(), GradeRecordSchema),
});
export type HistoryState = z.infer<typeof HistoryStateSchema>;

export function emptyHistory(): HistoryState {
  return { version: HISTORY_SCHEMA_VERSION, grades: {} };
}

/** Degrade unknown/corrupt/prior-version blobs to empty rather than throwing. */
export function migrateHistory(raw: unknown): HistoryState {
  const parsed = HistoryStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyHistory();
}

/** Record a grade for a question, incrementing its attempt count. Pure. */
export function applyGrade(
  state: HistoryState,
  questionId: string,
  grade: Grade,
  now: string,
): HistoryState {
  const prior = state.grades[questionId];
  return {
    ...state,
    grades: {
      ...state.grades,
      [questionId]: { grade, at: now, count: (prior?.count ?? 0) + 1 },
    },
  };
}

export interface HistoryBackend {
  load(): Promise<HistoryState>;
  save(state: HistoryState): Promise<void>;
}

/** In-memory backend for tests and SSR. */
export function memoryBackend(initial: HistoryState = emptyHistory()): HistoryBackend {
  let state = initial;
  return {
    load: async () => state,
    save: async (s) => {
      state = s;
    },
  };
}

const DB_NAME = 'agent-atlas';
const STORE = 'interview-history';
const KEY = 'history';

function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * IndexedDB backend. Stores the whole HistoryState blob under one key. If IndexedDB is
 * unavailable (SSR, private-mode quirks) it degrades to a no-op empty backend so the UI
 * never crashes — a lost grade is never worth an error.
 */
export function idbBackend(): HistoryBackend {
  if (!idbAvailable()) return memoryBackend();
  return {
    async load() {
      try {
        const db = await openDb();
        const raw = await new Promise<unknown>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
          tx.onsuccess = () => resolve(tx.result);
          tx.onerror = () => reject(tx.error);
        });
        db.close();
        return migrateHistory(raw);
      } catch {
        return emptyHistory();
      }
    },
    async save(state) {
      try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(state, KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      } catch {
        /* best-effort; ignore */
      }
    },
  };
}
