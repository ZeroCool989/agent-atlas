/**
 * The P0.5 composition proof: pure scene function + Stepper + TokenStream +
 * ContextWindowBar wired together. NOT the Tokens lesson (that's P0.9) — this exists
 * to prove the visual architecture end-to-end: state lives in one `step` number, the
 * scene function derives complete truth, renderers display it.
 *
 * Server-rendered at step 0, so the first frame is meaningful HTML before (or
 * without) hydration.
 */
import { useState } from 'react';

import { createTokenScene, TOKENIZATION_DEMO_INPUT } from '../../lib/viz';
import ContextWindowBar from './ContextWindowBar';
import Stepper from './Stepper';
import TokenStream from './TokenStream';

export default function TokenizationDemo() {
  const [step, setStep] = useState(0);
  const scene = createTokenScene(TOKENIZATION_DEMO_INPUT, step);

  return (
    <section aria-label="Tokenization walkthrough" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      <TokenStream
        sourceText={scene.sourceText}
        tokens={scene.tokens}
        showBoundaries={scene.showBoundaries}
        showIds={scene.showIds}
        stateText={{
          inactive: 'not yet in the context window',
          active: 'entering the context window',
          completed: 'in the context window',
        }}
      />

      {scene.window && <ContextWindowBar view={scene.window} />}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Tokenization steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        Note: this tokenization is illustrative, chosen to show honest subword behavior — it is not
        the output of a real tokenizer. The Tokens lesson will use real BPE.
      </p>
    </section>
  );
}
