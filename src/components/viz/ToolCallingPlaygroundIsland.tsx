/**
 * Tool Calling Playground: pick an outcome class and scrub its REAL execution trace.
 * Pure renderer over precomputed cases (scripted runtime behaviors + measured Claude
 * traces from Experiments 005/006). Reuses createTraceScene + TraceStepList + Stepper —
 * nothing here is simulated when real trace data exists.
 */
import { useState } from 'react';

import type { ToolCallingCase } from '../../lib/agent';
import { createTraceScene } from '../../lib/viz';
import Stepper from './Stepper';
import TraceStepList from './TraceStepList';

export interface ToolCallingPlaygroundIslandProps {
  cases: ToolCallingCase[];
}

const OUTCOME_STYLE: Record<string, string> = {
  completed: 'var(--viz-complete)',
  'invalid-tool-request': 'var(--viz-warning)',
  'tool-error': 'var(--viz-error)',
  'max-steps-reached': 'var(--viz-warning)',
  'model-error': 'var(--viz-error)',
};

export default function ToolCallingPlaygroundIsland({ cases }: ToolCallingPlaygroundIslandProps) {
  const [selectedKey, setSelectedKey] = useState(cases[0]!.key);
  const [step, setStep] = useState(0);
  const selected = cases.find((c) => c.key === selectedKey)!;
  const scene = createTraceScene(selected.trace, step);

  const select = (key: ToolCallingCase['key']) => {
    setSelectedKey(key);
    setStep(0); // each case is its own trace
  };

  return (
    <section aria-label="Tool calling playground" className="space-y-4 rounded border border-slate-200 p-4">
      <fieldset>
        <legend className="text-sm font-medium">Outcome class</legend>
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
                name="tool-case"
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
            style={{ borderColor: OUTCOME_STYLE[selected.outcome] ?? 'var(--viz-neutral)' }}
          >
            {selected.outcome}
          </span>
          <span
            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500"
          >
            {selected.provenance === 'measured' ? `measured · ${selected.evidence}` : `scripted${selected.evidence ? ` · ${selected.evidence}` : ''}`}
          </span>
        </p>
        <p className="mt-1 text-slate-600">{selected.summary}</p>
      </div>

      <div>
        <h4 className="font-semibold">{scene.title}</h4>
        <p className="mt-1 min-h-10 text-sm text-slate-600">{scene.description}</p>
      </div>

      <TraceStepList scene={scene} />

      {selected.finalText !== undefined && (
        <p className="rounded border border-slate-200 p-2 text-sm" style={{ background: 'var(--viz-surface)' }}>
          <span className="font-semibold">Final answer:</span> <code>{selected.finalText}</code>
        </p>
      )}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label={`${selected.label} trace steps`}
        stepLabel={scene.title}
      />
    </section>
  );
}
