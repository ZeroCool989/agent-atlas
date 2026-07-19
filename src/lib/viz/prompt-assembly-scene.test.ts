import { describe, expect, it } from 'vitest';

import { budgetFor } from '../prompt/assemble';
import {
  createPromptAssemblyScene,
  PROMPT_ASSEMBLY_DEMO_INPUT,
  PROMPT_ASSEMBLY_TIMELINE,
} from './prompt-assembly-scene';

describe('createPromptAssemblyScene', () => {
  const input = PROMPT_ASSEMBLY_DEMO_INPUT;
  const total = PROMPT_ASSEMBLY_TIMELINE.steps.length;

  it('reveals nothing at step 0 and costs no tokens', () => {
    const scene = createPromptAssemblyScene(input, 0);
    expect(scene.segments.every((s) => !s.revealed)).toBe(true);
    expect(scene.usedTokens).toBe(0);
    expect(scene.percentUsed).toBe(0);
  });

  it('reveals one more part per step, ending fully assembled', () => {
    const last = createPromptAssemblyScene(input, total - 1);
    expect(last.segments.every((s) => s.revealed)).toBe(true);
    // Fully-revealed cost equals the build project's own budget total.
    expect(last.usedTokens).toBe(budgetFor(input.parts, input.windowTokens).totalTokens);
  });

  it('accumulates monotonically — each step costs at least as much as the last', () => {
    let prev = -1;
    for (let step = 0; step < total; step++) {
      const scene = createPromptAssemblyScene(input, step);
      expect(scene.usedTokens).toBeGreaterThanOrEqual(prev);
      prev = scene.usedTokens;
    }
  });

  it('derives percentUsed from the real token math', () => {
    const scene = createPromptAssemblyScene(input, total - 1);
    expect(scene.percentUsed).toBeCloseTo((scene.usedTokens / scene.windowTokens) * 100, 1);
  });

  it('clamps out-of-range steps', () => {
    expect(createPromptAssemblyScene(input, -5).step).toBe(0);
    expect(createPromptAssemblyScene(input, 999).step).toBe(total - 1);
  });
});
