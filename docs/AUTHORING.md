# Authoring Guide

How to write Agent Atlas content that teaches — and that builds, validates, and stays
maintainable. Part 1 is how to think; Part 2 is the mechanics the validator enforces.
Run `npm run validate` before committing content.

---

## Part 1 — How to think about a concept

### Start from the problem, not the thing

Every concept page walks the reader through a *history of pressure*: something hurt,
someone invented a fix, the fix has costs. That's why the nine canonical questions are
ordered the way they are — problem → invention → mechanism → judgment. If you find
yourself opening with a definition, stop and ask: *what broke before this existed?*
A reader who knows the pressure can re-derive the invention; a reader who memorized the
definition cannot.

### One mental model per concept

Give the reader a single, honest anchor image early (tokens → Lego bricks; embeddings →
coordinates in meaning space; RAG → open-book exam; agents → a manager that thinks,
observes, acts, decides — see docs/EXECUTION_PROTOCOL.md). Convention: a blockquote
right after the intro paragraph, before "What problem existed before this?":

```md
> **Mental model:** …one or two sentences. Then one sentence on where the analogy breaks —
> every analogy breaks, and saying where is what keeps it honest.
```

### Manage cognitive load deliberately

- One new idea per section. If a section teaches two things, split or cut.
- Concrete before abstract: show a real token split before defining BPE.
- The visualization carries the mechanism; the prose carries the judgment. Don't
  narrate the visual in prose — let it be watched (steppable, scrubbable).
- Short sentences for load-bearing claims. Complexity budget goes to the *idea*, not
  the prose.
- Progressive depth is structural: oneLiner → mental model → sections → deep interview
  answers. A reader can stop at any level and leave with something true.

### Be honest, per the platform's own rules

Always distinguish "would I recommend this in production?" from "would I recommend
this for learning?" — the answers often differ; say so explicitly. The verdict box
exists for this judgment: fill it like a skeptical senior engineer, not a fan. Never
add hype-driven content; fashionable things enter at the rim
(`framework-abstraction` / `vendor-specific`) and earn their way inward.

### Write for both audiences at once

The beginner needs *why this exists*; the experienced engineer needs *when it fails and
what it costs*. The template forces both (problem/invention sections vs
trade-offs/avoid sections). If a section only serves one audience, the tiering is off.

### The completeness self-check

Before marking anything `complete`, run the learning review (EXECUTION_PROTOCOL.md):
after studying this page, can the reader explain it simply · explain why it exists ·
say when NOT to use it · build a minimal implementation · answer interview questions ·
state governance implications · connect it to prior concepts? The validator checks the
structure; only you can check the substance.

---

## Part 2 — Mechanics (what the validator enforces)

### Identifiers and URLs

- An entry's **id is its filename** (kebab-case, no extension): `context-windows.mdx`
  → `/concepts/context-windows`. Layer subfolders organize files **without changing
  ids or URLs**; basenames must be unique repo-wide. Never put an id/slug in
  frontmatter — there is no second slug source.
- Every cross-reference (`prerequisites`, `related`, `governance`, `sources`,
  interview `concepts`, governance `appliesTo`, source `routedTo`) is a filename id;
  the validator checks existence *and* the right collection (docs/GRAPH.md).

### Status semantics

| Status | Meaning | Template lint |
|---|---|---|
| `stub` | Planned territory: metadata + a "will cover" note. On the atlas deliberately. | not linted |
| `draft` | Real content in progress; partial sections allowed. | not linted |
| `complete` | Meets the full Definition of Done below. | fully linted |
| `needs-update` | Previously complete; intake flagged it (`needsUpdateReason` required). Structure still linted — the status flags freshness, not structure. | fully linted |

Stubs need only `title`, `layer`, `oneLiner`, `status`, `updated` + sensible
relationships, and must look intentionally incomplete, never broken.

### Definition of Done for `complete` (plan §19; codes in docs/GRAPH.md + template.ts)

1. **Nine canonical sections** as level-2+ headings, exact wording (normalized only
   for case/whitespace/trailing punctuation), defined in `src/lib/content/model.ts`:

   ```md
   ## What problem existed before this?
   ## Why was this invented?
   ## How does it work?
   ## Is it actually necessary?
   ## What are the trade-offs?
   ## What complexity does it introduce?
   ## What simpler alternative exists?
   ## When should I use it?
   ## When should I avoid it?
   ```

2. **Structured verdict** in frontmatter — classification (`essential` …
   `vendor-specific`), `problem`, `simplerBaseline`, `mainCost`.
3. **≥1 visualization**: import a component from `src/components/viz/`. Static
   server-rendered usage ships zero JS; add `client:visible` only for interaction;
   `core-mechanism` concepts get a steppable Tier-2 visual (ADR-0004).
4. **Governance hooks declared, even if "none"**: link frameworks in `governance:` OR
   justify absence in `governanceNotApplicable:` (mutually exclusive). Links mean
   *potential relevance* — pages never claim a law applies.
5. **Six-element interview package**, collective across linked questions: ≥3 questions
   (each already carries the 30-second/two-minute tiers) · ≥1 with `followUps` · ≥1
   `criticalThinking: true` (the "when would you NOT use this?" question) · ≥1
   `practicalExample` (working code in this repo) · ≥1 `governanceAngle`.
6. **Prerequisites at least `draft`** (graph rule).

### Interview questions

One YAML per question in `src/content/interview/`; all three answer tiers required and
real (no stubs). Write the `beginner` tier as the actual 30-second spoken answer, not a
summary of one. A question may serve several concepts via `concepts:`.

### Resolving validation errors

Findings group as SCHEMA → GRAPH → TEMPLATE → warnings; fix top-down; every finding
carries a `fix:` line. Never silence a finding by weakening content — no artificial
links for orphan warnings, no downgrading `complete` to dodge a section you could
write.

### `.astro` vs React (ADR-0001/0004/0005)

Page structure and content presentation → `.astro` (zero JS). Interactive behavior →
React islands in `src/components/viz/` rendering scene data from `src/lib/viz/`
(educational logic lives in the pure layer, never in components — see
docs/VISUAL_LANGUAGE.md). Educational prose lives in MDX, never inside React
components. Agent/model mechanics → plain TS in `src/lib/` (ADR-0005).

### Fixture labeling

Anything that isn't finished educational content carries a visible fixture note
(blockquote at the top of the body). Current fixtures: tokens (draft), context-windows
(complete), few-shot-prompting (needs-update), embeddings (stub).
