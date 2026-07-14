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

      <ol aria-label="Execution trace" className="space-y-1">
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
              <span
                className="rounded border px-1.5 py-0.5 font-mono text-[10px]"
                style={actor.style}
              >
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
