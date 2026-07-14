/**
 * Shared renderer for a stepped execution trace: the actor-coded, decider-labeled row
 * list used by both the flagship architecture comparison and the experiment viewer.
 * Pure renderer over a TraceScene (src/lib/viz/trace-scene.ts) — observable behavior
 * only.
 */
import type { TraceScene } from '../../lib/viz';

const ACTOR_STYLE: Record<string, { label: string; style: React.CSSProperties }> = {
  application: { label: 'APP', style: { borderColor: 'var(--viz-boundary)', background: 'white' } },
  model: { label: 'MODEL', style: { borderColor: 'var(--viz-active)', background: 'var(--viz-active-surface)' } },
  runtime: { label: 'RUNTIME', style: { borderColor: 'var(--viz-neutral)', background: 'var(--viz-surface)' } },
  tool: { label: 'TOOL', style: { borderColor: 'var(--viz-complete)', background: 'var(--viz-complete-surface)' } },
};

const DECIDER_TEXT: Record<string, string> = {
  developer: 'developer decided',
  model: 'model decided',
  runtime: 'runtime enforced',
};

export interface TraceStepListProps {
  scene: TraceScene;
  ariaLabel?: string;
}

export default function TraceStepList({ scene, ariaLabel = 'Execution trace' }: TraceStepListProps) {
  return (
    <ol aria-label={ariaLabel} className="space-y-1">
      {scene.rows.map((row) => {
        const actor = ACTOR_STYLE[row.actor]!;
        return (
          <li
            key={row.index}
            className={`viz-transition flex items-center gap-2 rounded border-2 px-2 py-1 text-sm ${
              row.state === 'active' ? 'border-slate-900' : 'border-transparent'
            } ${row.state === 'inactive' ? 'opacity-45' : ''}`}
          >
            <span aria-hidden="true" className="w-4 text-xs">
              {row.state === 'completed' ? '✓' : row.state === 'active' ? '▸' : ''}
            </span>
            <span className="rounded border px-1.5 py-0.5 font-mono text-[10px]" style={actor.style}>
              {actor.label}
            </span>
            <span className="flex-1">{row.label}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              {DECIDER_TEXT[row.decidedBy]}
            </span>
            <span className="sr-only">
              {`event ${row.index + 1} of ${scene.rows.length}, ${
                row.state === 'completed' ? 'happened' : row.state === 'active' ? 'current' : 'not yet'
              }`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
