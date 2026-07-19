/**
 * Renderer for the flat-vs-approximate vector-search scenes (ADR-0004). Controlled step
 * state; one instance owns its own step (no module state). Scenes are built at build time
 * from the real retrieval engine and passed in; this component only displays them.
 */
import { useState } from 'react';

import type { VectorSearchScene } from '../../lib/viz/vector-search-scene';
import Stepper from './Stepper';

export default function VectorSearchScanIsland({ scenes }: { scenes: VectorSearchScene[] }) {
  const [step, setStep] = useState(0);
  const scene = scenes[Math.min(step, scenes.length - 1)]!;

  return (
    <figure className="not-prose my-6 rounded-lg border border-slate-300 p-4">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium text-slate-700">
        <span>{scene.title}</span>
        <span className="flex gap-3 tabular-nums text-slate-600">
          <span data-testid="comparisons">
            {scene.comparisons} / {scene.corpusSize} compared
          </span>
          <span data-testid="recall">recall {scene.mode === 'setup' ? '—' : scene.recall.toFixed(2)}</span>
        </span>
      </figcaption>

      {scene.probedClusters.length > 0 && (
        <p className="mb-2 text-sm text-slate-600">
          Probed clusters:{' '}
          {scene.probedClusters.map((c) => (
            <span key={c} className="mr-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-900">
              {c}
            </span>
          ))}
        </p>
      )}

      <ol className="my-3 space-y-1">
        {scene.rows.map((row) => {
          const state = row.missed
            ? 'missed'
            : row.returned
              ? 'returned'
              : row.score === null
                ? 'unscanned'
                : 'scanned';
          return (
            <li
              key={row.text}
              data-state={state}
              className="grid grid-cols-[1fr_6rem_3rem] items-center gap-2 text-sm"
            >
              <span
                className={
                  state === 'returned'
                    ? 'font-semibold text-emerald-700'
                    : state === 'missed'
                      ? 'font-semibold text-rose-700'
                      : state === 'unscanned'
                        ? 'text-slate-300'
                        : 'text-slate-700'
                }
              >
                {row.text}
                {row.missed && ' — missed'}
              </span>
              <span className="text-xs text-slate-400">{row.cluster}</span>
              <span className="text-right tabular-nums text-slate-600">
                {row.score === null ? '·' : row.score.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mb-3 min-h-[3.5rem] text-sm text-slate-700">{scene.description}</p>

      <Stepper
        step={step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Flat versus approximate vector search"
        stepLabel={scene.description}
      />
    </figure>
  );
}
