/**
 * Reflection — the smallest honest version of "an agent that critiques its own output and
 * revises it" (plan §3 useful-addition, ADR-0005). A first draft from a model is often not
 * its best output. Reflection adds a loop AFTER producing: critique the draft against a
 * goal/rubric, then revise — bounded, stopping when the critic passes or improvement stalls.
 *
 * The load-bearing idea: **the critic is an EVALUATION applied inline.** This module builds
 * its `Critic` out of the very same `scoreAssertion` the eval harness uses
 * (`src/lib/eval/harness.ts`) — reflection is the eval harness pointed at a draft, in a loop.
 * Why it can work at all: judging a candidate against explicit criteria is often easier than
 * generating a perfect one in a single pass.
 *
 * Deterministic on purpose. In production the `Reviser` (and often the critic) is a model
 * call; here both are injected pure functions, so the mechanism — produce → critique → revise
 * → re-critique — reads and unit-tests without a model. Swap in a model and the loop is
 * unchanged; that substitution is the whole point (ADR-0005: understand the loop, don't hide it).
 *
 * The honesty this module refuses to hide: a critic is NOT independent verification. It shares
 * the producer's blind spots, so it can confidently "improve" a good answer into a worse one,
 * or rubber-stamp a bad one (sycophancy). This loop optimizes the critic's score — no more. If
 * the critic is a poor proxy for the real goal, faithfully optimizing it makes the output worse.
 * `src/lib/reflection/demo.ts` shows both: reflection fixing a flawed draft, and an over-eager
 * critic degrading a good one (measured against a held-out oracle the loop never sees).
 */
import { scoreAssertion, type EvalAssertion } from '../eval/harness';

/** A rubric is an ordered set of eval assertions — the criteria a draft is judged against.
 * Reusing the eval harness's assertion type is the point: a rubric IS an eval suite. */
export type Rubric = readonly EvalAssertion[];

/** The critic's judgment of one draft. `issues` are the human-readable "what's wrong"
 * strings — exactly the eval harness's failure details, surfaced so a reviser (or a reader)
 * can act on them. */
export interface Critique {
  /** Fraction of criteria satisfied, 0–1, rounded to two decimals. */
  readonly score: number;
  readonly passed: number;
  readonly total: number;
  /** True only when every criterion is satisfied — the loop's "accept" condition. */
  readonly pass: boolean;
  /** Why the unmet criteria failed, in order. Empty when the draft passes. */
  readonly issues: readonly string[];
}

/** Judges a draft. Deterministic. In production this is a model ("grade this against the
 * rubric"); here it is built from a rubric of eval assertions — see `rubricCritic`. */
export type Critic = (draft: string) => Critique;

/**
 * Build a `Critic` from a rubric of eval assertions. This is the concept made literal: the
 * critic runs the SAME `scoreAssertion` the offline eval harness runs, only now over the draft
 * as it is produced. A passing critique means "meets every stated criterion" — no more, and in
 * particular not "is correct in ways the rubric never stated."
 */
export function rubricCritic(rubric: Rubric): Critic {
  return (draft) => {
    const verdicts = rubric.map((a) => scoreAssertion(draft, a));
    const passed = verdicts.filter((v) => v.pass).length;
    const total = rubric.length;
    const issues = verdicts.filter((v) => !v.pass).map((v) => v.detail);
    const score = total === 0 ? 1 : Math.round((passed / total) * 100) / 100;
    return { score, passed, total, pass: passed === total, issues };
  };
}

/**
 * Produces a revised draft from the goal, the current draft, and the critique of it. This is
 * the "actor" half of a critic-actor loop; in production a model call, here an injected script.
 * It is handed the critique's `issues` so a revision can target what the critic flagged — the
 * same information a model would get in a "here is what's wrong, fix it" turn.
 */
export type Reviser = (input: {
  readonly goal: string;
  readonly draft: string;
  readonly critique: Critique;
  /** 1-based revision number, so a scripted reviser can stage a deterministic sequence. */
  readonly iteration: number;
}) => string;

export type ReflectOutcome =
  /** The critic passed — every criterion met. */
  | 'accepted'
  /** Revisions stopped improving the best score (diminishing returns) — bounded, not looping. */
  | 'stalled'
  /** The revision budget was exhausted before the critic passed. */
  | 'iteration-limit';

/** How a draft's score compares to the one immediately before it — what a viewer sees as
 * "this revision helped / hurt / did nothing." A regression here is the honest beat: a model
 * can revise a good answer into a worse one. */
export type ScoreDelta = 'first' | 'improved' | 'regressed' | 'same';

/** One draft in the trace, with the critique that judged it. The full, replayable record —
 * nothing happens in `reflect` that is not in `steps`. */
