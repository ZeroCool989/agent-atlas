import { describe, expect, it } from 'vitest';

import { buildRagScenes } from './rag-scene';

describe('buildRagScenes', () => {
  const scenes = buildRagScenes();

  it('walks the four pipeline stages in order', () => {
    expect(scenes.map((s) => s.stage)).toEqual(['question', 'retrieve', 'assemble', 'generate']);
    for (const [i, s] of scenes.entries()) {
      expect(s.step).toBe(i);
      expect(s.totalSteps).toBe(scenes.length);
    }
  });

  it('reveals nothing retrieved on the question step', () => {
    expect(scenes[0]!.retrieved).toHaveLength(0);
    expect(scenes[0]!.answer).toBe('');
  });

  it('reveals the real retrieval ranking on the retrieve step', () => {
    const retrieve = scenes[1]!;
    expect(retrieve.retrieved[0]!.id).toBe('KB1');
    expect(retrieve.retrieved[0]!.score).toBeGreaterThan(retrieve.retrieved[1]!.score);
    expect(retrieve.contextTokens).toBe(0); // not assembled yet
  });

  it('reveals a real token budget on the assemble step', () => {
    const assemble = scenes[2]!;
    expect(assemble.contextTokens).toBeGreaterThan(0);
    expect(assemble.contextTokens).toBeLessThan(assemble.windowTokens);
  });

  it('reveals a grounded, cited answer on the generate step', () => {
    const generate = scenes[3]!;
    expect(generate.answer).not.toBe('');
    expect(generate.citations).toContain('KB1');
    expect(generate.answer).toContain('[KB1]');
  });
});
