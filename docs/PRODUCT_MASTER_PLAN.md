# Agent Atlas — Product & UX Master Plan (Phase 1A)

- **Status:** Proposed — awaiting approval. No implementation until sign-off.
- **Date:** 2026-07-15
- **Companion documents:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) ·
  [EXECUTION_PROTOCOL.md](EXECUTION_PROTOCOL.md) · [VISUAL_LANGUAGE.md](VISUAL_LANGUAGE.md) ·
  ADRs 0001–0005 · [AUTHORING.md](AUTHORING.md)
- **Scope:** productization and UX. It does **not** replace the approved architecture,
  content model, ADRs, or educational philosophy — it puts a product around them. Where
  it proposes changing an approved decision, it says so explicitly and justifies it.

---

## 1. Executive Summary

Agent Atlas today is a set of five genuinely excellent, evidence-backed lessons sitting
on a rigorous content-and-experiment engine — with almost no product around them. The
engineering foundation is ahead of most learning platforms; the **product shell is
effectively unbuilt**. A first-time visitor lands on a placeholder home page, has no
navigation, cannot discover the Atlas, cannot see a learning path, cannot track
progress, and cannot search. The signature surface promised in the implementation plan —
the interactive knowledge graph — exists as data (`graph.json`) with no interface.

**The core finding:** the highest-leverage work is not another concept, and not the
experiment dashboard. It is the **product shell that makes the existing content a
navigable, discoverable, progress-aware learning journey.** Ten world-class lessons with
no way to find them is worth less than five lessons inside a product that guides you.

**The thesis of this plan:** build the shell (home, navigation, the Atlas graph, the
Learn path, local-first progress, search) *before* widening content or building the
experiment dashboard — then resume the curriculum inside a product that does the content
justice. This reorders the current priorities, and §17 argues why.

**What must not change:** the content-as-code model and CI integrity gates (the moat),
the evidence-backed methodology (the differentiator no competitor has), the
scene/renderer visualization architecture, the essentiality taxonomy and honesty rules,
the zero-JS-first performance posture, and the pure, portable `lib/`. This plan is
additive to all of it.

**The brand target.** Of the references given, Atlas should feel like **Stripe Docs and
Linear** first (credible, calm, information-dense done elegantly), **Brilliant** second
(interactive, guided, delightful), and Arc/Cursor for motion polish. It should *not*
feel like a gamified consumer app: Atlas's credibility — "we measure, then teach" — is
undermined by dopamine mechanics. Restraint is the brand.

---

## 2. Product Vision

Agent Atlas is an **interactive AI Engineering Academy, Research Lab, and Interview
Platform** in one coherent surface. It takes someone from "I know almost nothing about AI
engineering" to "I can explain, build, evaluate, experiment with, and govern production
AI systems" — and it is distinctive because **every claim it teaches can be traced to
either working code in the repo or a reproducible measurement.** No other learning
resource in this space is evidence-backed by construction.

Three product modes, one map:

- **Academy** — a guided journey through the essentiality-ordered curriculum, each
  concept taught problem-first with an interactive visualization and a build project.
- **Research Lab** — the experiment framework surfaced as a browsable evidence base:
  what real models actually do, measured, with limitations stated.
- **Interview Platform** — the interview bank as a practice surface: role tracks, tiered
  answers, drill and review, whiteboard prompts, tied back to the concepts and the code.

The connective tissue is the **Atlas** — a living map where concepts, evidence, projects,
and interview material are one graph you navigate spatially, not a list of docs.

---

## 3. Design Principles

