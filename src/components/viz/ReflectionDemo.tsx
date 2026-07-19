/**
 * The Reflection Tier-2 steppable visual: watch produce → critique → revise run. A weak first
 * draft is scored by the critic (the eval harness, inline), revised, scored again — including an
 * honest beat where a revision scores WORSE — until a revision passes and is accepted. A final
 * caveat beat shows the load-bearing limit: run the same loop with a critic that rewards
 * agreement instead of truth, and it "improves" a correct answer into a wrong one at full critic
 * confidence. State is a single `step`; the pure `createReflectionScene` derives the complete
 * truth from the reflect-critique-revise build project; this renderer only displays it.
 * Server-rendered at step 0.
 */
import { useState } from 'react';

import { REFLECTION_DEMO_INPUT, createReflectionScene } from '../../lib/viz';
import type { ScoreDelta } from '../../lib/reflection/reflect';
import Stepper from './Stepper';

const DELTA_BADGE: Record<ScoreDelta, { label: string; className: string } | null> = {
  first: null,
  improved: { label: 'improved', className: 'bg-emerald-100 text-emerald-800' },
  regressed: { label: 'regressed', className: 'bg-rose-100 text-rose-800' },
  same: { label: 'no change', className: 'bg-amber-100 text-amber-800' },
};

/** A word+colour score bar — never colour alone. */
function ScoreMeter({ passed, total, pass }: { passed: number; total: number; pass: boolean }) {
  const percent = total === 0 ? 100 : Math.round((passed / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-32 overflow-hidden rounded bg-slate-200"
        role="img"
        aria-label={`Critic score: ${passed} of ${total} criteria met`}
      >
        <div
          className={pass ? 'h-full bg-emerald-500' : 'h-full bg-indigo-500'}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-sm tabular-nums text-slate-600">
        {passed}/{total} {pass ? '· passes' : ''}
      </span>
    </div>
  );
}

export default function ReflectionDemo() {
  const [step, setStep] = useState(0);
  const scene = createReflectionScene(REFLECTION_DEMO_INPUT, step);
  const badge = DELTA_BADGE[scene.delta];

  return (
    <section aria-label="Reflection walkthrough" className="space-y-4">
      <p className="text-sm text-slate-600">
        Goal: <em>“{REFLECTION_DEMO_INPUT.goal}”</em>
      </p>

      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The current draft under critique. */}
      <div
        className={`rounded border p-3 ${
          scene.accepted ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {scene.iteration === 0 ? 'Initial draft' : `Revision ${scene.iteration}`}
          </span>
          {badge ? (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-mono text-sm text-slate-800">“{scene.draft}”</p>
        <div className="mt-2">
          <ScoreMeter
            passed={scene.critique.passed}
            total={scene.critique.total}
            pass={scene.critique.pass}
          />
        </div>
        {scene.critique.issues.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-sm text-rose-700">
            {scene.critique.issues.map((issue, i) => (
              <li key={i}>• {issue}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* The caveat beat: critic confidence vs. a held-out oracle. */}
      {scene.caveat ? (
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm">
          <p className="font-medium text-rose-800">Self-critique is not independent verification:</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-slate-500">Critic’s confidence in the “improved” answer</dt>
            <dd className="font-semibold text-rose-700 tabular-nums">{scene.caveat.criticPercent}%</dd>
            <dt className="text-slate-500">Its true quality (held-out oracle)</dt>
            <dd className="font-semibold text-rose-700 tabular-nums">
              {scene.caveat.oracleOnBestPercent}%
            </dd>
            <dt className="text-slate-500">The original answer’s true quality (now discarded)</dt>
            <dd className="font-semibold text-emerald-700 tabular-nums">
              {scene.caveat.oracleOnInitialPercent}%
            </dd>
          </dl>
          <p className="mt-2 text-slate-700">
            The loop was fully confident and fully wrong. A separate check — a verifier, a test, or a
            human — is what would have caught it.
          </p>
        </div>
      ) : null}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Reflection steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        Every draft, score, and issue is produced by the deterministic reflect-critique-revise
        harness in this repo (<code>src/lib/reflection/</code>), whose critic is the eval harness
        applied inline. Swap its scripted producer and critic for model calls and the loop is
        unchanged.
      </p>
    </section>
  );
}
