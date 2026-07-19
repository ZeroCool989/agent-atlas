/**
 * The evaluation lesson's Tier-2 steppable visual: run a small eval suite against a
 * buggy subject and watch it score case by case. State is a single `step` number; the
 * pure `createEvaluationScene` derives the whole scene from the real harness; this
 * renders it. Server-rendered at step 0, so the first frame is meaningful without JS.
 */
import { useState } from 'react';

import { createEvaluationScene, EVALUATION_DEMO_INPUT } from '../../lib/viz';
import type { EvalCaseView } from '../../lib/viz';
import Stepper from './Stepper';

function StatusBadge({ c }: { c: EvalCaseView }) {
  if (!c.revealed) {
    return <span className="text-slate-400" aria-label="not yet run">— pending</span>;
  }
  if (c.pass) {
    return (
      <span style={{ color: 'var(--viz-complete, #10b981)' }} className="font-medium">
        ✓ pass
      </span>
    );
  }
  return (
    <span style={{ color: 'var(--viz-warning, #f59e0b)' }} className="font-medium">
      ✗ fail{c.failReason ? ` — ${c.failReason}` : ''}
    </span>
  );
}

export default function EvaluationDemo() {
  const [step, setStep] = useState(0);
  const scene = createEvaluationScene(EVALUATION_DEMO_INPUT, step);

  return (
    <section aria-label="Evaluation run walkthrough" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The eval set, scored case by case as the run reveals each one. */}
      <ul
        className="divide-y divide-slate-200 rounded-md border border-slate-300 bg-slate-50"
        aria-label="Eval cases and their results"
      >
        {scene.cases.map((c) => (
          <li key={c.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-slate-700">
              {c.label}{' '}
              <span className="text-xs text-slate-400">({c.assertionKind})</span>
            </span>
            <span className="tabular-nums">
              <StatusBadge c={c} />
            </span>
          </li>
        ))}
      </ul>

      {/* The aggregate score, presented on the final step. */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Score</span>
          <span className="tabular-nums">
            {scene.passed} / {scene.total} passed{scene.scored ? ` (${scene.scorePercent}%)` : ''}
          </span>
        </div>
        <div
          className="h-4 w-full overflow-hidden rounded bg-slate-200"
          role="img"
          aria-label={`${scene.passed} of ${scene.total} eval cases passed`}
        >
          <div
            style={{
              width: `${scene.total ? (scene.passed / scene.total) * 100 : 0}%`,
              background: 'var(--viz-complete, #10b981)',
            }}
            className="h-full"
          />
        </div>
      </div>

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Evaluation steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        Every pass/fail comes from{' '}
        <a
          className="underline"
          href="https://github.com/ZeroCool989/agent-atlas/blob/main/src/lib/eval/harness.ts"
        >
          the eval harness in this repo
        </a>
        . The subject and cases are illustrative; the scoring is the real thing.
      </p>
    </section>
  );
}