**Principle 0 — The Simplicity Mandate (overriding).** Every UX decision must *reduce*
cognitive load. Do not add a feature because it is possible. Prefer **one obvious,
elegant interaction over three configurable ones.** When simplicity and feature count
conflict, choose simplicity — *unless there is clear evidence the added complexity
materially improves learning* (spaced repetition's grading is the rare carve-out; §12).
This principle overrides the ten below when they tension; the design test for any surface
is not "what could it do" but "what is the single thing the learner needs it to do, done
beautifully." A feature that must be explained has already failed it. §3A lists the
concrete cuts this mandate makes to the rest of this plan.

Ten principles, in priority order under the mandate. These are the tie-breakers for every
future decision.

1. **Evidence over assertion.** If we can measure it or link to the code that does it, we
   show that. The "measured / scripted / theory" distinction is a visible, first-class UI
   element, not a footnote. This is the product's soul.
2. **Clarity over cleverness.** Every screen answers "what is this, why am I here, what
   do I do next" before it does anything else. Information density is fine; confusion is
   not.
3. **Calm, credible, restrained.** Stripe/Linear, not a game. Motion communicates state
   change; it never entertains. No streak-shaming, no confetti, no dark patterns.
4. **Guided, not gated.** Show the whole territory (stubs included) and always suggest a
   next step, but never lock content behind artificial "unlocks." Prerequisites are
   advice rendered honestly, not walls.
5. **Progressive disclosure.** A concept reveals its depth in layers: one-liner → mental
   model → visualization → sections → deep interview answers. A learner can stop at any
   layer with something true.
6. **Fast by default.** Content pages ship zero JS; interactivity hydrates only where it
   teaches. Performance is a feature, and it's already true — protect it.
7. **Accessible as a requirement, not a pass.** Keyboard, screen-reader, reduced-motion,
   contrast, and non-color state are acceptance criteria on every surface, matching the
   existing viz discipline.
8. **Local-first and private.** No accounts, no tracking, no analytics for as long as
   possible (ADR-0003). Progress lives in the browser; the learner owns their data.
9. **One visual grammar.** Every diagram, badge, and state uses the same palette, shapes,
   and motion vocabulary (VISUAL_LANGUAGE.md), so the whole atlas reads as one system.
10. **Honest about maturity.** Stubs look intentionally unfinished; `needs-update`
    content says why; half-built surfaces are not shipped to the public shell. The
    product never pretends to be more complete than it is.

---

## 3A. Simplicity Decisions (applying the mandate)

Applying Principle 0 to my own plan. Each is a deliberate cut of proposed complexity down
to one obvious interaction; the fuller versions in later sections are amended to match.

- **Atlas graph: one control, not four filters.** The taxonomy is *already* the layout
  (center→rim) and status is *already* the fill — encoding them again as filters is
  redundant. The graph gets a **single toggle: "Show my path"** (highlight your frontier)
  vs. the whole map. Nothing else. (Amends §9.)
- **Concept page: one orientation device, not three.** Learning objectives + key
  takeaways + a sticky rail is three things doing one job. Decision: **a single sticky
  "on this page" rail** (scroll-spy + read progress) is the orientation device;
  **learning objectives** open the lesson (the one "what will I learn" block); **key
  takeaways** become the *closing recap*, not a second top-of-page block. One device for
  orientation, one promise at the top, one recap at the end. (Amends §10.)
- **One page action, not three.** The concept footer offers a single primary action —
  **"Mark complete"** — which also enrolls the concept in review automatically. No
  separate "add to review" / "bookmark from footer" buttons. Saving lives in one place
  (§14). (Amends §10.)
- **Progress capture: two mechanisms, not four.** Drop **highlights** (high interaction
  cost, marginal learning value) and the **user-curated "personal glossary"** (the
  glossary collection already exists — auto-surface saved terms instead of asking the
  learner to build one). Keep exactly two: **bookmark a concept** and **a note per
  concept.** (Amends §14.)
- **Drill: two buttons, not four.** Self-grade is **"Again / Got it,"** not
  again/hard/good/easy. This is the one place the mandate's evidence carve-out applies —
  SM-2's finer grades have real retention support — so the scheduler keeps a 4-grade
  *capability internally*, but the **default UI is two buttons**; a 4-grade option is
  considered only if usage evidence shows learners want it. Simplicity first, complexity
  on evidence. (Amends §12.)
- **Lab: one primary filter, not four facets.** Learners arrive asking "evidence for
  *this concept*," so the Lab's one filter is **by concept**; provider/outcome/measured
  facets appear only once multi-provider data exists to make them meaningful. Don't build
  four facets for five experiments. (Amends §11.)
- **Home: fewer sections.** The Atlas *is* the featured map and the nav *is* the mode
  switcher, so the separate "featured concepts" and "three modes" blocks are cut. Home =
  hero thesis · the Atlas (with your progress + one "Continue" CTA) · three proofs ·
  latest evidence · footer. (Amends §7.)
- **Search: one interaction, two entry points.** ⌘K *is* search. The `/search` page is
  the identical capability given a URL for no-JS/mobile/deep-link — not a second, richer
  search UI. Build once. (Confirms §15.)
- **Settings: essentially none.** The only "setting" is the theme toggle (and it can
  follow the OS by default). No preference panel — every default should be the right one.
  `/you` holds progress + export/import, not configuration. (Amends §14.)

The through-line: the *visual encoding does the work a control would otherwise do*, the
learner is given one obvious path rather than options to configure, and anything that must
be explained is cut or redesigned until it doesn't.

## 4. User Personas

Five personas, each with a primary job-to-be-done. The product must serve the first three
by 1.0; the last two are why the architecture exists.

- **P1 — The Career Switcher ("Maya").** Knows software, new to AI engineering. Wants a
  credible, structured path from zero and proof she's making progress. Needs: onboarding,
  a visible journey, a sense of "where am I," reassurance the content is trustworthy.
  *Primary success:* completes L0–L2, builds the tokenizer, can explain tokens in an
  interview.
- **P2 — The Working Engineer Leveling Up ("Sam").** Ships software, uses LLMs
  tangentially, wants depth fast on specific mechanisms (RAG, agents, evaluation). Needs:
  fast search, direct concept access, the "is this essential?" verdict, code links, the
  evidence. Impatient with hand-holding. *Primary success:* jumps to a concept, gets the
  mechanism + trade-offs + evidence in minutes.
- **P3 — The Interview Candidate ("Dev").** Preparing for AI engineering / architecture
  interviews. Needs: role tracks, tiered answers, drill/review, whiteboard prompts,
  weakness tracking, the "explain it in 30s / 2min / deep" framing. *Primary success:*
  practices a role track and walks into an interview able to answer at three depths.
- **P4 — The Governance / GRC Professional ("Priya").** Understands regulation, not the
  engineering. Needs: the concept→regulation mapping, careful applicability wording, the
  engineering controls behind each obligation. *Primary success:* understands what a
  tool-using agent's audit trail actually is, and when a framework applies.
- **P5 — The Maintainer / Contributor (the owner, and future collaborators).** Extends
  the atlas via the intake pipeline. Needs: the authoring/intake tooling, CI integrity,
  the research notebook. Already well-served; the product must not regress this.

Anti-persona: the passive video-watcher. Atlas is for people who want to *understand and
build*, not watch. We optimize for them and don't chase the mass market.

---

## 5. Information Architecture

The current IA is two half-built surfaces (`/concepts`, `/experiments`) and orphaned
pages. The target IA has **seven top-level destinations**, each a workflow, unified by the
Atlas and search.

```
/                     Home — the living Atlas + entry points + your progress
/learn                The Path — curriculum spine (L0–L6), guided journey
/learn/[layer]        Layer overview + ordered lessons
/concepts             A–Z reference (fast access), filter by layer/status
/concepts/[slug]      Concept page (the canonical lesson)
/build                Projects — the build artifacts per curriculum layer
/build/[slug]         A build project (code, what it proves, linked concept)
/lab                  Evidence Lab — experiment browser + comparisons
/lab/[id]             A single experiment (trace viewer + report)
/interview            Interview Prep — role tracks, drill, review
/interview/[track]    A role track's question set
/governance           Governance — frameworks + the concept×regulation matrix
/governance/[slug]    A framework page
/roadmap              What's built, what's coming, content health (public honesty)
/search               Full-text search across everything
/you                  Progress, bookmarks, notes, glossary, export/import (local-first)
```

**Renames from the current plan, justified.** `/experiments` → `/lab` ("Evidence Lab" is
a stronger product noun and matches the research-notebook identity). `/playgrounds` from
the implementation plan is **dropped as a separate surface** — playgrounds live inside
their host lessons, which is where learners meet them; a standalone gallery adds an IA
node with no journey. The atlas graph becomes the *home page itself*, not a separate
`/atlas` route.

**Two orientations, one content set (unchanged from the plan, now with UI):** the **Atlas**
(spatial, home) and the **Path** (linear, `/learn`) are two views over the same concepts.
This duality is correct and should be preserved — spatial for explorers (P2), linear for
the guided (P1).

**Deprecate `/viz-demo`.** It was the P0.5 architecture testbed and is now superseded by
real lessons. Keep it out of navigation; either delete it or move it under a `/dev`
noindex path. Shipping it to users is brand-negative (illustrative data labelled as
such, but still redundant).

---

## 6. Navigation

Today there is **no navigation** — the `Base` layout renders a skip link and a bare
content slot; every page is an island reachable only by URL. This is the single most
important gap after the home page. Every persona hits a dead end.

**Global chrome (persistent, every page):**

- **Top bar:** the Atlas wordmark (→ home), the primary destinations (Learn · Concepts ·
  Build · Lab · Interview · Governance), a search affordance (⌘K), a theme toggle, and a
  compact progress indicator (→ `/you`). Collapses to a menu on mobile.
- **Command palette (⌘K / touch button):** the primary way P2/P3 navigate — jump to any
  concept, experiment, question, or project by name. This is the Linear/Cursor move and
  it makes a dense product feel fast. It's search + navigation fused.
- **Footer:** roadmap, GitHub, the honesty statement (how content is made), accessibility,
  and the "no accounts, your data is yours" note.

**Why each destination exists (the workflow behind the label):**

| Nav item | Workflow it serves | Persona |
|---|---|---|
| **Learn** | "Guide me from where I am" — the ordered journey with progress | P1 |
| **Concepts** | "Take me straight to X" — reference, search, verdicts | P2 |
| **Build** | "Show me the code I'd write / discuss in an interview" | P2, P3 |
| **Lab** | "What do real models actually do?" — the evidence base | P2, P4 |
| **Interview** | "Get me interview-ready" — drill, review, role tracks | P3 |
| **Governance** | "How does regulation connect to the engineering?" | P4 |
| **Roadmap** | "Is this real and maintained?" — trust and transparency | all |
| **Search (⌘K)** | "Find anything, fast" | P2, P3 |
| **You** | "My progress, notes, and bookmarks" | P1, P3 |

Deliberately **not** in the top nav: Projects and Roadmap live in the footer + contextual
links to avoid overloading the bar (7±2 rule); Settings folds into `/you`. The bar shows
six learning destinations + search + progress + theme — no more.

---

## 7. Homepage

The current home is a placeholder (`h1` + one paragraph + "under construction"). It must
become the product's thesis in one screen and the Atlas in the next. It answers, above the
fold, the seven discovery questions the brief demands: *what, who, why different, where to
begin, what you'll learn, how long, and (for returning users) your progress.*

**Structure (top to bottom) — five sections, not seven (Principle 0 / §3A):**

1. **Hero — the thesis.** One line ("Understand, build, evaluate, and govern AI systems —
   from first principles, backed by evidence"), one sub-line, and — for a new visitor —
   two calls to action: **"Start the journey"** (→ `/learn`) and **"Explore the Atlas"**
   (→ the map below). A returning learner instead sees a single **"Continue: [next
   concept]"** primary CTA, driven by local progress.
2. **The living Atlas.** The interactive knowledge graph (§9) — the signature surface —
   rendered large, showing the whole territory center-to-rim, the learner's progress
   overlaid, click-through to any concept. It *is* the featured content and the "start
   here," so no separate featured-concepts block is needed. This is the "wow," the
   differentiator, and the reason someone screenshots Atlas.
3. **Why it's different (three proofs, not claims).** Three cards: *Evidence-backed* (a
   real measured result from the Lab), *Build, don't just read* (a real build project),
   *Interview-ready* (a real tiered answer). Each links to the live thing — the homepage
   proves its claims by showing them.
