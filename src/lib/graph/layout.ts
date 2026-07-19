/**
 * Deterministic radial layout for the Atlas graph (plan §4/§7): essentiality layers form
 * concentric rings — `foundation` at the centre, `vendor-specific` at the rim — and the
 * concepts of a layer are spaced evenly around their ring. Positions are a pure function
 * of the input, so the layout renders identically on the server (static first frame) and
 * in the hydrated island, and is unit-testable without a browser or a physics simulation.
 *
 * We deliberately do NOT run a force simulation: at MVP scale (tens of nodes) a
 * layer-banded radial placement is clearer, stable across renders, keyboard-orderable,
 * and needs no d3 dependency (plan §12 allows D3 for math only; here plain trig suffices).
 */
import { LAYERS, type ConceptStatus, type Layer } from '../content/model';

export interface LayoutConceptInput {
  slug: string;
  label: string;
  layer: Layer;
  status: ConceptStatus;
  oneLiner: string;
  prerequisites: string[];
  related: string[];
}

export interface PositionedNode {
  slug: string;
  label: string;
  layer: Layer;
  status: ConceptStatus;
  oneLiner: string;
  x: number;
  y: number;
  /** Ring index 0..LAYERS.length-1, centre outward. */
  ring: number;
}

export interface PositionedEdge {
  from: string;
  to: string;
  type: 'prerequisite' | 'related';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GraphLayout {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  /** Padding from the edge of the viewbox to the outermost ring. */
  padding?: number;
}

/**
 * Compute node/edge positions. Nodes are grouped by layer; each layer gets a ring radius
 * evenly spaced from centre to (min(width,height)/2 - padding). Within a ring, nodes are
 * ordered by slug (stable) and placed at even angles, offset per ring so adjacent rings
 * don't line up spokes. Edges reference only nodes present in the input (dangling
 * references are dropped — the graph is derived, never forced).
 */
export function computeGraphLayout(
  concepts: readonly LayoutConceptInput[],
  options: LayoutOptions = {},
): GraphLayout {
  const width = options.width ?? 960;
  const height = options.height ?? 720;
  const padding = options.padding ?? 64;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) / 2 - padding;

  // Which layers are actually present, in canonical order, so empty rings don't waste space.
  const presentLayers = LAYERS.filter((layer) => concepts.some((c) => c.layer === layer));
  const ringRadius = (layerIndexAmongPresent: number): number => {
    if (presentLayers.length <= 1) return 0;
    // foundation (index 0) closest to centre; spread the rest to maxRadius.
    return (layerIndexAmongPresent / (presentLayers.length - 1)) * maxRadius;
  };

  const nodes: PositionedNode[] = [];
  const byLayer = new Map<Layer, LayoutConceptInput[]>();
  for (const c of concepts) {
    const arr = byLayer.get(c.layer) ?? [];
    arr.push(c);
    byLayer.set(c.layer, arr);
  }

  presentLayers.forEach((layer, ringIdx) => {
    const members = (byLayer.get(layer) ?? []).slice().sort((a, b) => a.slug.localeCompare(b.slug));
    const radius = ringRadius(ringIdx);
    const angleStep = members.length > 0 ? (2 * Math.PI) / members.length : 0;
    // Rotate each ring a little so spokes don't align across rings.
    const angleOffset = (ringIdx * Math.PI) / (presentLayers.length + 1);
    members.forEach((c, i) => {
      const angle = angleOffset + i * angleStep;
      // A single centre node sits exactly at the middle.
      const x = radius === 0 && members.length === 1 ? cx : cx + radius * Math.cos(angle);
      const y = radius === 0 && members.length === 1 ? cy : cy + radius * Math.sin(angle);
      nodes.push({
        slug: c.slug,
        label: c.label,
        layer: c.layer,
        status: c.status,
        oneLiner: c.oneLiner,
        x: round(x),
        y: round(y),
        ring: ringIdx,
      });
    });
  });

  const pos = new Map(nodes.map((n) => [n.slug, n]));
  const edges: PositionedEdge[] = [];
  const seen = new Set<string>();
  for (const c of concepts) {
    const from = pos.get(c.slug);
    if (!from) continue;
    const addEdge = (toSlug: string, type: 'prerequisite' | 'related') => {
      const to = pos.get(toSlug);
      if (!to) return; // dangling reference — dropped, never forced
      const key = `${c.slug}->${toSlug}:${type}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ from: c.slug, to: toSlug, type, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    };
    for (const p of c.prerequisites) addEdge(p, 'prerequisite');
    for (const r of c.related) addEdge(r, 'related');
  }

  return { width, height, nodes, edges };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
