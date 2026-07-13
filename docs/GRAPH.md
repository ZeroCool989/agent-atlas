# The Knowledge Graph

How the graph is built, validated, and consumed. Companion to plan §7 (fail/warn scope)
and §14 (testing). Code: `src/lib/graph/` (pure core) + `scripts/validate-content.ts`
(adapter + CLI). Run it with `npm run validate`.

## Structure

The graph is **derived, never hand-drawn**: the validator reads every content entry and
emits nodes and typed edges.

- **Nodes** — one per entry in every collection: `{ collection, id, label, layer?, status? }`
  (`layer`/`status` only on concepts). An entry's id is its filename (kebab-case, no
  extension, flat across subfolders).
- **Edges** — one per declared reference, with full provenance
  `{ type, from: {collection, id}, field, to: {collection, id} }`. The edge types are
  exactly the reference fields in the approved schemas:

| Type | Declared by | Field | Must resolve in |
|---|---|---|---|
| `prerequisite` | concept | `prerequisites` | concepts |
| `related` | concept | `related` | concepts |
| `governed-by` | concept | `governance` | governance |
| `cites-source` | concept | `sources` | sources |
| `assesses` | interview question | `concepts` | concepts |
| `applies-to` | governance framework | `appliesTo` | concepts |
| `routed-to` | source | `routedTo` | concepts |

Glossary entries are nodes only — the approved schema gives them no reference fields.

References are **collection-aware**: a prerequisite must resolve to a *concept*; the
same string existing as a glossary term does not count (that's `GRAPH_WRONG_TARGET_TYPE`).

## Diagnostic codes

Every finding carries a stable code, severity, the entry to edit, the field/target where
applicable, a message, and a suggested remediation.

| Code | Severity | Meaning |
|---|---|---|
| `GRAPH_DANGLING_REFERENCE` | error | Referenced id exists in no collection. Create the target (a stub is fine) or remove the reference. |
| `GRAPH_WRONG_TARGET_TYPE` | error | Referenced id exists, but only in the wrong collection(s). Point the field at the right kind of entry. |
| `GRAPH_SELF_REFERENCE` | error | An entry lists itself in `prerequisites`/`related`. Remove it. |
| `GRAPH_PREREQUISITE_CYCLE` | error | Prerequisites form a loop; the finding includes the full path (e.g. `a → b → c → a`). Remove the edge pointing "backwards" to the more advanced concept. |
| `GRAPH_COMPLETE_REQUIRES_INCOMPLETE_PREREQUISITE` | error | A `complete` concept has a `stub` prerequisite. Per plan §19 prerequisites must be **at least `draft`** — `draft`, `complete`, and `needs-update` are all acceptable; only `stub` is not. Write the prerequisite up to `draft`, or downgrade the concept. |
| `GRAPH_DUPLICATE_REFERENCE` | warning | The same id is listed twice in one field. Delete the repeat. |
| `GRAPH_ORPHAN_CONCEPT` | warning | See orphan semantics below. |

Entry-local rules (identifier format, enums, dates, undispositioned sources) are enforced
by the Zod schemas — the CLI re-runs those same schemas and reports violations as
`SCHEMA FAILURES` before graph checks. Duplicate ids are rejected by Astro's loader (and
defensively by the CLI adapter).

## Orphan semantics (warnings, never failures)

An orphan is a **concept touched by no edge of any type, in either direction**: no
prerequisite/related links (in or out), no interview question assessing it, no governance
framework applying to it, and no source citing/routed to it.

Deliberately *not* orphans: foundational concepts with no prerequisites (normal — they
sit at the center of the atlas) as long as anything else touches them, and non-concept
entries (a not-yet-routed source is governed by the intake rule, not orphanhood).

Orphans are a curation report: CI passes while displaying them. **Never add an artificial
link to silence the warning** (plan §7 — referential integrity is enforced; topology is
curated). There is no exemption mechanism by design; if a legitimate long-lived orphan
class ever appears, add one via a documented decision, not ad hoc.

## The `graph.json` artifact

- **Generated, never edited.** `npm run validate` writes it to `src/generated/graph.json`
  (gitignored) only when there are no failures.
- **Deterministic**: nodes and edges are codepoint-sorted, key order is fixed, and the
  file contains no timestamps or environment-dependent values. Unchanged content ⇒
  byte-identical output (unit- and CLI-tested).
- It embeds `contentSchemaVersion` so consumers can detect model changes.
- **Not committed**: it derives entirely from content, so committing it would create a
  second source of truth that CI would have to police. CI (P0.7) runs `npm run validate`
  before `astro build`; future consumers (the Atlas island, mini-maps) import the fresh
  artifact at build time.

## Resolving findings (author guide)

1. Run `npm run validate`. Findings are grouped by entry; each line shows
   `[CODE] field → "target": message` plus a `fix:` suggestion.
2. Fix **schema failures first** — graph checks only run on schema-valid content.
3. For dangling references while drafting: create a stub target
   (`status: stub` with title/layer/oneLiner) rather than deleting your reference — the
   atlas is allowed to show unwritten territory.
4. Warnings don't block; clear them when the content matures.

## Architecture note

`src/lib/graph/` is pure TypeScript (no Astro/React/filesystem/YAML imports): it accepts
normalized entries and returns findings as data. The single narrow adapter that reads
files lives in `scripts/validate-content.ts` and reuses `src/content.schemas.ts` and
`flatEntryId` — parsing is adapter code, but validation rules and identifiers have
exactly one definition each. (Astro's content layer can't be cleanly invoked from a
standalone script; this trade-off is recorded in DECISIONS.md.)
