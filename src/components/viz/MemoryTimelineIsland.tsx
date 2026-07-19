/**
 * Renderer for the agent-memory scenes (ADR-0004). Controlled step state; one instance owns its
 * own step — no module state. Scenes are built at build time from the real `src/lib/memory`
 * module and passed in; this component only displays them.
 */
import { useState } from 'react';

import type { MemoryScene } from '../../lib/viz/memory-scene';
import Stepper from './Stepper';

const STAGES: Array<{ id: MemoryScene['stage']; label: string }> = [
  { id: 'converse', label: 'Converse' },
  { id: 'compact', label: 'Compact' },
  { id: 'retrieve', label: 'Retrieve' },
  { id: 'assemble', label: 'Assemble' },
];

/** Map a cosine score in [-1, 1] to a 0–100 bar width. */
const barWidth = (score: number) => Math.round(((score + 1) / 2) * 100);

export default function MemoryTimelineIsland({ scenes }: { scenes: MemoryScene[] }) {
  const [step, setStep] = useState(0);
  const scene = scenes[Math.min(step, scenes.length - 1)]!;
  const activeStage = STAGES.findIndex((s) => s.id === scene.stage);
  const fill = Math.min(100, Math.round((scene.workingTokens / scene.windowTokens) * 100));

  return (
    <figure className="not-prose my-6 rounded-lg border border-slate-300 p-4">
      <figcaption className="mb-3 text-sm font-medium text-slate-700">
        Agent memory · {scene.title}
      </figcaption>

      {/* Stage strip */}
      <ol className="mb-3 flex flex-wrap gap-1 text-xs" aria-hidden="true">
        {STAGES.map((s, i) => (
          <li
            key={s.id}
            className={`rounded px-2 py-1 ${
              i === activeStage
                ? 'bg-slate-800 text-white'
                : i < activeStage
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {/* Working-memory window budget */}
      <p className="my-2 text-sm text-slate-600">
        Working memory:{' '}
        <span className={fill > 100 ? 'font-medium text-slate-900' : 'font-medium text-slate-900'}>
          {scene.workingTokens} tokens
        </span>{' '}
        of the {scene.windowTokens}-token window
        <span className="mt-1 block h-2 w-full rounded bg-slate-100" aria-hidden="true">
          <span
            className={`block h-2 rounded ${scene.workingTokens > scene.windowTokens ? 'bg-slate-800' : 'bg-slate-500'}`}
            style={{ width: `${fill}%` }}
          />
        </span>
      </p>

      {/* Compaction summary */}
      {scene.summary && (
        <p className="my-2 rounded bg-slate-50 p-2 text-sm text-slate-700">
          <span className="font-medium">Summary of {scene.summarizedCount} older turn(s):</span>{' '}
          {scene.summary}
        </p>
      )}

      {/* Recent (verbatim) working turns */}
      <ol className="my-2 space-y-1">
        {scene.recent.map((t) => (
          <li key={t.id} className="text-sm">
            <span className="font-medium text-slate-500">{t.role}:</span>{' '}
            <span className="text-slate-800">{t.text}</span>
          </li>
        ))}
      </ol>

      {/* Episodic retrieval hits */}
      {scene.retrieved.length > 0 && (
        <>
          <p className="mt-3 text-sm text-slate-600">
            Query:{' '}
            <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-900">
              {scene.query}
            </span>{' '}
            → nearest stored turns:
          </p>
          <ol className="my-2 space-y-1">
            {scene.retrieved.map((h, i) => (
              <li
                key={h.turn.id}
                className="grid grid-cols-[2.5rem_1fr_4rem_3rem] items-start gap-2 text-sm"
              >
                <span className="tabular-nums font-medium text-slate-500">
                  #{i + 1} {h.turn.id}
                </span>
                <span className="text-slate-800">{h.turn.text}</span>
                <span className="mt-1 h-2 rounded bg-slate-100" aria-hidden="true">
                  <span
                    className="block h-2 rounded bg-slate-500"
                    style={{ width: `${barWidth(h.score)}%` }}
                  />
                </span>
                <span className="text-right tabular-nums text-slate-600">{h.score.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="mb-3 min-h-[3rem] text-sm text-slate-700">{scene.description}</p>

      <Stepper
        step={step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Agent memory steps"
        stepLabel={scene.description}
      />
    </figure>
  );
}
