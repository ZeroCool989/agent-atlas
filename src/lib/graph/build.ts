/**
 * Graph construction: normalized entries → canonical graph. Pure; records every
 * declared reference as an edge (including duplicates and references to missing
 * targets) so `checkIntegrity` can report on the author's actual data.
 */
import type { Graph, GraphEdge, GraphEntry, GraphNode } from './types';

export function buildGraph(entries: GraphEntry[]): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const entry of entries) {
    switch (entry.collection) {
      case 'concepts': {
        nodes.push({
          collection: 'concepts',
          id: entry.id,
          label: entry.title,
          layer: entry.layer,
          status: entry.status,
        });
        const from = { collection: 'concepts' as const, id: entry.id };
        for (const id of entry.prerequisites)
          edges.push({ type: 'prerequisite', from, field: 'prerequisites', to: { collection: 'concepts', id } });
        for (const id of entry.related)
          edges.push({ type: 'related', from, field: 'related', to: { collection: 'concepts', id } });
        for (const id of entry.governance)
          edges.push({ type: 'governed-by', from, field: 'governance', to: { collection: 'governance', id } });
        for (const id of entry.sources)
          edges.push({ type: 'cites-source', from, field: 'sources', to: { collection: 'sources', id } });
        break;
      }
      case 'interview': {
        nodes.push({ collection: 'interview', id: entry.id, label: entry.question });
        for (const id of entry.concepts)
          edges.push({
            type: 'assesses',
            from: { collection: 'interview', id: entry.id },
            field: 'concepts',
            to: { collection: 'concepts', id },
          });
        break;
      }
      case 'governance': {
        nodes.push({ collection: 'governance', id: entry.id, label: entry.title });
        for (const id of entry.appliesTo)
          edges.push({
            type: 'applies-to',
            from: { collection: 'governance', id: entry.id },
            field: 'appliesTo',
            to: { collection: 'concepts', id },
          });
        break;
      }
      case 'sources': {
        nodes.push({ collection: 'sources', id: entry.id, label: entry.title });
        for (const id of entry.routedTo)
          edges.push({
            type: 'routed-to',
            from: { collection: 'sources', id: entry.id },
            field: 'routedTo',
            to: { collection: 'concepts', id },
          });
        break;
      }
      case 'glossary': {
        // The approved glossary schema has no reference fields → nodes only, no edges.
        nodes.push({ collection: 'glossary', id: entry.id, label: entry.term });
        break;
      }
    }
  }

  return { nodes, edges };
}
