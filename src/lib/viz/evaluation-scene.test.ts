import { describe, expect, it } from 'vitest';

import { createEvaluationScene, EVALUATION_DEMO_INPUT } from './evaluation-scene';

const lastStep = EVALUATION_DEMO_INPUT.cases.length + 1; // intro + per-case + aggregate

describe('createEvaluationScene', () => {
  it('step 0 reveals no cases and is not yet scored', () => {
    const s = createEvaluationScene(EVALUATION_DEMO_INPUT, 0);
    expect(s.revealedCount).toBe(0);
    expect(s.cases.every((c) => !c.revealed)).toBe(true);
    expect(s.scored).toBe(false);
  });

  it('reveals cases one at a time as the step advances', () => {
    const s2 = createEvaluationScene(EVALUATION_DEMO_INPUT, 2);
    expect(s2.revealedCount).toBe(2);
    expect(s2.cases.filter((c) => c.revealed)).toHaveLength(2);
  });

  it('surfaces the valid-but-wrong case as a wrong-value failure', () => {
    const atThatCase = createEvaluationScene(
      EVALUATION_DEMO_INPUT,
      EVALUATION_DEMO_INPUT.cases.findIndex((c) => c.id === 'valid-but-wrong') + 1,
    );
    const view = atThatCase.cases.find((c) => c.id === 'valid-but-wrong')!;
    expect(view.revealed).toBe(true);
    expect(view.pass).toBe(false);
    expect(view.failReason).toBe('wrong-value');
  });

  it('final step scores the whole suite from the real harness (3/4 = 75%)', () => {
    const s = createEvaluationScene(EVALUATION_DEMO_INPUT, lastStep);
    expect(s.scored).toBe(true);
    expect(s.total).toBe(4);
    expect(s.passed).toBe(3);
    expect(s.scorePercent).toBe(75);
  });

  it('clamps out-of-range steps', () => {
    expect(createEvaluationScene(EVALUATION_DEMO_INPUT, -5).step).toBe(0);
    expect(createEvaluationScene(EVALUATION_DEMO_INPUT, 999).step).toBe(lastStep);
  });
});
