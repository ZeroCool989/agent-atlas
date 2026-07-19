/**
 * The Atlas — the signature surface (plan §4). Renders the concept knowledge graph as an
 * SVG: essentiality layers as concentric rings (foundation centre → vendor rim), typed
 * edges (prerequisite solid, related dashed), each node a link to its concept.
 *
 * Zero-JS first: Astro server-renders this island, so the positioned graph and its links
 * are in the HTML and fully usable without JavaScript (positions come from the pure
 * `computeGraphLayout`, so server and client agree). On hydration it adds the local
 * progress overlay (read concepts marked) and a focus/hover detail panel. React owns the
 * DOM; the layout math is the only "D3-ish" part and it's plain trig.
 */
import { useEffect, useMemo, useState } from 'react';

import type { GraphLayout, PositionedNode } from '../lib/graph/layout';
import { LAYERS, type Layer, type ConceptStatus } from '../lib/content/model';
import { conceptProgress, loadProgress, type ConceptProgress } from '../lib/storage/progress';

const LAYER_COLOR: Record<Layer, string> = {
  foundation: '#1d4ed8',
  'core-mechanism': '#047857',
  'useful-addition': '#b45309',
  'advanced-system': '#7c3aed',
  'framework-abstraction': '#64748b',
  'vendor-specific': '#94a3b8',
};

const STATUS_GLYPH: Record<ConceptStatus, string> = {
  complete: '●',
  draft: '◐',
  stub: '○',
  'needs-update': '⚠',
};

const nodeRadius = (status: ConceptStatus) => (status === 'complete' ? 9 : status === 'stub' ? 5 : 7);

export default function AtlasGraph({ layout }: { layout: GraphLayout }) {
  const { width, height, nodes, edges } = layout;
  const [progress, setProgress] = useState<Record<string, ConceptProgress | null>>({});
  const [active, setActive] = useState<string | null>(null);

  // Progress lives in localStorage — only readable after mount (SSR-safe).
  useEffect(() => {
    const state = loadProgress();
    const map: Record<string, ConceptProgress | null> = {};
    for (const n of nodes) map[n.slug] = conceptProgress(state, n.slug);
    setProgress(map);
  }, [nodes]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.slug, n])), [nodes]);
  const activeNode = active ? byId.get(active) ?? null : null;
  const activeEdges = useMemo(
    () => (active ? new Set(edges.filter((e) => e.from === active || e.to === active)) : new Set()),
    [active, edges],
  );
  const neighborSlugs = useMemo(() => {
    const s = new Set<string>();
    if (active) {
      for (const e of edges) {
        if (e.from === active) s.add(e.to);
        if (e.to === active) s.add(e.from);
      }
    }
    return s;
  }, [active, edges]);

  const presentLayers = LAYERS.filter((l) => nodes.some((n) => n.layer === l));

  return (
    <div className="not-prose">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {presentLayers.map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" style={{ color: LAYER_COLOR[l] }}>
              ●
            </span>
            {l}
          </span>
        ))}
        <span className="ml-auto text-slate-400">● complete · ◐ draft · ○ stub · ⚠ needs update</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full rounded-xl border border-slate-200 bg-slate-50"
        role="group"
        aria-label="Concept atlas: essentiality layers from foundations at the centre to vendor-specific at the rim"
      >
        {/* faint ring guides */}
        {presentLayers.map((_, i) => {
          const maxR = Math.min(width, height) / 2 - 64;
          const r = presentLayers.length <= 1 ? 0 : (i / (presentLayers.length - 1)) * maxR;
          return (
            <circle
              key={`ring-${i}`}
              cx={width / 2}
              cy={height / 2}
              r={r}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          );
        })}

        {/* edges under nodes */}
        {edges.map((e, i) => {
          const on = activeEdges.has(e);
          return (
            <line
              key={`e-${i}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={on ? '#334155' : '#cbd5e1'}
              strokeWidth={on ? 1.75 : 1}
              strokeDasharray={e.type === 'related' ? '4 4' : undefined}
              opacity={active && !on ? 0.25 : 1}
            />
          );
        })}

        {/* nodes */}
        {nodes.map((n) => (
          <NodeMark
            key={n.slug}
            node={n}
            color={LAYER_COLOR[n.layer]}
            progress={progress[n.slug] ?? null}
            dimmed={!!active && active !== n.slug && !neighborSlugs.has(n.slug)}
            onEnter={() => setActive(n.slug)}
            onLeave={() => setActive((cur) => (cur === n.slug ? null : cur))}
          />
        ))}
      </svg>

      <p className="mt-3 min-h-[2.5rem] text-sm text-slate-600" aria-live="polite">
        {activeNode ? (
          <>
            <a href={`/concepts/${activeNode.slug}`} className="font-medium text-blue-700 underline">
              {activeNode.label}
            </a>{' '}
            <span className="text-slate-400">
              · {activeNode.layer} · {activeNode.status}
              {progress[activeNode.slug] === 'read' ? ' · read' : ''}
            </span>
            <br />
            <span>{activeNode.oneLiner}</span>
          </>
        ) : (
          <span className="text-slate-400">
            Hover or focus a concept to see what it is. Click to open the lesson.
          </span>
        )}
      </p>
    </div>
  );
}

function NodeMark({
  node,
  color,
  progress,
  dimmed,
  onEnter,
  onLeave,
}: {
  node: PositionedNode;
  color: string;
  progress: ConceptProgress | null;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const r = nodeRadius(node.status);
  const read = progress === 'read';
  return (
    <a
      href={`/concepts/${node.slug}`}
      aria-label={`${node.label} — ${node.layer}, ${node.status}${read ? ', read' : ''}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      data-slug={node.slug}
      data-layer={node.layer}
      data-status={node.status}
      data-progress={read ? 'read' : progress ?? ''}
      style={{ opacity: dimmed ? 0.4 : 1 }}
    >
      <title>{`${node.label} — ${node.oneLiner}`}</title>
      {read && (
        <circle cx={node.x} cy={node.y} r={r + 4} fill="none" stroke="#047857" strokeWidth={2} />
      )}
      <circle cx={node.x} cy={node.y} r={r} fill={color} stroke="#fff" strokeWidth={1.5} />
      <text
        x={node.x}
        y={node.y - r - 5}
        textAnchor="middle"
        className="pointer-events-none"
        fontSize={11}
        fill="#0f172a"
      >
        {node.label}
      </text>
      <text
        x={node.x}
        y={node.y + 3}
        textAnchor="middle"
        className="pointer-events-none"
        fontSize={8}
        fill="#fff"
        aria-hidden="true"
      >
        {STATUS_GLYPH[node.status]}
      </text>
    </a>
  );
}
