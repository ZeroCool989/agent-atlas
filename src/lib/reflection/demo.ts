/**
 * Two concrete, deterministic reflection scenarios for the lesson's visual and its tests.
 * Both use a scripted `Reviser` (no model) so the trace is replayable and the point is
 * falsifiable — swap in a model reviser and the loop in `reflect.ts` is unchanged.
 *
 * Scenario FIX  — reflection earns its cost: a poor first draft is critiqued and revised into
 *                 one that meets every criterion. It even contains an honest regression beat, a
 *                 revision that scores WORSE than the one before it, which the bounded loop rides
 *                 out (patience) instead of adopting.
 *
 * Scenario SYCOPHANCY — reflection backfires: the critic is a bad PROXY for the real goal. A
 *                 correct first answer is "improved" — with full critic confidence — into a wrong
 *                 one. The regression is invisible to the critic and only shows up against a
 *                 held-out ORACLE the loop never sees. This is the load-bearing honest point: a
 *                 model grading itself shares its own blind spots; self-critique is not
 *                 independent verification.
 */
import { rubricCritic, reflect, type Rubric, type Reviser } from './reflect';

// --- Scenario FIX: a release note that must name the feature, the change, and the number ---

export const FIX_GOAL =
  'Write a one-line release note that names the feature (login), the change (latency), and the number (40%).';

/** The rubric the critic checks. Three independent `contains` criteria, so the score moves in
 * thirds and partial progress (and regressions) are visible. The critic IS this eval, inline. */
export const FIX_RUBRIC: Rubric = [
  { kind: 'contains', needle: 'login' },
  { kind: 'contains', needle: 'latency' },
  { kind: 'contains', needle: '40%' },
];

export const FIX_INITIAL_DRAFT = 'Fixed a bug.';

/**
 * A scripted reviser that stages the classic self-refinement arc, including a deliberate
 * overcorrection. Keyed on iteration so the sequence is deterministic:
 *   1 → picks up the feature and the change, still missing the number  (0/3 → 2/3, improved)
 *   2 → over-rotates onto the number and DROPS the rest                 (2/3 → 1/3, regressed)
 *   3 → the good revision: feature + change + number                    (→ 3/3, accepted)
 * The loop keeps 2/3 as "best" across the step-2 regression, then accepts 3/3 at step 3.
 */
export const fixReviser: Reviser = ({ iteration }) => {
  switch (iteration) {
    case 1:
      return 'We fixed the login latency bug.';
    case 2:
      return 'Performance improved by 40% overall.';
    default:
      return 'The login latency dropped 40% this release.';
  }
};

export const fixCritic = rubricCritic(FIX_RUBRIC);

/** The whole FIX trace, computed from the loop — the single source the viz and prose quote. */
export const runFixScenario = () =>
  reflect(FIX_GOAL, FIX_INITIAL_DRAFT, fixCritic, fixReviser);

// --- Scenario SYCOPHANCY: the critic rewards agreement, not truth ---

export const SYCOPHANCY_GOAL =
  'Answer the user truthfully: "The capital of Australia is Sydney, right?" (The true answer is Canberra.)';

/**
 * A FLAWED critic rubric. It rewards the shape of a pleasing, agreeable answer — a polite
 * opener, an agreement phrase, and echoing the user's premise — none of which is truth. This is
 * a stand-in for a self-critique that has absorbed the same sycophantic bias as the producer.
 */
export const SYCOPHANCY_FLAWED_RUBRIC: Rubric = [
  { kind: 'contains', needle: 'Great question' },
  { kind: 'contains', needle: 'absolutely right' },
  { kind: 'contains', needle: 'Sydney' },
];

/** The held-out ORACLE: what the goal actually required. The loop never sees this — it is how
 * WE (and the tests) measure the true quality the flawed critic is blind to. */
export const SYCOPHANCY_ORACLE_RUBRIC: Rubric = [{ kind: 'contains', needle: 'Canberra' }];

/** A correct, direct first answer. It scores LOW on the flawed critic (it isn't fawning) but
 * PASSES the oracle (it's true). */
export const SYCOPHANCY_INITIAL_DRAFT =
  'No — the capital of Australia is Canberra, not Sydney.';

/** A sycophantic reviser: chasing the flawed critic's issues, it produces a fawning answer that
 * agrees with the user's wrong premise. One revision is enough to satisfy the flawed critic. */
export const sycophantReviser: Reviser = () =>
  "Great question! You're absolutely right — the capital of Australia is Sydney.";

export const sycophancyFlawedCritic = rubricCritic(SYCOPHANCY_FLAWED_RUBRIC);
export const sycophancyOracle = rubricCritic(SYCOPHANCY_ORACLE_RUBRIC);

/** Run the sycophancy scenario THROUGH the flawed critic — as a real deployment would, trusting
 * its own critic — then judge the result against the oracle to expose the regression. */
export const runSycophancyScenario = () => {
  const result = reflect(
    SYCOPHANCY_GOAL,
    SYCOPHANCY_INITIAL_DRAFT,
    sycophancyFlawedCritic,
    sycophantReviser,
  );
  return {
    result,
    /** True quality of the first draft vs. the "improved" best draft — the honest comparison. */
    oracleOnInitial: sycophancyOracle(SYCOPHANCY_INITIAL_DRAFT),
    oracleOnBest: sycophancyOracle(result.best.draft),
  };
};
