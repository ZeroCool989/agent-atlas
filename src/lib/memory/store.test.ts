import { describe, expect, it } from 'vitest';
import { estimateTokens } from '../prompt/assemble';
import {
  DEMO_QUERY_VECTOR,
  DEMO_SESSION,
  EpisodicMemory,
  type EpisodicTurn,
  packContext,
  summarize,
  type Turn,
  turnTokens,
} from './store';

const turn = (id: string, role: Turn['role'], text: string): Turn => ({ id, role, text });

describe('turnTokens', () => {
  it('counts the role label plus text', () => {
    const t = turn('a', 'user', 'hello world');
    expect(turnTokens(t)).toBe(estimateTokens('user: hello world'));
  });
});

describe('summarize', () => {
  it('is empty for no turns', () => {
    expect(summarize([])).toBe('');
  });

  it('is lossy: shorter than the turns it replaces and labels the omission', () => {
    const turns = [
      turn('1', 'user', 'I need a detailed plan for the Q3 launch including budget and staffing.'),
      turn('2', 'assistant', 'Sure. Here is a full breakdown of budget, staffing, and timeline.'),
    ];
    const summary = summarize(turns);
    expect(summary).toContain('detail lost');
    const originalTokens = turns.reduce((n, t) => n + estimateTokens(t.text), 0);
    // The summary must cost fewer tokens than the verbatim turns — the whole point of compaction.
    expect(estimateTokens(summary)).toBeLessThan(originalTokens);
  });
});

describe('packContext', () => {
  const session: Turn[] = Array.from({ length: 8 }, (_, i) =>
    turn(String(i), i % 2 === 0 ? 'user' : 'assistant', `Turn number ${i} with some content here.`),
  );

  it('keeps everything verbatim when it fits the budget', () => {
    const packed = packContext(session, 10_000);
    expect(packed.summarizedCount).toBe(0);
    expect(packed.summary).toBe('');
    expect(packed.recent).toHaveLength(session.length);
    expect(packed.overBudget).toBe(false);
  });

  it('summarises older turns and keeps the newest verbatim under a tight budget', () => {
    const packed = packContext(session, 30);
    expect(packed.summarizedCount).toBeGreaterThan(0);
    expect(packed.summary).not.toBe('');
    // Newest turn is always kept.
    expect(packed.recent.at(-1)?.id).toBe('7');
    // The kept recent turns are a contiguous newest-suffix of the session.
    const keptIds = packed.recent.map((t) => Number(t.id));
    for (let i = 1; i < keptIds.length; i++) expect(keptIds[i]).toBe(keptIds[i - 1]! + 1);
    expect(packed.tokens).toBeLessThanOrEqual(30 + 5); // summary may nudge slightly; recent fit
  });

  it('flags unavoidable overflow when even summary + newest turn exceed the budget', () => {
    const big = [turn('x', 'user', 'a '.repeat(200)), turn('y', 'assistant', 'b '.repeat(200))];
    const packed = packContext(big, 5);
    expect(packed.overBudget).toBe(true);
  });
});

describe('EpisodicMemory', () => {
  it('retrieves the most relevant past turn, not the most recent', () => {
    const mem = new EpisodicMemory();
    DEMO_SESSION.forEach((t) => mem.add(t));
    // Query is about a snack/allergy; nearest stored turn must be the allergy turn (t1),
    // NOT the recent Lisbon-trip turns — relevance beats recency.
    const hits = mem.retrieve(DEMO_QUERY_VECTOR, 3);
    expect(hits[0]?.turn.id).toBe('t1');
    expect(hits.map((h) => h.turn.id)).not.toContain('t3'); // the trip turn is far away
    // Scores are real cosine values in [-1, 1], descending.
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
    expect(hits[0]!.score).toBeLessThanOrEqual(1);
  });

  it('returns nothing from an empty store', () => {
    expect(new EpisodicMemory().retrieve(DEMO_QUERY_VECTOR)).toEqual([]);
  });

  it('similarity is symmetric', () => {
    const a: EpisodicTurn = DEMO_SESSION[0]!;
    const b: EpisodicTurn = DEMO_SESSION[2]!;
    expect(EpisodicMemory.similarity(a.vector, b.vector)).toBeCloseTo(
      EpisodicMemory.similarity(b.vector, a.vector),
    );
  });
});
