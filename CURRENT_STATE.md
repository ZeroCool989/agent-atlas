# Current state

_Updated after each completed task. Roadmap: `docs/IMPLEMENTATION_PLAN.md` §18;
task list: `NEXT_TASKS.md`; deviations: `DECISIONS.md`._

## Phase 1 progress

| Task | Status |
|---|---|
| F1 Flagship slice: workflows vs agents + minimal agent runtime | ✅ complete (2026-07-14) |
| EXP Real-model experiment platform (AI Engineering Laboratory) | ✅ complete (2026-07-14) |
| EXP-LIVE Live validation (Claude): 005/006/007 + flagship lesson evidence update | ✅ complete (2026-07-15) |
| TC Tool Calling concept (evidence-backed) | ✅ complete (2026-07-15) |

- **Tool Calling lesson (TC):** `/concepts/tool-calling` (complete, full DoD) built on
  tokens + workflows-vs-agents. Signature **static** three-gate validation viz
  (`ValidationLayers.astro`, zero JS) computing message → schema → semantic layers with
  the real calculator; the `2 ** 0.5` row is the measured Experiment 006 case. Tool
  Calling **Playground** (`ToolCallingPlayground` island) replaying five outcome classes
  (success, schema-failure, semantic-failure, unknown-tool, tool-error) — success and
  semantic-failure are the MEASURED Claude traces from Experiments 005/006 (loaded from
  checked-in results, scripted fallback), the rest scripted runtime behaviors, all
  provenance-labelled. Dedicated Evidence section (005/006/007, each with limitations),
  security + production + governance sections. `unreliable-lookup` moved into
  `src/lib/agent/`. 4 interview questions. 20 new tests (233 total), 21 e2e.

- **Experiment platform (EXP):** provider adapters in `src/lib/model/providers/`
  (Claude, OpenAI, Gemini via raw fetch, no SDKs; `openAiCompatible()` covers
  Qwen/Llama/Mistral/DeepSeek/local by base URL) mapping vendor shapes into the neutral
  `ModelProvider` — the runtime never sees a vendor API. `experiments/` framework:
  schema-validated versioned definitions, a matrix runner (scripted + real rows ×
  prompt variants × repeats) over the *same* `src/lib/agent` runtime, a measurement
  record (outcome, tokens, latency, cost estimate, tool order, validation failures,
  malformed calls, warnings, full trace), auto-generated markdown reports, and a CLI
  (`npm run experiment`). Four definitions (baseline, prompting styles, temperature
  sweep, failure modes) + four failure scenarios. Two checked-in results (001 baseline,
  004 failures) run with zero keys. `/experiments` viewer (build-time from result.json,
  reuses `TraceStepList`/`createTraceScene`). Missing keys skip visibly; no key ever in
  the deployed build. Docs: `experiments/README.md`, `.env.example`. 23 new tests
  (217 total), 21 e2e.

- **Flagship slice (F1):** `src/lib/agent/` — the minimal tool-using agent runtime
  (ADR-0005: plain TS on the ModelProvider interface): `runner.ts` (the loop: validate
  → execute → observe → repeat, step-limited, typed outcomes separate from stop
  reasons, full trace events with `decidedBy`), `tools.ts` (allowlist registry),
  `calculator.ts` (recursive-descent parser, never eval), `workflows.ts` (direct call /
  deterministic / model-assisted implemented for real), `comparison.ts` (runs all four
  at build time). Lesson `/concepts/workflows-vs-agents` (complete, full DoD):
  four-architecture comparison island driven by real traces, mental model
  (recipe→taste-tester→contractor + breaking point), trade-off table, three
  problem-first transitions, minimum-loop-vs-optional-additions, security/governance
  section with careful applicability wording, 3-question interview package incl.
  whiteboard + critical-thinking. New `createTraceScene`; 2 new scenarios; Anthropic
  "Building effective agents" ingested. 32 new tests (194 total), 17 e2e.

## Phase 0 progress

| Task | Status |
|---|---|
| P0.1 Scaffold | ✅ complete (2026-07-13) |
| P0.2 Content schemas | ✅ complete (2026-07-13) |
| P0.3 Graph builder + integrity CI | ✅ complete (2026-07-13) |
| P0.4 ModelProvider + ScriptedProvider | ✅ complete (2026-07-13) |
| P0.5 Viz foundation | ✅ complete (2026-07-13) |
| P0.6 Layouts + routes + template lint | ✅ complete (2026-07-13) |
| P0.7 CI/CD | ✅ repo-side complete (2026-07-13) — deploy awaits Cloudflare secrets (see NEXT_TASKS) |
| P0.8 Docs (INTAKE.md, AUTHORING.md, README) | ✅ complete (2026-07-13) |
| P0.9 "Tokens" exemplar | ✅ complete (2026-07-13) — **Phase 0 done** |

## What exists right now

- **The Tokens lesson (P0.9) — the gold-standard exemplar:** `status: complete`,
  passing the full DoD lint. Real BPE trainer/encoder in `src/lib/sim/tokenizer/`
  (the L0 build project, ~150 readable lines + 14 tests) trained live on a checked-in
  seven-line corpus; `BpeTrainingExplorer` (watch 16 merges being discovered, real
  frequencies, merge table, corpus inspection) and `TokenizerPlayground` (type
  anything; ids, counts, honest unknown-character handling) as `client:visible`
  islands; mental model with its breaking point; misconceptions section; teaching-vs-
  production-vs-research honesty table; 3-question interview package (incl.
  critical-thinking and cost/limits); Sennrich BPE paper ingested via the intake
  pipeline. New scene type `createBpeScene`; TokenStream gained a `stateText` prop.

