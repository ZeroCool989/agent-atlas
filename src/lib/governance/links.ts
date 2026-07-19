/**
 * Governance ↔ concept links, derived (never hand-maintained) from frontmatter in BOTH
 * directions and unioned:
 *   - a concept's `governance: [framework...]` refs, and
 *   - a framework's `appliesTo: [concept...]` refs.
 *
 * Either side declaring the edge is enough — so a framework page lists every concept that
 * points at it even if its own `appliesTo` is a curated subset, and vice versa. Pure TS,
 * no Astro imports (plan ADR-0005): the pages only render what these functions compute.
 */

export interface GovConcept {
  readonly id: string;
  readonly governance: readonly string[];
}

export interface GovFramework {
  readonly id: string;
  readonly appliesTo: readonly string[];
}

/** Stable key for a concept↔framework edge. */
export function linkKey(conceptId: string, frameworkId: string): string {
  return `${conceptId}::${frameworkId}`;
}

/**
 * The full set of concept↔framework edges (as `linkKey` strings), unioned from both
 * directions. Edges pointing at an id that does not exist in the opposite collection are
 * dropped — `npm run validate` already fails on dangling refs, so this is defense in depth,
 * never a way to hide one.
 */
export function governanceLinks(
  concepts: readonly GovConcept[],
  frameworks: readonly GovFramework[],
): Set<string> {
  const conceptIds = new Set(concepts.map((c) => c.id));
  const frameworkIds = new Set(frameworks.map((f) => f.id));
  const edges = new Set<string>();

  for (const c of concepts) {
    for (const fId of c.governance) {
      if (frameworkIds.has(fId)) edges.add(linkKey(c.id, fId));
    }
  }
  for (const f of frameworks) {
    for (const cId of f.appliesTo) {
      if (conceptIds.has(cId)) edges.add(linkKey(cId, f.id));
    }
  }
  return edges;
}

/** Concept ids connected to a framework (input order preserved). */
export function conceptsForFramework(
  frameworkId: string,
  concepts: readonly GovConcept[],
  frameworks: readonly GovFramework[],
  links: Set<string> = governanceLinks(concepts, frameworks),
): string[] {
  return concepts.filter((c) => links.has(linkKey(c.id, frameworkId))).map((c) => c.id);
}

/** Framework ids connected to a concept (input order preserved). */
export function frameworksForConcept(
  conceptId: string,
  concepts: readonly GovConcept[],
  frameworks: readonly GovFramework[],
  links: Set<string> = governanceLinks(concepts, frameworks),
): string[] {
  return frameworks.filter((f) => links.has(linkKey(conceptId, f.id))).map((f) => f.id);
}
