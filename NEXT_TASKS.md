# Next tasks

_The active queue. Full task definitions and acceptance criteria live in the approved
Phase 0 breakdown (see `docs/IMPLEMENTATION_PLAN.md` §18 and the approval conversation);
statuses live in `CURRENT_STATE.md`._

## Up next

1. **P0.7 — CI/CD.** GitHub Actions pipeline: typecheck → `npm run validate` → unit
   tests → build → Playwright smoke; deploy static output to Cloudflare Pages with
   branch preview deployments and CSP headers. Keep the app portable (standing
   condition in DECISIONS.md): no Cloudflare-specific application logic or data
   dependencies. _Accepted when:_ a push runs the full pipeline; a red validate blocks
   deploy; the site is live at a public URL with per-branch previews; CSP verified in
   response headers.
2. **P0.8 — Docs** (INTAKE.md; AUTHORING.md exists since P0.6 — extend only if gaps).
3. **P0.9 — "Tokens" exemplar end-to-end** (real BPE, Tier-2 visual, full DoD).

## Rules of engagement (Phase 0)

Complete and verify one task before the next · no backend/auth/DB/agent-framework/live
production model API · plain TypeScript for model & agent mechanics · tests alongside
implementation · update CURRENT_STATE.md + NEXT_TASKS.md per task · record deviations in
DECISIONS.md · never silently weaken acceptance criteria.
