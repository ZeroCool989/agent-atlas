/**
 * Corpus-wide integrity rules (plan §7 fail/warn scope). Entry-local rules live in the
 * Zod schemas (src/content.schemas.ts); duplicate ids are enforced by Astro's loader.
 * Diagnostic codes and remediation guidance are documented in docs/GRAPH.md.
 *
 * Failures: dangling reference · wrong target collection · prohibited self-reference ·
 * prerequisite cycle (with path) · complete concept with a `stub` prerequisite
 * ("prerequisites are at least draft", plan §19 — so draft/complete/needs-update are
 * acceptable, only `stub` is not).
 * Warnings: duplicate reference within one field · orphan concept (a concept touched by
 * NO edge of any type, in either direction — having no prerequisites is fine).
 */
import type { Collection, Finding, Graph, GraphNode, IntegrityReport, NodeRef } from './types';

const byCodepoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const nodeKey = (ref: NodeRef) => `${ref.collection}/${ref.id}`;

export function checkIntegrity(graph: Graph): IntegrityReport {
  const failures: Finding[] = [];
  const warnings: Finding[] = [];

  const nodesByKey = new Map<string, GraphNode>();
  const collectionsById = new Map<string, Collection[]>();
  for (const node of graph.nodes) {
    nodesByKey.set(nodeKey(node), node);
    const list = collectionsById.get(node.id) ?? [];
    list.push(node.collection);
    collectionsById.set(node.id, list);
  }

  // --- Referential integrity: dangling / wrong collection / self / duplicate ---------
  const seenRefs = new Set<string>();
  for (const edge of graph.edges) {
    const base = {
      collection: edge.from.collection,
      entryId: edge.from.id,
      field: edge.field,
      targetId: edge.to.id,
    };

    const refKey = `${nodeKey(edge.from)}#${edge.field}→${edge.to.id}`;
    if (seenRefs.has(refKey)) {
      warnings.push({
        severity: 'warning',
        code: 'GRAPH_DUPLICATE_REFERENCE',
        ...base,
        message: `${edge.from.collection}/${edge.from.id} lists "${edge.to.id}" more than once in ${edge.field}.`,
        remediation: `Remove the repeated "${edge.to.id}" entry from ${edge.field}.`,
      });
      continue; // one finding per repeated ref; the first occurrence was fully checked
    }
    seenRefs.add(refKey);

    if (edge.from.collection === edge.to.collection && edge.from.id === edge.to.id) {
      failures.push({
        severity: 'error',
        code: 'GRAPH_SELF_REFERENCE',
        ...base,
        message: `${edge.from.collection}/${edge.from.id} references itself in ${edge.field}.`,
        remediation: `Remove "${edge.to.id}" from its own ${edge.field} list.`,
      });
      continue;
    }

    if (!nodesByKey.has(nodeKey(edge.to))) {
      const elsewhere = (collectionsById.get(edge.to.id) ?? []).filter(
        (c) => c !== edge.to.collection,
      );
      if (elsewhere.length > 0) {
        failures.push({
          severity: 'error',
          code: 'GRAPH_WRONG_TARGET_TYPE',
          ...base,
          message: `${edge.from.collection}/${edge.from.id} → ${edge.field}: "${edge.to.id}" must be a ${edge.to.collection} entry, but only exists in ${elsewhere.join(', ')}.`,
          remediation: `Point ${edge.field} at a ${edge.to.collection} entry, or create ${edge.to.collection}/${edge.to.id}.`,
        });
      } else {
        failures.push({
          severity: 'error',
          code: 'GRAPH_DANGLING_REFERENCE',
          ...base,
          message: `${edge.from.collection}/${edge.from.id} → ${edge.field}: no ${edge.to.collection} entry named "${edge.to.id}" exists.`,
          remediation: `Create ${edge.to.collection}/${edge.to.id} (a stub is fine) or remove the reference.`,
        });
      }
    }
  }

  // --- Prerequisite cycles (self-loops excluded: reported as GRAPH_SELF_REFERENCE) ---
  for (const cycle of findPrerequisiteCycles(graph)) {
    const path = [...cycle, cycle[0]!];
    failures.push({
      severity: 'error',
      code: 'GRAPH_PREREQUISITE_CYCLE',
      collection: 'concepts',
      entryId: cycle[0]!,
      field: 'prerequisites',
      message: `Prerequisite cycle: ${path.join(' → ')}.`,
      remediation:
        'Break the cycle by removing one prerequisite edge — usually the one pointing "backwards" to the more advanced concept.',
      cyclePath: path,
    });
  }

  // --- Complete concepts must not depend on stub prerequisites (plan §19) ------------
  for (const node of graph.nodes) {
    if (node.collection !== 'concepts' || node.status !== 'complete') continue;
    for (const edge of graph.edges) {
      if (edge.type !== 'prerequisite' || edge.from.id !== node.id) continue;
      const target = nodesByKey.get(nodeKey(edge.to));
      if (target?.status === 'stub') {
        failures.push({
          severity: 'error',
          code: 'GRAPH_COMPLETE_REQUIRES_INCOMPLETE_PREREQUISITE',
          collection: 'concepts',
          entryId: node.id,
          field: 'prerequisites',
          targetId: target.id,
          message: `concepts/${node.id} is "complete" but its prerequisite concepts/${target.id} is still "stub" — prerequisites must be at least "draft" (plan §19).`,
          remediation: `Write concepts/${target.id} up to at least "draft", or downgrade concepts/${node.id} from "complete".`,
        });
      }
    }
  }

  // --- Orphan concepts (warning only) -------------------------------------------------
  const touched = new Set<string>();
  for (const edge of graph.edges) {
    touched.add(nodeKey(edge.from));
    touched.add(nodeKey(edge.to));
  }
  for (const node of graph.nodes) {
    if (node.collection !== 'concepts') continue;
    if (!touched.has(nodeKey(node))) {
      warnings.push({
        severity: 'warning',
        code: 'GRAPH_ORPHAN_CONCEPT',
        collection: 'concepts',
        entryId: node.id,
        message: `concepts/${node.id} has no relationships of any kind (no concept, interview, governance, or source linkage).`,
        remediation:
          'Connect it as it matures (prerequisites, related, sources, interview questions) — or leave it; orphans are reported, never build failures (plan §7).',
      });
    }
  }

  sortFindings(failures);
  sortFindings(warnings);
  return { failures, warnings };
}

