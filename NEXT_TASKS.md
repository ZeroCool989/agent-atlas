# Next tasks

_The active queue. Full task definitions and acceptance criteria live in the approved
Phase 0 breakdown (see `docs/IMPLEMENTATION_PLAN.md` §18 and the approval conversation);
statuses live in `CURRENT_STATE.md`._

## Up next

1. **P0.3 — Graph builder + integrity CI.** Pure functions in `src/lib/graph/` emitting
   `graph.json`; `scripts/validate-content` implementing the plan §7 fail/warn split.
   Cross-entry rules deferred from P0.2: dangling references (prerequisites, related,
   governance, sources, appliesTo, interview→concepts, source routedTo), prerequisite
   cycles, `complete`-with-`stub`-prereqs, orphan *warning* report. Note: duplicate flat
   ids are caught by Astro's loader; undispositioned sources are already schema-level —
   don't re-implement. _Accepted when:_ unit tests cover every fail rule + the warn
   rule; a broken fixture fails `npm run validate`; an orphan passes with a warning.
2. **P0.4 — ModelProvider + ScriptedProvider** (see standing condition in DECISIONS.md).
3. **P0.5 — Viz foundation** (Stepper + Tokens primitives).
4. **P0.6 — Layouts + routes + template lint.**
5. **P0.7 — CI/CD** (GitHub Actions → Cloudflare Pages; keep portable per DECISIONS.md).
6. **P0.8 — Docs** (INTAKE.md, AUTHORING.md).
7. **P0.9 — "Tokens" exemplar end-to-end.**

## Rules of engagement (Phase 0)

Complete and verify one task before the next · no backend/auth/DB/agent-framework/live
production model API · plain TypeScript for model & agent mechanics · tests alongside
implementation · update CURRENT_STATE.md + NEXT_TASKS.md per task · record deviations in
DECISIONS.md · never silently weaken acceptance criteria.
