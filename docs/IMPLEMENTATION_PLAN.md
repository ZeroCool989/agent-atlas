# Agent Atlas — Implementation Plan

- **Status:** Approved with amendments (2026-07-13). Phase 0 may begin.
- **Date:** 2026-07-13
- **Companion documents:** [ADR-0001 Framework](adr/0001-framework-selection.md) ·
  [ADR-0002 Content as Code](adr/0002-content-as-code.md) ·
  [ADR-0003 Local-First Progress](adr/0003-local-first-progress.md) ·
  [ADR-0004 Visualization Stack](adr/0004-visualization-stack.md) ·
  [ADR-0005 Transparent Agent Mechanics](adr/0005-transparent-agent-mechanics.md)

**Amendment log (2026-07-13, at approval):** (1) lightweight model-provider abstraction
from the start + one scheduled real-model agent experiment; (2) "Tokens" demoted to
pipeline-validation exemplar, flagship vertical slice is "Direct model call vs
deterministic workflow vs tool-using agent"; (3) ADR-0003 backend trigger broadened to
concrete server-side requirements; (4) CI graph-connectivity scope defined precisely —
no forced artificial links; (5) practical build projects added per curriculum layer;
(6) six-step autonomy spectrum made canonical; (7) explicit Astro-is-shell /
plain-TypeScript-agent-mechanics rule (ADR-0005); (8) interview readiness added to the
Definition of Done for major concepts.

---

## 1. Product Vision

Agent Atlas is an interactive atlas of modern AI systems: a single, coherent map that
teaches how AI actually works — from tokens to multi-agent systems to the governance that
regulates them — using visual, interactive, first-principles explanations.

It is explicitly **not**:

- a framework tutorial site (no "learn LangChain in 30 days"),
- a vendor course (no OpenAI/Anthropic-centric curriculum),
- a link dump or notes wiki.

Three product pillars, in priority order:

1. **Understanding** — every concept explained from the problem that preceded it, with the
   mechanism made visible.
2. **Judgment** — every concept classified by how essential it is, what it costs, and what
   simpler alternative exists.
3. **Employability** — every important concept backed by tiered interview preparation for
   AI engineering, architecture, consulting, and governance roles.

Primary user: the project owner. The architecture must not *prevent* a future public
audience, but must never pay complexity for one prematurely (ADR-0003).

## 2. Learning Philosophy

Every concept page must answer the **nine canonical questions**:

1. What problem existed before this?
2. Why was this invented?
3. How does it work? *(always with a visual)*
4. Is it actually necessary?
5. What are the trade-offs?
6. What complexity does it introduce?
7. What simpler alternative exists?
8. When should I use it?
9. When should I avoid it?

This is enforced structurally, not aspirationally: the concept MDX template contains these
as required sections, and CI lint checks that complete (non-stub) concepts contain them.

**The Essentiality Layer taxonomy.** Every concept is tagged with exactly one layer — this
is the single most important metadata field in the system:

| Layer | Meaning | Examples |
|---|---|---|
| `foundation` | Understanding is non-negotiable | tokens, context windows, sampling, prompting |
| `core-mechanism` | The reusable building blocks of AI systems | embeddings, RAG, tool calling, agent loop, evaluation |
| `useful-addition` | Valuable for specific problems, skippable otherwise | memory systems, reflection, planning patterns |
| `advanced-system` | Compositions of core mechanisms | multi-agent systems, computer use, voice agents |
| `framework-abstraction` | Someone else's opinions about the layers above | LangChain, LlamaIndex, agent frameworks |
| `vendor-specific` | One company's implementation | specific model APIs, proprietary features |

The layer determines visual treatment in the atlas (foundations at the center, vendors at
the rim), curriculum ordering, and the tone of the "is it necessary?" answer. This is how
the platform stays honest as hype cycles pass: fashionable things enter at the rim and
must earn their way inward.

**Reusable architecture over use cases.** Coding agents, research agents, compliance
agents, and support agents are presented as *parameterizations of one architecture*
(context assembly → model call → tool execution → verification → loop). A dedicated
"Anatomy of Any Agent" concept makes this explicit, and case studies map each example
agent onto the same diagram.

