# Next tasks

_The active queue. Full task definitions and acceptance criteria live in the approved
Phase 0 breakdown (see `docs/IMPLEMENTATION_PLAN.md` §18 and the approval conversation);
statuses live in `CURRENT_STATE.md`._

## Up next

1. **P0.4 — ModelProvider + ScriptedProvider** in `src/lib/model/`: minimal
   `complete(request) => response` interface with typed tool-call support and per-call
   metadata (latency, tokens, cost estimate); `ScriptedProvider` replaying deterministic
   scenario files. Standing condition in DECISIONS.md: sufficient for scripted scenarios,
   the hand-built agent loop, and the first real-model experiment — evolvable with
   evidence, no artificial permanence. No React/Astro/SDK imports. _Accepted when:_ unit
   tests replay a multi-step tool-use scenario deterministically; interface reviewed
   against ADR-0005's shape; nothing in `lib/model/` imports a framework.
2. **P0.5 — Viz foundation** (Stepper + Tokens primitives).
3. **P0.6 — Layouts + routes + template lint.** Tracked deferral: the six-element
   interview-package lint for `complete` concepts lands here.
4. **P0.7 — CI/CD** (GitHub Actions → Cloudflare Pages; keep portable per DECISIONS.md;
   `npm run validate` is ready to be called as a pipeline step).
5. **P0.8 — Docs** (INTAKE.md, AUTHORING.md).
6. **P0.9 — "Tokens" exemplar end-to-end.**

## Rules of engagement (Phase 0)

Complete and verify one task before the next · no backend/auth/DB/agent-framework/live
production model API · plain TypeScript for model & agent mechanics · tests alongside
implementation · update CURRENT_STATE.md + NEXT_TASKS.md per task · record deviations in
DECISIONS.md · never silently weaken acceptance criteria.
