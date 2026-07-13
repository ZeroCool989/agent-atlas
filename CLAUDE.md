# Agent Atlas — Project guide for Claude

Agent Atlas is an interactive learning platform that teaches how AI systems work from
first principles — tokens to multi-agent systems to governance. The full architecture is
in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) and ADRs 0001–0005 in
[docs/adr/](docs/adr/). This file is the short version; when it conflicts with the plan
or an ADR, the ADR wins and this file must be fixed.

**Read [docs/EXECUTION_PROTOCOL.md](docs/EXECUTION_PROTOCOL.md) before implementing
anything** — the standing working constitution: optimize for teaching over software
elegance; work every task from four perspectives (engineer, teacher, interviewer,
governance expert); one approved task at a time with the nine-point completion report;
never silently diverge from approved architecture.

## Stack (ADR-0001, ADR-0003, ADR-0004)

- **Astro 5** + TypeScript (strict) + MDX + Tailwind CSS 4. Static output.
- **React 19 islands** for all interactivity; nano-stores or URL state across islands.
- D3 as a math library only (layout, scales) — React owns the DOM. `motion` for
  animation where CSS is not enough.
- Zod everywhere: content schemas, local-state schemas, structured-output validation.
- Pagefind for search. Vitest for unit tests, Playwright for e2e smoke, axe for a11y.
- **No backend, no database, no auth, no Stripe, no Redis, no 3D in MVP.** A backend
  requires a new ADR, triggered by a concrete server-side requirement (protected model
  API calls, source/transcript/regulatory ingestion, cross-device sync, multi-user) —
  see ADR-0003.
- User state is client-side only: localStorage/IndexedDB, versioned Zod-validated
  schemas, JSON export/import.

## Role boundary (ADR-0005 — the most important rule)

- **Astro is the application shell and content platform.** Routing, rendering, content
  collections, islands. Nothing else.
- **All agent mechanics are plain TypeScript in `src/lib/`** — agent loop, tool
  registry, workflow engines (`lib/agent/`), model providers (`lib/model/`), simulation
  engines (`lib/sim/`), graph logic (`lib/graph/`). No React, no Astro imports in
  `lib/`. This code is course material: write it to be read, keep it dependency-free,
  unit-test all of it.
- **Never add LangGraph, CrewAI, an Agents SDK, or similar as a dependency.** They
  appear only as Phase 3 comparison subjects, after the manual loop exists.
- Model calls go through the `ModelProvider` interface (`lib/model/`). The deployed
  site uses only the deterministic `ScriptedProvider` — no API keys in the site, ever.
  Real-model runs live in `experiments/` (local Node scripts, git-ignored `.env`,
  never bundled, never required by CI).

## Content is the product (ADR-0002)

- All content = MDX/YAML in Astro Content Collections under `src/content/`, with
  Zod-validated frontmatter. No CMS, no notes directory. The knowledge graph is derived
  from frontmatter at build time — never hand-maintained.
- Every concept carries an **essentiality layer** (`foundation` → `core-mechanism` →
  `useful-addition` → `advanced-system` → `framework-abstraction` → `vendor-specific`)
  and must answer the **nine canonical questions** (problem before → why invented → how
  it works (with a visual) → necessary? → trade-offs → complexity → simpler alternative
  → when to use → when to avoid).
- **The autonomy spectrum is canonical vocabulary** — never blur these six:
  deterministic workflow · model-assisted workflow · tool-using agent · stateful agent ·
  reliable agent · multi-agent system.
- **Definition of Done for major concepts** includes the six-element interview package:
  30-second answer · two-minute professional answer · technical follow-ups ·
  critical-thinking question · practical repository example · governance perspective.
- **CI enforces referential integrity, not connectivity:** fail on bad/duplicate ids,
  dangling `prerequisites`/`related`/`governance`/`sources` refs, prerequisite cycles,
  `complete`-with-`stub`-prereqs, undispositioned sources; **warn only** on edge-less
  orphans. Never add artificial links to satisfy CI.
- Every new source goes through the intake pipeline (docs/INTAKE.md): log → route →
  apply → verify. An intake that leaves information outside a collection is incomplete.

## Phase 0 working protocol

- Task queue and statuses: [NEXT_TASKS.md](NEXT_TASKS.md) and
  [CURRENT_STATE.md](CURRENT_STATE.md) — update both after every completed task.
- Material deviations, discoveries, and standing conditions go in
  [DECISIONS.md](DECISIONS.md) (e.g., Astro 7 vs plan's "Astro 5"; ModelProvider
  evolvability; Cloudflare portability). Read it before implementing.
- Complete and verify one task before starting the next; never silently weaken an
  acceptance criterion. Each completed task is reported with: what was implemented ·
  files changed · what to learn from it · tests/verification · acceptance status ·
  deviations/risks · next task.

## Working rules

- Everything lands as reviewable diffs; CI (typecheck → content integrity → unit →
  build → Playwright smoke) must be green — content errors are build errors.
- Minimal-dependency policy: every new package needs a stated reason.
- Curriculum work ships **artifacts, not only lessons**: each layer L0–L6 has a build
  project (plan §3) that doubles as interview evidence.
- VibeSec lives in `.claude/skills` — follow secure coding practices. Strict CSP, no
  third-party scripts, no analytics in MVP, no secrets in the deployed site.
