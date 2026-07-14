/**
 * Interactive viewer for a checked-in experiment result: pick a run from the matrix,
 * scrub its execution trace, read the measured metrics. Renders only what the
 * experiment recorded — observable behavior. Runs entirely on serialized result data
 * passed from the .astro page (no keys, no runtime in the browser).
 */
import { useState } from 'react';

import { createTraceScene } from '../../lib/viz';
import type { RunRecord } from '../../../experiments/lib/types';
import Stepper from './Stepper';
import TraceStepList from './TraceStepList';

export interface ExperimentTraceViewerProps {
  runs: RunRecord[];
  question: string;
}

const runKey = (run: RunRecord) => `${run.provider} · ${run.variant} · #${run.repeat}`;

export default function ExperimentTraceViewer({ runs, question }: ExperimentTraceViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [step, setStep] = useState(0);
  const run = runs[selectedIndex]!;
  const scene = createTraceScene(run.trace, step);

  const select = (index: number) => {
    setSelectedIndex(index);
    setStep(0); // each run's trace is its own timeline
  };

  return (
    <section aria-label="Experiment trace viewer" className="space-y-4 rounded border border-slate-200 p-4">
      <p className="text-sm text-slate-600">
        Task: <strong>“{question}”</strong>. Pick a run and scrub its recorded trace.
      </p>

      <label className="block text-sm">
        <span className="font-medium">Run</span>
        <select
          value={selectedIndex}
          onChange={(event) => select(Number(event.target.value))}
          className="mt-1 block rounded border border-slate-300 px-2 py-1"
        >
          {runs.map((r, index) => (
            <option key={index} value={index}>
              {runKey(r)} — {r.outcome} {r.success ? '✓' : '✗'}
            </option>
          ))}
        </select>
      </label>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase text-slate-400">Outcome</dt>
          <dd>{run.outcome}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-400">Model calls</dt>
          <dd className="tabular-nums">{run.modelCalls}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-400">Tools selected</dt>
          <dd className="tabular-nums">{run.toolCallCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-400">Total tokens</dt>
          <dd className="tabular-nums">{run.totalTokens ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-400">Latency (ms)</dt>
          <dd className="tabular-nums">{run.latencyMsTotal ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-400">Est. cost</dt>
          <dd className="tabular-nums">
            {run.estimatedCost ? `${run.estimatedCost.amount} ${run.estimatedCost.currency}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-400">Validation failures</dt>
          <dd className="tabular-nums">{run.validationFailures}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-400">Malformed calls</dt>
          <dd className="tabular-nums">{run.malformedToolCalls}</dd>
        </div>
      </dl>

      {run.warnings.length > 0 && (
        <ul className="rounded border p-2 text-xs" style={{ borderColor: 'var(--viz-warning)', background: 'var(--viz-warning-surface)' }}>
          {run.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <div>
        <h4 className="font-semibold">{scene.title}</h4>
        <p className="mt-1 min-h-10 text-sm text-slate-600">{scene.description}</p>
        {scene.usage && (
          <p className="text-xs tabular-nums text-slate-500">
            declared metadata: {scene.usage.latencyMs ?? '—'} ms · {scene.usage.totalTokens ?? '—'} tokens
          </p>
        )}
      </div>

      <TraceStepList scene={scene} />

      {run.finalText !== undefined && (
        <p className="rounded border border-slate-200 p-2 text-sm" style={{ background: 'var(--viz-surface)' }}>
          <span className="font-semibold">Final result:</span> <code>{run.finalText}</code>
        </p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Success criteria checks</summary>
        <ul className="mt-1 list-disc pl-5">
          {run.successChecks.map((c) => (
            <li key={c} className={c.startsWith('FAIL') ? 'text-red-700' : ''}>
              {c}
            </li>
          ))}
        </ul>
      </details>

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label={`${runKey(run)} trace steps`}
        stepLabel={scene.title}
      />
    </section>
  );
}
