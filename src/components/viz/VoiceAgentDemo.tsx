/**
 * The Voice agents Tier-2 steppable visual: watch one spoken turn move through the
 * speech pipeline (ASR → agent → TTS) while the turn-taking state machine advances and
 * the latency budget fills — then the user barges in and the agent stops. State is a
 * single `step`; the pure `createVoiceAgentsScene` derives the complete truth from the
 * voice build project (`src/lib/voice/`); this renderer only displays it. Server-rendered
 * at step 0; the Stepper handles reduced-motion.
 */
import { useState } from 'react';

import {
  VOICE_AGENTS_DEMO,
  TURN_STATES,
  createVoiceAgentsScene,
  type StageStatus,
} from '../../lib/viz';
import type { TurnState } from '../../lib/voice';
import Stepper from './Stepper';

const STATE_LABEL: Record<TurnState, string> = {
  idle: 'Idle',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

const STAGE_CLASS: Record<StageStatus, string> = {
  pending: 'border-slate-300 bg-slate-50 text-slate-400',
  active: 'border-indigo-400 bg-indigo-50 text-indigo-900',
  done: 'border-emerald-400 bg-emerald-50 text-emerald-800',
  error: 'border-rose-400 bg-rose-50 text-rose-800',
};

export default function VoiceAgentDemo() {
  const [step, setStep] = useState(0);
  const scene = createVoiceAgentsScene(VOICE_AGENTS_DEMO, step);
  const budgetPct = Math.min(100, Math.round((scene.elapsedMs / scene.budgetMs) * 100));

  return (
    <section aria-label="Voice agent walkthrough" className="space-y-4">
      <p className="text-sm text-slate-600">
        The user said: <em>“{scene.utterance}”</em>
      </p>

      {/* Turn-taking state machine: which of the four states the turn is in now. */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Turn-taking state</p>
        <ol className="mt-1 flex flex-wrap items-center gap-1" aria-label="Turn-taking state machine">
          {TURN_STATES.map((s, i) => {
            const active = s === scene.state;
            return (
              <li key={s} className="flex items-center gap-1">
                <span
                  aria-current={active ? 'step' : undefined}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    active
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-300 bg-white text-slate-500'
                  }`}
                >
                  {STATE_LABEL[s]}
                </span>
                {i < TURN_STATES.length - 1 ? <span aria-hidden="true" className="text-slate-400">→</span> : null}
              </li>
            );
          })}
          {scene.interrupted ? (
            <li className="ml-1 rounded-full border border-amber-400 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
              barge-in ↩ back to listening
            </li>
          ) : null}
        </ol>
      </div>

      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The pipeline: three stages the words pass through, each with its modeled latency. */}
      <figure className="space-y-1">
        <div className="flex flex-wrap items-stretch gap-1" aria-label="Speech pipeline: ASR to agent to TTS">
          <span className="flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-500">
            🎙 audio in
          </span>
          {scene.stages.map((stage, i) => (
            <span key={stage.name} className="flex items-center gap-1">
              <span aria-hidden="true" className="text-slate-400">→</span>
              <span
                className={`flex flex-col rounded border px-2.5 py-1 text-xs font-medium ${STAGE_CLASS[stage.status]}`}
              >
                <span>
                  {stage.label}
                  {stage.corrupted ? ' ⚠' : ''}
                </span>
                <span className="tabular-nums font-normal opacity-80">
                  {stage.latencyMs !== undefined ? `+${stage.latencyMs}ms` : '—'}
                </span>
              </span>
              {i === scene.stages.length - 1 ? (
                <>
                  <span aria-hidden="true" className="text-slate-400">→</span>
                  <span className="flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-500">
                    🔊 audio out
                  </span>
                </>
              ) : null}
            </span>
          ))}
        </div>
        <figcaption className="text-xs text-slate-500">
          Modeled, illustrative latencies — not measured benchmarks. A <span className="text-rose-700">⚠</span> marks a
          stage carrying a mis-heard transcript it cannot detect.
        </figcaption>
      </figure>

      {/* The text in flight: ground truth vs what the pipeline is now working with. */}
      <div
        className={`rounded border p-3 text-sm ${
          scene.fidelity === 'corrupted'
            ? 'border-rose-300 bg-rose-50 text-rose-900'
            : 'border-slate-200 bg-slate-50 text-slate-700'
        }`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {scene.fidelity === 'corrupted' ? 'In the pipeline (mis-heard)' : 'In the pipeline'}
        </span>
        <p className="mt-0.5">
          “{scene.streamText}”
          {scene.mistranscribed ? (
            <span className="ml-1 font-semibold">← ASR heard this, not what was said</span>
          ) : null}
        </p>
      </div>

      {/* The latency budget: what the user waits before hearing anything. */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide">End-to-end latency budget</span>
          <span className="tabular-nums">
            {scene.elapsedMs}ms / {scene.budgetMs}ms {scene.overBudget ? '— over budget' : ''}
          </span>
        </div>
        <div
          className="mt-1 h-3 w-full overflow-hidden rounded bg-slate-200"
          role="img"
          aria-label={`Accumulated latency ${scene.elapsedMs} of ${scene.budgetMs} millisecond budget${
            scene.overBudget ? ', over budget' : ''
          }`}
        >
          <div
            className={`h-full ${scene.overBudget ? 'bg-rose-500' : 'bg-emerald-500'}`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>

      {scene.outcome ? (
        <div
          className={`rounded border p-3 text-sm ${
            scene.corruptedOutcome
              ? 'border-rose-300 bg-rose-50 text-rose-900'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800'
          }`}
        >
          Outcome: <strong>{scene.outcome}</strong>.{' '}
          {scene.corruptedOutcome
            ? 'A single mis-heard word five steps back was never caught, so the agent confidently spoke the wrong answer — and the user had to barge in to correct it. The mechanism "worked"; the result was wrong.'
            : 'The turn completed within the machine, though the latency budget was still blown.'}
        </div>
      ) : null}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Voice agent steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        The states, the latency numbers, the mistranscription, and the barge-in are all produced by the
        deterministic loop in this repo (<code>src/lib/voice/</code>). Swap its scripted agent for a real
        tool-calling agent and the loop is unchanged.
      </p>
    </section>
  );
}