**The autonomy spectrum (canonical).** The platform preserves — in curriculum ordering,
concept naming, visuals, and interview answers — the distinction between six system
shapes of increasing autonomy:

1. **Deterministic workflow** — fixed code path, no model in the loop.
2. **Model-assisted workflow** — fixed code path with model calls at predetermined steps.
3. **Tool-using agent** — the model chooses which tools to call and when, inside a loop.
4. **Stateful agent** — a tool-using agent with persistent memory/state across steps or sessions.
5. **Reliable agent** — a stateful agent hardened with verification, retries, guardrails,
   evals, and observability.
6. **Multi-agent system** — a composition of the above with orchestration and delegation.

Content must never blur these (e.g., calling a model-assisted workflow an "agent"). Each
step exists because the previous one hit a limit; every step up costs predictability and
money — the "is it necessary?" question applies at each transition. This spectrum is the
spine of L3–L4 and of the flagship lesson (§19).

## 3. Learning Roadmap (Curriculum)

Seven layers, each depending only on the ones before it. This is the spine of the Learn
navigation and the initial content backlog.

- **L0 — What a Model Is:** AI/ML fundamentals, what an LLM is, training vs. inference,
  tokens & tokenization, sampling/temperature, context windows, model families & scaling.
- **L1 — Talking to Models:** prompt engineering, structured output, system prompts,
  context management, failure modes (hallucination, sycophancy), cost & latency basics.
- **L2 — Extending Models with Knowledge:** embeddings, similarity search, vector
  databases, chunking, RAG (and when *not* to RAG), fine-tuning vs. retrieval vs. long
  context, graph-augmented retrieval.
- **L3 — Extending Models with Action:** tool calling, the agent loop, MCP, memory
  (working/episodic/semantic), planning, reflection, verification, workflows vs. agents.
- **L4 — Systems of Models:** multi-agent architectures, orchestration patterns,
  computer use, voice agents, evaluation of systems (not just models).
- **L5 — Production Reality:** reliability patterns, observability, evals in CI, cost
  engineering, security (prompt injection, OWASP LLM Top 10), guardrails.
- **L6 — Governance & Risk:** EU AI Act, DORA, FINMA, ISO 42001, NIST AI RMF, GDPR, risk
  taxonomies, audit & documentation practices — each mapped back to the technical
  concepts it regulates.

Interview preparation is **cross-cutting**: every layer feeds the interview bank; role
tracks (AI Engineer, Solutions Architect, Governance/Risk, Consultant, Product) are
filtered views over the same bank.

**Build projects (one per layer — the roadmap ships artifacts, not only lessons).** Each
major learning stage culminates in a small working implementation project: code that lives
in this repo (under `src/lib/` or `experiments/`), demonstrates the layer's central
mechanism, and can be shown and discussed in an interview. Initial mapping:

| Layer | Build project |
|---|---|
| L0 | BPE tokenizer + context-window packer (powers the Tokenizer playground) |
| L1 | Structured-output extractor: prompt → Zod-validated JSON with retry-on-invalid |
| L2 | Mini retrieval engine: chunking + embeddings + cosine ranking (powers the RAG playground) |
| L3 | **Hand-written agent loop in plain TypeScript** — context assembly, tool selection, execution, verification, stopping (ADR-0005); plus the real-model experiment (§18) |
| L4 | Two-agent orchestration on top of the L3 loop (planner/executor or writer/critic) |
| L5 | Eval harness: scripted scenarios + assertions run in CI against the L3 agent |
| L6 | Model/system documentation pack for the L3 agent (EU AI Act–style technical documentation + risk classification exercise) |

Each project's page links the concepts it demonstrates and feeds `practicalExample`
fields in the interview bank — "show, then explain" is the interview-prep story.

## 4. Information Architecture

Two complementary organizations of the same content:

- **The Atlas (spatial):** an interactive knowledge graph — concepts as nodes positioned
  by layer (center = foundations, rim = vendor-specific), edges for prerequisites and
  relationships. The "you are here" view of the whole field. This is the signature surface.
