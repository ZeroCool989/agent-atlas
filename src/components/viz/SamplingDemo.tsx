/**
 * The sampling lesson's Tier-2 steppable visual: watch one next-token distribution be
 * reshaped by temperature and then truncated by top-k / top-p. State is a single `step`
 * number; the pure `createSamplingScene` derives the complete distribution; the renderer
 * displays it. Server-rendered at step 0, so the first frame is meaningful before (or
 * without) hydration.
 */
import { useState } from 'react';

import { createSamplingScene, SAMPLING_DEMO_INPUT } from '../../lib/viz';
import DistributionBars from './DistributionBars';
import Stepper from './Stepper';

export default function SamplingDemo() {
  const [step, setStep] = useState(0);
  const scene = createSamplingScene(SAMPLING_DEMO_INPUT, step);

  return (
    <section aria-label="Sampling walkthrough" className="space-y-4">
      <p className="text-sm text-slate-600">
        Prompt: <em>“{SAMPLING_DEMO_INPUT.prompt} …”</em> — six candidate next tokens.
      </p>

      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      <DistributionBars scene={scene} />

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Sampling steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        Every probability is computed live by{' '}
        <a
          className="underline"
          href="https://github.com/ZeroCool989/agent-atlas/blob/main/src/lib/sim/sampling/sampling.ts"
        >
          the sampling module in this repo
        </a>
        . The logits are illustrative; the softmax, temperature, top-k, and top-p math is the real thing.
      </p>
    </section>
  );
}
