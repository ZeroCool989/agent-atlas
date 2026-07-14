# Next tasks

_The active queue. Full task definitions and acceptance criteria live in the approved
Phase 0 breakdown (see `docs/IMPLEMENTATION_PLAN.md` §18 and the approval conversation);
statuses live in `CURRENT_STATE.md`._

## Up next

1. **USER ACTION — enable deployment** (closes P0.7's live-URL criterion): create the
   Cloudflare Pages project `agent-atlas`, add repo secrets `CLOUDFLARE_API_TOKEN` +
   `CLOUDFLARE_ACCOUNT_ID`, set repo variable `CLOUDFLARE_DEPLOY_ENABLED=true`
   (steps in docs/DEPLOYMENT.md). CI itself already runs on every push.
2. **Flagship slice delivered — awaiting approval for the next Phase 1 task.**
   Recommended next: the **real-model agent experiment** (plan §18: same runner, thin
   real-provider adapter, local `experiments/` script, transcripts → sources) — the
   runtime and scenarios are now exactly the shape it needs. Alternative: the
   tool-calling or agent-loop concept pages (both are natural decompositions the
   flagship lesson already links toward), or the Atlas graph home.

## Rules of engagement (Phase 0)

Complete and verify one task before the next · no backend/auth/DB/agent-framework/live
production model API · plain TypeScript for model & agent mechanics · tests alongside
implementation · update CURRENT_STATE.md + NEXT_TASKS.md per task · record deviations in
DECISIONS.md · never silently weaken acceptance criteria.