export interface ReflectionStep {
  readonly kind: 'initial' | 'revision';
  /** 0 for the initial draft, 1..N for revisions. */
  readonly iteration: number;
  readonly draft: string;
  readonly critique: Critique;
  readonly delta: ScoreDelta;
  /** True if this is the highest-scoring draft seen up to and including this step. */
  readonly isBest: boolean;
  /** True on the step whose critique passed and ended the loop. */
  readonly accepted: boolean;
}

export interface ReflectResult {
  readonly outcome: ReflectOutcome;
  readonly goal: string;
  readonly steps: readonly ReflectionStep[];
  /** The best draft by critic score — what the loop RETURNS. Not necessarily the last one:
   * if a late revision regressed, the loop keeps the best it saw, never the worse latest. */
  readonly best: {
    readonly draft: string;
    readonly critique: Critique;
    readonly iteration: number;
  };
  /** How many `reviser` calls were made. */
  readonly revisions: number;
}

export interface ReflectOptions {
  /** Hard cap on `reviser` calls — the defense against an endless refine loop. */
  readonly maxIterations?: number;
  /** Stop after this many consecutive revisions that fail to beat the best score so far.
   * Patience ≥ 2 lets a single regression be ridden out if the next revision recovers. */
  readonly patience?: number;
}

const DEFAULT_MAX_ITERATIONS = 4;
const DEFAULT_PATIENCE = 2;

function classifyDelta(next: number, prev: number): ScoreDelta {
  if (next > prev) return 'improved';
  if (next < prev) return 'regressed';
  return 'same';
}

/**
 * Run produce → critique → revise, bounded. Deterministic given a deterministic `critic` and
 * `reviser`. Returns the full trace and the best-scoring draft. The loop optimizes the critic's
 * score and nothing else: if the critic is a faithful measure of the goal, that is refinement;
 * if it is a poor proxy, that is Goodhart's law and the "best" draft can be worse than the first.
 */
export function reflect(
  goal: string,
  initialDraft: string,
  critic: Critic,
  reviser: Reviser,
  options: ReflectOptions = {},
): ReflectResult {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const patience = options.patience ?? DEFAULT_PATIENCE;

  const steps: ReflectionStep[] = [];
  let draft = initialDraft;
  let critique = critic(draft);
  let bestIndex = 0;
  let bestScore = critique.score;
  let noImprove = 0;
  let revisions = 0;

  steps.push({
    kind: 'initial',
    iteration: 0,
    draft,
    critique,
    delta: 'first',
    isBest: true,
    accepted: critique.pass,
  });

  let outcome: ReflectOutcome;
  for (;;) {
    if (critique.pass) {
      outcome = 'accepted';
      break;
    }
    if (revisions >= maxIterations) {
      outcome = 'iteration-limit';
      break;
    }
    if (noImprove >= patience) {
      outcome = 'stalled';
      break;
    }

    const iteration = revisions + 1;
    const prevScore = critique.score;
    const revised = reviser({ goal, draft, critique, iteration });
    const revisedCritique = critic(revised);
    revisions = iteration;

    const beatsBest = revisedCritique.score > bestScore;
    if (beatsBest) {
      bestScore = revisedCritique.score;
      bestIndex = steps.length; // the step we are about to push
      noImprove = 0;
    } else {
      noImprove += 1;
    }

    steps.push({
      kind: 'revision',
      iteration,
      draft: revised,
      critique: revisedCritique,
      delta: classifyDelta(revisedCritique.score, prevScore),
      isBest: beatsBest,
      accepted: revisedCritique.pass,
    });

    draft = revised;
    critique = revisedCritique;
  }

  const bestStep = steps[bestIndex]!;
  return {
    outcome,
    goal,
    steps,
    best: { draft: bestStep.draft, critique: bestStep.critique, iteration: bestStep.iteration },
    revisions,
  };
}

/**
 * The "multi-sample + select" variant of reflection: instead of iteratively revising one draft,
 * generate several independent candidates and let the critic pick the best. Same critic, same
 * "judging is easier than generating" bet — a different loop shape. Ties go to the first
 * candidate (stable). Shares the exact caveat: it selects the best by the CRITIC, which is only
 * as trustworthy as the critic is.
 */
export function bestOfN(
  candidates: readonly string[],
  critic: Critic,
): {
  readonly best: string;
  readonly critique: Critique;
  readonly index: number;
  readonly ranked: readonly { readonly draft: string; readonly critique: Critique }[];
} {
  if (candidates.length === 0) {
    throw new Error('bestOfN needs at least one candidate');
  }
  const ranked = candidates.map((draft) => ({ draft, critique: critic(draft) }));
  let bestIndex = 0;
  for (let i = 1; i < ranked.length; i += 1) {
    if (ranked[i]!.critique.score > ranked[bestIndex]!.critique.score) bestIndex = i;
  }
  return {
    best: ranked[bestIndex]!.draft,
    critique: ranked[bestIndex]!.critique,
    index: bestIndex,
    ranked,
  };
}
