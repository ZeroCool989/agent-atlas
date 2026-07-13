# ADR-0002: Content as Code (Git-Versioned MDX, No CMS, No Database)

- **Status:** Accepted (2026-07-13, amended: CI connectivity scope defined)
- **Date:** 2026-07-13

## Context

Agent Atlas content is unusual in three ways:

1. It is **highly structured**: every concept follows a canonical template (problem before →
   why invented → how it works → trade-offs → alternatives → when to use/avoid) and carries
   machine-readable relationships (prerequisites, related concepts, governance mappings,
   interview questions).
2. It is **continuously revised** by an AI collaborator: the knowledge-intake process means
   Claude will routinely update lessons, add cross-links, and flag contradictions. The
   editing interface must be one an agent can use safely and reviewably.
3. It **derives artifacts**: the knowledge graph, interview banks, and "needs-update" flags
   are computed from content, so content must be parseable and validatable.

Options: headless CMS (Contentful/Sanity/Payload), database-backed content (Postgres +
admin UI), or files in the repository.

## Decision

**All content lives in the Git repository as MDX/YAML files, organized into Astro Content
Collections with Zod-validated frontmatter schemas.**

- Concepts, governance pages: MDX with typed frontmatter.
- Interview questions, sources ledger, glossary: YAML/JSON data collections.
- The knowledge graph is **derived at build time** from frontmatter — never hand-maintained.
- CI enforces **referential integrity, not connectivity**. It **fails** the build on:
  schema violations; invalid or duplicate identifiers/slugs; dangling references in
  `prerequisites`, `related`, `governance`, and `sources`; prerequisite cycles;
  `complete` concepts with `stub` prerequisites; and `sources` entries with no recorded
  intake disposition. It **warns** (report only) on concepts with no edges at all —
  orphans are surfaced for curation, but CI never forces artificial links merely to make
  every node connected.

## Rationale

- **Git is the ideal editing surface for an AI collaborator.** Every intake operation
  becomes a reviewable diff. Contradiction handling, provenance, and rollback come free
  from version control. A CMS would put content behind an API that is harder to diff,
  review, and bulk-refactor.
- **Zod schemas make the content model executable.** "Every concept must declare its layer
  and prerequisites" is a build error, not a convention. This is the enforcement mechanism
  for the "no loose ends" intake rule.
- **A CMS/database solves problems we don't have**: non-technical editors, live editing,
  editorial workflow for teams. Cost: hosting, auth, API schemas, migrations, and a second
  system of record. By the project's own reality-over-hype test, it fails.
- Plain-text content outlives every framework choice; worst case, MDX files port anywhere.

## Consequences

- Content refactors (renaming a concept, changing a schema field) are repo-wide operations —
  scriptable, but they must update all referrers. CI's reference checker makes these safe.
- No web-based editing UI. Acceptable: the sole author works via editor/Claude.
- Large media (video) must not live in Git; static images/SVGs are fine, anything heavy
  goes to an asset host if ever needed.
- Revisit trigger: multiple non-technical content editors join the project.
