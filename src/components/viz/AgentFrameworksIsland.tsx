/**
 * Renderer for the agent-frameworks scenes (ADR-0004). Controlled step state; one instance
 * owns its own step (no module state). Scenes are built at build time from the REAL
 * comparison in src/lib/frameworks (the same task run two ways) and passed in; this
 * component only displays them. The step-0 scene renders server-side as the static first
 * frame, then the island hydrates on scroll (client:visible).
 */
import { useState } from 'react';

import type { AgentFrameworksScene } from '../../lib/viz/agent-frameworks-scene';
import type { AuthoredLine, ComparisonSide } from '../../lib/frameworks';
import Stepper from './Stepper';

function CodePanel({
  side,
  ownerBadge,
}: {
  side: ComparisonSide;
  ownerBadge: 'you' | 'framework';
}) {
  return (
    <div className="min-w-0 rounded border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 px-3 py-1.5">
        <p className="text-sm font-semibold text-slate-800">{side.label}</p>
        <p className="text-xs text-slate-500">{side.summary}</p>
      </div>
      <pre className="overflow-x-auto px-3 py-2 text-xs leading-relaxed text-slate-800">
        <code>
          {side.authoring.map((line: AuthoredLine, i: number) => (
            <span
              key={i}
              data-owns={line.owns}
              className={
                line.owns === 'framework'
                  ? 'block rounded bg-amber-50 text-amber-900'
                  : 'block text-slate-800'
              }
              title={line.concern}
            >
              {line.code}
            </span>
          ))}
        </code>
      </pre>
      <div className="border-t border-slate-200 px-3 py-1 text-xs text-slate-500">
        {ownerBadge === 'you'
          ? 'Every line — and the loop it calls — is yours to read.'
          : 'Amber lines: the wiring and the loop are the framework’s, not in your code.'}
      </div>
    </div>
  );
}

export default function AgentFrameworksIsland({ scenes }: { scenes: AgentFrameworksScene[] }) {
  const [step, setStep] = useState(0);
  const scene = scenes[Math.min(step, scenes.length - 1)]!;

  return (
    <figure className="not-prose my-6 rounded-lg border border-slate-300 p-4">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium text-slate-700">
        <span data-testid="af-title">{scene.title}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
          goal: {scene.goal}
        </span>
      </figcaption>

      {/* The two authoring surfaces, side by side. */}
      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <CodePanel side={scene.handBuilt} ownerBadge="you" />
        <CodePanel side={scene.framework} ownerBadge="framework" />
      </div>

      {/* The tally: runtime steps you can see vs steps hidden inside the box. */}
      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        <span className="text-slate-700" data-testid="af-visible">
          Visible in your code:{' '}
          <span className="font-semibold tabular-nums">
            {scene.visibleInHandBuilt}/{scene.totalRuntimeSteps}
          </span>
        </span>
        <span className="text-slate-700" data-testid="af-hidden">
          Inside <code className="font-mono">.run()</code>, out of sight:{' '}
          <span className="font-semibold tabular-nums">
            {scene.hiddenInFramework}/{scene.totalRuntimeSteps}
          </span>
        </span>
      </div>

      {/* The shared runtime trace, revealed step by step. */}
      <ol className="mb-3 space-y-1">
        {scene.rows.map((row) => (
          <li
            key={row.index}
            data-state={row.state}
            className={
              row.state === 'active'
                ? 'text-sm font-semibold text-slate-900'
                : row.state === 'completed'
                  ? 'text-sm text-slate-500'
                  : 'text-sm text-slate-300'
            }
          >
            {row.state === 'completed' ? '✓ ' : row.state === 'active' ? '→ ' : '· '}
            {row.label}
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
              {row.decidedBy}
            </span>
          </li>
        ))}
      </ol>

      {/* The reveal, only on the final step. */}
      {scene.revealed && (
        <div
          className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          data-testid="af-reveal"
        >
          <p className="mb-1 font-semibold">
            {scene.tracesMatch
              ? 'Identical trace, identical answer — no new capability.'
              : 'Traces diverged.'}
          </p>
          <p className="mb-1">What the framework ran for you, out of sight:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {scene.hidden.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mb-3 min-h-[4.5rem] text-sm text-slate-700">{scene.description}</p>

      <Stepper
        step={step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Agent frameworks steps"
        stepLabel={scene.title}
      />
    </figure>
  );
}
