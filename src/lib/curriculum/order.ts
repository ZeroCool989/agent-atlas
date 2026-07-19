/**
 * The Path: a deterministic linear reading order over the concepts (plan §4 "The Path",
 * §3 curriculum L0→L6). Pure functions — no Astro, no React, no I/O — so the ordering is
 * unit-testable and identical on server and client.
 *
 * Order rule: concepts are grouped by essentiality layer in the canonical LAYERS order
 * (foundation → vendor-specific), and within a layer they are topologically sorted so a
 * concept never appears before a prerequisite that lives in the same layer. Prerequisites
 * in earlier layers are already satisfied by the layer order; ties break alphabetically by
 * title for stability. The sort is deterministic and cycle-safe (CI already forbids
 * prerequisite cycles; a defensive fallback keeps this total even if one slipped through).
 */
import { LAYERS, type Layer } from '../content/model';

/** The minimal shape this module needs from a concept entry (collection-agnostic). */
export interface CurriculumConcept {
  id: string;
  title: string;
  layer: Layer;
  status: string;
  prerequisites: readonly string[];
}

export interface CurriculumLayerGroup {
  layer: Layer;
  concepts: CurriculumConcept[];
}

/** Topologically order concepts *within one layer* (prereqs in the same layer come first). */
function orderWithinLayer(concepts: CurriculumConcept[]): CurriculumConcept[] {
  const inLayer = new Set(concepts.map((c) => c.id));
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const visited = new Set<string>();
  const inProgress = new Set<string>();
  const ordered: CurriculumConcept[] = [];

  // Deterministic entry order: alphabetical by title, then DFS emitting prereqs first.
  const roots = [...concepts].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));

  const visit = (c: CurriculumConcept): void => {
    if (visited.has(c.id)) return;
    if (inProgress.has(c.id)) return; // defensive: cycle → break rather than loop forever
    inProgress.add(c.id);
    const sameLayerPrereqs = c.prerequisites
      .filter((p) => inLayer.has(p))
      .map((p) => byId.get(p)!)
      .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
    for (const p of sameLayerPrereqs) visit(p);
    inProgress.delete(c.id);
    visited.add(c.id);
    ordered.push(c);
  };

  for (const c of roots) visit(c);
  return ordered;
}

/** The full curriculum: layer groups in canonical order, each internally topo-sorted. */
export function orderedCurriculum(concepts: readonly CurriculumConcept[]): CurriculumLayerGroup[] {
  return LAYERS.map((layer) => ({
    layer,
    concepts: orderWithinLayer(concepts.filter((c) => c.layer === layer)),
  })).filter((g) => g.concepts.length > 0);
}

/** The flat reading sequence (all layers concatenated in path order). */
export function readingSequence(concepts: readonly CurriculumConcept[]): CurriculumConcept[] {
  return orderedCurriculum(concepts).flatMap((g) => g.concepts);
}

/**
 * Prerequisites of `concept` that the learner has not yet marked read.
 * `readSlugs` is the set of concept ids currently marked `read`. Returns concept ids,
 * stable-ordered by the reading sequence so hints read naturally.
 */
export function unreadPrerequisites(
  concept: CurriculumConcept,
  readSlugs: ReadonlySet<string>,
  all: readonly CurriculumConcept[],
): string[] {
  const seq = readingSequence(all).map((c) => c.id);
  const rank = new Map(seq.map((id, i) => [id, i]));
  return concept.prerequisites
    .filter((p) => !readSlugs.has(p))
    .filter((p) => rank.has(p)) // ignore dangling (CI forbids them anyway)
    .sort((a, b) => (rank.get(a)! - rank.get(b)!));
}
