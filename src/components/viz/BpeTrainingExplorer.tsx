/**
 * Watch BPE learn its vocabulary, merge by merge (Tokens lesson, Tier 2). The model is
 * trained by the REAL trainer on the checked-in corpus at module load — every number
 * on screen (frequencies, token counts) is computed, not scripted. Each step answers
 * one question: "what does the same text look like after k merges?"
 */
import { useMemo, useState } from 'react';

import { SAMPLE_TEXT, TEACHING_MERGES, TRAINING_CORPUS, trainBpe } from '../../lib/sim/tokenizer';
import { createBpeScene } from '../../lib/viz';
import Stepper from './Stepper';
import TokenStream from './TokenStream';

const display = (s: string) => s.replace(/ /g, '␣');

export default function BpeTrainingExplorer() {
  const model = useMemo(() => trainBpe(TRAINING_CORPUS, TEACHING_MERGES), []);
  const [step, setStep] = useState(0);
  const scene = createBpeScene(model, SAMPLE_TEXT, step);

  return (
    <section aria-label="BPE training walkthrough" className="space-y-4 rounded border border-slate-200 p-4">
      <div>
        <h3 className="text-lg font-semibold">{scene.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{scene.description}</p>
      </div>

      <TokenStream
        sourceText={scene.sampleText}
        tokens={scene.tokens}
        showBoundaries={true}
        showIds={false}
        stateText={{
          inactive: 'still a single character',
          active: 'token learned in this merge',
          completed: 'token learned in an earlier merge',
        }}
      />

      <p className="text-sm tabular-nums text-slate-600">
        “{scene.sampleText}” → <strong>{scene.tokenCount} tokens</strong> after{' '}
        {scene.mergesLearned} of {model.merges.length} merges
      </p>

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="BPE training steps"
        stepLabel={scene.title}
      />

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">
          Merge table so far ({scene.mergesLearned} learned)
        </summary>
        <ol className="mt-2 list-decimal space-y-0.5 pl-6 font-mono text-xs">
          {model.merges.slice(0, scene.mergesLearned).map((m) => (
            <li key={m.rank} className={m.rank === scene.mergesLearned - 1 ? 'font-bold' : ''}>
              "{display(m.left)}" + "{display(m.right)}" → "{display(m.merged)}" (seen {m.frequency}
              ×)
            </li>
          ))}
        </ol>
      </details>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">The training corpus (7 lines)</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs">{TRAINING_CORPUS.trim()}</pre>
        <p className="mt-1 text-xs text-slate-500">
          Deliberately tiny and repetitive so merges are predictable by eye. Production
          tokenizers run this exact algorithm over terabytes.
        </p>
      </details>
    </section>
  );
}
