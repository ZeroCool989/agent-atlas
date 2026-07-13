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

## 2026-07-13 — P0.3: graph and validation decisions

- **One narrow disk adapter, documented trade-off.** Astro's content layer can't be
  cleanly invoked from a standalone script (loaders run inside the build's virtual-module
  context), so `scripts/validate-content.ts` reads files itself — but it reuses
  `src/content.schemas.ts` and `flatEntryId` verbatim, so validation rules and identifier
  derivation each have exactly one definition. Only frontmatter/YAML *parsing* is
  adapter-local. If Astro ever exposes a supported programmatic content API, replace the
  adapter (nothing else changes — the graph core is filesystem-free).
- **`graph.json` is generated, gitignored, never committed** (`src/generated/`). It
  derives entirely from content; committing it would create a second source of truth.
  CI order (P0.7) guarantees freshness: validate runs before build.
- **Severity choices within the approved scope:** self-references and wrong-collection
  targets are failures (they are referential-integrity errors, the plan's "dangling
  slugs" class); duplicate references within one field are warnings (harmless sloppiness,
  not approved as a CI-blocking rule). "Complete requires prerequisites ≥ draft" (plan
  §19): only `stub` prerequisites fail; `draft`/`complete`/`needs-update` are acceptable.
- **Orphan definition:** a concept touched by no edge of any type in either direction
  (concept/interview/governance/source linkage all absent). Having no prerequisites is
  explicitly NOT orphanhood — foundational concepts legitimately have none. No exemption
  field was added (none justified yet). Warnings only; CI passes with a visible report.
- **New dev-only dependencies:** `tsx` (run TS scripts with extension-less imports —
  Node's native type-stripping can't resolve them) and `yaml` (parse entries outside
  Astro). Neither ships to the site bundle.

## 2026-07-13 — P0.1: minor scaffold notes

- Tailwind 4 is wired via `@tailwindcss/vite` plugin + `@import "tailwindcss"` in
  `src/styles/global.css` (what `astro add tailwind` now produces — no tailwind.config).
- The build emits `dist/_astro/client.*.js` (the @astrojs/react hydration helper) as an
  asset even with no islands on any page. It is **unreferenced**: `dist/index.html` has
  zero `<script>` tags and the e2e test asserts the page performs no script requests.
  Not a violation of the zero-JS acceptance criterion.
- `typecheck` required `@types/node` (Playwright config uses `process.env`) and a
  `/// <reference types="vitest/config" />` in `vitest.config.ts`.