4. **Latest evidence.** The most recent experiments (research-notebook heartbeat) — signals
   the project is alive and measuring.
5. **Footer CTA + honesty statement.** "How Atlas is made: every claim is code or
   measurement" + GitHub + roadmap. (The nav already exposes the three modes, so no
   separate modes block on the home page.)

**Performance constraint:** the hero, the three proofs, and copy are static (zero JS). The
Atlas graph is the one hydrated island on the page, `client:visible`. The home page must
still be fast; the graph must have a meaningful static first frame (a rendered snapshot of
the map) before hydration.

---

## 8. Learning Journey (`/learn`)

The curriculum spine (L0–L6, already defined in the implementation plan) becomes a
**visual, progress-aware journey** — the Path view. This is P1's home.

**Structure:**

- **Journey map:** the seven layers as a vertical/branching path from *What a Model Is*
  (L0) to *Governance & Risk* (L6), each layer a station showing its concepts, your
  completion %, and estimated time. Foundations first; rim last. The visual echoes the
  Atlas but linearized.
- **Four difficulty bands** mapped onto the layers for orientation, not gating:
  *Beginner* (L0–L1), *Intermediate* (L2–L3), *Advanced* (L4–L5), *Expert* (L6 +
  production). These are labels that set expectations, not locks.
