/**
 * The failure-modes lesson's Tier-2 steppable visual: a deterministic citation checker
 * reveals its verdict on each sentence of a confident, grounded-looking answer, then a
 * final step exposes what it cannot catch. State is a single `step`; the pure
 * `createCitationCheckScene` derives the complete truth; this renders it. Server-rendered
 * at step 0, so the first frame is meaningful before (or without) hydration.
 */
import { useState } from 'react';

import {
  CITATION_CHECK_DEMO_INPUT,
  createCitationCheckScene,
  type CitationCheckRow,
} from '../../lib/viz/citation-check-scene';
import Stepper from './Stepper';

const STATUS_LABEL: Record<CitationCheckRow['status'], string> = {
  unchecked: 'not checked',
  supported: 'citation resolves',
  'fabricated-citation': 'fabricated citation',
  'uncited-claim': 'no citation',
};

function rowClass(row: CitationCheckRow): string {
  if (row.trapExposed) return 'border-amber-500 bg-amber-50';
  if (!row.revealed) return 'border-slate-200';
  if (row.status === 'supported') return 'border-emerald-300 bg-emerald-50';
  if (row.status === 'fabricated-citation') return 'border-rose-300 bg-rose-50';
  return 'border-slate-300 bg-slate-50';
}

export default function CitationCheckDemo() {
  const [step, setStep] = useState(0);
  const scene = createCitationCheckScene(CITATION_CHECK_DEMO_INPUT, step);

  return (
    <section aria-label="Citation check walkthrough" className="space-y-4">
      <p className="text-sm text-slate-600">
        A grounded answer, checked sentence by sentence against the two sources actually
        retrieved (<code>history</code>, <code>specs</code>).
      </p>

      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      <ol className="space-y-2">
        {scene.rows.map((row, i) => (
          <li key={i} className={`rounded border p-3 text-sm ${rowClass(row)}`}>
            <p>{row.sentence}</p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {row.revealed || row.trapExposed ? (
                <>
                  Verdict: {STATUS_LABEL[row.status]}
                  {row.trapExposed && ' — but the source does not support it (see note above)'}
                </>
              ) : (
                'Verdict: pending'
              )}
            </p>
          </li>
        ))}
      </ol>

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Citation check steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        Every verdict is computed live by{' '}
        <a
          className="underline"
          href="https://github.com/ZeroCool989/agent-atlas/blob/main/src/lib/reliability/citation-check.ts"
        >
          the citation checker in this repo
        </a>
        . It reliably catches fabricated and missing citations; it cannot tell whether a
        resolving citation actually supports its claim — that is the point of the last step.
      </p>
    </section>
  );
}
