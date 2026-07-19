/**
 * The "what a language model is" Tier-2 steppable visual: watch inference run as an
 * autoregressive loop — the model predicts a next-token distribution, appends the most
 * likely token, and repeats. State is a single `step`; the pure `createGenerationScene`
 * derives the complete truth; this renderer only displays it. Server-rendered at step 0,
 * so the first frame is meaningful before (or without) hydration.
 */
import { useState } from 'react';

import { createGenerationScene, GENERATION_DEMO_INPUT } from '../../lib/viz';
import Stepper from './Stepper';

export default function GenerationDemo() {
  const [step, setStep] = useState(0);
  const scene = createGenerationScene(GENERATION_DEMO_INPUT, step);
  const maxProb = scene.candidates.reduce((m, c) => Math.max(m, c.prob), 0) || 1;

  return (
    <section aria-label="Generation walkthrough" className="space-y-4">
      <p className="text-sm text-slate-600">
        A tiny bigram model trained on a few sentences, generating from the prompt{' '}
        <em>“{GENERATION_DEMO_INPUT.prompt}”</em>.
      </p>

      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The growing token sequence: prompt tokens muted, generated tokens accented. */}
      <p className="font-mono text-lg leading-relaxed" aria-label="Sequence so far">
        {scene.sequence.map((tok, i) => (
          <span
            key={i}
            className={i < scene.promptLength ? 'text-slate-500' : 'font-semibold text-indigo-700'}
          >
            {tok}
            {i < scene.sequence.length - 1 ? ' ' : ''}
          </span>
        ))}
        {scene.phase === 'predict' ? <span className="text-slate-400"> ▌</span> : null}
      </p>

      {/* The next-token distribution at this step (real probabilities from the model). */}
      {scene.candidates.length > 0 ? (
        <ul aria-label="Next-token distribution" className="space-y-1">
          {scene.candidates.map((c) => (
            <li key={c.token} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 truncate font-mono" title={c.token}>
                {c.token}
              </span>
              <span className="h-3 flex-1 rounded bg-slate-100">
                <span
                  className={`block h-3 rounded ${c.chosen ? 'bg-indigo-600' : 'bg-slate-400'}`}
                  style={{ width: `${(c.prob / maxProb) * 100}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right tabular-nums text-slate-600">
                {(c.prob * 100).toFixed(0)}%
              </span>
              {c.chosen ? <span className="text-xs text-indigo-700">← chosen</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Generation steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        The distribution at every step is computed live by{' '}
        <a
          className="underline"
          href="https://github.com/ZeroCool989/agent-atlas/blob/main/src/lib/sim/language-model/next-token.ts"
        >
          the next-token model in this repo
        </a>
        . Real counting and prediction; the tiny corpus is a teaching prop.
      </p>
    </section>
  );
}
