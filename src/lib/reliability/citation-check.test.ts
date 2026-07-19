import { describe, expect, it } from 'vitest';

import { checkCitations, extractCitations, splitSentences } from './citation-check';

describe('splitSentences', () => {
  it('splits on sentence boundaries and trims', () => {
    expect(splitSentences('One fact [a]. Two facts [b]! Three?')).toEqual([
      'One fact [a].',
      'Two facts [b]!',
      'Three?',
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('extractCitations', () => {
  it('finds [id] tokens, lowercased, in order, with duplicates', () => {
    expect(extractCitations('See [Doc-1] and [doc-2] and again [Doc-1].')).toEqual([
      'doc-1',
      'doc-2',
      'doc-1',
    ]);
  });

  it('ignores bracketed text that is not an id (spaces are not part of an id)', () => {
    expect(extractCitations('see [note this] and [multi word phrase]')).toEqual([]);
  });

  it('treats a bare number as a citation id — numeric citations are common', () => {
    expect(extractCitations('as shown [1] and again [2]')).toEqual(['1', '2']);
  });
});

describe('checkCitations', () => {
  const provided = ['doc-1', 'doc-2', 'doc-3'];

  it('marks a sentence supported when all its citations resolve', () => {
    const r = checkCitations('The tower is 300m tall [doc-1].', provided);
    expect(r.sentences[0]!.status).toBe('supported');
    expect(r.ok).toBe(true);
    expect(r.fabricatedCitations).toEqual([]);
  });

  it('flags a fabricated citation that was never provided', () => {
    const r = checkCitations('It was built in 1889 [doc-9].', provided);
    expect(r.sentences[0]!.status).toBe('fabricated-citation');
    expect(r.sentences[0]!.fabricated).toEqual(['doc-9']);
    expect(r.fabricatedCitations).toEqual(['doc-9']);
    expect(r.ok).toBe(false);
  });

  it('flags a claim made with no citation at all', () => {
    const r = checkCitations('It is the tallest building in the world.', provided);
    expect(r.sentences[0]!.status).toBe('uncited-claim');
    expect(r.uncitedClaims).toBe(1);
    expect(r.ok).toBe(false);
  });

  it('reports each sentence independently across a mixed answer', () => {
    const answer =
      'The tower opened in 1889 [doc-1]. It is made of iron [doc-2]. ' +
      'It has 1,665 steps [doc-9]. It is repainted every seven years.';
    const r = checkCitations(answer, provided);
    expect(r.sentences.map((s) => s.status)).toEqual([
      'supported',
      'supported',
      'fabricated-citation',
      'uncited-claim',
    ]);
    expect(r.fabricatedCitations).toEqual(['doc-9']);
    expect(r.uncitedClaims).toBe(1);
    expect(r.ok).toBe(false);
  });

  it('is case-insensitive about provided ids', () => {
    const r = checkCitations('Fact [DOC-1].', ['doc-1']);
    expect(r.sentences[0]!.status).toBe('supported');
  });

  it('the honest limit: a resolving citation is marked supported even if it would not actually back the claim', () => {
    // doc-2 exists, so the checker passes it — but resolution is not support.
    const r = checkCitations('The tower is painted blue [doc-2].', provided);
    expect(r.sentences[0]!.status).toBe('supported');
    // The checker cannot know doc-2 says nothing about colour; that is its stated limit.
    expect(r.ok).toBe(true);
  });
});