- **The Path (linear):** the L0–L6 curriculum as an ordered reading sequence with progress
  tracking, for people (including future-you) who want to be led.

Supporting surfaces: a **Concept Reference** (A–Z, filterable by layer/status), **Playgrounds**
(all simulations, also reachable from their host lessons), **Interview Prep** (bank + drill
mode + role tracks), **Governance** (framework pages + the concept↔regulation mapping
matrix), and a **Sources ledger** (provenance for everything ingested).

## 5. Navigation Structure

```
/                     → Atlas (graph home) + entry points to Path and search
/learn                → L0–L6 curriculum index
/learn/[layer]        → layer overview + ordered lessons
/concepts             → A–Z reference, filter by layer/status/tag
/concepts/[slug]      → concept page (the canonical template)
/playgrounds          → all interactive simulations
/playgrounds/[slug]   → standalone simulation page
/interview            → role tracks + drill mode
/interview/[track]    → filtered question sets with tiered answers
/governance           → framework index + mapping matrix
/governance/[slug]    → framework page (EU AI Act, DORA, …)
/sources              → intake ledger / changelog
```

Global: full-text search (Pagefind, build-time index, zero server), breadcrumbs by layer,
"prerequisites you haven't read" hints from local progress state.

## 6. Content Model

Astro Content Collections with Zod schemas (ADR-0002). Collections:

**`concepts`** (MDX) — the core entity:

```ts
{
  title: string,
  slug: string,
  layer: 'foundation' | 'core-mechanism' | 'useful-addition'
       | 'advanced-system' | 'framework-abstraction' | 'vendor-specific',
  oneLiner: string,                    // the concept in one sentence
  prerequisites: slug[],               // hard edges in the graph
  related: slug[],                     // soft edges
  governance: governanceSlug[],        // which regulations touch this concept
  interviewTags: string[],             // links questions to this concept
  status: 'stub' | 'draft' | 'complete' | 'needs-update',
  needsUpdateReason?: string,          // set by intake when new info contradicts content
  sources: sourceId[],                 // provenance
  updated: date,
}
```

Body sections (template-enforced for `complete` status): the nine canonical questions,
at least one visualization, an "essential vs optional" verdict box, governance hooks,
and a link to its interview questions.

**`interview`** (YAML) — one file per question:

```ts
{
  id: string,
  question: string,
  concepts: slug[],
  roles: ('engineer'|'architect'|'consultant'|'governance'|'product')[],
  difficulty: 'screen' | 'standard' | 'deep',
  answers: { beginner: string, professional: string, deep: string },
  followUps: string[],
  practicalExample?: string,
  governanceAngle?: string,
}
```

**`governance`** (MDX) — framework pages with `appliesTo: slug[]` mappings and an
obligations table (what the regulation actually requires, mapped to technical controls).

**`sources`** (YAML) — the intake ledger: `{ id, type (video|paper|repo|article|note|talk),
title, url?, ingestedAt, routedTo: slug[], decisions: string }`.

**`glossary`** (YAML) — short definitions, auto-linkable in prose.

## 7. Knowledge Graph Strategy

- The graph is **derived, never hand-drawn**: a build-time script reads all frontmatter and
  emits `graph.json` (nodes with layer/status, typed edges: `prerequisite`, `related`,
  `governs`).
