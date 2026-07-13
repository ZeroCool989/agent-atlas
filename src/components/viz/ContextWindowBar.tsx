/**
 * Renders a `ContextWindowView` — a CONCEPTUAL picture of finite context capacity
 * (providers count and manage context differently; the caption says so). Pure
 * renderer over precomputed scene truth from `computeContextWindow`.
 *
 * Honesty rules (edge-case policy in src/lib/viz/context-window.ts): invalid inputs
 * render an error panel instead of a misleading bar; overflow renders a capped bar
 * plus explicit "over capacity" text; data problems (segment mismatches) are shown as
 * warnings. Status is always conveyed in words, never color alone, and the numbers
 * are real text — the bar itself is decoration (aria-hidden).
 */
import type { ContextWindowView } from '../../lib/viz';

const STATUS_TEXT: Record<ContextWindowView['status'], string> = {
  ok: 'capacity available',
  'near-capacity': 'near capacity',
  full: 'full',
  overflow: 'over capacity',
  invalid: 'invalid data',
};

export interface ContextWindowBarProps {
  view: ContextWindowView;
  title?: string;
}

export default function ContextWindowBar({ view, title = 'Context window' }: ContextWindowBarProps) {
  if (view.status === 'invalid') {
    return (
      <div
        role="group"
        aria-label={title}
        className="rounded border-2 p-3 text-sm"
        style={{ borderColor: 'var(--viz-error)', background: 'var(--viz-error-surface)' }}
      >
        <p className="font-semibold" style={{ color: 'var(--viz-error)' }}>
          {title}: cannot display — invalid data
        </p>
        <ul className="mt-1 list-disc pl-5">
          {view.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
    );
  }

  const fillPercent = Math.min(view.percentUsed, 100);
  const fillColor =
    view.status === 'overflow'
      ? 'var(--viz-error)'
      : view.status === 'full' || view.status === 'near-capacity'
        ? 'var(--viz-warning)'
        : 'var(--viz-active)';

  return (
    <div role="group" aria-label={title} className="text-sm">
      <p>
        <span className="font-semibold">{title}:</span>{' '}
        {view.usedTokens} of {view.capacityTokens} tokens used ({view.percentUsed}%) —{' '}
        <span className="font-semibold">{STATUS_TEXT[view.status]}</span>
        {view.status === 'overflow'
          ? `, ${view.usedTokens - view.capacityTokens} tokens over`
          : `, ${view.remainingTokens} remaining`}
      </p>
      <div
        aria-hidden="true"
        className="mt-1 h-5 w-full overflow-hidden rounded border border-slate-300"
        style={{ background: 'var(--viz-surface)' }}
      >
        <div
          className="viz-transition h-full"
          style={{ width: `${fillPercent}%`, background: fillColor }}
        />
      </div>
      {view.segments.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
          {view.segments.map((segment) => (
            <li key={segment.label}>
              {segment.label}: {segment.tokenCount} tokens ({segment.percent}%)
            </li>
          ))}
        </ul>
      )}
      {view.problems.length > 0 && (
        <ul
          className="mt-1 rounded border p-2 text-xs"
          style={{ borderColor: 'var(--viz-warning)', background: 'var(--viz-warning-surface)' }}
        >
          {view.problems.map((problem) => (
            <li key={problem}>⚠ {problem}</li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-slate-500">
        Conceptual view of finite context capacity — exact counting and management differ per model
        and provider.
      </p>
    </div>
  );
}
