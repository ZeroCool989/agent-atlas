# Next tasks

_The active queue. Full task definitions and acceptance criteria live in the approved
Phase 0 breakdown (see `docs/IMPLEMENTATION_PLAN.md` §18 and the approval conversation);
statuses live in `CURRENT_STATE.md`._

## Up next

1. **P0.6 — Layouts + routes + template lint.** Concept template with the nine
   canonical sections, verdict box, governance hooks, interview links; `/concepts`
   index + `/concepts/[slug]`; lint that `complete` concepts satisfy the template.
   **Tracked deferral lands here:** the six-element interview-package lint for
   `complete` concepts (30s answer, 2-min answer, follow-ups, critical-thinking
   question, practical example, governance perspective). _Accepted when:_ stub and
   complete fixtures render; removing a required section from a complete fixture
   fails CI.
2. **P0.7 — CI/CD** (GitHub Actions → Cloudflare Pages; keep portable per DECISIONS.md;
   `npm run validate` is ready to be called as a pipeline step).
3. **P0.8 — Docs** (INTAKE.md, AUTHORING.md).
4. **P0.9 — "Tokens" exemplar end-to-end.**

## Rules of engagement (Phase 0)

Complete and verify one task before the next · no backend/auth/DB/agent-framework/live
production model API · plain TypeScript for model & agent mechanics · tests alongside
implementation · update CURRENT_STATE.md + NEXT_TASKS.md per task · record deviations in
DECISIONS.md · never silently weaken acceptance criteria.
