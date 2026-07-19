/**
 * Spaced-repetition scheduling (plan §9, Phase 2). Barrel export.
 *
 *  - `sm2.ts`       — the pure SM-2 card transition (deterministic, `now` injected).
 *  - `scheduler.ts` — versioned SRS state, folding drill history into cards, due-queue.
 *  - `backend.ts`   — IndexedDB persistence (own database), SSR-safe, degrade-to-empty.
 */
export * from './sm2';
export * from './scheduler';
export * from './backend';
