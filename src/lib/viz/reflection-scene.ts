/**
 * The `(input, step) => Scene` function for the Reflection lesson (ADR-0004, plan §8). Pure and
 * deterministic: it replays the reflect-critique-revise trace of the build project
 * (`src/lib/reflection/`) one draft at a time — initial draft + critique → revision + re-critique
 * → an honest REGRESSION beat where a revision scores worse → the passing revision, accepted —
 * then a final CAVEAT beat that runs the sycophancy scenario to make the load-bearing point: the
 * critic is not ground truth. A model grading itself can reach 100% confidence on a wrong answer.
 *
 * Every score and issue comes from the real critic (the eval harness applied inline), so the
 * picture can never disagree with the mechanism it teaches.
 */
import {
  reflect,
  type Critic,
  type Critique,
  type ReflectOutcome,
  type ReflectionStep,
  type Reviser,
  type ScoreDelta,
} from '../reflection/reflect';
import {
  FIX_GOAL,
  FIX_INITIAL_DRAFT,
  fixCritic,
  fixReviser,
  runSycophancyScenario,
} from '../reflection/demo';
import { clampStep } from './timeline';

export interface ReflectionSceneInput {
  readonly goal: string;
  readonly initialDraft: string;
  readonly critic: Critic;
  readonly reviser: Reviser;
}

export const REFLECTION_DEMO_INPUT: ReflectionSceneInput = {
  goal: FIX_GOAL,
  initialDraft: FIX_INITIAL_DRAFT,
  critic: fixCritic,
  reviser: fixReviser,
};

export type ReflectionSceneKind = ReflectionStep['kind'] | 'caveat';

/** The sycophancy caveat, precomputed from the real loop + oracle. Present only on the final beat. */
export interface ReflectionCaveat {
  /** What the flawed critic scored the "improved" answer (0–100). */
  readonly criticPercent: number;
  /** What a held-out oracle scored it — the true quality the critic was blind to (0–100). */
  readonly oracleOnBestPercent: number;
  /** The oracle score of the original, correct draft (0–100) — what was lost. */
  readonly oracleOnInitialPercent: number;
  readonly wrongDraft: string;
  readonly rightDraft: string;
}

export interface ReflectionScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  /** Teaching text; doubles as the accessible scene description. */
  readonly description: string;
  readonly kind: ReflectionSceneKind;
  /** The draft under consideration at this beat. */
  readonly draft: string;
  /** The critique of that draft — real scores from the critic. */
  readonly critique: Critique;
  /** How this draft's score compares to the one before it. */
  readonly delta: ScoreDelta;
  /** True on the best-scoring draft seen so far — the one the loop keeps. */
  readonly isBest: boolean;
  /** True on the draft the loop accepted (critic passed). */
  readonly accepted: boolean;
  /** 1-based revision number (0 = initial draft). */
  readonly iteration: number;
  /** The overall outcome, present from the accepting beat onward. */
  readonly outcome?: ReflectOutcome;
  /** The sycophancy caveat, present only on the final caveat beat. */
  readonly caveat?: ReflectionCaveat;
}

const KIND_TITLE: Record<ReflectionStep['kind'], string> = {
  initial: 'A first draft, then judge it',
  revision: 'Critique, then revise',
};

const DELTA_NOTE: Record<ScoreDelta, string> = {
  first: 'This is the first draft — the baseline the critic measures against.',
  improved: 'The revision raised the critic score — it fixed what was flagged.',
  regressed:
    'The revision scored WORSE than the draft before it — the model "improved" one thing and broke ' +
    'others. The bounded loop keeps the better earlier draft instead of adopting this one.',
  same: 'The revision did not move the score — a sign of diminishing returns.',
};

const pct = (score: number) => Math.round(score * 100);

export function createReflectionScene(input: ReflectionSceneInput, step: number): ReflectionScene {
  const run = reflect(input.goal, input.initialDraft, input.critic, input.reviser);
  const steps = run.steps;
  // One frame per draft in the trace, plus a final caveat beat.
  const totalSteps = steps.length + 1;
  const current = clampStep(step, totalSteps);

  if (current < steps.length) {
    const s = steps[current]!;
    const criticLine = s.critique.pass
      ? `The critic passes this draft: ${s.critique.passed}/${s.critique.total} criteria met.`
      : `The critic scores it ${s.critique.passed}/${s.critique.total}. What's wrong: ${s.critique.issues.join('; ')}.`;
    const acceptedLine = s.accepted
      ? ' Every criterion is met, so the loop stops and accepts this draft.'
      : '';
    return {
      step: current,
      totalSteps,
      kind: s.kind,
      title: s.accepted ? 'Accepted — the critic passes' : KIND_TITLE[s.kind],
      description: `${criticLine} ${DELTA_NOTE[s.delta]}${acceptedLine}`.trim(),
      draft: s.draft,
      critique: s.critique,
      delta: s.delta,
      isBest: s.isBest,
      accepted: s.accepted,
      iteration: s.iteration,
      outcome: s.accepted ? run.outcome : undefined,
    };
  }

  // Final beat: the sycophancy caveat. The loop above optimized its critic to 100%; here a
  // DIFFERENT run shows what that guarantees — nothing, if the critic is a poor proxy.
  const syc = runSycophancyScenario();
  return {
    step: current,
    totalSteps,
    kind: 'caveat',
    title: 'But the critic is not ground truth',
    description:
      'Run the same loop with a critic that rewards agreement instead of truth, and it "improves" ' +
      'a correct answer into a wrong one — at full critic confidence. A model grading itself shares ' +
      'its own blind spots; self-critique is not independent verification.',
    draft: syc.result.best.draft,
    critique: syc.result.best.critique,
    delta: 'improved', // the critic THOUGHT it improved
    isBest: true,
    accepted: true,
    iteration: syc.result.best.iteration,
    outcome: syc.result.outcome,
    caveat: {
      criticPercent: pct(syc.result.best.critique.score),
      oracleOnBestPercent: pct(syc.oracleOnBest.score),
      oracleOnInitialPercent: pct(syc.oracleOnInitial.score),
      wrongDraft: syc.result.best.draft,
      rightDraft: 'No — the capital of Australia is Canberra, not Sydney.',
    },
  };
}
