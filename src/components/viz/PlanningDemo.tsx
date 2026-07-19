/**
 * The Planning Tier-2 steppable visual: watch plan-then-execute run — a whole plan is made
 * up front, steps fill in, one fails, the planner re-plans the remainder, and the goal is
 * reached; a final beat contrasts a greedy planless run that just drifts. State is a single
 * `step`; the pure `createPlanningScene` derives the complete truth from the plan-execute
 * build project; this renderer only displays it. Server-rendered at step 0.
 */
import { useState } from 'react';

import { PLANNING_DEMO_INPUT, createPlanningScene } from '../../lib/viz';
import type { StepStatus } from '../../lib/planning/plan-execute';
import Stepper from './Stepper';

const STATUS_GLYPH: Record<StepStatus, string> = {
  pending: '○',
  running: '▶',
  done: '✓',
  failed: '✗',
  skipped: '–',
};

const STATUS_CLASS: Record<StepStatus, string> = {
  pending: 'text-slate-400',
  running: 'text-indigo-700 font-semibold',
  done: 'text-emerald-700',
  failed: 'text-rose-700 line-through',
  skipped: 'text-slate-400',
};

export default function PlanningDemo() {
  const [step, setStep] = useState(0);
  const scene = createPlanningScene(PLANNING_DEMO_INPUT, step);

  return (
    <section aria-label="Planning walkthrough" className="space-y-4">
      <p className="text-sm text-slate-600">
        Goal: <em>“{PLANNING_DEMO_INPUT.goal}”</em>
      </p>

      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The plan, filling in over time. Status is a word+glyph, never colour alone. */}
      <ol aria-label="Plan" className="space-y-1">
        {scene.plan.map((s) => (
          <li key={s.id} className="flex items-start gap-2 text-sm">
            <span className={`w-4 shrink-0 tabular-nums ${STATUS_CLASS[s.status]}`} aria-hidden="true">
              {STATUS_GLYPH[s.status]}
            </span>
            <span className="w-16 shrink-0 text-xs uppercase tracking-wide text-slate-400">{s.status}</span>
            <span>
              <span className={STATUS_CLASS[s.status]}>{s.description}</span>
              {s.result ? <span className="text-slate-500"> — {s.result}</span> : null}
            </span>
          </li>
        ))}
      </ol>

      {/* The greedy contrast, only on the final beat. */}
      {scene.greedy ? (
        <div className="rounded border border-rose-200 bg-rose-50 p-3">
          <p className="text-sm font-medium text-rose-800">Greedy, one step at a time (no plan):</p>
          <ol className="mt-1 space-y-1 text-sm">
            {scene.greedy.map((b, i) => (
              <li key={i} className={b.stuck ? 'text-rose-700' : 'text-slate-700'}>
                {b.action} → {b.result}
                {b.stuck ? ' ⟲' : ''}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Planning steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        The plan and every status are produced by the deterministic plan-then-execute harness in
        this repo (<code>src/lib/planning/</code>). Swap its scripted planner for a model call and
        the mechanism is unchanged.
      </p>
    </section>
  );
}
