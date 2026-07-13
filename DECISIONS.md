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

## 2026-07-13 — P0.1: minor scaffold notes

- Tailwind 4 is wired via `@tailwindcss/vite` plugin + `@import "tailwindcss"` in
  `src/styles/global.css` (what `astro add tailwind` now produces — no tailwind.config).
- The build emits `dist/_astro/client.*.js` (the @astrojs/react hydration helper) as an
  asset even with no islands on any page. It is **unreferenced**: `dist/index.html` has
  zero `<script>` tags and the e2e test asserts the page performs no script requests.
  Not a violation of the zero-JS acceptance criterion.
- `typecheck` required `@types/node` (Playwright config uses `process.env`) and a
  `/// <reference types="vitest/config" />` in `vitest.config.ts`.
