# Next tasks

_The active queue. Full task definitions and acceptance criteria live in the approved
Phase 0 breakdown (see `docs/IMPLEMENTATION_PLAN.md` §18 and the approval conversation);
statuses live in `CURRENT_STATE.md`._

## Up next

1. **P0.5 — Viz foundation.** `<Stepper>` (play/pause/scrub, keyboard-accessible) +
   the `(step) => Scene` pure-function model + the primitives Tokens needs
   (`TokenStream`, `ContextWindowBar`); static non-hydrated first frame; start
   `docs/VISUAL_LANGUAGE.md`. Visuals accessible and educational, not decorative.
   _Accepted when:_ scene functions unit-tested; Stepper keyboard-operable; JS-disabled
   render shows a meaningful first frame.
2. **P0.6 — Layouts + routes + template lint.** Tracked deferral: the six-element
   interview-package lint for `complete` concepts lands here.
3. **P0.7 — CI/CD** (GitHub Actions → Cloudflare Pages; keep portable per DECISIONS.md;
   `npm run validate` is ready to be called as a pipeline step).
4. **P0.8 — Docs** (INTAKE.md, AUTHORING.md).
5. **P0.9 — "Tokens" exemplar end-to-end.**

## Rules of engagement (Phase 0)

Complete and verify one task before the next · no backend/auth/DB/agent-framework/live
production model API · plain TypeScript for model & agent mechanics · tests alongside
implementation · update CURRENT_STATE.md + NEXT_TASKS.md per task · record deviations in
DECISIONS.md · never silently weaken acceptance criteria.
