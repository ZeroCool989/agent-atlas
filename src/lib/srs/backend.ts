/**
 * Persistence for the SRS state. Same local-first approach as the grade history
 * (IndexedDB, one blob under one key), and deliberately in its OWN database
 * (`agent-atlas-srs`) rather than the history database.
 *
 * Why a separate database: `history.ts` opens `agent-atlas` at version 1 and owns that
 * upgrade. Adding an SRS object store to it would force a version bump, and two modules
 * opening the same database at different versions race into `VersionError`. A separate
 * database keeps SRS storage fully decoupled from the history store while using the exact
 * same guarded, SSR-safe, degrade-to-empty pattern.
 *
 * Importing this module is SSR-safe: IndexedDB access is guarded, and with no IndexedDB
 * present (server, private-mode quirks) it falls back to an in-memory backend.
 */
import { emptySrs, migrateSrs, type SrsState } from './scheduler';

export interface SrsBackend {
  load(): Promise<SrsState>;
  save(state: SrsState): Promise<void>;
}

/** In-memory backend for tests and SSR. */
export function memorySrsBackend(initial: SrsState = emptySrs()): SrsBackend {
  let state = initial;
  return {
    load: async () => state,
    save: async (s) => {
      state = s;
    },
  };
}

export const SRS_DB_NAME = 'agent-atlas-srs';
export const SRS_STORE = 'srs';
export const SRS_KEY = 'srs';

function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SRS_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(SRS_STORE)) req.result.createObjectStore(SRS_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * IndexedDB backend. Stores the whole SrsState blob under one key. If IndexedDB is
 * unavailable it degrades to an in-memory no-op so the UI never crashes — a lost review
 * schedule is never worth an error (it rebuilds from history on the next load anyway).
 */
export function srsIdbBackend(): SrsBackend {
  if (!idbAvailable()) return memorySrsBackend();
  return {
    async load() {
      try {
        const db = await openDb();
        const raw = await new Promise<unknown>((resolve, reject) => {
          const tx = db.transaction(SRS_STORE, 'readonly').objectStore(SRS_STORE).get(SRS_KEY);
          tx.onsuccess = () => resolve(tx.result);
          tx.onerror = () => reject(tx.error);
        });
        db.close();
        return migrateSrs(raw);
      } catch {
        return emptySrs();
      }
    },
    async save(state) {
      try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(SRS_STORE, 'readwrite');
          tx.objectStore(SRS_STORE).put(state, SRS_KEY);
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
