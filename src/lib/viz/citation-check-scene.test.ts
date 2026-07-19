import { describe, expect, it } from 'vitest';

import {
  CITATION_CHECK_DEMO_INPUT,
  createCitationCheckScene,
} from './citation-check-scene';

describe('createCitationCheckScene', () => {
  const input = CITATION_CHECK_DEMO_INPUT;
  // 5 sentences → 5 + 2 = 7 steps (intro + one per sentence + limit).
  const totalSteps = 7;

  it('step 0 shows the answer with nothing checked yet', () => {
    const scene = createCitationCheckScene(input, 0);
    expect(scene.step).toBe(0);
    expect(scene.totalSteps).toBe(totalSteps);
    expect(scene.checkedCount).toBe(0);
    expect(scene.rows.every((r) => r.status === 'unchecked')).toBe(true);
    expect(scene.rows).toHaveLength(5);
  });

  it('reveals verdicts one sentence at a time', () => {
    const s1 = createCitationCheckScene(input, 1);
    expect(s1.checkedCount).toBe(1);
    expect(s1.rows[0]!.status).toBe('supported'); // "[history]" is provided
    expect(s1.rows[1]!.status).toBe('unchecked');
  });

  it('flags the fabricated citation (records-2020 was never provided)', () => {
    const scene = createCitationCheckScene(input, 4);
    expect(scene.rows[3]!.status).toBe('fabricated-citation');
    expect(scene.rows[3]!.citations).toContain('records-2020');
  });

  it('flags the uncited final claim', () => {
    const scene = createCitationCheckScene(input, 5);
    expect(scene.rows[4]!.status).toBe('uncited-claim');
  });

  it('the limit step exposes the trap: a resolving citation the source does not support', () => {
    const limit = createCitationCheckScene(input, totalSteps - 1);
    expect(limit.title).toMatch(/cannot catch/i);
    expect(limit.rows[2]!.status).toBe('supported'); // checker passed it
    expect(limit.rows[2]!.trapExposed).toBe(true); // but it is the trap
    expect(limit.limitNote).toBeTruthy();
  });

  it('clamps out-of-range steps', () => {
    expect(createCitationCheckScene(input, 99).step).toBe(totalSteps - 1);
    expect(createCitationCheckScene(input, -5).step).toBe(0);
  });
});
