/**
 * Renderer for a sampling `SamplingScene` (ADR-0004): one horizontal bar per candidate
 * token, width proportional to its probability at the current step. Pure presentation —
 * it displays the scene's truth and decides nothing. The probabilities are real text
 * (the bars are aria-hidden decoration), so the visual is fully usable without color or
 * hydration.
 */
import type { SamplingScene } from '../../lib/viz';

const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

export default function DistributionBars({ scene }: { scene: SamplingScene }) {
  const anyCut = scene.bars.some((b) => !b.kept);

  return (
    <div role="group" aria-label="Next-token probability distribution" className="text-sm">
      <ul className="space-y-1.5">
        {scene.bars.map((bar) => {
          const width = Math.max(scene.method === 'raw' ? bar.prob : Math.max(bar.prob, bar.basisProb), 0) * 100;
          const fill = bar.kept ? 'var(--viz-active)' : 'var(--viz-inactive)';
          return (
            <li key={bar.token} className={bar.kept ? '' : 'opacity-60'}>
              <div className="flex items-baseline justify-between gap-3">
                <code className="font-mono">{bar.token === ' ' ? '␣' : bar.token}</code>
                <span className="tabular-nums text-slate-600">
                  {bar.kept ? pct(bar.prob) : 'cut'}
                  {scene.method !== 'raw' && bar.kept && (
                    <span className="ml-1 text-xs text-slate-400">(was {pct(bar.basisProb)})</span>
                  )}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="mt-0.5 h-3 w-full overflow-hidden rounded border border-slate-200"
              >
                <div
                  className="viz-transition h-full"
                  style={{ width: `${Math.min(width, 100)}%`, background: fill }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        {scene.parameterLabel && (
          <>
            <span className="font-semibold">{scene.parameterLabel}</span> ·{' '}
          </>
        )}
        {scene.keptCount} of {scene.bars.length} tokens can be drawn
        {anyCut ? ' — the rest are cut to zero probability.' : ' — every token keeps a nonzero chance.'}
      </p>
    </div>
  );
}
