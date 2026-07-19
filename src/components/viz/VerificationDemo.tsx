/**
 * The verification lesson's Tier-2 steppable visual: step candidate model outputs through
 * a four-gate verification pipeline (schema → value → grounding → policy) and watch which
 * gate catches each one — ending on the honest limit, an output that clears every gate and
 * is still wrong. State is a single `step`; the pure `createVerificationScene` derives the
 * whole scene from the real `src/lib/verification` module; this only renders it. Server-
 * rendered at step 0, so the first frame is meaningful before (or without) hydration.
 */
import { useState } from 'react';

import { createVerificationScene, VERIFICATION_DEMO_INPUT } from '../../lib/viz';
import type { GateStatus, VerificationCandidateView, VerificationGateView } from '../../lib/viz';
import Stepper from './Stepper';

const GATE_GLYPH: Record<GateStatus, string> = {
  pending: '·',
  passed: '✓',
  failed: '✗',
  skipped: '–',
};

const GATE_STYLE: Record<GateStatus, string> = {
  pending: 'border-slate-200 text-slate-300',
  passed: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-400 bg-rose-50 text-rose-700 font-semibold',
  skipped: 'border-slate-200 bg-slate-50 text-slate-400',
};

function GateBadge({ gate }: { gate: VerificationGateView }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${GATE_STYLE[gate.status]}`}
      title={gate.detail ?? gate.kind}
    >
      <span aria-hidden="true">{GATE_GLYPH[gate.status]}</span>
      {gate.kind}
    </span>
  );
}

function CandidateRow({ candidate }: { candidate: VerificationCandidateView }) {
  const border = candidate.trapExposed
    ? 'border-amber-500 bg-amber-50'
    : !candidate.revealed
      ? 'border-slate-200'
      : candidate.verdict === 'proceeds'
        ? 'border-emerald-300 bg-emerald-50'
        : 'border-rose-300 bg-rose-50';

  let verdict: string;
  if (!candidate.revealed) verdict = 'not yet run';
  else if (candidate.trapExposed) verdict = 'proceeds — yet the output is wrong';
  else if (candidate.verdict === 'proceeds') verdict = 'may proceed';
  else verdict = `blocked at the ${candidate.blockedAtKind} gate`;

  return (
    <li className={`rounded border p-3 text-sm ${border}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-700">{candidate.label}</span>
        <span className="text-xs font-medium text-slate-600">Verdict: {verdict}</span>
      </div>
      <p className="mt-1 break-words font-mono text-xs text-slate-500">{candidate.text}</p>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Gate results">
        {candidate.gates.map((g) => (
          <GateBadge key={g.kind} gate={g} />
        ))}
      </div>
    </li>
  );
}

export default function VerificationDemo() {
  const [step, setStep] = useState(0);
  const scene = createVerificationScene(VERIFICATION_DEMO_INPUT, step);

  return (
    <section aria-label="Verification pipeline walkthrough" className="space-y-4">
      <p className="text-sm text-slate-600">
        A refund-decision output, checked against four independent gates —{' '}
        {scene.gates.map((g) => g.kind).join(' → ')} — before anything is acted on.
      </p>

      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      <ol className="space-y-2" aria-label="Candidate outputs and their gate verdicts">
        {scene.candidates.map((c) => (
          <CandidateRow key={c.label} candidate={c} />
        ))}
      </ol>

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Verification steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        Every gate verdict is computed live by{' '}
        <a
          className="underline"
          href="https://github.com/ZeroCool989/agent-atlas/tree/main/src/lib/verification"
        >
          the verification module in this repo
        </a>
        . The gates reuse structured-outputs&rsquo; schema validation, the eval assertion
        kinds, and the reliability citation checker. They reliably catch what each is
        written to catch — and the last step shows what none of them can.
      </p>
    </section>
  );
}
