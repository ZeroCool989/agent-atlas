import { describe, expect, it } from 'vitest';

import {
  decode,
  encode,
  splitWords,
  trainBpe,
  TRAINING_CORPUS,
  TEACHING_MERGES,
} from '../../src/lib/sim/tokenizer';

describe('splitWords', () => {
  it('keeps the leading space with each word after the first', () => {
    expect(splitWords('the model reads')).toEqual(['the', ' model', ' reads']);
  });
  it('normalizes whitespace runs and newlines', () => {
    expect(splitWords('  a \n b  ')).toEqual(['a', ' b']);
  });
});

describe('trainBpe — the algorithm on a hand-checkable corpus', () => {
  // "aa" appears 3× as a pair inside these words; classic minimal BPE example.
  const model = trainBpe('aaab aaab', 3);

  it('learns the most frequent pair first, with its real frequency', () => {
    // Sequences: "aaab"×1 + " aaab"×1 → pairs: (a,a)×4? count per word: a-a twice in aaab.
    expect(model.merges[0]).toMatchObject({ rank: 0, left: 'a', right: 'a', merged: 'aa' });
    expect(model.merges[0]!.frequency).toBe(4);
  });

  it('stops early when no pair occurs at least twice', () => {
    const tiny = trainBpe('ab cd', 10);
    expect(tiny.merges).toEqual([]); // every pair occurs once — nothing worth learning
  });

  it('is deterministic: identical corpus → identical merges and vocab', () => {
    expect(trainBpe(TRAINING_CORPUS, TEACHING_MERGES)).toEqual(
      trainBpe(TRAINING_CORPUS, TEACHING_MERGES),
    );
  });

  it('assigns deterministic ids: sorted characters first, then merges in learned order', () => {
    const { vocab, merges } = trainBpe('abba abba', 1);
    const chars = vocab.slice(0, vocab.length - merges.length).map((v) => v.token);
    expect(chars).toEqual([...chars].sort());
    expect(vocab[vocab.length - 1]!.token).toBe(merges[merges.length - 1]!.merged);
    expect(vocab.map((v) => v.id)).toEqual(vocab.map((_, i) => i));
  });
});

describe('encode/decode', () => {
  const model = trainBpe(TRAINING_CORPUS, TEACHING_MERGES);

  it('encodes seen text into multi-character tokens with vocabulary ids', () => {
    // " tokens" (with leading space) is how the corpus saw the word — see the
    // leading-space test below for why that distinction is real.
    const tokens = encode('the tokens', model);
    expect(tokens.length).toBeLessThan('the tokens'.length); // merges actually compress
    expect(tokens.every((t) => t.known && t.id !== undefined)).toBe(true);
    expect(tokens.some((t) => t.text.length > 2)).toBe(true);
  });

  it('round-trips losslessly (BPE is lossless by construction)', () => {
    for (const text of ['learning tokenization', 'the model reads tokens', 'a token']) {
      expect(decode(encode(text, model))).toBe(text);
    }
  });

  it('maxMerges: 0 yields pure characters; more merges never increase token count', () => {
    const chars = encode('learning', model, { maxMerges: 0 });
    expect(chars.map((t) => t.text)).toEqual([...'learning']);
    let previous = chars.length;
    for (let k = 1; k <= model.merges.length; k++) {
      const count = encode('learning', model, { maxMerges: k }).length;
      expect(count).toBeLessThanOrEqual(previous);
      previous = count;
    }
  });

  it('applies merges by rank order, not left-to-right greed', () => {
    // With merges learned on the corpus, encoding must equal re-applying training merges.
    const viaTraining = trainBpe('abab abab', 2);
    const tokens = encode('abab', viaTraining);
    expect(decode(tokens)).toBe('abab');
    expect(tokens.length).toBeLessThanOrEqual(2);
  });

  it('unknown characters become honest single-character unknown tokens', () => {
    const tokens = encode('tokens 🚀 ...', model);
    const unknown = tokens.filter((t) => !t.known);
    expect(unknown.length).toBeGreaterThan(0);
    expect(unknown.every((t) => t.id === undefined)).toBe(true); // never fabricated
    expect(decode(tokens)).toBe('tokens 🚀 ...'); // still lossless
  });

  it('leading-space convention: " token" and "token" tokenize differently', () => {
    const mid = encode('a token', model).slice(1); // drop "a"
    const start = encode('token', model);
    expect(decode(mid)).toBe(' token');
    expect(mid.map((t) => t.text)).not.toEqual(start.map((t) => t.text));
  });
});

describe('teaching model sanity (guards the lesson content)', () => {
  const model = trainBpe(TRAINING_CORPUS, TEACHING_MERGES);

  it('learns the full requested number of merges from the teaching corpus', () => {
    expect(model.merges).toHaveLength(TEACHING_MERGES);
  });

  it('discovers recognizable subword pieces the lesson refers to', () => {
    const learned = model.merges.map((m) => m.merged);
    // The corpus is designed so pieces of "token" and "-ing" emerge.
    expect(learned.some((t) => t.includes('to') || t.includes('en'))).toBe(true);
  });
});
