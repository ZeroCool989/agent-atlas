import { describe, expect, it } from 'vitest';

import {
  assembleRagPrompt,
  buildContext,
  chunkText,
  contextTokens,
  groundedAnswer,
  RAG_CORPUS,
  RAG_DEMO_QUERY_VECTOR,
  RELEVANCE_FLOOR,
  retrieve,
  runRagPipeline,
} from './pipeline';

describe('chunkText', () => {
  it('packs whole sentences up to the size limit and never splits mid-sentence', () => {
    const doc = 'One sentence here. A second, slightly longer, sentence follows. Third.';
    const chunks = chunkText(doc, 40);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(60); // whole sentences, near the cap
    // Every sentence survives intact somewhere.
    expect(chunks.join(' ')).toContain('slightly longer');
  });

  it('returns a single chunk when the document fits', () => {
    expect(chunkText('Short doc.', 240)).toEqual(['Short doc.']);
  });

  it('handles empty input', () => {
    expect(chunkText('')).toEqual([]);
  });
});

describe('retrieve', () => {
  it('ranks the billing passage first for a billing query, by real cosine', () => {
    const top = retrieve(RAG_DEMO_QUERY_VECTOR, RAG_CORPUS, 3);
    expect(top.map((p) => p.id)).toEqual(['KB1', 'KB2', 'KB3']);
    // Scores are sorted descending and are genuine cosine values.
    expect(top[0]!.score).toBeGreaterThan(top[1]!.score);
    expect(top[0]!.score).toBeGreaterThan(0.9);
  });

  it('pushes unrelated passwords/shipping passages to the bottom', () => {
    const all = retrieve(RAG_DEMO_QUERY_VECTOR, RAG_CORPUS, RAG_CORPUS.length);
    const bottomTwo = all.slice(-2).map((p) => p.id).sort();
    expect(bottomTwo).toEqual(['KB4', 'KB5']);
  });

  it('respects k', () => {
    expect(retrieve(RAG_DEMO_QUERY_VECTOR, RAG_CORPUS, 1)).toHaveLength(1);
    expect(retrieve(RAG_DEMO_QUERY_VECTOR, RAG_CORPUS, 0)).toHaveLength(0);
  });
});

describe('buildContext', () => {
  it('labels each passage with its citation id', () => {
    const ctx = buildContext(retrieve(RAG_DEMO_QUERY_VECTOR, RAG_CORPUS, 2));
    expect(ctx).toMatch(/^\[KB1\] /);
    expect(ctx).toContain('[KB2]');
  });
});

describe('assembleRagPrompt', () => {
  it('produces a ModelRequest whose system pins the model to the context and demands citations', () => {
    const retrieved = retrieve(RAG_DEMO_QUERY_VECTOR, RAG_CORPUS, 3);
    const { request, context } = assembleRagPrompt('How do I cancel my subscription?', retrieved);
    expect(request.system).toMatch(/only the numbered context/i);
    expect(request.system).toMatch(/cite/i);
    expect(request.system).toMatch(/do not use outside knowledge/i);
    const lastTurn = request.messages.at(-1)!;
    expect(lastTurn.role).toBe('user');
    const userText = lastTurn.role === 'user' ? lastTurn.text : '';
    expect(userText).toContain('How do I cancel my subscription?');
    expect(userText).toContain(context);
  });

  it('accounts for the retrieved context in the token budget', () => {
    const few = assembleRagPrompt('q', retrieve(RAG_DEMO_QUERY_VECTOR, RAG_CORPUS, 1));
    const many = assembleRagPrompt('q', retrieve(RAG_DEMO_QUERY_VECTOR, RAG_CORPUS, 3));
    expect(many.budget.totalTokens).toBeGreaterThan(few.budget.totalTokens);
    expect(contextTokens(retrieve(RAG_DEMO_QUERY_VECTOR, RAG_CORPUS, 3))).toBeGreaterThan(0);
  });
});

describe('groundedAnswer', () => {
  it('grounds the answer on the top passage with a citation when it clears the floor', () => {
    const ans = groundedAnswer(retrieve(RAG_DEMO_QUERY_VECTOR, RAG_CORPUS, 3));
    expect(ans.grounded).toBe(true);
    expect(ans.citations).toEqual(['KB1']);
    expect(ans.text).toContain('[KB1]');
  });

  it('refuses instead of inventing when retrieval is below the relevance floor', () => {
    const weak = [{ id: 'KB5', text: 'shipping', score: RELEVANCE_FLOOR - 0.1 }];
    const ans = groundedAnswer(weak);
    expect(ans.grounded).toBe(false);
    expect(ans.citations).toEqual([]);
    expect(ans.text).toMatch(/does not contain the answer/i);
  });
});

describe('runRagPipeline', () => {
  it('runs retrieve → assemble → answer end to end and is deterministic', () => {
    const a = runRagPipeline();
    const b = runRagPipeline();
    expect(a).toEqual(b);
    expect(a.retrieved[0]!.id).toBe('KB1');
    expect(a.answer.grounded).toBe(true);
    expect(a.request.messages.length).toBeGreaterThan(0);
    expect(a.budget.totalTokens).toBeGreaterThan(0);
  });
});