- **CI/CD + security posture (P0.7):** `.github/workflows/ci.yml` runs typecheck →
  validate → unit tests → build → Playwright e2e on every push/PR, then a gated deploy
  job (Cloudflare Pages, previews per branch) that activates only when
  `CLOUDFLARE_DEPLOY_ENABLED=true` + secrets exist. Strict CSP via Astro's
  `security.csp` (per-page meta with hashes — host-portable, browser-enforced, so e2e
  doubles as CSP regression); header-only directives in `public/_headers`; the concepts
  filter script externalized to `public/scripts/`. Docs: `docs/DEPLOYMENT.md`,
  `docs/EXECUTION_PROTOCOL.md` (standing working constitution, linked from CLAUDE.md).
- **Concept system (P0.6):** `/concepts` index (layer-grouped, layer/status filters via
  shareable URL params + inline progressive enhancement) and `/concepts/[slug]` pages
  (verdict box, needs-update banner, separated prerequisite/related lists with target
  status, governance section with careful wording + explicit not-applicable path,
  `<details>` interview disclosure, source links, skip link). Template lint in
  `src/lib/content/template.ts` wired into `npm run validate` (schema → graph →
  template → artifact): nine canonical headings, verdict, ≥1 viz import, governance
  hooks-or-justification, and the **six-element interview package enforced
  collectively** (deferred item CLOSED). Content-model v2 (verdict,
  governanceNotApplicable, criticalThinking). Fixture corpus: tokens (draft+island),
  context-windows (complete, zero-JS page), few-shot-prompting (needs-update),
  embeddings (stub), gdpr stub, 6 new interview questions. Docs: `docs/AUTHORING.md`.
  31 new unit tests (135 total), 11 new e2e (16 total).
- **Viz foundation (P0.5):** pure scene layer in `src/lib/viz/` (`(input, step) =>
  Scene` with clamping, `computeContextWindow` with documented edge-case policy,
  timeline types); renderers in `src/components/viz/` (`Stepper` — keyboard-operable,
  timer-safe, instance-independent; `TokenStream`; `ContextWindowBar`;
  `TokenizationDemo` composition) wired on `/viz-demo` via `client:visible` with a
  server-rendered step-0 first frame. Semantic `--viz-*` CSS variables + reduced-motion
  removal in `global.css`; vocabulary and rules in `docs/VISUAL_LANGUAGE.md`. Home page
  still ships zero JS (e2e-enforced). 30 new tests (104 total), 5 e2e.
- **Model layer (P0.4):** `src/lib/model/` — provider-neutral `ModelProvider` contract
  (`complete(request) => response` with typed messages, tool definitions/calls, six-value
  stop-reason vocabulary, all-optional usage metadata, typed errors) and
  `ScriptedProvider` (instance-owned session state, four-matcher divergence detection,
  deterministic replay, deep-cloned responses). Scenario format: JSON validated by Zod
  (`parseScenario`); acceptance scenario `calculator-tool-use` covers the two-call tool
  round-trip. Boundary rule: *the model selects a tool; the agent runtime validates and
  executes it.* Docs: `docs/MODEL_PROVIDER.md` (incl. three-consumer interface review).
  19 new tests, 74 total. No real provider, no SDKs, no keys (P1 experiment).
- **Knowledge graph + validation (P0.3):** pure graph core in `src/lib/graph/`
  (build → integrity → deterministic serialize; findings as data with stable diagnostic
  codes) and the `npm run validate` CLI (`scripts/validate-content.ts`) — the one narrow
  disk adapter, reusing the P0.2 Zod schemas and `flatEntryId`. Fail/warn scope per plan
  §7; cycle findings include the actual path; orphans warn without failing. Deterministic
  `graph.json` → `src/generated/` (gitignored, generated-only). Docs: `docs/GRAPH.md`.
  36 new tests (graph core + CLI boundary), 55 total.
- **Content model (P0.2):** all five collections (`concepts`, `interview`, `governance`,
  `sources`, `glossary`) defined in `src/content.config.ts` with strict Zod schemas in
  `src/content.schemas.ts`; shared vocabulary (layers, statuses, roles, slug rules,
  `CONTENT_SCHEMA_VERSION`) in `src/lib/content/model.ts` (pure TS, reusable by P0.3).
  One valid fixture per collection under `src/content/`, all anchored on the tokens
  draft. Entry-local rules enforced at build: identifier format, enums, dates,
  undispositioned-intake, needs-update-requires-reason, unknown-key rejection.
  Cross-entry rules (dangling refs, cycles, six-element package) deliberately deferred
  to P0.3/P0.6. 19 unit tests cover valid + invalid cases; real-build failures verified
  readable (file + field + message).

- Astro 7 + TypeScript strict + Tailwind 4 + MDX + React 19 islands, scaffolded and
  building. Placeholder home page (`src/pages/index.astro`) via `src/layouts/Base.astro`,
  shipping zero client JS.
- Test harnesses wired: Vitest (`npm test`, `tests/unit/`), Playwright
  (`npm run test:e2e`, `tests/e2e/` — home renders + zero-JS assertions),
  `npm run typecheck` (astro check) clean.
- `.gitignore` covers `.env*` and `experiments/` outputs.
- Planning approved with amendments: plan + ADRs 0001–0005 in `docs/`, CLAUDE.md rewritten.

## Verification evidence (P0.1)

`npm run typecheck` → 0 errors · `npm test` → 1 passed · `npm run build` → 1 page,
0 `<script>` in `dist/index.html` · `npm run test:e2e` → 2 passed · `npm run dev` serves
the page · clean-clone check: see P0.1 report.
