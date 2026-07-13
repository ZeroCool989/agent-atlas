# ADR-0003: Local-First Progress Tracking (No Backend, No Auth for MVP)

- **Status:** Accepted (2026-07-13, amended: backend introduction trigger broadened)
- **Date:** 2026-07-13

## Context

The platform needs per-user state: lesson completion, interview-drill history, spaced-
repetition scheduling, playground settings. The template `CLAUDE.md` assumed Postgres +
Prisma + Redis + Auth.js + Stripe. The actual requirement is state for **one user** (the
project owner), with no payments and no accounts.

## Decision

**All user state is stored client-side (localStorage for small flags, IndexedDB via a thin
wrapper for structured data like drill history), with JSON export/import for backup and
device transfer. No backend, no auth, no database.**

A versioned state schema (Zod-validated on load) protects against shape drift; corrupt or
outdated state degrades gracefully to "no progress recorded," never to a broken page.

## Rationale

Apply the platform's own core questions to the proposed backend:

- *What problem does it solve?* Cross-device sync and multi-user accounts. Neither is an
  MVP requirement.
- *What complexity does it introduce?* Hosting, migrations, auth flows, session security,
  secrets management, GDPR posture, cost, and an on-call surface — for a site that otherwise
  has **no server at all**.
- *Could a simpler solution achieve the same outcome?* Yes: browser storage + export file
  covers single-user progress entirely. Even multi-device is tolerable via export/import.
- *Does the improvement justify the complexity?* No — not until a concrete server-side
  requirement exists (see the revisit trigger below).

Deleting the backend also deletes most of the security and operations burden (see plan §15)
and keeps deployment at "static files on a CDN."

## Consequences

- Progress is per-browser. Mitigation: prominent export/import; optionally a "sync via
  Gist/file" convenience later — still no server.
- Spaced-repetition scheduling (SM-2 style) runs entirely client-side; the algorithm is a
  pure TypeScript module, unit-tested independent of storage.
- **Revisit trigger (amended at approval):** a backend is introduced when a **concrete
  server-side requirement** appears — not only when a second user does. Qualifying
  requirements include any of:
  - protected model API calls (server-held keys for live-model features);
  - source ingestion (fetching/scraping external material server-side);
  - transcript processing (e.g., video/audio → text pipelines);
  - regulatory-news ingestion (scheduled monitoring of governance sources);
  - cross-device synchronization of progress state;
  - multi-user functionality of any kind.

  When one of these becomes real, write a new ADR *scoped to that requirement* — the
  smallest server that satisfies it (an Astro adapter endpoint, an edge function, or a
  small separate service), not a general-purpose backend. The upgrade path is clean: the
  versioned state schema already exists, and nothing in the MVP forecloses it.
  Note: the Phase 1 real-model agent experiment deliberately does **not** trigger this —
  it runs as a local Node script with a git-ignored key, outside the deployed site.
- Stripe/Redis/Auth.js are removed from the stack until a decision record justifies them.
