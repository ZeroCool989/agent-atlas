# ADR-0001: Web Framework Selection

- **Status:** Accepted (2026-07-13)
- **Date:** 2026-07-13
- **Deciders:** Almir Dumisic, Claude (architect role)

## Context

Agent Atlas is an interactive learning platform for understanding AI systems from
first principles. Its workload profile, derived from the product vision:

1. **Content-dominant.** Hundreds of lessons, interview banks, and governance pages —
   long-form structured text authored in Markdown/MDX, heavily cross-linked.
2. **Interactive islands.** Diagrams, animations, simulations, and playgrounds embedded
   *inside* content pages. Interactivity is dense in spots, not global.
3. **Single primary user (initially).** No auth, no payments, no multi-tenancy for MVP.
   Progress tracking can live client-side.
4. **A derived knowledge graph.** Cross-references between concepts must be machine-readable
   and validated at build time.
5. **Longevity.** The platform must evolve for years; the framework must not force
   rewrites when requirements grow (e.g., optional backend later).

The pre-existing `CLAUDE.md` names Next.js + Prisma + Postgres + Redis + Stripe. That file
predates any architectural decision and is treated as boilerplate, not as a constraint.

## Options Considered

### Option A: Astro 5 (+ React islands)

Content-first framework. Pages are static HTML by default; interactive components hydrate
as isolated "islands" on demand.

**Strengths**
- **Content Collections** are a near-exact match for our content model: typed collections
  of MDX/YAML entries with **Zod-validated frontmatter**, checked at build time. The
  knowledge graph (prerequisites, related concepts, governance mappings) falls out of
  frontmatter for free, with build failures on dangling references.
- **Zero JS by default.** A lesson that is 90% prose ships ~0 KB of JS; only its embedded
  simulations hydrate (`client:visible`). Best possible performance for a reading-heavy site.
- React islands mean the full React ecosystem (D3 integration, state libraries) is available
  exactly where needed.
- Static output → deploy anywhere, no server to secure or operate.
- **Escape hatch:** Astro supports server adapters and API endpoints. If a sync backend or
  auth is ever justified, it is an addition, not a migration.

**Weaknesses**
- Two component models (`.astro` for layout/content, React for islands) — a real but small
  cognitive tax.
- No React Server Components; deep app-like flows (dashboards with server mutations) would
  be more work than in Next.js.
- Smaller ecosystem than Next.js, though mature and stable (v5, large adoption for content sites).

### Option B: Next.js 15 (App Router)

Full-stack React framework.

**Strengths**
- One component model everywhere; RSC allows server-rendered content with selective
  client interactivity.
- Best choice **if** the platform needs auth, database-backed state, payments, or
  multi-user features — it is designed for application backends.
- Largest ecosystem and hiring pool.

**Weaknesses**
- The entire site is a React app: every page pays React runtime + hydration cost even when
  it is pure prose. Mitigable, but you are working against the grain.
- Content tooling is weaker: no first-class typed content layer (Contentlayer is
  unmaintained; `next-mdx-remote` / custom pipelines are DIY). We would hand-build the
  Zod-validated content system Astro ships natively.
- Higher complexity budget: caching semantics, RSC/client boundaries, App Router churn.
  Complexity spent on framework mechanics, not on lessons and visualizations.
- Full feature set is Vercel-shaped; static export disables many features.

### Option C: React + Vite (SPA)

Hand-rolled single-page application.

**Strengths**
- Maximum control; simplest mental model for a *pure* interactive app (if Agent Atlas were
  90% playground and 10% text, this would be a contender).
- Fastest dev-server iteration loop.

**Weaknesses**
- Everything content-related is DIY: routing, MDX pipeline, code-splitting per lesson,
  cross-reference validation, sitemap, SEO, prerendering. That is precisely the
  infrastructure Astro provides.
- Client-rendered content: slow first paint on long lessons, poor SEO by default.
- Highest long-term maintenance for the lowest leverage. Rejected early.

### Option D: Docusaurus 3 (the "additional option")

Purpose-built documentation/learning-site framework (React-based).

**Strengths**
- Fastest time-to-first-content: sidebar navigation, search, dark mode, MDX, i18n out of
  the box. A credible learning site exists in a day.
- Proven at scale for exactly "structured educational content" workloads.

**Weaknesses**
- Opinionated docs-site shape. Agent Atlas's signature surfaces — a graph-based atlas home,
  custom lesson templates, playground-heavy pages, an interview drill UI — fight the theme
  system ("swizzling" components is the documented but painful escape hatch).
- Whole site is a hydrated React SPA (same cost profile as Next.js without the flexibility).
- Frontmatter is not schema-validated; the knowledge-graph layer would be a custom plugin.
- We would spend effort *removing* docs-site assumptions instead of adding learning features.

## Comparison Matrix

Scored 1–5 against Agent Atlas's actual requirements (not general-purpose quality):

| Criterion (weight)                          | Astro | Next.js | React+Vite | Docusaurus |
|---------------------------------------------|:-----:|:-------:|:----------:|:----------:|
| Content authoring & typed content model (×3)| 5     | 3       | 1          | 4          |
| Embedded interactive visualizations (×3)    | 5     | 4       | 5          | 3          |
| Performance for reading-heavy pages (×2)    | 5     | 3       | 2          | 3          |
| Simplicity / complexity budget (×2)         | 4     | 2       | 3          | 4          |
| Long-term evolvability (backend later) (×2) | 4     | 5       | 2          | 2          |
| Custom design freedom (×1)                  | 5     | 5       | 5          | 2          |
| **Weighted total (max 65)**                 | **60**| **46**  | **36**     | **41**     |

## Decision

**Astro 5 with React islands, MDX, Tailwind CSS, and TypeScript.**

The deciding argument is alignment of defaults: Agent Atlas is a content system with
embedded interactivity, and Astro is the only candidate whose *default* architecture
(typed content collections + zero-JS pages + opt-in hydration) matches that shape without
custom infrastructure. Next.js is the better framework for a different product — a
multi-user application with server state. If Agent Atlas ever becomes that product, Astro's
adapter model provides an incremental path (see ADR-0003 for why no backend now).

## Consequences

- **Scope of the framework's role:** Astro is the *application shell and content
  platform* only — routing, rendering, content collections, island hydration. Domain
  logic, and in particular all agent mechanics, lives in plain TypeScript under
  `src/lib/` with no framework coupling (see ADR-0005).
- Interactive components are written in React and hydrated per-island; shared state across
  islands uses nano-stores or URL state, not a global app shell.
- Contributors (human or Claude) must learn the `.astro`/React split; the authoring guide
  documents when to use which.
- No server at runtime → security surface is minimal (see plan §15) and hosting is
  commodity static hosting.
- `CLAUDE.md` must be rewritten after approval to reflect this stack (currently misleading).
- Revisit trigger: if requirements ever include auth + per-user server state + third-party
  integrations, write ADR-000X re-evaluating Next.js or an Astro adapter before building.
