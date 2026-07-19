import { describe, expect, it } from 'vitest';

import {
  bestOfN,
  reflect,
  rubricCritic,
  type Critic,
  type Reviser,
} from './reflect';
import {
  FIX_RUBRIC,
  fixCritic,
  runFixScenario,
  runSycophancyScenario,
  SYCOPHANCY_FLAWED_RUBRIC,
} from './demo';

describe('rubricCritic — the critic is an inline eval', () => {
  it('scores a draft as the fraction of criteria met, in thirds', () => {
    const critic = rubricCritic(FIX_RUBRIC);
    expect(critic('Fixed a bug.')).toMatchObject({ passed: 0, total: 3, score: 0, pass: false });
    expect(critic('We fixed the login latency bug.')).toMatchObject({ passed: 2, score: 0.67, pass: false });
    expect(critic('The login latency dropped 40% this release.')).toMatchObject({
      passed: 3,
      score: 1,
      pass: true,
    });
  });

  it('surfaces the failing criteria as human-readable issues (from the eval harness)', () => {
    const critic = rubricCritic(FIX_RUBRIC);
    const c = critic('Fixed a bug.');
    expect(c.issues).toHaveLength(3);
    expect(c.issues.every((i) => i.length > 0)).toBe(true);
    expect(critic('The login latency dropped 40% this release.').issues).toHaveLength(0);
  });

  it('treats an empty rubric as vacuously passing (score 1)', () => {
    expect(rubricCritic([])('anything')).toMatchObject({ passed: 0, total: 0, score: 1, pass: true });
  });
});

describe('reflect — produce → critique → revise, bounded', () => {
  it('FIX: refines a flawed draft to a passing one and returns the best', () => {
    const r = runFixScenario();
    expect(r.outcome).toBe('accepted');
    expect(r.steps).toHaveLength(4); // initial + three revisions
    expect(r.revisions).toBe(3);
    expect(r.best.critique.pass).toBe(true);
    expect(r.best.critique.score).toBe(1);
    expect(r.best.draft).toBe('The login latency dropped 40% this release.');
  });

  it('FIX: the trace contains the honest beat — a revision that scores WORSE than the last', () => {
    const r = runFixScenario();
    const regressed = r.steps.find((s) => s.delta === 'regressed');
    expect(regressed).toBeDefined();
    // Step 2 over-rotates onto the number and drops the feature+change: 0.67 → 0.33.
    expect(regressed!.iteration).toBe(2);
    expect(regressed!.critique.score).toBe(0.33);
    expect(regressed!.isBest).toBe(false); // the loop never adopts the worse draft as best
  });

  it('FIX: never marks the regressed draft as best; the prior best held until recovery', () => {
    const r = runFixScenario();
    // isBest tracks "best up to and including this step": step 1 was best, the regressed step 2
    // did not displace it, step 3 (the passing revision) becomes the new best.
    expect(r.steps.map((s) => s.isBest)).toEqual([true, true, false, true]);
    expect(r.steps[1]!.critique.score).toBeGreaterThan(r.steps[2]!.critique.score);
  });

  it('accepts immediately when the initial draft already passes (no revisions)', () => {
    const passing = 'login latency 40%';
    const r = reflect('goal', passing, fixCritic, () => 'unused');
    expect(r.outcome).toBe('accepted');
    expect(r.revisions).toBe(0);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]!.accepted).toBe(true);
  });

  it('stops as STALLED when revisions stop improving the best score', () => {
    // A reviser that never changes anything: the score plateaus and patience runs out.
    const stuckReviser: Reviser = ({ draft }) => draft;
    const r = reflect('goal', 'Fixed a bug.', fixCritic, stuckReviser, { patience: 2 });
    expect(r.outcome).toBe('stalled');
    expect(r.revisions).toBe(2); // exactly `patience` no-improve revisions, then stop
    expect(r.best.critique.pass).toBe(false); // it never reached the bar — reported honestly
  });

  it('stops at the ITERATION LIMIT when improvements keep coming but never pass', () => {
    // Each revision improves by a hair but never satisfies the (unreachable) criterion.
    let n = 0;
    const climbingCritic: Critic = () => {
      n += 1;
      const score = Math.min(0.9, n * 0.1);
      return { score, passed: 0, total: 1, pass: false, issues: ['never satisfied'] };
    };
    const reviser: Reviser = ({ draft }) => `${draft}+`;
    const r = reflect('goal', 'seed', climbingCritic, reviser, { maxIterations: 3, patience: 5 });
    expect(r.outcome).toBe('iteration-limit');
    expect(r.revisions).toBe(3);
  });

  it('is deterministic — identical runs produce identical traces', () => {
    expect(JSON.stringify(runFixScenario())).toBe(JSON.stringify(runFixScenario()));
  });
});

describe('reflect — SYCOPHANCY: self-critique is not independent verification', () => {
  it('the flawed critic "accepts" a confidently WRONG revision', () => {
    const { result } = runSycophancyScenario();
    expect(result.outcome).toBe('accepted');
    expect(result.best.critique.pass).toBe(true);
    expect(result.best.critique.score).toBe(1); // the critic is 100% sure
    expect(result.best.draft).toContain('Sydney'); // ...and 100% wrong
  });

  it('a held-out oracle exposes the regression the critic is blind to', () => {
    const { oracleOnInitial, oracleOnBest } = runSycophancyScenario();
    // The first (terse, correct) draft was TRUE; the "improved" draft is FALSE.
    expect(oracleOnInitial.pass).toBe(true);
    expect(oracleOnBest.pass).toBe(false);
    // Critic score rose while true quality fell — Goodhart, made concrete.
    expect(oracleOnBest.score).toBeLessThan(oracleOnInitial.score);
  });
});

describe('bestOfN — the multi-sample + select variant', () => {
  it('selects the highest-scoring candidate by the same critic', () => {
    const candidates = ['Fixed a bug.', 'login latency', 'The login latency dropped 40% today.'];
    const { best, critique, index } = bestOfN(candidates, fixCritic);
    expect(index).toBe(2);
    expect(critique.pass).toBe(true);
    expect(best).toContain('40%');
  });

  it('breaks ties toward the first candidate and ranks every candidate', () => {
    const critic = rubricCritic(SYCOPHANCY_FLAWED_RUBRIC);
    const { index, ranked } = bestOfN(['Sydney one', 'Sydney two'], critic);
    expect(index).toBe(0); // equal scores → first wins
    expect(ranked).toHaveLength(2);
  });

  it('throws on an empty candidate list rather than inventing a winner', () => {
    expect(() => bestOfN([], fixCritic)).toThrow();
  });
});
