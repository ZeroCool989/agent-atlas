import { describe, expect, it } from 'vitest';

import { createVerificationScene, VERIFICATION_DEMO_INPUT } from './verification-scene';

describe('createVerificationScene', () => {
  const input = VERIFICATION_DEMO_INPUT;
  // 6 candidates → 6 + 1 = 7 steps (intro + one per candidate).
  const totalSteps = 7;

  it('step 0 shows the four-gate pipeline with nothing run yet', () => {
    const scene = createVerificationScene(input, 0);
    expect(scene.step).toBe(0);
    expect(scene.totalSteps).toBe(totalSteps);
    expect(scene.checkedCount).toBe(0);
    expect(scene.gates.map((g) => g.kind)).toEqual(['schema', 'value', 'grounding', 'policy']);
    expect(scene.candidates.every((c) => !c.revealed && c.verdict === 'pending')).toBe(true);
  });

  it('reveals the clean output as passing every gate (proceeds)', () => {
    const scene = createVerificationScene(input, 1);
    expect(scene.checkedCount).toBe(1);
    const clean = scene.candidates[0]!;
    expect(clean.revealed).toBe(true);
    expect(clean.verdict).toBe('proceeds');
    expect(clean.gates.every((g) => g.status === 'passed')).toBe(true);
  });

  it('stops the malformed output at the schema gate and skips the rest', () => {
    const scene = createVerificationScene(input, 2);
    const malformed = scene.candidates[1]!;
    expect(malformed.verdict).toBe('blocked');
    expect(malformed.blockedAtKind).toBe('schema');
    expect(malformed.gates[0]!.status).toBe('failed');
    expect(malformed.gates.slice(1).every((g) => g.status === 'skipped')).toBe(true);
  });

  it('catches the schema-valid-but-wrong-currency output at the VALUE gate', () => {
    const scene = createVerificationScene(input, 3);
    const wrongCurrency = scene.candidates[2]!;
    expect(wrongCurrency.blockedAtKind).toBe('value');
    expect(wrongCurrency.gates[0]!.status).toBe('passed'); // schema passed — shape was fine
  });

  it('catches the invented citation at the GROUNDING gate', () => {
    const scene = createVerificationScene(input, 4);
    const invented = scene.candidates[3]!;
    expect(invented.blockedAtKind).toBe('grounding');
    expect(invented.gates[2]!.offending).toContain('refund-policy-2020');
    expect(invented.gates[0]!.status).toBe('passed');
    expect(invented.gates[1]!.status).toBe('passed');
  });

  it('catches the leaked internal note at the POLICY gate', () => {
    const scene = createVerificationScene(input, 5);
    const leaked = scene.candidates[4]!;
    expect(leaked.blockedAtKind).toBe('policy');
    expect(leaked.gates.slice(0, 3).every((g) => g.status === 'passed')).toBe(true);
  });

  it('the final step exposes the honest limit: passes every gate yet is wrong', () => {
    const scene = createVerificationScene(input, totalSteps - 1);
    expect(scene.title).toMatch(/still misses/i);
    const trap = scene.candidates[5]!;
    expect(trap.verdict).toBe('proceeds'); // every gate green
    expect(trap.trapExposed).toBe(true); // yet it is the trap
    expect(scene.limitNote).toBeTruthy();
  });

  it('clamps out-of-range steps', () => {
    expect(createVerificationScene(input, 99).step).toBe(totalSteps - 1);
    expect(createVerificationScene(input, -5).step).toBe(0);
  });
});
