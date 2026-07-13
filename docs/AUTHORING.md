# Authoring Guide

How to write Agent Atlas content that builds, validates, and teaches. Companion to the
content model (plan §6, `src/content.schemas.ts`), the graph rules (docs/GRAPH.md), and
the visual system (docs/VISUAL_LANGUAGE.md). Everything here is enforced by
`npm run validate` — run it before committing content.

## Identifiers and URLs

- An entry's **id is its filename** (kebab-case, no extension): `context-windows.mdx`
  → id `context-windows` → public URL `/concepts/context-windows`.
- Layer subfolders (`concepts/foundation/…`) organize files **without changing ids or
  URLs** — ids are flat, so basenames must be unique across all subfolders (collisions
  fail the build). There is no second slug source: never put an id/slug in frontmatter.
- Every cross-reference (`prerequisites`, `related`, `governance`, `sources`,
  interview `concepts`, governance `appliesTo`, source `routedTo`) is one of these
  filename ids; the validator checks existence and the right collection.

## Concept status semantics

| Status | Meaning | Template lint |
|---|---|---|
| `stub` | Planned territory: metadata + a short "will cover" note. Appears on the atlas deliberately. | not linted |
| `draft` | Real content in progress; may have partial canonical sections. | not linted |
| `complete` | Meets the full Definition of Done below. | fully linted |
| `needs-update` | Previously complete; intake flagged it (`needsUpdateReason` required). Structural completeness still applies — the status flags freshness, not structure. | fully linted |

A stub needs only: `title`, `layer`, `oneLiner`, `status`, `updated`, and whatever
relationships already make sense. Make stubs look intentionally incomplete (a "will
cover" blockquote), never broken.

## Definition of Done for `complete` (plan §19)

`npm run validate` enforces every item; codes in parentheses.

1. **All nine canonical sections** as level-2+ headings with EXACT wording
   (`TEMPLATE_MISSING_REQUIRED_SECTION`). Matching normalizes case, whitespace, and
   trailing punctuation — nothing else. The nine (from plan §2, defined in
   `src/lib/content/model.ts` as `CANONICAL_SECTIONS`):

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

2. **Structured verdict** in frontmatter (`TEMPLATE_COMPLETE_MISSING_VERDICT`):

   ```yaml
   verdict:
     classification: essential | commonly-useful | situational | advanced | framework-specific | vendor-specific
     problem: "…"           # the problem it addresses
     simplerBaseline: "…"   # what you'd do without it
     mainCost: "…"          # the main cost of adopting it
   ```

3. **≥1 visualization** (`TEMPLATE_COMPLETE_MISSING_VISUALIZATION`): the body imports
   at least one component from `src/components/viz/`. A static, server-rendered usage
   (no `client:` directive) is fine and ships zero JS; add `client:visible` only when
   interaction is needed. `core-mechanism` concepts should use a steppable (Tier-2)
   visual per ADR-0004.

4. **Governance hooks declared, even if "none"**
   (`TEMPLATE_COMPLETE_MISSING_GOVERNANCE_HOOK`): either link frameworks in
   `governance:` or justify their absence in `governanceNotApplicable: "…"` — the two
   are mutually exclusive. A link means *potential relevance*; the page wording never
   claims a law applies.

5. **The six-element interview package**, satisfied COLLECTIVELY by the questions that
   link this concept (`TEMPLATE_COMPLETE_MISSING_INTERVIEW_PACKAGE`,
   `TEMPLATE_COMPLETE_MISSING_PRACTICAL_EXAMPLE`):
   - ≥3 linked questions (each already carries the 30-second `beginner` and two-minute
     `professional` answers — schema-required);
   - ≥1 question with non-empty `followUps`;
   - ≥1 question with `criticalThinking: true` (a trade-off/judgment question,
     typically "when would you NOT use this?");
   - ≥1 question with `practicalExample` (pointing at working code in this repo);
   - ≥1 question with `governanceAngle`.

6. **Prerequisites at least `draft`** — enforced by the graph validator
   (`GRAPH_COMPLETE_REQUIRES_INCOMPLETE_PREREQUISITE`).

Not required for complete (deliberately, per plan §19): source references — but intake
provenance (plan §11) means real lessons will have them anyway.

## Relationship fields

- `prerequisites` — what must be learned first (hard graph edges; rendered as "Learn
  these first" with the target's status).
- `related` — useful connections, not required (rendered separately — never merge the
  two meanings).
- `governance` — frameworks with potential relevance (see above).
- `sources` — intake ledger entries backing the content (rendered with outbound links).
- Interview questions link concepts from their side via `concepts:` — a question can
  serve several concepts.

## Writing interview questions

One YAML file per question in `src/content/interview/`. All three answer tiers are
required and must be real answers (no stubs, plan §9). `followUps` is a required key
(may be empty for questions that genuinely have none — but each concept needs at least
one question with follow-ups). Mark judgment questions `criticalThinking: true`.

## Resolving validation errors

Run `npm run validate`. Findings are grouped: SCHEMA → GRAPH → TEMPLATE → warnings.
Fix top-down (schema errors block graph checks; graph/template failures block
`graph.json`). Every finding names the file/entry, the field or missing element, and a
`fix:` line. Never silence a finding by weakening content (e.g., an artificial link for
an orphan warning, or downgrading `complete` to dodge a missing section you could
write).

## `.astro` vs React (from ADR-0001/0004)

- Page structure, layouts, content presentation → `.astro` components (zero JS).
- Interactive behavior (steppers, playgrounds) → React islands in
  `src/components/viz/`, hydrated `client:visible`, rendering scene data from
  `src/lib/viz/` (see docs/VISUAL_LANGUAGE.md — educational logic never lives in the
  component).
- Educational prose lives in MDX, not inside React components.

## Fixture labeling

Demonstration content that isn't a finished lesson carries a visible fixture note
(blockquote at the top of the body) so it can't be mistaken for final educational
content. Current fixtures: tokens (draft), context-windows (complete),
few-shot-prompting (needs-update), embeddings (stub).
