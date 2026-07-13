# Next tasks

_The active queue. Full task definitions and acceptance criteria live in the approved
Phase 0 breakdown (see `docs/IMPLEMENTATION_PLAN.md` §18 and the approval conversation);
statuses live in `CURRENT_STATE.md`._

## Up next

1. **USER ACTION — enable deployment** (closes P0.7's live-URL criterion): create the
   Cloudflare Pages project `agent-atlas`, add repo secrets `CLOUDFLARE_API_TOKEN` +
   `CLOUDFLARE_ACCOUNT_ID`, set repo variable `CLOUDFLARE_DEPLOY_ENABLED=true`
   (steps in docs/DEPLOYMENT.md). CI itself already runs on every push.
2. **P0.9 — "Tokens" exemplar end-to-end** (awaiting approval + readiness-review
   sign-off): real BPE in `src/lib/sim/`, Tier-2 steppable visual, mental-model
   convention, full DoD incl. six-element interview package.

## Rules of engagement (Phase 0)

Complete and verify one task before the next · no backend/auth/DB/agent-framework/live
production model API · plain TypeScript for model & agent mechanics · tests alongside
implementation · update CURRENT_STATE.md + NEXT_TASKS.md per task · record deviations in
DECISIONS.md · never silently weaken acceptance criteria.
