/**
 * Renderer for the nearest-neighbor retrieval scenes (ADR-0004). Controlled step state,
 * one instance owns its own step — no module state. The scenes are built at build time
 * from the real retrieval engine and passed in; this component only displays them.
 */
import { useState } from 'react';

import type { RetrievalScene } from '../../lib/viz/retrieval-scene';
import Stepper from './Stepper';

/** Map a cosine score in [-1, 1] to a 0–100 bar width. */
const barWidth = (score: number) => Math.round(((score + 1) / 2) * 100);

export default function RetrievalRankingIsland({ scenes }: { scenes: RetrievalScene[] }) {
  const [step, setStep] = useState(0);
  const scene = scenes[Math.min(step, scenes.length - 1)]!;

  return (
    <figure className="not-prose my-6 rounded-lg border border-slate-300 p-4">
      <figcaption className="mb-3 text-sm font-medium text-slate-700">
        {scene.title}
      </figcaption>

      <p className="mb-1 text-sm text-slate-600">
        Query vector:{' '}
        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-900">
          {scene.query}
        </span>
      </p>

      <ol className="my-3 space-y-1">
        {scene.candidates.map((candidate) => (
          <li
            key={candidate.text}
            className="grid grid-cols-[1.5rem_5rem_1fr_3rem] items-center gap-2 text-sm"
            data-revealed={candidate.revealed || undefined}
          >
            <span className="tabular-nums text-slate-400">
              {candidate.revealed ? candidate.rank : '·'}
            </span>
            <span className={candidate.revealed ? 'font-medium text-slate-900' : 'text-slate-400'}>
              {candidate.text}
            </span>
            <span className="h-2 rounded bg-slate-100" aria-hidden="true">
              {candidate.revealed && (
                <span
                  className="block h-2 rounded bg-slate-500"
                  style={{ width: `${barWidth(candidate.score)}%` }}
                />
              )}
            </span>
            <span className="text-right tabular-nums text-slate-600">
              {candidate.revealed ? candidate.score.toFixed(2) : '—'}
            </span>
          </li>
        ))}
      </ol>

      <p className="mb-3 min-h-[2.5rem] text-sm text-slate-700">{scene.description}</p>

      <Stepper
        step={step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label={`Nearest-neighbor ranking of ${scene.query}`}
        stepLabel={scene.description}
      />
    </figure>
  );
}
