/**
 * Renderer for the RAG-pipeline scenes (ADR-0004). Controlled step state; one instance owns
 * its own step — no module state. The scenes are built at build time from the real
 * `src/lib/rag` pipeline and passed in; this component only displays them.
 */
import { useState } from 'react';

import type { RagScene } from '../../lib/viz/rag-scene';
import Stepper from './Stepper';

const STAGES: Array<{ id: RagScene['stage']; label: string }> = [
  { id: 'question', label: 'Question' },
  { id: 'retrieve', label: 'Retrieve' },
  { id: 'assemble', label: 'Assemble' },
  { id: 'generate', label: 'Generate' },
];

/** Map a cosine score in [-1, 1] to a 0–100 bar width. */
const barWidth = (score: number) => Math.round(((score + 1) / 2) * 100);

export default function RagPipelineIsland({ scenes }: { scenes: RagScene[] }) {
  const [step, setStep] = useState(0);
  const scene = scenes[Math.min(step, scenes.length - 1)]!;
  const activeStage = STAGES.findIndex((s) => s.id === scene.stage);

  return (
    <figure className="not-prose my-6 rounded-lg border border-slate-300 p-4">
      <figcaption className="mb-3 text-sm font-medium text-slate-700">
        RAG pipeline · {scene.title}
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

      <p className="mb-2 text-sm text-slate-600">
        Question:{' '}
        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-900">
          {scene.question}
        </span>
      </p>

      {/* Retrieved passages with real cosine scores */}
      {scene.retrieved.length > 0 && (
        <ol className="my-3 space-y-1">
          {scene.retrieved.map((p, i) => (
            <li
              key={p.id}
              className="grid grid-cols-[2.5rem_1fr_4rem_3rem] items-start gap-2 text-sm"
            >
              <span className="tabular-nums font-medium text-slate-500">
                #{i + 1} {p.id}
              </span>
              <span className="text-slate-800">{p.text}</span>
              <span className="mt-1 h-2 rounded bg-slate-100" aria-hidden="true">
                <span
                  className="block h-2 rounded bg-slate-500"
                  style={{ width: `${barWidth(p.score)}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-slate-600">{p.score.toFixed(2)}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Context budget bar, once assembled */}
      {scene.contextTokens > 0 && (
        <p className="my-2 text-sm text-slate-600">
          Retrieved context:{' '}
          <span className="font-medium text-slate-900">{scene.contextTokens} tokens</span> of the{' '}
          {scene.windowTokens}-token window
          <span className="mt-1 block h-2 w-full rounded bg-slate-100" aria-hidden="true">
            <span
              className="block h-2 rounded bg-slate-500"
              style={{ width: `${Math.min(100, Math.round((scene.contextTokens / scene.windowTokens) * 100))}%` }}
            />
          </span>
        </p>
      )}

      {/* Grounded answer, once generated */}
      {scene.answer && (
        <p className="my-2 rounded bg-slate-50 p-2 text-sm text-slate-900">
          <span className="font-medium">Answer:</span> {scene.answer}
        </p>
      )}

      <p className="mb-3 min-h-[3rem] text-sm text-slate-700">{scene.description}</p>

      <Stepper
        step={step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="RAG pipeline steps"
        stepLabel={scene.description}
      />
    </figure>
  );
}
