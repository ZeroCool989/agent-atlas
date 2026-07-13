/**
 * Deterministic serialization of the graph to the `graph.json` artifact. Byte-identical
 * output for identical content regardless of input entry order or environment: nodes
 * and edges are sorted by codepoint, object keys are written in a fixed order, and the
 * artifact contains no timestamps or machine-dependent values.
 */
import { CONTENT_SCHEMA_VERSION } from '../content/model';
import type { Graph } from './types';

const byCodepoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function serializeGraph(graph: Graph): string {
  const nodes = [...graph.nodes]
    .sort((a, b) => byCodepoint(a.collection, b.collection) || byCodepoint(a.id, b.id))
    .map((n) => ({
      collection: n.collection,
      id: n.id,
      label: n.label,
      ...(n.layer !== undefined ? { layer: n.layer } : {}),
      ...(n.status !== undefined ? { status: n.status } : {}),
    }));

  const edges = [...graph.edges]
    .sort(
      (a, b) =>
        byCodepoint(a.from.collection, b.from.collection) ||
        byCodepoint(a.from.id, b.from.id) ||
        byCodepoint(a.field, b.field) ||
        byCodepoint(a.to.id, b.to.id),
    )
    .map((e) => ({
      type: e.type,
      from: { collection: e.from.collection, id: e.from.id },
      field: e.field,
      to: { collection: e.to.collection, id: e.to.id },
    }));

  return `${JSON.stringify({ contentSchemaVersion: CONTENT_SCHEMA_VERSION, nodes, edges }, null, 2)}\n`;
}
