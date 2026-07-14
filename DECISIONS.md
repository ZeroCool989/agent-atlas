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

## 2026-07-14 — EXP (real-model experiment platform): decisions

- **Raw `fetch` adapters, no SDKs** (ADR-0005): the vendor→neutral mapping is the
  lesson and the zero-dependency rule holds. Adapters live in
  `src/lib/model/providers/`, imported ONLY by `experiments/`; nothing in the deployed
  site references them, so no key can reach the browser.
- **Generation settings are provider-instance config, not `ModelRequest` fields.** An
  experiment run = a configured provider; the runtime's request shape stays exactly as
  it was. One backward-compatible addition to the shared types: `ModelResponse.warnings?`
  (and a matching `TraceEvent.warnings?`) for observable anomalies like malformed
  tool-call JSON — measurable behavior, never hidden.
- **OpenAI adapter takes a `baseUrl`** → Qwen/Llama/Mistral/DeepSeek/local are "trivial"
  additions via their OpenAI-compatible endpoints (`openAiCompatible()`), not new
  adapters.
- **Every experiment includes a scripted row** so the whole framework runs and is
  CI-verified with zero keys; missing-key real rows are SKIPPED with a visible reason,
  never an error.
- **Results are checked-in learning artifacts** under `experiments/results/` (not
  gitignored); `generatedAt` is pinned in committed results for reproducibility (the
  CLI stamps real time; determinism is proven in tests with an injected clock). The
  `raw` provider payload is dropped before writing (kept off the RunRecord entirely).
- **Reports never fabricate conclusions:** computed sections are filled from data;
  Lessons Learned / Future Questions are curator prompts seeded with observations.
- **Cost is always `estimated`** and only computed when a definition supplies pricing;
  absent metadata stays absent.

## 2026-07-14 — F1 (Phase 1 flagship slice): agent-runtime decisions

- **Invalid tool requests and tool failures END the run** (`invalid-tool-request` /
  `tool-error`) rather than feeding errors back for model retry. Retry-on-error is a
  real production pattern, but it is a RELIABILITY addition — implementing it in the
  minimum loop would hide how often models get tools wrong and blur the lesson's
  boundary. The runner documents the alternative where the policy lives.
- **`decidedBy` on every trace event** ('developer' | 'model' | 'runtime') — the
  lesson's central comparison encoded in the data model, so the visualization renders
  the teaching dimension instead of decorating it.
- **Comparison traces computed at build time** in an .astro wrapper (`await
  buildComparison()`) and passed to the island as serializable props: the static first
  frame shows real data, and the island ships only the renderer, not the runtime.
- **Calculator is a recursive-descent parser** — the "no arbitrary code through tools"
  rule made concrete and teachable; `eval()` never appears.
- **`escalation-required` documented but not implemented** — reserved in the outcome
  vocabulary for the human-approval lesson; implementing it now would be speculative.
- **e2e note:** Playwright's `reuseExistingServer` will latch onto a leftover
  `astro dev` daemon on 4321 and run e2e against the dev server (breaking zero-JS
  assertions). Stop the daemon (`npx astro dev stop`) before local e2e runs.

## 2026-07-13 — P0.9: Tokens lesson decisions

- **Character-level mini-BPE over a production vocabulary.** The lesson trains the
  real Sennrich-style algorithm on a seven-line checked-in corpus (16 merges, ~36
  vocab entries) instead of shipping GPT-2's ~1 MB byte-level vocabulary. Teaching
  reasons: the learner watches merges being *learned* (the mechanism, not its output),
  merges are predictable by eye, and everything on screen is computed live. The
  honesty table in the lesson states exactly what is simplified (the diet, never the
  algorithm). The corpus is versioned content — editing it changes the learned
  vocabulary and the lesson's claims (guarded by unit tests).
- **Model trained at module load, not checked in.** Training 16 merges on 7 lines is
  microseconds; a checked-in merge table would be a second source of truth that could
  drift from the trainer the lesson tells readers to read.
- **TokenStream `stateText` prop** (neutral defaults): state wording is host semantics
  — the window demo says "entering the context window", the BPE explorer says "learned
  in this merge". Renderer stays generic per the scene/renderer separation.
- **e2e hydration wait pattern:** `client:visible` islands below the fold race
  Playwright clicks; tests scroll the `<astro-island>` into view and wait for its
  `ssr` attribute to drop before interacting. Reusable for all future lesson tests.

## 2026-07-13 — P0.7: CI/CD and security decisions

- **CSP as per-page `<meta>` via Astro's `security.csp`, not host headers.** Astro
  inlines island-loader scripts and small styles, so `script-src 'self'` header CSP
  would break islands; Astro's built-in CSP hashes exactly what it inlines, per page.
  Wins: host-portable (policy travels with the HTML — satisfies the portability
  standing condition), and browser-enforced, so the Playwright suite is a live CSP
  regression test. `public/_headers` carries only meta-ignored directives
  (frame-ancestors/X-Frame-Options, nosniff, referrer/permissions policies).
- **Concepts filter script externalized** to `public/scripts/concept-filters.js` —
  authored inline scripts would need manual hash maintenance; external + `'self'` is
  simpler and equally strict.
- **Deploy gating via repository variable** `CLOUDFLARE_DEPLOY_ENABLED` (job-level
  `if:` cannot read secrets); until the user adds the Cloudflare secrets + variable,
  CI runs fully and deploy is skipped rather than failing.