- **Per-concept journey card:** title, one-liner, essentiality badge, status, estimated
  time, prerequisites (with their status), and your state (not started / in progress /
  complete / needs review).
- **Guidance engine (local-first, deterministic):** "suggested next lesson" (the shallowest
  unmet prerequisite frontier), "knowledge gaps" (prerequisites of things you've started
  but not their prereqs), and "review due" (spaced-repetition surfacing — see §12).
- **Estimated durations:** computed from a per-concept `estimatedMinutes` field
  (content-model addition — see §21) plus interactive time, shown honestly as ranges.
- **Completion & mastery, restrained:** completion = "read the complete lesson";
  mastery = "answered its interview questions in review." Two honest states, no XP, no
  levels. A quiet, optional streak (days with any activity) — off by default,
  never shaming.

**On achievements/unlocks/gamification — a challenge to the brief.** The brief lists
achievements and unlocks. I recommend **against** classic gamification and **for**
*mastery signals*: a concept can show "explained" (you revealed all answer tiers),
"built" (you opened the build project), "evidenced" (you viewed its experiment). These are
truthful reflections of engagement, not points. They fit the Stripe/Linear brand;
badges-and-streaks fit Duolingo and would cheapen the "we measure, then teach"
credibility. If we ever add streaks, they are opt-in and silent.

---

## 9. Interactive Atlas (the signature experience)

This is the product's signature and it is **currently unbuilt** — `graph.json` is
generated with no consumer. Building it is the single highest-visibility deliverable and
should be *the* signature experience the brief asks us to identify.

**What it is.** A spatial, zoomable map of the whole field. Concepts are nodes positioned
by essentiality layer — foundations at the center, vendor-specifics at the rim (the
taxonomy made visible). Edges are typed: prerequisite (solid), related (dashed), governs
(to governance nodes). The learner's progress is overlaid (completed nodes filled, next
frontier highlighted). Every node is clickable → its concept. Stubs appear as faint
"future territory," so the map shows the whole plan, not just what's written.

**Interactions:**

- **Zoom & pan** from the whole field down to a neighborhood.
- **Hover/focus a node:** title, one-liner, status, estimated time, prerequisites, "you
  are here" relative to your progress, and quick links (lesson · build · evidence).
- **One control — "Show my path":** a single toggle that highlights your recommended
  frontier vs. showing the whole map. That is the *only* control (Principle 0 / §3A):
  layer is already encoded by center→rim position and status by node fill, so filtering
  them again would be redundant chrome. The progress overlay (completed / in-progress /
  not-started / needs-review) is always on, using shape and fill, never color alone.

**Technical stance (respects ADR-0004).** Use the existing D3-as-math approach for layout
(force/radial), React for rendering the SVG, and the scene/renderer split so the graph is
data-driven and testable. **No React Flow, no Three.js** — the existing primitives and D3
math cover this; a 3D version stays a Phase-3 option behind its own ADR. The graph must
render a **static first frame** (a pre-computed layout snapshot, server-rendered) before
hydration, so the home page stays fast and works without JS (falling back to the
`/concepts` list).

**Why it's the signature:** it is the one thing that is simultaneously beautiful, useful,
and unique — it turns "a list of docs" into "a territory you explore," it makes the
essentiality taxonomy legible at a glance, and it is the natural home for progress. It is
also *already latent in the data* — the cheapest path to the biggest wow.

---

## 10. Concept Pages

The current concept page is genuinely strong — verdict box, nine canonical sections,
separated relationships, governance, interview disclosure, sources, evidence. But it is
**long, dense, and top-loaded with metadata**, with no in-page orientation. Improvements,
in priority order:

**Structure & orientation (one orientation device — Principle 0 / §3A):**

- **Lesson header:** title, one-liner, essentiality badge, status, **estimated time**,
  **difficulty band**, and 2–3 **learning objectives** ("after this you can…") — the one
  "what will I learn / how long" block at the top.
- **A single sticky "on this page" rail** (desktop) / collapsible sheet (mobile): the
  nine sections + evidence + interview, with scroll-spy and a read-progress bar. This is
  *the* orientation device — not a second thing alongside a separate takeaways block.
- **Key takeaways** appear as the **closing recap** (3 bullets at the end), not a second
  top-of-page block — the top makes the promise, the end confirms it.
- **Visualization placement:** keep visualizations inline at the point of "how does it
  work," which is already correct. A "focus mode" that expands a playground to full width
  is a *maybe* — added only if learners struggle with the inline size, not by default.
