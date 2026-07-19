/**
 * Renderer for the Reliability-patterns scenes (ADR-0004). Controlled step state; one instance owns
 * its own step — no module state. The scenes are built at build time from the real
 * `src/lib/resilience/` wrappers (run under a deterministic virtual clock) and passed in as plain
 * data; this component only displays them. Server-rendered at step 0.
 */
import { useState } from 'react';

import type { BeatTone, ResilienceScene } from '../../lib/viz/resilience-scene';
import Stepper from './Stepper';

const TONE_BADGE: Record<BeatTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  ok: 'bg-emerald-100 text-emerald-800',
  fail: 'bg-rose-100 text-rose-800',
  warn: 'bg-amber-100 text-amber-800',
  open: 'bg-rose-100 text-rose-800',
  'half-open': 'bg-amber-100 text-amber-800',
  closed: 'bg-emerald-100 text-emerald-800',
};

const CIRCUIT_CHIP: Record<string, string> = {
  closed: 'bg-emerald-100 text-emerald-800',
  open: 'bg-rose-100 text-rose-800',
  'half-open': 'bg-amber-100 text-amber-800',
};

const OUTCOME_CHIP: Record<string, string> = {
  recovered: 'bg-emerald-100 text-emerald-800',
  degraded: 'bg-amber-100 text-amber-800',
  protected: 'bg-emerald-100 text-emerald-800',
};

const SCENARIO_LABELS = ['Retry + backoff', 'Timeout → fallback', 'Circuit breaker'];

export default function ResilienceStackIsland({ scenes }: { scenes: ResilienceScene[] }) {
  const [step, setStep] = useState(0);
  const scene = scenes[Math.min(step, scenes.length - 1)]!;
  const scenarioBeats = scenes.filter((s) => s.scenarioIndex === scene.scenarioIndex);

  return (
    <figure className="not-prose my-6 rounded-lg border border-slate-300 p-4">
      <figcaption className="mb-3 text-sm font-medium text-slate-700">
        Reliability stack · {scene.scenarioTitle}
      </figcaption>

      {/* Scenario strip — which of the three patterns we are watching. */}
      <ol className="mb-3 flex flex-wrap gap-1 text-xs" aria-hidden="true">
        {SCENARIO_LABELS.map((label, i) => (
          <li
            key={label}
            className={`rounded px-2 py-1 ${
              i === scene.scenarioIndex
                ? 'bg-slate-800 text-white'
                : i < scene.scenarioIndex
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <p className="mb-3 text-sm text-slate-500">{scene.scenarioSubtitle}</p>

      {/* Current beat. */}
      <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">{scene.title}</h3>
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${TONE_BADGE[scene.tone]}`}>
              {scene.badge}
            </span>
            <span className="rounded bg-slate-200 px-2 py-0.5 text-xs tabular-nums text-slate-700">
              t = {scene.elapsedMs}ms
            </span>
          </div>
        </div>
        <p className="mt-2 min-h-[3.5rem] text-sm text-slate-700">{scene.description}</p>

        {/* Running state chips. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {scene.attempt !== undefined && (
            <span className="rounded border border-slate-300 px-2 py-0.5 tabular-nums">
              call/attempt #{scene.attempt}
            </span>
          )}
          {scene.circuitState !== undefined && (
            <span className={`rounded px-2 py-0.5 font-medium ${CIRCUIT_CHIP[scene.circuitState]}`}>
              breaker: {scene.circuitState}
            </span>
          )}
        </div>
      </div>

      {/* Event log for the current scenario, current beat highlighted. */}
      <ol className="my-3 space-y-1">
        {scenarioBeats.map((b) => {
          const active = b.step === scene.step;
          return (
            <li
              key={b.step}
              className={`grid grid-cols-[5rem_1fr_4rem] items-center gap-2 rounded px-2 py-1 text-xs ${
                active ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500'
              }`}
            >
              <span className={`rounded px-1.5 py-0.5 text-center ${TONE_BADGE[b.tone]}`}>{b.badge}</span>
              <span className="truncate">{b.title}</span>
              <span className="text-right tabular-nums">{b.elapsedMs}ms</span>
            </li>
          );
        })}
      </ol>

      {/* Scenario outcome + honest takeaway, on the last beat of a scenario. */}
      {scene.isScenarioEnd && scene.outcome && (
        <div className="my-3 rounded border border-slate-200 p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-medium text-slate-800">
            <span className={`rounded px-2 py-0.5 text-xs uppercase ${OUTCOME_CHIP[scene.outcomeKind ?? '']}`}>
              {scene.outcomeKind}
            </span>
            {scene.outcome}
          </p>
          <p className="mt-2 text-slate-600">{scene.takeaway}</p>
        </div>
      )}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Reliability stack steps"
        stepLabel={scene.title}
      />

      <p className="mt-3 text-xs text-slate-500">
        Every attempt count, backoff delay, timeout, and breaker transition is produced by the
        deterministic wrappers in this repo (<code>src/lib/resilience/</code>), run under a virtual
        clock. Swap that clock for the system clock and the same code runs in production.
      </p>
    </figure>
  );
}
