/**
 * The Prompt injection Tier-2 steppable visual: watch one request run two ways. The trusted
 * system prompt + user task and an untrusted retrieved article are concatenated into ONE stream;
 * a provenance-blind model proposes both the real reply and an injected exfiltration. In the
 * NAIVE pipeline the injected action executes (data exfiltrated); in the MITIGATED pipeline the
 * SAME attack is refused by layered architectural controls while the real reply completes. State
 * is a single `step`; the pure `createPromptInjectionScene` derives the complete truth from the
 * security build project; this renderer only displays it. Server-rendered at step 0.
 */
import { useState } from 'react';

import { PROMPT_INJECTION_DEMO, createPromptInjectionScene } from '../../lib/viz';
import type { PromptInjectionStatus } from '../../lib/viz';
import type { Trust } from '../../lib/security';
import Stepper from './Stepper';

const STATUS_LABEL: Record<PromptInjectionStatus, string> = {
  assembling: 'Assembling',
  reading: 'Model proposes',
  executed: 'Executed',
  harm: 'Harm',
  allowed: 'Allowed',
  blocked: 'Blocked',
  outcome: 'Outcome',
};

const STATUS_CLASS: Record<PromptInjectionStatus, string> = {
  assembling: 'bg-slate-100 text-slate-700 border-slate-300',
  reading: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  executed: 'bg-sky-50 text-sky-800 border-sky-300',
  harm: 'bg-rose-50 text-rose-800 border-rose-400',
  allowed: 'bg-emerald-50 text-emerald-800 border-emerald-400',
  blocked: 'bg-emerald-50 text-emerald-800 border-emerald-400',
  outcome: 'bg-slate-100 text-slate-700 border-slate-300',
};

const TRUST_CLASS: Record<Trust, string> = {
  trusted: 'border-slate-300 bg-slate-50',
  untrusted: 'border-rose-300 bg-rose-50',
};

export default function PromptInjectionDemo() {
  const [step, setStep] = useState(0);
  const scene = createPromptInjectionScene(PROMPT_INJECTION_DEMO, step);

  return (
    <section aria-label="Prompt injection walkthrough" className="space-y-4">
      <p className="text-sm text-slate-600">
        Task: <em>“Answer the customer's refund question and reply.”</em> One of the retrieved
        documents is attacker-controlled.
      </p>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[scene.status]}`}>
            {STATUS_LABEL[scene.status]}
          </span>
          <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
            phase: {scene.phase}
          </span>
          {scene.call ? (
            <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
              {scene.call.tool} · {scene.call.consequence} · from {scene.call.origin} text
            </span>
          ) : null}
        </div>
        <h2 className="mt-2 text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The one assembled stream: system + user + untrusted article. Untrusted segments are
          marked in red — but note nothing INSIDE the stream tells the model which is which. */}
      <figure className="space-y-1">
        <ol
          aria-label="The single concatenated prompt stream"
          className="space-y-2 rounded border border-slate-300 bg-white p-3"
        >
          {scene.segments.map((segment) => (
            <li
              key={segment.source}
              className={`rounded border p-2 text-sm ${TRUST_CLASS[segment.trust]} ${
                segment.active ? 'ring-2 ring-indigo-400' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-500">{segment.source}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                    segment.trust === 'untrusted'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {segment.trust}
                </span>
              </div>
              <p className="mt-1 text-slate-700">{segment.text}</p>
            </li>
          ))}
        </ol>
        <figcaption className="text-xs text-slate-500">
          One token stream. The trust labels are the runtime's knowledge — the model reading the
          stream has no reliable boundary between your instructions and text that merely appears in
          the data.
        </figcaption>
      </figure>

      {scene.firedControls ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Refused by layered controls:{' '}
          <strong>{scene.firedControls.join(', ')}</strong>. Defense-in-depth — and still a
          risk reduction, not a guarantee.
        </div>
      ) : null}

      {scene.outcome ? (
        <div
          className={`rounded border p-3 text-sm ${
            scene.outcome.injectionSucceeded
              ? 'border-rose-300 bg-rose-50 text-rose-800'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800'
          }`}
        >
          {scene.outcome.injectionSucceeded ? (
            <>
              Outcome: <strong>injection succeeded</strong>. The reply went out AND the customer
              record was exfiltrated — the naive pipeline could not tell the attacker's instruction
              from the task.
            </>
          ) : (
            <>
              Outcome: <strong>injection refused</strong>, legitimate reply completed. The model
              still proposed the attack; the architecture around it — not a smarter prompt — is what
              stopped it.
            </>
          )}
        </div>
      ) : null}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Prompt injection steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        The stream, the model's proposals, and every control decision are produced by the
        deterministic pipeline in this repo (<code>src/lib/security/</code>). No model is called and
        no network is touched — the attack and its containment are modelled in memory.
      </p>
    </section>
  );
}
