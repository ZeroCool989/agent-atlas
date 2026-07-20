/**
 * The Cost-engineering lesson's Tier-2 steppable visual: take one agent request and pull the
 * cost levers one at a time, watching the running per-request cost drop and reading the trade
 * each lever makes. State is a single `step` number; the pure `createCostScene` derives the
 * whole scene from the real optimization walkthrough produced by the cost build project
 * (`src/lib/cost/`); this only renders it. Server-rendered at step 0, so the first frame —
 * the unoptimized baseline and its bill — is meaningful without JS.
 */
import { useState } from 'react';

import { COST_DEMO_STEPS } from '../../lib/cost';
import { createCostScene } from '../../lib/viz';
import type { CostCallRow } from '../../lib/viz';
import Stepper from './Stepper';

function money(n: number): string {
  return `$${n.toFixed(4)}`;
}

function bigMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function CallRow({ row }: { row: CostCallRow }) {
  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-sm"
      style={{ opacity: row.dropped ? 0.35 : 1 }}
      data-dropped={row.dropped || undefined}
      data-small-model={row.onSmallModel || undefined}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className="rounded border px-1 text-[10px] uppercase"
          style={{
            borderColor: row.onSmallModel ? 'var(--viz-ok, #16a34a)' : 'var(--viz-active, #6366f1)',
            color: row.onSmallModel ? 'var(--viz-ok, #16a34a)' : 'var(--viz-active, #6366f1)',
          }}
        >
          {row.modelLabel}
        </span>
        <span className={`truncate font-medium text-slate-700 ${row.dropped ? 'line-through' : ''}`}>
          {row.label}
        </span>
        {row.cacheHitRate > 0 && (
          <span className="rounded bg-slate-200 px-1 text-[10px] text-slate-600">
            prefix cached
          </span>
        )}
        {row.dropped && <span className="text-[10px] font-semibold uppercase text-slate-500">dropped</span>}
      </div>
      <div className="whitespace-nowrap text-right tabular-nums text-xs text-slate-500">
        {row.dropped ? (
          <span>— skipped</span>
        ) : (
          <>
            <span>
              {row.inputTokens} in · {row.outputTokens} out
            </span>
            <span className="ml-1 font-semibold text-slate-700">{money(row.costUsd)}</span>
          </>
        )}
      </div>
    </li>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="tabular-nums text-sm font-semibold text-slate-700">{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default function CostEngineeringDemo() {
  const [step, setStep] = useState(0);
  const scene = createCostScene(COST_DEMO_STEPS, step);

  return (
    <section aria-label="Cost-engineering lever walkthrough" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The agent request as its model calls, revealed with each lever applied. */}
      <ul
        className="divide-y divide-slate-200 rounded-md border border-slate-300 bg-slate-50"
        aria-label="Model calls in the agent request"
      >
        {scene.rows.map((row) => (
          <CallRow key={row.label} row={row} />
        ))}
      </ul>

      {/* The running cost, its share of the baseline, the saving so far, and the bill at scale. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Cost summary">
        <Metric label="Cost / request" value={money(scene.perRequestCostUsd)} />
        <Metric
          label="Saved vs baseline"
          value={scene.isBaseline ? '—' : `${scene.cumulativeSavingsPercent.toFixed(1)}%`}
          sub={scene.isBaseline ? undefined : `${money(-scene.stepDeltaUsd)} this step`}
        />
        <Metric label="Baseline / request" value={money(scene.baselineCostUsd)} />
        <Metric
          label={`Bill / mo (${(scene.monthlyRequests / 1_000_000).toFixed(0)}M req)`}
          value={bigMoney(scene.monthlyCostUsd)}
          sub={scene.isBaseline ? undefined : `was ${bigMoney(scene.monthlyBaselineCostUsd)}`}
        />
      </div>

      {/* Cost bar: current cost as a share of the unoptimized baseline. */}
      <div aria-hidden="true" className="h-3 w-full overflow-hidden rounded bg-slate-100">
        <div
          className="h-full rounded"
          style={{
            width: `${Math.max(scene.costPercentOfBaseline, 2)}%`,
            background: scene.isBaseline ? 'var(--viz-error, #ef4444)' : 'var(--viz-ok, #16a34a)',
            transition: 'width 300ms ease',
          }}
        />
      </div>

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Cost-engineering steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        Every cost, token count and delta comes from the estimator in this repo (
        <code>src/lib/cost/estimator.ts</code>). Prices are illustrative, configurable constants — round
        teaching numbers, not any vendor&apos;s real prices; what is real is the shape (output dearer than
        input, a cache hit far cheaper than a fresh read) and the trade each lever makes.
      </p>
    </section>
  );
}
