# Next tasks

_The active queue. Full task definitions and acceptance criteria live in the approved
Phase 0 breakdown (see `docs/IMPLEMENTATION_PLAN.md` §18 and the approval conversation);
statuses live in `CURRENT_STATE.md`._

## Up next

1. **USER ACTION — enable deployment** (closes P0.7's live-URL criterion): create the
   Cloudflare Pages project `agent-atlas`, add repo secrets `CLOUDFLARE_API_TOKEN` +
   `CLOUDFLARE_ACCOUNT_ID`, set repo variable `CLOUDFLARE_DEPLOY_ENABLED=true`
   (steps in docs/DEPLOYMENT.md). CI itself already runs on every push.
2. **Tool Calling delivered — awaiting review before the next concept.** Per the
   standing hold, do NOT start Memory, RAG, MCP, Planning, Reflection, or Multi-Agent
   until reviewed. Candidate next steps once approved (user's priority #3):
   an **experiment dashboard** (browse evidence across experiments/models); or the
   next core-mechanism concept. USER ACTIONS still open: Cloudflare deploy enablement
   (docs/DEPLOYMENT.md); optionally run 002/003 live to compare prompting styles and
   temperature.

## Rules of engagement (Phase 0)

Complete and verify one task before the next · no backend/auth/DB/agent-framework/live
production model API · plain TypeScript for model & agent mechanics · tests alongside
implementation · update CURRENT_STATE.md + NEXT_TASKS.md per task · record deviations in
DECISIONS.md · never silently weaken acceptance criteria.
