/**
 * Structured-output pipeline viz: pick a case and scrub the real extractStructured
 * stages (model output → isolate JSON → parse → validate → typed value / retry / give
 * up). Pure renderer over precomputed cases from src/lib/structured — the mechanism is
 * the real one, the model outputs are scripted demonstrations (labelled as such).
 */
import { useState } from 'react';

import type { StructuredCase } from '../../lib/structured';
import { clampStep } from '../../lib/viz';
import Stepper from './Stepper';

const STATUS_STYLE: Record<string, { glyph: string; color: string }> = {
  info: { glyph: '•', color: 'var(--viz-neutral)' },
  ok: { glyph: '✓', color: 'var(--viz-complete)' },
  fixed: { glyph: '✎', color: 'var(--viz-warning)' },
  fail: { glyph: '✗', color: 'var(--viz-error)' },
};

export interface StructuredExtractionIslandProps {
  cases: StructuredCase[];
}

export default function StructuredExtractionIsland({ cases }: StructuredExtractionIslandProps) {
  const [selectedKey, setSelectedKey] = useState(cases[0]!.key);
  const [step, setStep] = useState(0);
  const selected = cases.find((c) => c.key === selectedKey)!;
  const total = selected.stages.length;
  const current = clampStep(step, total);
  const activeStage = selected.stages[current]!;

  const select = (key: StructuredCase['key']) => {
    setSelectedKey(key);
    setStep(0); // each case is its own pipeline
  };

  return (
    <section aria-label="Structured extraction pipeline" className="space-y-4 rounded border border-slate-200 p-4">
      <fieldset>
        <legend className="text-sm font-medium">Case</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {cases.map((c) => (
            <label
              key={c.key}
              className={`cursor-pointer rounded border px-3 py-1.5 text-sm ${
                c.key === selectedKey ? 'border-slate-900 font-semibold' : 'border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="structured-case"
                value={c.key}
                checked={c.key === selectedKey}
                onChange={() => select(c.key)}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded border border-slate-200 p-3 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span
            className="rounded border px-1.5 py-0.5 text-xs font-semibold"
            style={{ borderColor: selected.ok ? 'var(--viz-complete)' : 'var(--viz-error)' }}
          >
            {selected.ok ? 'validated value returned' : 'typed failure'}
          </span>
          <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
            scripted · {selected.attempts} attempt(s)
          </span>
        </p>
        <p className="mt-1 text-slate-600">{selected.summary}</p>
      </div>

      <ol aria-label="Pipeline stages" className="space-y-1">
        {selected.stages.map((stage, index) => {
          const style = STATUS_STYLE[stage.status]!;
          const state = index < current ? 'completed' : index === current ? 'active' : 'inactive';
          return (
            <li
              key={index}
              className={`viz-transition rounded border-2 px-2 py-1 text-sm ${
                state === 'active' ? 'border-slate-900' : 'border-transparent'
              } ${state === 'inactive' ? 'opacity-45' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden="true" style={{ color: style.color }}>{style.glyph}</span>
                <span className="font-medium">
                  {stage.label}
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-slate-400">attempt {stage.attempt}</span>
                </span>
              </div>
              {state !== 'inactive' && <p className="ml-6 text-xs text-slate-600">{stage.detail}</p>}
              <span className="sr-only">
                {`stage ${index + 1} of ${selected.stages.length}, ${stage.label}, ${stage.status}: ${stage.detail}`}
              </span>
            </li>
          );
        })}
      </ol>

      {activeStage.content !== undefined && (
        <pre className="overflow-x-auto rounded border border-slate-200 p-2 font-mono text-xs" style={{ background: 'var(--viz-surface)' }}>
          {activeStage.content}
        </pre>
      )}

      {selected.value !== undefined && (
        <p className="rounded border border-slate-200 p-2 text-sm" style={{ background: 'var(--viz-surface)' }}>
          <span className="font-semibold">Typed value:</span> <code>{JSON.stringify(selected.value)}</code>
        </p>
      )}

      <Stepper
        step={current}
        totalSteps={total}
        onStepChange={setStep}
        label={`${selected.label} pipeline steps`}
        stepLabel={activeStage.label}
      />
    </section>
  );
}
