# Next tasks

_The active queue. Full task definitions and acceptance criteria live in the approved
Phase 0 breakdown (see `docs/IMPLEMENTATION_PLAN.md` §18 and the approval conversation);
statuses live in `CURRENT_STATE.md`._

## Up next

1. **P0.2 — Content schemas.** `src/content.config.ts` with all five collections
   (`concepts`, `interview`, `governance`, `sources`, `glossary`) per plan §6, including
   the layer enum, `status`/`needsUpdateReason`, and the six-element interview fields.
   _Accepted when:_ one valid fixture per collection builds; each schema-violation class
   (missing layer, bad enum, malformed date) fails the build with a readable error.
2. **P0.3 — Graph builder + integrity CI** (fail/warn scope per plan §7).
3. **P0.4 — ModelProvider + ScriptedProvider** (see standing condition in DECISIONS.md).
4. **P0.5 — Viz foundation** (Stepper + Tokens primitives).
5. **P0.6 — Layouts + routes + template lint.**
6. **P0.7 — CI/CD** (GitHub Actions → Cloudflare Pages; keep portable per DECISIONS.md).
7. **P0.8 — Docs** (INTAKE.md, AUTHORING.md).
8. **P0.9 — "Tokens" exemplar end-to-end.**

## Rules of engagement (Phase 0)

Complete and verify one task before the next · no backend/auth/DB/agent-framework/live
production model API · plain TypeScript for model & agent mechanics · tests alongside
implementation · update CURRENT_STATE.md + NEXT_TASKS.md per task · record deviations in
DECISIONS.md · never silently weaken acceptance criteria.
