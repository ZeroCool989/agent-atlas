import { describe, expect, it } from 'vitest';
import { buildMemoryScenes, MEMORY_WINDOW_TOKENS } from './memory-scene';

describe('buildMemoryScenes', () => {
  const scenes = buildMemoryScenes();

  it('produces a four-step walkthrough with consistent step metadata', () => {
    expect(scenes).toHaveLength(4);
    scenes.forEach((s, i) => {
      expect(s.step).toBe(i);
      expect(s.totalSteps).toBe(4);
    });
    expect(scenes.map((s) => s.stage)).toEqual(['converse', 'compact', 'retrieve', 'assemble']);
  });

  it('shows compaction dropping the working-set token count', () => {
    const [converse, compact] = scenes;
    expect(converse!.summarizedCount).toBe(0);
    expect(compact!.summarizedCount).toBeGreaterThan(0);
    expect(compact!.summary).toContain('detail lost');
    // Compaction must reduce the working token cost and fit the window.
    expect(compact!.workingTokens).toBeLessThan(converse!.workingTokens);
    expect(compact!.workingTokens).toBeLessThanOrEqual(MEMORY_WINDOW_TOKENS + 5);
  });

  it('retrieves the relevant early turn (relevance beats recency), computed for real', () => {
    const retrieve = scenes[2]!;
    expect(retrieve.retrieved.length).toBeGreaterThan(0);
    // The allergy turn (t1) is surfaced, not the recent Lisbon-trip turn (t3).
    expect(retrieve.retrieved[0]!.turn.id).toBe('t1');
    expect(retrieve.retrieved.map((h) => h.turn.id)).not.toContain('t3');
    // Real cosine score, descending.
    expect(retrieve.retrieved[0]!.score).toBeGreaterThan(retrieve.retrieved[1]!.score);
  });

  it('carries the retrieved fact into the assembled context', () => {
    const assemble = scenes[3]!;
    expect(assemble.stage).toBe('assemble');
    expect(assemble.retrieved[0]!.turn.id).toBe('t1');
    expect(assemble.summary).not.toBe('');
  });
});