- **CI is the graph's integrity guarantee — with a precisely bounded scope.** CI
  **fails** the build on: invalid or duplicate identifiers/slugs; dangling references in
  `prerequisites`, `related`, `governance`, and `sources`; prerequisite cycles; `complete`
  concepts with `stub` prerequisites (you can't "complete" RAG before embeddings exists);
  and `sources` entries with no recorded disposition (`routedTo` empty *and* no decision
  note — an unfinished intake). CI **warns but does not fail** on concepts with no edges
  at all: an orphan report is generated for curation, but connectivity is never *forced* —
  adding an artificial `related` link to silence CI is worse than an honest orphan.
  Referential integrity is enforced; graph topology is curated.
- Rendered as the Atlas home: D3 force/radial layout inside a React island, layer-based
  radial positioning, progress overlay from local state, click-through to concepts.
- The same `graph.json` powers per-concept mini-maps ("where am I?") and the
  prerequisite hints in navigation.
- Deliberately **not** a graph database. A few hundred nodes serialized to JSON at build
  time needs nothing more — and this fact itself becomes a lesson in the
  `useful-addition` layer ("when do you actually need a graph database?").

## 8. Visual Learning System

Per ADR-0004, three tiers with a shared visual language:

- **Tier 1 — Static diagrams:** composed from the `viz` primitive library (pipeline flows,
  layer maps, sequence diagrams, architecture blocks). Required for every non-stub concept.
- **Tier 2 — Steppable animations:** the same diagrams driven by a `(step) => Scene` pure
  function and a universal `<Stepper>` (play/pause/scrub). Required for every
  `core-mechanism` concept — you should be able to *watch* a token stream fill a context
  window, a query flow through a RAG pipeline, an agent loop iterate.
- **Tier 3 — Simulations/playgrounds:** deterministic, inspectable, no API keys.
  MVP set (four): **Tokenizer** (real BPE, live token boundaries and counts),
  **Embedding Space** (precomputed real embeddings, 2D projection, nearest-neighbor
  queries), **RAG Pipeline** (chunking → retrieval → context assembly with every ranking
  score visible), **Agent Loop** (scripted scenario stepping through
  context → decision → tool call → result → loop, with the full "conversation state"
  visible at each step).

One visual grammar everywhere: same palette (layer-coded), same node/edge shapes, same
animation vocabulary. Diagrams are data + renderer, so intake can update them as diffs.

**Model-provider abstraction (from day one).** Simulation engines that conceptually
"call a model" (agent loop, structured output, workflow comparisons) are written against
a minimal `ModelProvider` interface in `src/lib/model/` — roughly
`complete(request) => response` with typed tool-call support, plus per-call metadata
(latency, token counts, cost estimate) — not against hardcoded script lookups. The MVP
ships only a `ScriptedProvider` (deterministic, replayable scenario files), so the
deployed site stays key-free per ADR-0004. But the same engine can be pointed at a real
API provider in a **local Node experiment** (§18) without rewriting. This is an interface
and two implementations — explicitly *not* an agent framework (ADR-0005).

## 9. Interview Preparation System

- **Bank:** structured questions (see §6) linked bidirectionally with concepts — every
  concept page shows its questions; every question links its concepts.
- **Tiered answers:** beginner / professional / deep, revealed progressively so you can
  self-test before reading.
- **Drill mode (island):** filter by role track and difficulty, self-grade
  (again/hard/good/easy), history in IndexedDB.
- **Spaced repetition (Phase 2):** SM-2 scheduling as a pure, unit-tested TS module over
  the drill history; "due today" queue on the interview home.
- **Role tracks:** saved filters + ordering per target role, including governance-angle
  follow-ups for consulting/GRC tracks.
- Quality bar: MVP ships with ~60 questions covering L0–L3 `foundation` and
  `core-mechanism` concepts, each with all three answer tiers written out (no stub answers).

**Interview readiness is part of the Definition of Done** for every major concept
(`foundation` and `core-mechanism` layers, and any concept marked `complete`). A concept's
interview package must include all six elements:

1. a **30-second answer** (the elevator version — maps to the `beginner` tier),
2. a **two-minute professional answer** (maps to the `professional` tier),
3. **technical follow-ups** an interviewer would actually ask (`followUps`),
4. at least one **critical-thinking question** (trade-off/judgment, not recall —
   typically "when would you *not* use this?"),
5. a **practical repository example** — a pointer to working code in this repo, usually
   the layer's build project (`practicalExample`),
6. a **governance perspective** — how regulation/risk sees this mechanism, even if the
   honest answer is "not materially regulated" (`governanceAngle`).

The existing `interview` schema already carries fields for all six; CI's template lint
checks that `complete` major concepts link a question set satisfying them.

## 10. Governance Integration

Governance is a **layer on the map, not a separate site**:

- Each framework (EU AI Act, DORA, FINMA, ISO 42001, NIST AI RMF, OWASP LLM Top 10, GDPR)
  gets a page: what it is, who it binds, its actual obligations, and — critically —
  `appliesTo` mappings to technical concepts.
- Concept pages surface their governance hooks inline (e.g., RAG page: "GDPR: retrieved
  personal data is still processing; EU AI Act: provenance obligations for training vs.
  retrieval corpora").
- A **mapping matrix** page renders the full concept × regulation grid from frontmatter.
- Sequencing follows the vision: governance pages reference technical pages as
  prerequisites, never the reverse. L6 depends on L0–L5.

## 11. Knowledge Intake Process

The "no loose ends" pipeline, documented as `docs/INTAKE.md` and executed by Claude on
every new source you send:

1. **Log:** create a `sources` entry (type, title, provenance).
2. **Route:** decide explicitly, and record in the entry, each of: which concepts it
   updates · whether it creates a new concept (and its layer) · whether it contradicts
   existing content · what it contributes to the interview bank · whether it suggests an
   experiment or visualization.
3. **Apply:** make the edits as one reviewable change set. Contradictions that can't be
   resolved immediately set `status: needs-update` + `needsUpdateReason` on affected
   concepts — a visible debt marker, not a silent note.
4. **Verify:** build must pass (schemas, graph integrity), which structurally guarantees
   the new material is connected to the graph.

Rule: an intake that ends with information outside a collection is an incomplete intake.
There is no "notes" directory by design.

## 12. Technical Architecture

**Stack (per ADRs 0001–0004):**

- Astro 5 · TypeScript (strict) · MDX · Tailwind CSS 4
- React 19 islands for all interactive components; nano-stores for cross-island state
- D3 (math only) for graph layout & scales; `motion` for animation where CSS is not enough
- Pagefind for search · Zod everywhere (content schemas, local-state schemas)
- Client state: localStorage + IndexedDB with versioned Zod-validated schemas, JSON
  export/import (ADR-0003)
- No backend, no database, no auth, no Stripe, no Redis (ADR-0003)

**Role boundary (ADR-0005).** Astro is the **application shell and content platform** —
routing, rendering, content collections, islands. All agent mechanics — the agent loop,
tool dispatch, provider abstraction, workflow engines, memory, verification — are
implemented **transparently in plain TypeScript** under `src/lib/`, with no framework
between the learner and the mechanism. LangGraph, CrewAI, the OpenAI Agents SDK, and
similar frameworks are **not dependencies of this platform**; they enter later only as
*comparison subjects* (framework-abstraction-layer content and experiments), and only
after the underlying loop has been implemented by hand.

**Project structure:**

```
agent-atlas/
├── docs/                      # this plan, ADRs, INTAKE.md, AUTHORING.md, VISUAL_LANGUAGE.md
├── src/
│   ├── content/               # THE PRODUCT — all collections
│   │   ├── concepts/          # organized by layer subfolders
│   │   ├── interview/
│   │   ├── governance/
│   │   ├── sources/
│   │   └── glossary/
│   ├── content.config.ts      # Zod schemas = executable content model
│   ├── components/
│   │   ├── viz/               # visual primitive library + Stepper
│   │   ├── playgrounds/       # Tier-3 simulations (React islands)
│   │   ├── interview/         # drill mode, tiered answers
│   │   └── ui/                # shared chrome
│   ├── lib/
│   │   ├── graph/             # graph build + integrity checks (pure, tested)
│   │   ├── model/             # ModelProvider interface + ScriptedProvider (+ real provider, used only by experiments/)
│   │   ├── agent/             # hand-written agent loop, tool registry, workflow engines (plain TS, ADR-0005)
│   │   ├── sim/               # simulation engines (pure TS, no React)
│   │   ├── srs/               # spaced repetition (pure, tested)
│   │   └── storage/           # versioned local-state wrapper
│   ├── layouts/               # concept template, governance template, …
│   └── pages/                 # routes per §5
├── experiments/               # local Node scripts (real-model runs); never bundled into the site
├── scripts/                   # graph validation, content lint, link check
└── tests/                     # vitest unit + playwright e2e
```

The load-bearing separation: **`lib/` is pure TypeScript with no React and no Astro** —
simulation engines, graph logic, SRS scheduling are all testable functions; components
only render them. This is what keeps the interactive surface maintainable for years.

## 13. Framework Evaluation

Full comparison in [ADR-0001](adr/0001-framework-selection.md). Summary: Astro 5, Next.js 15,
React + Vite, and Docusaurus 3 were scored against the actual workload (content-dominant,
island interactivity, typed content model, single user, longevity). **Astro wins** because
its defaults — typed content collections, zero-JS pages, opt-in hydration — match the
product's shape without custom infrastructure. Next.js is the right tool for a different
product (multi-user app with server state) and remains the documented fallback if
requirements change. Docusaurus was the strongest "fourth option" but constrains exactly
the surfaces (graph atlas, custom lesson UX, playgrounds) that differentiate Agent Atlas.

## 14. Testing Strategy

Test what can silently rot; don't test the framework.

1. **Content integrity (the highest-value layer):** Zod schema validation at build +
   custom checks in `scripts/`, with the fail/warn split defined in §7: **fail** on
   invalid/duplicate identifiers, dangling prerequisite/related/governance/source
   references, prerequisite cycles, `complete`-with-`stub`-prerequisites, undispositioned
   `sources` entries, and template-section lint for `complete` concepts (including the
   six-element interview package, §9); **warn** (report only) on edge-less orphan
   concepts. Plus an internal link checker. Runs in CI on every push — this is what makes
   AI-driven intake safe.
2. **Unit (Vitest):** everything in `lib/` — simulation engines (tokenizer, retrieval
   scoring, agent-loop state machine), graph builder, SRS scheduler, storage
   migrations. Target: `lib/` fully covered; it's pure functions, so this is cheap.
3. **Component (Vitest + Testing Library):** `(step) => Scene` functions and critical
   islands (Stepper, drill mode) — behavior, not pixels.
4. **E2E (Playwright, small and stable):** one smoke path per surface — a concept page
   renders with its island hydrated, atlas graph renders and navigates, drill mode
   records a grade, search returns results, progress export/import round-trips.
5. **Accessibility:** axe checks in the Playwright suite for the main templates; every
   Tier-2/3 visual needs a text alternative (the step descriptions double as one).

## 15. Security Strategy

The static architecture eliminates most risk classes by construction (no server, no auth,
no user PII, no payment flows). What remains:

- **Supply chain:** lockfile + `npm audit`/Dependabot in CI; minimal dependency policy
  (every new dependency needs a reason — the viz library exists partly to avoid grabbing
  chart packages ad hoc).
- **Content injection:** MDX is code — intake content is always reviewed as a diff before
  merge; no `set:html` with source-derived strings; sanitize any rendered user input in
  playgrounds (inputs stay client-side anyway).
- **Headers:** strict CSP (no third-party scripts is the default and should stay true),
  no analytics for MVP.
- **Secrets:** none exist in the deployed site by design. CI has no deploy-time secrets
  beyond the host token. The real-model experiment (§18) runs as a **local Node script**
  only: its API key lives in a git-ignored `.env`, is never referenced from `src/` code
  that Astro bundles, never committed, and never needed by CI (experiment transcripts are
  checked in as data; the run itself is manual).
- **Future BYOK playgrounds (explicitly out of MVP):** if live-model mode ever lands, keys
  live in memory only, never persisted or proxied, with its own ADR + review beforehand.
  VibeSec secure-coding practices (`.claude/skills`) apply to all implementation work.

## 16. Documentation Strategy

- `docs/` holds meta-documentation: this plan, ADRs (one per irreversible decision, same
  template as 0001–0004), `INTAKE.md` (the §11 pipeline), `AUTHORING.md` (concept template
  + when `.astro` vs React), `VISUAL_LANGUAGE.md` (palette, node/edge grammar, animation
  vocabulary).
- **`CLAUDE.md` is rewritten at Phase 0** to reflect the real stack and point to the docs —
  it currently describes a stack this plan rejects, and it is the file every future
  Claude session trusts first.
- The platform documents itself: the sources ledger is the changelog; concept `status`
  fields are the content health dashboard.
- READMEs stay thin and point into `docs/` — one source of truth per topic.

## 17. Deployment Strategy

- **CI (GitHub Actions), every push:** typecheck → content integrity suite → unit tests →
  build → Playwright smoke. A red build blocks deploy — content errors are build errors.
- **Hosting:** static output to **Cloudflare Pages** (fast global CDN, generous free tier,
  preview deployments per branch, custom headers for CSP). Vercel/Netlify are drop-in
  equivalents; nothing couples to the host.
- **Preview deploys** on every branch = review surface for intake change sets.
- No environments to manage beyond production + previews; no migrations, no rollbacks
  beyond `git revert`.

## 18. Roadmap

**Phase 0 — Foundation (~1 week of focused work).** Scaffold Astro + TypeScript strict +
Tailwind + MDX; implement all content schemas; graph builder + integrity CI (fail/warn
scope per §7); `ModelProvider` interface + `ScriptedProvider` in `src/lib/model/`; base
layouts (concept template with the nine sections); CI/CD to Cloudflare Pages; rewrite
`CLAUDE.md`; **one simple exemplar concept ("Tokens") completed end-to-end** — full
template, Tier-2 visual, six-element interview package, governance hooks. Tokens is the
*pipeline validation* exemplar: deliberately simple content, so failures are pipeline
failures, not content failures.

**Phase 1 — MVP (4–6 weeks).** See §19. Opens with the **flagship vertical slice**:
the lesson *"Direct model call vs deterministic workflow vs tool-using agent"* — one
problem solved three ways, with the full autonomy spectrum (§2) as the framing. This
lesson establishes the **reusable flagship lesson format**: visual learning (Tier-2
comparison of the three execution traces) · implementation (the hand-written loop in
`src/lib/agent/`, ADR-0005) · essential-vs-optional classification at each spectrum
transition · security surface at each step (what prompt injection can reach) · governance
hooks (how autonomy changes the risk classification) · quiz · six-element interview
package. Every later major lesson follows this format.

**Shortly after the foundational modules of Phase 1** (once the agent loop +
`ScriptedProvider` exist): the **first real-model agent experiment** — a local Node
script in `experiments/` that runs the *same* hand-written loop against a real API
provider on 2–3 tool-use scenarios, capturing for direct observation: actual tool
selection, malformed/unparseable output, retry behavior, latency, token counts, cost,
hallucination risk, and stopping behavior. Deliverables: checked-in transcripts (as
`sources` entries), a short findings write-up routed into the relevant concepts via the
intake pipeline, and any corrections to the scripted scenarios where they misrepresent
real behavior. No agent framework is introduced for this (ADR-0005).

**Phase 2 — Depth (next ~2 months).** Complete L3 (MCP, memory, planning, reflection,
verification, workflows-vs-agents) and start L4/L5, extending the built artifact along
the autonomy spectrum (stateful → reliable agent, per the §3 build projects); governance
pages for EU AI Act, NIST AI RMF, ISO 42001 with the mapping matrix; spaced repetition +
interview bank to ~150 questions; intake process battle-tested and refined; 3–4 more
simulations (context-window packer, chunking explorer, eval runner).

**Phase 3 — Systems (thereafter).** L4 advanced systems (multi-agent visualizer — the most
ambitious visual), computer use, voice; L5 production content; L6 completed (DORA, FINMA,
GDPR pages); role-track interview views; **framework-abstraction-layer content**
(LangGraph, CrewAI, Agents SDK) written as *comparisons against the hand-built loop* —
"here is what the framework does for you, here is what it hides" (ADR-0005); consider
BYOK live-model mode and 3D embedding explorer (each behind its own ADR).

## 19. MVP Definition

The MVP is **deep, not wide**: a complete vertical slice proving every system.

**Ships with:**

- **The flagship lesson: "Direct model call vs deterministic workflow vs tool-using
  agent"** — the first complete vertical slice in the flagship format (§18 Phase 1),
  built on the hand-written loop and the autonomy spectrum. This, not Tokens, is the
  template every later major lesson copies.
- **12–15 concepts at `complete` status** forming the spine: tokens, LLMs & training vs.
  inference, sampling, context windows, prompt engineering, structured output, embeddings,
  vector search & vector DBs, RAG, tool calling, workflows vs. agents (the autonomy
  spectrum), the agent loop, evaluation basics, hallucination & failure modes.
  (Everything else may exist as visible `stub` nodes on the atlas — the map shows the
  whole territory even where lessons aren't written.)
- **Atlas graph home** (interactive, progress overlay) + **Path view** for L0–L2.
- **Four playgrounds:** tokenizer, embedding space, RAG pipeline, agent loop.
- **Interview bank:** ~60 fully-answered questions with drill mode (no SRS yet).
- **Governance:** framework stubs with `appliesTo` mappings visible on concept pages
  (full framework pages are Phase 2).
- Search, progress tracking with export/import, CI, deployed and public-URL live.

**A concept is `complete` only when:** all nine canonical questions answered · essential-
vs-optional verdict present · ≥1 visualization (Tier 2 if `core-mechanism`) · ≥3 interview
questions linked, together satisfying the **six-element interview package** (§9:
30-second answer, two-minute professional answer, technical follow-ups, critical-thinking
question, practical repository example, governance perspective) · governance hooks
declared (even if "none") · prerequisites are at least `draft`.

**Explicitly not in MVP:** accounts/backend, live model calls *in the deployed site*
(the local real-model experiment in `experiments/` is in scope, §18), spaced repetition,
3D, voice/computer-use content, framework-abstraction layer content, analytics.

## 20. Future Expansion & Scalability

Growth axes and how the architecture absorbs them:

- **More content:** the content model scales linearly; the graph and CI keep it coherent.
  Risk at ~300+ nodes is curation, not technology — the layer taxonomy is the pruning tool.
- **Multi-device / multi-user:** versioned local-state schema → export/import → (if ever
  justified) a small sync API via Astro adapter. ADR required before any backend; the
  trigger is any *concrete server-side requirement* (protected model API calls, source
  ingestion, transcript processing, regulatory-news ingestion, cross-device sync,
  multi-user features), not only a second user — see ADR-0003.
- **Live-model playgrounds:** BYOK, client-side only, own ADR + security review.
- **Public audience:** static architecture already handles arbitrary read traffic; what
  would change is editorial process, not infrastructure.
- **Framework churn resilience:** content is portable MDX/YAML; `lib/` is dependency-free
  TypeScript; the truly framework-coupled surface (layouts, islands wiring) is the
  smallest slice of the system. This is deliberate.

## 21. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Content sprawl** — many stubs, nothing finished | High | Hard `complete` definition (§19); atlas visually shames stub-heavy regions; MVP is depth-first |
| **Visualization cost** — each visual becomes a project | High | Primitive library + step-scene model (ADR-0004); Tier requirements scale with layer, not ambition |
| **Over-engineering pull** — backend/CMS/graph-DB creep | Medium | ADRs 0002/0003 with explicit revisit triggers; every addition needs a decision record |
| **Hype churn** — content dated by model releases | Medium | Layer taxonomy quarantines volatility at the rim; `needs-update` status + sources ledger make staleness visible |
| **Single-maintainer fatigue** | Medium | Always-deployed vertical slices (value from week 1); intake pipeline makes Claude a low-friction co-maintainer |
| **AI-authored content errors** | Medium | Everything lands as reviewable diffs; CI integrity gates; provenance via sources ledger |
| **Astro bet fails for a future need** | Low | Documented fallback (ADR-0001); portable content; pure `lib/` |

---

## Approval

**Approved 2026-07-13** with the eight amendments recorded in the amendment log above.
The four flagged decisions (Astro over Next.js; no backend/auth/DB for MVP;
deterministic key-free simulations in the deployed site; deep-not-wide MVP scope) stand
as decided. Phase 0 begins with the scaffold + the "Tokens" pipeline-validation
exemplar; the flagship vertical slice opens Phase 1.
