/**
 * The prompt-engineering lesson's Tier-2 steppable visual: watch a prompt be assembled
 * one part at a time and see the context budget fill. State is a single `step` number;
 * the pure `createPromptAssemblyScene` derives the whole scene; this renders it.
 * Server-rendered at step 0, so the first frame is meaningful before (or without) JS.
 */
import { useState } from 'react';

import { createPromptAssemblyScene, PROMPT_ASSEMBLY_DEMO_INPUT } from '../../lib/viz';
import type { PromptSegmentView } from '../../lib/viz';
import Stepper from './Stepper';

// Categorical colours for the four prompt parts, drawn from the semantic viz palette
// (VISUAL_LANGUAGE.md) with literal fallbacks so the bar renders even before CSS loads.
const KIND_COLOR: Record<PromptSegmentView['kind'], string> = {
  system: 'var(--viz-active, #6366f1)',
  examples: 'var(--viz-boundary, #14b8a6)',
  task: 'var(--viz-warning, #f59e0b)',
  format: 'var(--viz-complete, #10b981)',
};

export default function PromptAssemblyDemo() {
  const [step, setStep] = useState(0);
  const scene = createPromptAssemblyScene(PROMPT_ASSEMBLY_DEMO_INPUT, step);
  const revealed = scene.segments.filter((s) => s.revealed);

  return (
    <section aria-label="Prompt assembly walkthrough" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The context box: revealed parts stacked, each labelled with its token cost. */}
      <div
        className="rounded-md border border-slate-300 bg-slate-50 p-3"
        aria-label="Assembled prompt so far"
      >
        {revealed.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-slate-400">
            Empty context — the model sees nothing yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {revealed.map((seg) => (
              <li key={seg.kind} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{seg.label}</span>
                <span className="tabular-nums text-slate-500">~{seg.tokens} tokens</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The budget bar: how much of the window the prompt has already spent. */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Context budget</span>
          <span className="tabular-nums">
            {scene.usedTokens} / {scene.windowTokens} tokens ({scene.percentUsed}%)
          </span>
        </div>
        <div
          className="flex h-4 w-full overflow-hidden rounded bg-slate-200"
          role="img"
          aria-label={`Prompt uses ${scene.usedTokens} of ${scene.windowTokens} context tokens`}
        >
          {revealed.map((seg) => (
            <div
              key={seg.kind}
              style={{
                width: `${(seg.tokens / scene.windowTokens) * 100}%`,
                background: KIND_COLOR[seg.kind],
              }}
              title={`${seg.label}: ~${seg.tokens} tokens`}
            />
          ))}
        </div>
      </div>

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Prompt assembly steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        Token counts come from{' '}
        <a
          className="underline"
          href="https://github.com/ZeroCool989/agent-atlas/blob/main/src/lib/prompt/assemble.ts"
        >
          the prompt-assembly module in this repo
        </a>
        . The text is illustrative; the estimate and the budget math are the real thing.
      </p>
    </section>
  );
}
