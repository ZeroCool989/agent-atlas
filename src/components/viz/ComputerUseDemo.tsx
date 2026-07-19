/**
 * The Computer use Tier-2 steppable visual: watch the perceive → decide → act loop run over
 * a mock screen — a screenshot is taken, the policy proposes an action (its target highlighted
 * and its click point drawn), the runtime gate refuses an injected instruction and confirms a
 * genuinely consequential action, the screen updates, and the goal is reached. State is a single
 * `step`; the pure `createComputerUseScene` derives the complete truth from the computer-use build
 * project; this renderer only displays it. Server-rendered at step 0.
 */
import { useState } from 'react';

import { COMPUTER_USE_DEMO, createComputerUseScene } from '../../lib/viz';
import type { SceneStatus } from '../../lib/viz';
import Stepper from './Stepper';

// The virtual screen's own coordinate space (see src/lib/computer-use/demo.ts).
const SCREEN_W = 400;
const SCREEN_H = 180;

const STATUS_LABEL: Record<SceneStatus, string> = {
  perceiving: 'Perceiving',
  proposed: 'Proposed',
  'awaiting-confirmation': 'Awaiting confirmation',
  refused: 'Refused',
  confirmed: 'Confirmed',
  acted: 'Acted',
  done: 'Done',
  stopped: 'Stopped',
};

const STATUS_CLASS: Record<SceneStatus, string> = {
  perceiving: 'bg-slate-100 text-slate-700 border-slate-300',
  proposed: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  'awaiting-confirmation': 'bg-amber-50 text-amber-900 border-amber-400',
  refused: 'bg-rose-50 text-rose-800 border-rose-400',
  confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-400',
  acted: 'bg-sky-50 text-sky-800 border-sky-300',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-400',
  stopped: 'bg-slate-100 text-slate-700 border-slate-300',
};

export default function ComputerUseDemo() {
  const [step, setStep] = useState(0);
  const scene = createComputerUseScene(COMPUTER_USE_DEMO, step);

  return (
    <section aria-label="Computer use walkthrough" className="space-y-4">
      <p className="text-sm text-slate-600">
        Goal: <em>“{scene.goal}”</em>
      </p>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[scene.status]}`}
          >
            {STATUS_LABEL[scene.status]}
          </span>
          {scene.risk ? (
            <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
              action risk: {scene.risk}
            </span>
          ) : null}
          <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-500">
            screen: {scene.view}
          </span>
        </div>
        <h2 className="mt-2 text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The mock screen. Rectangles are elements; a dashed ring marks the action's target; a
          crosshair marks the grounded click point — the coordinate the action resolves to. */}
      <figure className="space-y-1">
        <svg
          viewBox={`-4 -4 ${SCREEN_W + 8} ${SCREEN_H + 8}`}
          role="img"
          aria-label={`Screenshot of the ${scene.view} screen. ${scene.title}. ${scene.description}`}
          className="w-full rounded border border-slate-300 bg-white"
        >
          <rect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="#f8fafc" />
          {scene.elements.map((element) => {
            const { x, y, width, height } = element.bounds;
            const fill = element.injected
              ? '#fef2f2'
              : element.kind === 'button'
                ? '#eef2ff'
                : element.kind === 'textfield'
                  ? '#ffffff'
                  : '#f1f5f9';
            const stroke = element.injected ? '#f43f5e' : element.targeted ? '#4338ca' : '#cbd5e1';
            return (
              <g key={element.id}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={4}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={element.targeted ? 2.5 : 1}
                />
                {element.targeted ? (
                  <rect
                    x={x - 3}
                    y={y - 3}
                    width={width + 6}
                    height={height + 6}
                    rx={6}
                    fill="none"
                    stroke="#4338ca"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                ) : null}
                <text
                  x={x + 8}
                  y={y + height / 2 + 4}
                  fontSize={11}
                  fill={element.injected ? '#9f1239' : '#334155'}
                >
                  {element.label.length > 46 ? `${element.label.slice(0, 45)}…` : element.label}
                </text>
                {element.injected ? (
                  <text x={x + width - 8} y={y + 14} fontSize={9} textAnchor="end" fill="#9f1239">
                    injected
                  </text>
                ) : null}
              </g>
            );
          })}
          {scene.point ? (
            <g aria-hidden="true">
              <circle cx={scene.point.x} cy={scene.point.y} r={7} fill="none" stroke="#111827" strokeWidth={1.5} />
              <line x1={scene.point.x - 11} y1={scene.point.y} x2={scene.point.x + 11} y2={scene.point.y} stroke="#111827" strokeWidth={1.5} />
              <line x1={scene.point.x} y1={scene.point.y - 11} x2={scene.point.x} y2={scene.point.y + 11} stroke="#111827" strokeWidth={1.5} />
            </g>
          ) : null}
        </svg>
        <figcaption className="text-xs text-slate-500">
          The crosshair is the grounded click point — the coordinate the action resolves to. A few
          pixels off and it lands on the wrong element; that fragility is computer use’s core cost.
        </figcaption>
      </figure>

      {scene.outcome ? (
        <div
          className={`rounded border p-3 text-sm ${
            scene.outcome === 'completed'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-slate-300 bg-slate-50 text-slate-700'
          }`}
        >
          Outcome: <strong>{scene.outcome}</strong>. The runtime gate refused{' '}
          <strong>{scene.refusals}</strong> action — the injected “Delete account” — while the
          policy was fooled by it. Safety came from the gate, not the policy.
        </div>
      ) : null}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Computer use steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        The screen, the policy’s choices, the grounded coordinates, and every gate decision are
        produced by the deterministic loop in this repo (<code>src/lib/computer-use/</code>). Swap
        its scripted policy for a vision-model call and the loop is unchanged.
      </p>
    </section>
  );
}