/**
 * DFS cycle detection over `prerequisite` edges only. Returns each distinct cycle once,
 * rotated so the lexicographically smallest id comes first (deterministic output).
 * Self-loops and edges to missing nodes are skipped — both already produce their own
 * findings — but are tolerated defensively (no crash, no infinite loop).
 */
function findPrerequisiteCycles(graph: Graph): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) if (node.collection === 'concepts') adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    if (edge.type !== 'prerequisite') continue;
    if (edge.from.id === edge.to.id) continue; // self-loop → GRAPH_SELF_REFERENCE
    if (!adjacency.has(edge.to.id)) continue; // dangling → GRAPH_DANGLING_REFERENCE
    adjacency.get(edge.from.id)!.push(edge.to.id);
  }
  for (const targets of adjacency.values()) targets.sort(byCodepoint);

  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seen = new Set<string>();

  function visit(id: string): void {
    state.set(id, 'visiting');
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      if (state.get(next) === 'done') continue;
      if (state.get(next) === 'visiting') {
        const cycle = stack.slice(stack.indexOf(next));
        const smallest = cycle.reduce((a, b) => (byCodepoint(a, b) <= 0 ? a : b));
        const rotated = [
          ...cycle.slice(cycle.indexOf(smallest)),
          ...cycle.slice(0, cycle.indexOf(smallest)),
        ];
        const key = rotated.join('→');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(rotated);
        }
        continue;
      }
      visit(next);
    }
    stack.pop();
    state.set(id, 'done');
  }

  for (const id of [...adjacency.keys()].sort(byCodepoint)) {
    if (!state.has(id)) visit(id);
  }
  cycles.sort((a, b) => byCodepoint(a.join('→'), b.join('→')));
  return cycles;
}

function sortFindings(findings: Finding[]): void {
  findings.sort(
    (a, b) =>
      byCodepoint(a.collection, b.collection) ||
      byCodepoint(a.entryId, b.entryId) ||
      byCodepoint(a.code, b.code) ||
      byCodepoint(a.field ?? '', b.field ?? '') ||
      byCodepoint(a.targetId ?? '', b.targetId ?? ''),
  );
}