- **Mental model** callout styled as a signature element (it's a differentiator), with the
  "where the analogy breaks" line always visible.

**New/strengthened sections (mostly already present, to be made consistent surfaces):**

- **Common mistakes / misconceptions** — already in some lessons; make it a first-class,
  consistently-styled section.
- **Evidence** — already present; elevate to a visually distinct, badge-driven block
  (measured / scripted / theory chips).
- **Build project** link — surface as a prominent card, not a prose link.
- **Interview** — keep the `<details>` disclosure (zero-JS, attempt-before-reveal) but
  give it a clearer "practice these" framing and a link into `/interview`.
- **Related / prerequisites** — keep the separation; add "what this unlocks" (reverse
  edges) so the learner sees where the concept leads.
- **Repository links** — consistent "see the code" affordances (already in the
  build-it-then-own-it sections).

**Footer of every concept:** one primary action — **"Mark complete"** (which auto-enrolls
the concept in review) — plus a quiet "Next in your path" link. No separate
add-to-review/bookmark buttons (Principle 0 / §3A); saving lives in one place (§14).

**Do not reorder the nine canonical sections** — the problem-first order is pedagogically
load-bearing and CI-enforced. This is about *chrome and orientation around* the sections,
not the sections themselves.

---

## 11. Evidence Lab (`/lab`)

The experiment viewer exists (`/experiments`) but is a flat list of result pages. Elevate
it into the **Research Lab** the vision promises — the browsable evidence base that no
competitor has.

**Surfaces:**

- **Lab home:** the experiments as a gallery with **one primary filter — by concept**
  (how learners arrive: "evidence for X"), each card showing the question, the headline
  observation, and provenance. Provider/outcome/measured facets are added only once
  multi-provider data makes them meaningful (Principle 0 / §3A — don't build four facets
  for five experiments). A "latest evidence" strip feeds the home page.
- **Experiment page:** keep the trace viewer; add a structured **summary header**
  (question · method · result · limitations · provenance) and the machine-readable
  metrics as compact stat tiles (latency, tokens, cost, outcome distribution).
- **Comparison view (the differentiator, phased):** compare the *same task across
  providers/models/temperatures/prompt styles* — latency, tokens, cost, tool behavior,
  failure rate, side by side. This is the "model comparison / provider comparison"
  the brief wants; it becomes powerful once more live rows are run (currently one
  provider). Ship the framework first; the comparison surface grows with the data.
- **Confidence & replicability, honestly:** every experiment shows sample size,
  determinism (temp 0 vs sampled), date, and a prominent limitations block. The Lab's
  credibility comes from *stating what it cannot conclude.* No marketing charts.
- **Version/timeline:** experiments are versioned and dated; show when evidence was
  gathered and flag when a lesson's cited evidence is stale (ties to `needs-update`).

**This is the user's priority #3 (experiment dashboard).** I agree it's high value — but
§17 argues it comes *after* the shell, because a dashboard with no navigation around it
serves no one, and its comparison power is thin until more live rows exist (a
user-dependent, budgeted activity).

---

## 12. Interview Platform (`/interview`)

The interview bank (20 questions) is currently only visible inline on concept pages via
`<details>`. It deserves a destination. **But the brief's full ask — mock interviews,
adaptive questions, scoring, coding, behavioral — is a second product**, and building it
prematurely risks diluting the core. I recommend a phased platform.

**Phase A (V1 — drill & review, local-first):**

- **Role tracks:** filtered views of the bank by role (engineer / architect / consultant
  / governance / product) — the schema already carries `roles`.
- **Drill mode:** one question at a time, attempt-before-reveal, self-grade with **two
  buttons — "Again / Got it"** (Principle 0 / §3A). The scheduler retains a finer-grade
  capability internally, but the default UI is two buttons; the 4-grade option is the
  mandate's evidence carve-out and is added only if usage shows learners want it.
- **Tiered answers:** 30-second / two-minute / deep, revealed progressively — already the
  content model.
- **Whiteboard prompts:** the deep/system-design questions (already tagged `deep`)
  presented as "explain this on a whiteboard" with a scratch area (local, ephemeral).
- **Weakness tracking:** which concepts you grade poorly on → surfaced as knowledge gaps
  in `/learn` and review nudges. Local, deterministic.
- **Spaced repetition:** the SM-2 module already planned (pure, testable) schedules review
  — "due today" queue on the interview home.

**Phase B (post-1.0, needs a decision):**

- **Adaptive questioning, scoring, mock interviews, coding challenges.** These need either
  a model in the loop (auto-grading — a live-model feature, keys, cost, an ADR) or a
  backend (session state, coding sandbox). They are genuinely valuable but they are a
  *product bet*, not a lesson. Defer until the Academy is strong and decide deliberately.

**Honest challenge:** don't let the interview platform's ambition outrun the content. A
role track over 60 well-written questions with drill + spaced repetition beats a
half-working "AI mock interviewer" for P3 every time. Depth of question bank first.

---

## 13. Projects (`/build`)

Build projects are referenced in lesson prose ("the L0 build project is the tokenizer")
but have **no surface**. Make them first-class — this is a major differentiator for P2/P3
("something you can confidently explain in an interview," per the plan's own goal).

- **Build index:** the per-layer projects (tokenizer, structured-output extractor, mini
  retrieval engine, hand-written agent loop, two-agent orchestration, eval harness,
  documentation pack) as a portfolio.
- **Project page:** what it demonstrates, the concept it anchors, links to the actual repo
  code, the experiment that exercised it (where one exists), and the interview questions
  it prepares you for. Every concept ↔ project ↔ code ↔ experiment ↔ interview link the
  plan's §3 promises becomes navigable.
- **"Discuss this in an interview":** a framing that turns each project into interview
  ammunition (the 30s/2min/deep story about code you understand).

This closes the loop the whole platform is built around: *learn → build → measure →
explain → govern.*

---

## 14. Progress System (`/you`) — reconciled with ADR-0003

Everything user-state is **local-first** (localStorage/IndexedDB, versioned, Zod-validated,
export/import) per ADR-0003. This constrains what's possible and that's a feature (privacy,
no accounts). The brief lists profile, streaks, review reminders, cross-device — some of
which need a backend. Here's the honest reconciliation:

**Buildable now (local-first, no backend) — kept deliberately small (Principle 0 / §3A):**

- Lesson completion, per-concept state, mastery signals.
- **Two capture mechanisms only: bookmark a concept, and one note per concept.**
  Highlights are cut (high interaction cost, marginal value); the "personal glossary" is
  cut in favor of auto-surfacing saved terms from the existing glossary collection.
- Drill history + spaced-repetition schedule.
- Suggested next / knowledge gaps / review-due (all deterministic over local state).
- A quiet, opt-in activity streak.
- **Export / import** the whole progress file (backup + manual device transfer).
- **No settings panel:** the only preference is the theme toggle (OS-following by
  default). Every default should be the right one.

**Needs a backend → a new ADR before building (ADR-0003 revisit trigger):**

- Cross-device sync, accounts, social/leaderboards, server-side reminders (email/push),
  cloud notes. The implementation plan already broadened the backend trigger to "a
  concrete server-side requirement"; cross-device sync is exactly that. When a real user
  demands it, write the ADR and add the smallest sync endpoint — not before.

**`/you` surface:** a dashboard of your journey (completion by layer), your review queue,
your notes/bookmarks/glossary, and prominent **export/import**. No vanity metrics.

**Design caution:** progress must degrade gracefully — corrupt/absent state shows "no
progress recorded," never a broken page (already the ADR-0003 rule). And progress is
*encouragement, not pressure*: no red streak counters, no "you're behind."

---

## 15. Search (`/search` + ⌘K)

There is no search today. It is table-stakes for a dense product and P2's primary tool.
The implementation plan already specifies **Pagefind** (build-time index, zero server) —
the right choice; keep it.

- **Command palette (⌘K):** instant fuzzy nav to any concept, experiment, question, or
  project. Client-side over a small prebuilt index. This is the fast path.
- **Full search page:** full-text across concepts, experiments, governance, interview
  questions, source references, and project descriptions, with facet filters (type,
  layer, status). Pagefind indexes the built HTML, so it covers rendered content for free.
- **Result design:** typed results (concept / experiment / question / project / source)
  with the essentiality badge and a snippet; keyboard-navigable.
- **Zero-server, zero-JS-until-invoked:** the index is static; the palette hydrates on
  first invocation. Respects the performance and CSP posture.

---

## 16. Visual & Interaction System

The current visual language is **functional but not yet a product design system**:
Tailwind defaults, a slate palette, system fonts, the `--viz-*` semantic variables (good,
but scoped to visualizations), no dark mode, no typographic scale, no motion system, no
brand. VISUAL_LANGUAGE.md is a strong foundation for *diagrams* — this section extends it
to the *product*.

**Design tokens (new, single source of truth):**

- **Color:** a semantic token layer (`--surface`, `--text`, `--muted`, `--border`,
  `--accent`, plus the existing `--viz-*`), defined for **light and dark** themes. Dark
  mode is expected by this audience and the viz layer is already partly theme-aware.
  Maintain AA contrast; never signal state by color alone (already the rule).
- **Typography:** a real type scale and a chosen typeface pairing — a clean sans for UI
  (Inter-like) and a readable mono for code/tokens (already implied by the token viz).
  Self-hosted to respect the strict CSP (no third-party font CDNs). A comfortable reading
  measure (~66ch) for lesson prose.
- **Spacing & layout:** an 8px spacing scale, a consistent max-width for reading, a card
  system with one elevation vocabulary, and a grid that reflows to mobile.
- **Components:** a documented set — badges (status, essentiality, provenance), cards,
  callouts (mental model, evidence, warning), stat tiles, the Stepper (exists), buttons,
  the command palette, the nav. Consolidate the ad-hoc styles now scattered across
  components.

**Motion & micro-interactions (restrained):**

- Motion communicates state transitions only (the existing `appear/flow/highlight/step`
  vocabulary), never decoration. Page transitions subtle; the Atlas graph gets the most
  motion budget (zoom, focus). All motion respects `prefers-reduced-motion` (already the
  rule) — reduced-motion *removes*, never slows.
- Micro-interactions: hover reveals on graph nodes, scroll-spy on the concept rail,
  command-palette open/close, "marked complete" acknowledgement (a checkmark, not
  confetti).
- **Do not add Framer Motion** unless a specific interaction proves CSS insufficient
  (ADR-0004 stance). The graph may justify a small animation helper; decide per-need.

**Design principles for the system:** consistent, calm, legible, theme-aware, fast,
accessible. Every new component ships in both themes, keyboard-operable, with a
reduced-motion story.

---

## 17. Roadmap, Priorities, and a Challenge to Current Priorities

**The current priority order (build the experiment dashboard next, then more concepts) is
wrong for where the product is.** Here is the challenge and the recommended reorder.

The content is at Phase 2 maturity; the shell is at Phase 0. A visitor cannot navigate,
discover, orient, track, or search. Building the experiment dashboard or concept #8 adds
value only reachable by URL. **The shell is the multiplier on everything already built.**

**Recommended phase order (each phase is shippable and independently valuable):**

- **Phase 1A — Foundations of the shell (this plan's approval → first build phase).**
  Global navigation + command palette scaffold, the design-token system + dark mode, the
  real home page (hero + three proofs + modes), and deprecating `/viz-demo`. *Outcome:*
  the existing content becomes navigable and the product has a face.
- **Phase 1B — The signature Atlas + Learn path + progress.** The interactive graph on the
  home page, the `/learn` journey, and local-first progress (completion, next-step,
  bookmarks, notes). *Outcome:* the "living map" and a guided journey; the product feels
  like a product.
- **Phase 1C — Search + Concept-page upgrade.** Pagefind + ⌘K search; the concept-page
  chrome (sticky rail, objectives, key takeaways, consistent sections). *Outcome:* fast
  access and orientation; P2 is served.
- **Phase 1D — Evidence Lab + Build/Projects surfaces.** `/lab` gallery + comparison
  scaffold; `/build` project portfolio. *Outcome:* the research-notebook and portfolio
  differentiators are live. (This is where the user's priority #3 lands — correctly, after
  the shell.)
- **Phase 1E — Interview Platform (Phase A) + Governance surface.** `/interview` drill +
  review + role tracks + spaced repetition; `/governance` framework pages + mapping
  matrix. *Outcome:* P3 and P4 are served.
- **Phase 2 — Resume curriculum inside the product.** Now widen content (embeddings →
  attention → RAG → evaluation → memory → planning → agents → multi-agent → production)
  *inside* a product that does each lesson justice, running live experiments as evidence
  per the established methodology. Interview Platform Phase B and any backend features get
  their own ADRs here.

**Parallelizable, low-cost, high-trust:** the `/roadmap` page (surfacing content health —
we already have the data) can ship in 1A as a transparency win.

**What this reorders:** it inserts the entire shell (1A–1C) *before* the experiment
dashboard (1D) and *before* more concepts (Phase 2). It does not throw away any work — it
makes all of it reachable.

---

## 18. Critique — Specific Weaknesses in the Current Repository

Honest, concrete, grounded in the code as it is today.

**Unfinished / missing (highest impact first):**

- **Home page is a placeholder.** The product has no front door.
- **No navigation anywhere.** `Base.astro` has no header/footer/nav. Pages are orphans.
- **The signature Atlas graph is unbuilt.** `graph.json` has no consumer — the plan's
  headline surface doesn't exist as UI.
- **No search, no progress UI, no `/learn`, no `/interview`, no `/build`, no `/governance`
  surface.** All designed in the plan, none built.
- **No dark mode, no design tokens, no type system.** Visuals are functional, not product.
- **Mobile is untested.** Layouts use responsive utilities but no surface has been designed
  mobile-first; the concept pages' density and the future graph are mobile risks.

**Confusing / friction:**

- **Concept pages are long and top-loaded** with metadata before the learner knows what
  they'll get (no objectives, no reading time, no takeaways, no in-page nav).
- **Interview content is buried** inside concept `<details>` with no destination or
  practice mode.
- **Evidence is powerful but under-presented** — a flat list of experiment pages, no
  gallery, no comparison, no "latest evidence" heartbeat.

**Redundant / should change:**

- **`/viz-demo`** is superseded by real lessons — deprecate.
- **`/playgrounds` as a planned separate surface** — drop; playgrounds live in lessons.
- **Governance is two stub pages** — either build the `/governance` surface properly in
  1E or keep it out of the public nav until it's real (don't ship half-built).

**What to merge:** the two orientations (Atlas + Path) share one content set — keep them
as views, not duplicated data (already the architecture). Search and the command palette
are one capability with two surfaces — build once.

**What to postpone (and say so):** the Interview Platform's adaptive/scoring/mock features
(Phase B, needs a model-in-loop or backend + an ADR); a 3D atlas (Phase 3, own ADR);
cross-device sync and accounts (backend, own ADR); live model calls in the *deployed* site
(still out of scope — the Lab's evidence is pre-computed and checked in).

**What should become the signature experience:** **the interactive Atlas graph.** It's
unique, already latent in the data, simultaneously beautiful and useful, and the natural
home for progress and discovery. It is the thing worth being great at.

**A strength worth protecting explicitly:** the CI integrity + content model + evidence
methodology is a genuine moat. As we add product surfaces, *nothing* may weaken the rule
that a claim is code or measurement, that `complete` is CI-enforced, and that stubs look
unfinished. The product must not tempt us into marketing polish that outruns the evidence.

---

## 19. Accessibility

Accessibility is a requirement on every surface, extending the discipline the viz layer
already has (keyboard steppers, sr-only descriptions, reduced-motion, non-color state).

- **Keyboard:** every interactive surface fully operable — nav, command palette, graph
  (arrow-key node traversal + focus), drill mode, filters. Visible focus everywhere.
- **Screen readers:** the Atlas graph ships a **text-equivalent** (the ordered concept
  list with prerequisites — which is also the no-JS fallback); diagrams keep their
  descriptions; live regions announce state changes concisely (not chattily).
- **Contrast & color:** AA minimum in both themes; state never by color alone (shape +
  glyph + text), already the rule.
- **Reduced motion:** removes transitions, never slows; autoplay never default.
- **Structure:** one `<h1>` per page, landmarks, skip link (exists), logical heading
  order, semantic lists for relationships (already done on concept pages).
- **Testing:** axe checks in the Playwright suite for every template (already the plan's
  §14 intent); make it real across the new surfaces.

---

## 20. Mobile

Mobile is currently unaddressed and is a real risk for a dense, visualization-heavy
product. Principles:

- **Mobile-first for the shell:** nav collapses to a menu + a persistent search/command
  button; the top bar stays minimal.
- **Concept pages:** the sticky rail becomes a collapsible "on this page" sheet; prose
  reflows to a comfortable measure; playgrounds get a full-width focus mode and must be
  touch-operable (the Stepper already is).
- **The Atlas graph on mobile:** the hardest problem. Ship a **layered fallback** — a
  simplified, tappable radial or a "your path" linear view on small screens, with the full
  zoomable graph on larger viewports. Never a pinch-to-zoom SVG that fights the browser.
- **Playgrounds & viz:** every interactive viz must be usable with touch and readable at
  360px; horizontal scroll is contained (already the artifact rule for wide content).
- **Performance:** mobile makes the zero-JS-first posture matter more; keep hydration
  minimal and lazy.

---

## 21. Content-Model & Architecture Changes Required (small, justified)

The product needs a few additive content-model fields. All are optional/additive,
CI-checked, versioned (bump `CONTENT_SCHEMA_VERSION`, log in DECISIONS.md) — consistent
with how the model has evolved (v1→v2 already):

- `estimatedMinutes` on concepts (reading + interactive) — powers durations in Learn/Atlas.
- `learningObjectives: string[]` on concepts — powers the "what you'll learn" header.
- `keyTakeaways: string[]` on concepts — powers the top-of-page gist.
- A `difficultyBand` derivation (from layer, deterministic — no new field needed).
- Build projects likely need a small **`projects` collection** (or frontmatter) so `/build`
  is data-driven, not prose-scraped — the cleanest way to make concept↔project↔code↔
  experiment↔interview links machine-checkable.
- Governance mapping matrix is already derivable from `appliesTo` frontmatter — the
  `/governance` surface renders it; no model change.

No changes to the nine canonical sections, the essentiality taxonomy, the graph rules, or
the ADRs are required by this plan. The only ADR-adjacent items are the *future* backend
triggers (sync, accounts, auto-grading), each of which gets its own ADR when a concrete
requirement appears — exactly as ADR-0003 prescribes.

---

## 22. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Shell work stalls content momentum** | Med | Med | Phases 1A–1E are each shippable in ~days; resume curriculum in Phase 2. The shell is a one-time multiplier. |
| **Scope creep in the Interview Platform** | High | High | Ship Phase A only (drill/review/tracks/SRS); Phase B needs its own decision + ADR. Depth of bank over feature count. |
| **Gamification cheapens the brand** | Med | High | Mastery signals, not points/streaks; restraint is a design principle (§3, §8). |
| **The Atlas graph is hard on mobile** | High | Med | Layered fallback (§20); text-equivalent is also the a11y + no-JS path. |
| **Design system drift** | Med | Med | Tokens as single source of truth (§16); every component ships both themes + a11y. |
| **Evidence over-generalized as product grows** | Med | High | The measured/scripted/theory chips are enforced UI; limitations always shown; CI gates unchanged. |
| **Performance regresses as JS grows** | Med | Med | Zero-JS-first stays a rule; the e2e "content pages ship 0 JS" test stays green; graph is the one heavy island. |
| **Backend creep** | Low | High | ADR-0003 discipline; each server feature needs a concrete requirement + ADR. |
| **Single-maintainer bandwidth** | High | Med | Ship in thin vertical slices; the shell makes every future concept cheaper to surface. |

---

## 23. Definition of Done — the release ladder

Four honest release bars. Each is a coherent product a real person could use, not a
feature checklist.

### Alpha (internal — "navigable and coherent")
*The existing content becomes a real product for the maintainer to dogfood.*
- Global nav + footer on every page; `/viz-demo` deprecated.
- Design tokens + dark mode; typography and spacing system applied to existing pages.
- Real home page (hero + three proofs + modes + entry points) — no graph yet, a static
  map placeholder acceptable.
- `/roadmap` shows content health.
- All existing lessons reachable via nav; zero-JS-first and CSP intact; a11y green.
- **Bar:** a stranger can land, understand what Atlas is, and reach any lesson without a URL.

### Private Beta (invited learners — "guided and trackable")
*A first cohort (P1/P2) can actually learn a path.*
- The interactive **Atlas graph** live on the home page (with static + text fallbacks).
- `/learn` journey with per-concept state, estimated time, suggested next.
- Local-first **progress** (completion, bookmarks, notes, export/import) via `/you`.
- Concept-page upgrade (objectives, key takeaways, sticky rail, consistent sections).
- Search + ⌘K over concepts.
- Mobile: shell + concept pages usable; graph has a mobile fallback.
- **Bar:** a career-switcher completes L0–L2, tracks progress, and always knows the next step.

### Public Beta (open — "credible, searchable, evidenced")
*Anyone can arrive and trust it.*
- Full search across all content types.
- **Evidence Lab** gallery + experiment pages with summary headers + limitations; "latest
  evidence" on home. Comparison scaffold (grows with live runs).
- **`/build`** project portfolio with concept↔code↔experiment↔interview links.
- **`/interview`** Phase A: role tracks, drill, tiered answers, spaced repetition, weakness
  tracking.
- `/governance` surface: framework pages + concept×regulation matrix (built, not stubs).
- Accessibility audited across all surfaces; mobile designed, not just responsive.
- Deployed publicly (Cloudflare Pages — the pending user action) with previews.
- **Bar:** all four learner personas (P1–P4) are served end-to-end; every claim traces to
  code or measurement.

### Version 1.0 ("the definitive first-principles AI engineering academy")
*The product the mission describes.*
- Curriculum coverage through the core spine (L0–L4 complete, L5–L6 substantially there),
  each concept with a visualization, a build project, an interview package, and — where
  run — live evidence.
- The Atlas graph is the signature experience: beautiful, fast, accessible, mobile-viable,
  the home of progress and discovery.
- Interview Platform Phase A proven; Phase B decided (built or explicitly deferred with an
  ADR).
- Evidence Lab with multi-provider comparisons (dependent on live runs the maintainer
  chooses to fund).
- Consistent design system, dark mode, motion, accessibility, and mobile across every
  surface.
- Performance budget held: content pages zero-JS, strict CSP, fast on mobile.
- **Bar:** someone can go from "I know almost nothing" to "I can explain, build, evaluate,
  experiment with, and govern production AI systems" — inside one elegant, fast,
  trustworthy product — and the product can prove, for any claim, that it's code or
  measurement.

---

## 24. What I Recommend We Do First (on approval)

Not code — the first *decisions* to lock before Phase 1A:

0. **Ratify the Simplicity Mandate as the overriding design law** (§3 Principle 0, §3A) —
   one obvious interaction over three configurable ones; cut features that must be
   explained; simplicity beats feature count absent clear learning evidence. This is now
   the tie-breaker for every surface below.
1. **Approve the priority reorder** (shell before dashboard/curriculum) — §17.
2. **Approve the brand stance** (Stripe/Linear restraint; mastery signals over
   gamification) — §3, §8.
3. **Approve the IA and nav** (seven destinations, ⌘K, `/lab` rename, drop `/playgrounds`,
   deprecate `/viz-demo`) — §5, §6.
4. **Confirm the signature bet** (the Atlas graph as the signature experience) — §9.
5. **Confirm local-first scope** (progress local-only; sync/accounts/auto-grading each
   need their own ADR later) — §14.

Then Phase 1A begins with navigation, tokens/dark mode, and the home page — the shell that
turns everything already built into a product.

---

*This plan changes no approved architecture, ADR, or the nine canonical sections. It adds
a product around a foundation that is stronger than its current surface reveals. The work
is not to build more; it is to make what exists reachable, navigable, discoverable, and
delightful — and only then to widen the curriculum inside a product worthy of the content.*
