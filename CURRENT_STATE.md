# Current state

_Updated after each completed Phase 0 task. Roadmap: `docs/IMPLEMENTATION_PLAN.md` §18;
task list: `NEXT_TASKS.md`; deviations: `DECISIONS.md`._

## Phase 0 progress

| Task | Status |
|---|---|
| P0.1 Scaffold | ✅ complete (2026-07-13) |
| P0.2 Content schemas | ✅ complete (2026-07-13) |
| P0.3 Graph builder + integrity CI | ✅ complete (2026-07-13) |
| P0.4 ModelProvider + ScriptedProvider | not started |
| P0.5 Viz foundation | not started |
| P0.6 Layouts + routes + template lint | not started |
| P0.7 CI/CD | not started |
| P0.8 Docs (INTAKE.md, AUTHORING.md) | not started |
| P0.9 "Tokens" exemplar | not started |

## What exists right now

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
