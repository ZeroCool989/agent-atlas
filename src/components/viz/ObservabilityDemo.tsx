/**
 * The observability lesson's Tier-2 steppable visual: watch a trace assemble as a span
 * tree / timeline. State is a single `step` number; the pure `createObservabilityScene`
 * derives the whole scene from a real `Trace` produced by the tracer build project; this
 * only renders it. Server-rendered at step 0, so the first frame — the open root span —
 * is meaningful without JS.
 */
import { useState } from 'react';

import { createObservabilityScene, OBSERVABILITY_DEMO_INPUT } from '../../lib/viz';
import type { ObservabilitySpanRow } from '../../lib/viz';
import Stepper from './Stepper';

const KIND_LABEL: Record<ObservabilitySpanRow['kind'], string> = {
  agent: 'agent',
  'model-call': 'model',
  'tool-call': 'tool',
  retry: 'retry',
  response: 'response',
};

function SpanRow({ row }: { row: ObservabilitySpanRow }) {
  const dim = row.state === 'inactive';
  const barColor = row.hasError
    ? 'var(--viz-error, #ef4444)'
    : row.isSlowest
      ? 'var(--viz-warning, #f59e0b)'
      : 'var(--viz-active, #6366f1)';

  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-sm"
      style={{ opacity: dim ? 0.4 : 1 }}
      data-state={row.state}
      data-error={row.hasError || undefined}
      data-slowest={row.isSlowest || undefined}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2" style={{ paddingLeft: `${row.depth * 16}px` }}>
          <span className="rounded border border-slate-300 px-1 text-[10px] uppercase text-slate-500">
            {KIND_LABEL[row.kind]}
          </span>
          <span className="truncate font-medium text-slate-700">{row.name}</span>
          {row.hasError && (
            <span style={{ color: 'var(--viz-error, #ef4444)' }} className="text-xs font-semibold">
              ✗ error
            </span>
          )}
          {row.isSlowest && (
            <span style={{ color: 'var(--viz-warning, #f59e0b)' }} className="text-xs font-semibold">
              slowest
            </span>
          )}
        </div>
        {/* Timeline bar: offset + width across the whole run. */}
        <div className="mt-1 h-1.5 w-full rounded bg-slate-100" role="presentation">
          {row.state !== 'inactive' && (
            <div
              className="h-full rounded"
              style={{
                marginLeft: `${row.offsetPercent}%`,
                width: `${Math.max(row.widthPercent, 1)}%`,
                background: barColor,
              }}
            />
          )}
        </div>
      </div>
      <div className="whitespace-nowrap text-right tabular-nums text-xs text-slate-500">
        {row.state === 'inactive' ? (
          <span>— pending</span>
        ) : (
          <>
            <span>{row.durationMs} ms</span>
            {row.tokens > 0 && <span> · {row.tokens} tok</span>}
            {row.costUsd > 0 && <span> · ${row.costUsd.toFixed(4)}</span>}
          </>
        )}
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="tabular-nums text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}

export default function ObservabilityDemo() {
  const [step, setStep] = useState(0);
  const scene = createObservabilityScene(OBSERVABILITY_DEMO_INPUT, step);
  const m = scene.metrics;

  return (
    <section aria-label="Observability trace walkthrough" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The span tree / timeline, revealed one span at a time. */}
      <ul
        className="divide-y divide-slate-200 rounded-md border border-slate-300 bg-slate-50"
        aria-label="Trace spans as a tree and timeline"
      >
        {scene.rows.map((row) => (
          <SpanRow key={row.id} row={row} />
        ))}
      </ul>

      {/* Running totals while stepping; the full metric panel resolves on the last step. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Trace metrics">
        <Metric
          label="Latency"
          value={`${scene.metricsRevealed ? m.totalDurationMs : scene.runningDurationMs} ms`}
        />
        <Metric
          label="Tokens"
          value={`${scene.metricsRevealed ? m.totalTokens : scene.runningTokens}`}
        />
        <Metric
          label="Cost"
          value={`$${(scene.metricsRevealed ? m.totalCostUsd : scene.runningCostUsd).toFixed(4)}`}
        />
        <Metric
          label="Error rate"
          value={scene.metricsRevealed ? `${m.errorRatePercent}%` : '—'}
        />
      </div>

      {scene.metricsRevealed && (
        <p className="text-sm text-slate-600">
          Slowest span by self-time:{' '}
          <span className="font-medium">{m.slowestName}</span> at{' '}
          <span className="tabular-nums">{m.slowestSelfMs} ms</span> · {m.retryCount} retry ·{' '}
          {m.errorCount}/{m.spanCount} spans errored.
        </p>
      )}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Observability steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        Every span, duration and metric comes from{' '}
        <a
          className="underline"
          href="https://github.com/ZeroCool989/agent-atlas/blob/main/src/lib/observability/tracer.ts"
        >
          the tracer in this repo
        </a>
        . The run is a fixed sample; token and cost figures are illustrative declared values, but the
        tree, the durations and the rolled-up metrics are all computed.
      </p>
    </section>
  );
}
