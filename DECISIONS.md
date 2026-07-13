# Decision log

Material deviations, discoveries, and standing conditions recorded during
implementation. ADRs in `docs/adr/` hold the big irreversible decisions; this file holds
everything smaller that a future session must not silently contradict.

## 2026-07-13 — Standing conditions attached to the Phase 0 approval

- **ModelProvider evolvability (P0.4):** the interface must be sufficient for the
  scripted scenarios, the hand-built agent loop, and the first real-model experiment.
  No artificial promise that it can never change: later changes must be evidence-driven,
  backward-compatible where reasonable, and recorded here or in an ADR.
- **Hosting portability (P0.7):** Cloudflare Pages is approved for initial deployment,
  but no Cloudflare-specific application logic, proprietary data dependencies, or
  deployment coupling may be introduced in Phase 0 unless separately justified.

## 2026-07-13 — P0.1: Astro 7, not Astro 5

The plan and ADR-0001 name "Astro 5"; `create-astro`'s current stable is **Astro 7.0**
(with @astrojs/mdx 7, @astrojs/react 6, Tailwind 4.3). Proceeded with Astro 7: ADR-0001's
rationale (typed content collections, zero-JS defaults, island hydration, adapter escape
hatch) is architecture, not version-specific, and pinning a two-major-old release at
project start would be pure debt. Plan references to "Astro 5" should be read as
"current stable Astro".

## 2026-07-13 — P0.2: content-model decisions

- **Entry ids come from filenames, not frontmatter.** Plan §6 lists `slug`/`id` fields;
  duplicating the filename in frontmatter invites drift, so the filename IS the
  identifier (Astro content-layer convention). Concepts live in layer subfolders but get
  *flat* ids via `generateId` (`foundation/tokens.mdx` → `tokens`), so references stay
  short; duplicate basenames across folders collide and Astro reports a duplicate-id
  error — which is the desired behavior.
- **Entry-local vs cross-entry validation split.** Zod schemas enforce everything
  provable from one file: identifier *format* (kebab-case), enums, dates, URL shape,
  `needs-update` ⇒ `needsUpdateReason`, undispositioned-intake (empty `routedTo` AND
  empty `decisions` fails — the plan §7 rule, promoted from the P0.3 validator to the
  schema since it's entry-local), and unknown-key rejection (`.strict()`, typo
  protection). Cross-entry rules (dangling refs, cycles, complete-with-stub-prereqs,
  six-element interview package, orphan warnings) are P0.3/P0.6 — Astro's per-entry
  validation cannot express them, and Astro's `reference()` helper was deliberately not
  used so the P0.3 validator stays the single source of truth for referential integrity
  (it needs warn-only semantics Astro can't do).
- **Schema evolution convention:** `CONTENT_SCHEMA_VERSION` in `src/lib/content/model.ts`
  is bumped on any schema change, with an entry here (or an ADR if the approved §6 model
  itself changes). Version 1 = the approved plan §6 model.
- **`astro/zod` is Zod 4** (4.4.3), not Zod 3: custom messages use `{ error }` not
  `{ errorMap }`, unrecognized-key issues carry the key in the message rather than the
  path, and `z.string().url()` is deprecated in favor of `z.url()`. Schemas and tests
  are written Zod-4-native.

## 2026-07-13 — P0.1: minor scaffold notes

- Tailwind 4 is wired via `@tailwindcss/vite` plugin + `@import "tailwindcss"` in
  `src/styles/global.css` (what `astro add tailwind` now produces — no tailwind.config).
- The build emits `dist/_astro/client.*.js` (the @astrojs/react hydration helper) as an
  asset even with no islands on any page. It is **unreferenced**: `dist/index.html` has
  zero `<script>` tags and the e2e test asserts the page performs no script requests.
  Not a violation of the zero-JS acceptance criterion.
- `typecheck` required `@types/node` (Playwright config uses `process.env`) and a
  `/// <reference types="vitest/config" />` in `vitest.config.ts`.
