/**
 * The flagship comparison: switch among four architectures and step through each one's
 * REAL execution trace (computed server-side by src/lib/agent, passed in as data).
 * Renderer only — all educational truth arrives via createTraceScene.
 *
 * Deliberate interaction choice: switching architecture resets the step to 0 — each
 * trace is its own timeline, and comparing "step 3 of A" with "step 3 of B" would
 * suggest a correspondence that doesn't exist.
 */
import { useState } from 'react';

import type { ArchitectureRun } from '../../lib/agent';
import { createTraceScene } from '../../lib/viz';
import Stepper from './Stepper';
import TraceStepList from './TraceStepList';

export interface ArchitectureComparisonIslandProps {
  runs: ArchitectureRun[];
  question: string;
}

export default function ArchitectureComparisonIsland({ runs, question }: ArchitectureComparisonIslandProps) {
  const [selectedKey, setSelectedKey] = useState(runs[0]!.key);
  const [step, setStep] = useState(0);
  const selected = runs.find((r) => r.key === selectedKey)!;
  const scene = createTraceScene(selected.trace, step);

  const selectArchitecture = (key: ArchitectureRun['key']) => {
    setSelectedKey(key);
    setStep(0); // each trace is its own timeline — see component docblock
  };

  return (
    <section
      aria-label="Architecture comparison"
      className="space-y-4 rounded border border-slate-200 p-4"
    >
      <p className="text-sm text-slate-600">
        Same task for all four — <strong>“{question}”</strong> — so what you compare is
        architecture, not use case.
      </p>

      <fieldset>
        <legend className="text-sm font-medium">Architecture</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {runs.map((run) => (
            <label
              key={run.key}
              className={`cursor-pointer rounded border px-3 py-1.5 text-sm ${
                run.key === selectedKey ? 'border-slate-900 font-semibold' : 'border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="architecture"
                value={run.key}
                checked={run.key === selectedKey}
                onChange={() => selectArchitecture(run.key)}
                className="sr-only"
              />
              {run.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded border border-slate-200 p-3 text-sm">
        <p>{selected.summary}</p>
        <p className="mt-1">
          <span className="font-semibold">Who decides the next step?</span> {selected.decider}.
        </p>
      </div>

      <div>
        <h4 className="font-semibold">{scene.title}</h4>
        <p className="mt-1 min-h-10 text-sm text-slate-600">{scene.description}</p>
        {scene.usage && (
          <p className="text-xs tabular-nums text-slate-500">
            declared metadata: {scene.usage.latencyMs} ms · {scene.usage.totalTokens} tokens
            {scene.usage.cost ? ` · $${scene.usage.cost.amount} (${scene.usage.cost.basis})` : ''}
          </p>
        )}
      </div>

      <TraceStepList scene={scene} />

      {selected.finalText !== undefined && (
        <p className="rounded border border-slate-200 p-2 text-sm" style={{ background: 'var(--viz-surface)' }}>
          <span className="font-semibold">Output:</span> <code>{selected.finalText}</code>
          {selected.key === 'direct' && (
            <span className="text-slate-600"> — confidently wrong (127 × 49 = 6,223). Nothing in this architecture can catch it.</span>
          )}
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
