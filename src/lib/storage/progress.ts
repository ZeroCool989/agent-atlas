/**
 * Local-first progress tracking (ADR-0003). Pure, versioned, Zod-validated state that
 * lives only in the browser (localStorage) with JSON export/import — no backend, no
 * account. This module is framework-free: no React, no Astro. Components read/write it;
 * the storage wrapper is the single point that touches `localStorage`, guarded so the
 * pure functions stay testable in Node.
 *
 * Evolution: bump PROGRESS_SCHEMA_VERSION and add a migration branch in `migrate()`.
 */
import { z } from 'astro/zod';

export const PROGRESS_SCHEMA_VERSION = 1;

/** Per-concept reading state. `seen` = visited; `read` = marked done by the learner. */
export const CONCEPT_PROGRESS = ['seen', 'read'] as const;
export type ConceptProgress = (typeof CONCEPT_PROGRESS)[number];

const ProgressStateSchema = z.object({
  version: z.literal(PROGRESS_SCHEMA_VERSION),
  /** Map of concept slug → progress. Absent slug = untouched. */
  concepts: z.record(z.string(), z.enum(CONCEPT_PROGRESS)),
  updatedAt: z.string(),
});

export type ProgressState = z.infer<typeof ProgressStateSchema>;

export const STORAGE_KEY = 'agent-atlas:progress:v1';

export function emptyProgress(now = '1970-01-01T00:00:00.000Z'): ProgressState {
  return { version: PROGRESS_SCHEMA_VERSION, concepts: {}, updatedAt: now };
}

/**
 * Bring any prior-version or unknown blob up to the current schema. Unknown/corrupt
 * input degrades to empty progress rather than throwing — a lost reading-position is
 * never worth a crash. Returns the migrated state (does not persist).
 */
export function migrate(raw: unknown): ProgressState {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const v = (raw as { version?: unknown }).version;
    // v1 is current; future versions add branches here BEFORE the generic parse.
    if (v === PROGRESS_SCHEMA_VERSION) {
      const parsed = ProgressStateSchema.safeParse(raw);
      if (parsed.success) return parsed.data;
    }
  }
  return emptyProgress();
}

/** Pure update: set a concept's progress (or clear it with `null`). */
export function setConceptProgress(
  state: ProgressState,
  slug: string,
  progress: ConceptProgress | null,
  now: string,
): ProgressState {
  const concepts = { ...state.concepts };
  if (progress === null) delete concepts[slug];
  else concepts[slug] = progress;
  return { ...state, concepts, updatedAt: now };
}

export function conceptProgress(state: ProgressState, slug: string): ConceptProgress | null {
  return state.concepts[slug] ?? null;
}

export function readCount(state: ProgressState): number {
  return Object.values(state.concepts).filter((p) => p === 'read').length;
}

/** Serialize for the export button. Stable, pretty JSON. */
export function exportProgress(state: ProgressState): string {
  return JSON.stringify(state, null, 2);
}

/** Parse an imported file. Runs through `migrate` so partial/older files still load. */
export function importProgress(json: string): ProgressState {
  try {
    return migrate(JSON.parse(json));
  } catch {
    return emptyProgress();
  }
}

/** True only in a browser with a working localStorage (SSR / private-mode safe). */
function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

/** Load persisted progress, tolerating SSR, absent, and corrupt data. */
export function loadProgress(): ProgressState {
  if (!storageAvailable()) return emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    return migrate(JSON.parse(raw));
  } catch {
    return emptyProgress();
  }
}

/** Persist progress. No-op (returns false) when storage is unavailable. */
export function saveProgress(state: ProgressState): boolean {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