- **Only the ~10-line deploy job is Cloudflare-coupled**; swap hosts by swapping that
  job (documented per-host header translation in docs/DEPLOYMENT.md).

## 2026-07-13 — P0.6: concept-system decisions

- **Content-model v2** (CONTENT_SCHEMA_VERSION 2): three additive fields closing gaps
  the template lint needed — concept `verdict` (structured essential-vs-optional:
  classification/problem/simplerBaseline/mainCost; the schema previously had no data
  for the plan §19 verdict box), concept `governanceNotApplicable` (explicit justified
  "no hooks" — an empty governance list was ambiguous; mutually exclusive with a
  non-empty list), interview `criticalThinking` (package element 4 was otherwise
  undetectable). All optional/additive; existing content unaffected.
- **Required-section detection = validated MDX headings.** The nine canonical
  questions are EXACT level-2+ headings (normalized for case/whitespace/trailing
  punctuation only), parsed line-anchored with code fences stripped — no false
  positives from prose mentions, no fragile substring checks. Visualization detection
  = an import from `components/viz/` in the body. Trade-off: heading wording is fixed
  vocabulary (documented in AUTHORING.md), which is exactly the consistency the
  platform wants.
- **Interview package enforced collectively** across a concept's linked questions
  (plan §9 "a question set satisfying them"): ≥3 linked questions (covers the 30s/2min
  tiers, which are schema-required per question) + ≥1 with followUps + ≥1
  criticalThinking + ≥1 practicalExample + ≥1 governanceAngle.
- **Lint status policy:** applies to `complete` AND `needs-update` (needs-update marks
  previously-complete content; structure still applies, the status flags freshness).
  Stubs/drafts never template-linted. Sources are NOT required for complete — plan §19
  omits them; revisit only via a plan amendment.
- **Template findings share the graph findings' reporting interface** (same shape,
  separate code domain/type) — one printer, two domains; validate order is schema →
  graph → template → deterministic artifact (template failures also block graph.json).
- **Index filtering = inline vanilla progressive enhancement** (~25 lines, `is:inline`):
  a static host cannot filter server-side; a React island for a form is unjustified
  (~190 KB runtime vs ~1 KB script). Shareable `?layer=&status=` URLs; without JS the
  full list renders and stays useful.
- **Public URL rule:** `/concepts/<filename-id>`; layer subfolders never affect URLs.

## 2026-07-13 — P0.5: visual-system decisions

- **Scene truth vs rendering** is the binding rule (docs/VISUAL_LANGUAGE.md): scene
  data carries semantic state only (no CSS/colors/durations); renderers decide
  presentation. Out-of-range steps CLAMP (never reject) so every scrub position maps to
  a complete scene; NaN → 0.
- **Context-window edge-case policy:** impossible inputs (negative, zero capacity,
  non-integers) → `invalid` + error panel, never a misleading bar; overflow is a
  legitimate teaching state (percent > 100 shown honestly, bar capped); segment/usage
  mismatches render as visible warnings while used/capacity math stands.
- **Hydration:** educational visuals hydrate `client:visible` (in-prose islands need
  interactivity only when seen). Content pages stay zero-JS — e2e-enforced.
- **Reduced motion:** transitions are removed, not slowed (`.viz-transition` +
  media query); no information lives in animation by construction. Stepper exposes
  `data-reduced-motion` for styling hooks.
- **No animation/graphics dependencies:** HTML/CSS + small React state only. D3,
  canvas, Motion, React Flow, Three.js all rejected for these primitives; `motion`
  only if CSS proves insufficient for a concrete future need (per plan §12 it remains
  an option, not a default).
- **New dev-only test dependencies:** `jsdom` + `@testing-library/react` (component
  tests per the P0.5 acceptance criteria). Not shipped to the site.
- **Demo tokenization is illustrative** (hand-chosen subword splits, visible notice on
  the page); real BPE arrives with the Tokens lesson (P0.9/L0 build project).

## 2026-07-13 — P0.4: model-layer decisions

- **Scenario format: JSON + Zod validation** (`*.scenario.json`, `parseScenario`).
  Chosen over YAML (one less parser in lib/) and TS fixtures (no runtime validation, not
  loadable as data by future playground islands for visual playback). Teaching
  annotations live in the scenario file but outside the runtime response types.
- **System instructions are a request field, not a message role.** Providers disagree
  about where system text goes; `ModelRequest.system` keeps the shared type neutral and
  adapters map it. Message roles are `user`/`assistant`/`tool` only.
- **Session state = provider instance.** One `ScriptedProvider` = one replay; fresh
  replay = new instance; over-consumption throws `scenario-exhausted`. No module-level
  mutable state; no `reset()` (a new instance is cheaper and more obvious).
- **Intentional interface omissions** (await evidence from the P1 real-model
  experiment): generation settings, streaming, multimodal, parallel-tool-call semantics,
  prompt caching, reasoning tokens, capability negotiation. Additions must be
  evidence-driven, backward-compatible where reasonable, and recorded here (standing
  condition from the Phase 0 approval).
- **`zod` added as a direct dependency.** lib/ purity forbids `astro/zod` inside
  `src/lib/`; plain `zod` is the same library (4.4.3, deduped with Astro's copy).
  Content schemas keep using `astro/zod` (they live outside lib/ in Astro's instance);
  lib schemas use `zod` directly.

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
