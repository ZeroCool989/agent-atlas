/**
 * The L0 "what a language model is" build project — a next-token predictor, implemented
 * from first principles (plan §3 build projects, ADR-0005).
 *
 * A large language model is, mechanically, one thing: given a sequence of tokens, it
 * produces a probability distribution over which token comes next. Everything else —
 * chat, code, reasoning-shaped output — is that single operation run over and over,
 * appending one token each time (autoregression). This file makes that operation
 * concrete with the simplest model that actually learns from data: an **n-gram** model.
 *
 * The two phases every language model has are visible here, kept deliberately separate:
 *
 *   1. **Training** (`trainNgram`) — read a corpus once and *count* how often each token
 *      follows its context. Those counts ARE the learned "weights". A real LLM learns
 *      billions of continuous weights by gradient descent instead of counting, but the
 *      thing being learned is the same: the conditional distribution of the next token.
 *   2. **Inference** (`nextTokenDistribution`, `generate`) — run the frozen model forward
 *      to get the next-token distribution and extend the sequence. The model does not
 *      learn during inference; the counts (weights) never change as it generates.
 *
 * An n-gram model is a real language model — just a tiny, transparent one. Seeing where
 * it succeeds (local fluency) and fails (no long-range memory, it forgets everything
 * before the last few tokens) is the fastest honest intuition for what scaling and the
 * Transformer bought. No dependencies, no network, no real model — course material meant
 * to be read. The picking step (greedy vs sampling) is deliberately NOT here: it is the
 * separate `sampling` concept, and `generate` takes a `pick` function so the two ideas
 * stay factored exactly as they are in a real decoder.
 */

export interface TokenProb {
  token: string;
  prob: number;
}

/**
 * A trained n-gram model. `order` is n: order 2 = bigram (condition on the previous 1
 * token), order 3 = trigram (previous 2). `counts` maps a context key (the previous
 * `order - 1` tokens, joined) to how many times each token was seen following it.
 * `unigram` is the fallback distribution used when a context was never seen in training.
 */
export interface NgramModel {
  order: number;
  counts: Map<string, Map<string, number>>;
  unigram: Map<string, number>;
  vocab: string[];
}

/**
 * Deterministic word tokenizer for the demo corpus: lowercase, split on whitespace, and
 * keep sentence-ending punctuation as its own token so the model can learn where
 * sentences stop. This is intentionally simpler than the real subword tokenizer (see the
 * `tokens` concept) — the point here is next-token prediction, not tokenization.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/([.!?])/g, ' $1 ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** The context key for a token at position `i`: the previous `order - 1` tokens joined. */
function contextKey(tokens: string[], i: number, order: number): string {
  return tokens.slice(Math.max(0, i - (order - 1)), i).join(' ');
}

/**
 * Training: count next-token frequencies over the corpus. The resulting counts are the
 * model's entire learned knowledge — there is nothing else. A real LLM replaces counting
 * with gradient descent over continuous weights, but the target it fits is the same
 * conditional next-token distribution this function tallies.
 */
export function trainNgram(corpus: string, order = 2): NgramModel {
  if (order < 1) throw new Error('trainNgram: order must be >= 1');
  const tokens = tokenize(corpus);
  const counts = new Map<string, Map<string, number>>();
  const unigram = new Map<string, number>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    unigram.set(token, (unigram.get(token) ?? 0) + 1);
    const key = contextKey(tokens, i, order);
    let next = counts.get(key);
    if (!next) {
      next = new Map<string, number>();
      counts.set(key, next);
    }
    next.set(token, (next.get(token) ?? 0) + 1);
  }

  return { order, counts, unigram, vocab: [...unigram.keys()].sort() };
}

/** Turn a count map into a probability distribution, sorted most-likely first. */
function toDistribution(counts: Map<string, number>): TokenProb[] {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...counts.entries()]
    .map(([token, c]) => ({ token, prob: c / total }))
    .sort((a, b) => b.prob - a.prob || a.token.localeCompare(b.token));
}

/**
 * Inference, step one: the next-token distribution given the tokens so far. Uses the last
 * `order - 1` tokens as context; if that exact context was never seen in training, it
 * **backs off** to the overall unigram distribution rather than failing — a real model
 * never has an "unseen context" because its weights generalize, but backoff is the honest
 * n-gram stand-in. The returned distribution is a genuine probability distribution
 * (sums to ~1) that a decoder (the `sampling` concept) then picks from.
 */
export function nextTokenDistribution(model: NgramModel, contextTokens: string[]): TokenProb[] {
  const key = contextTokens.slice(Math.max(0, contextTokens.length - (model.order - 1))).join(' ');
  const seen = model.counts.get(key);
  if (seen && seen.size > 0) return toDistribution(seen);
  return toDistribution(model.unigram);
}

/**
 * Inference, the full loop: autoregressive generation. Predict the next-token
 * distribution, hand it to `pick` to choose one token, append it, and repeat. This is
 * exactly the shape of real text generation — the only difference is that a real model's
 * `nextTokenDistribution` is a forward pass through billions of weights.
 *
 * `pick` is injected, not hardcoded, because *how* you turn a distribution into a token
 * is the separate decoding decision (greedy vs temperature/top-k/top-p — the `sampling`
 * concept). The default is greedy (argmax), which is deterministic. Generation stops at
 * `maxTokens` or when a sentence-ending token is produced.
 */
export function generate(
  model: NgramModel,
  prompt: string,
  maxTokens: number,
  pick: (dist: TokenProb[]) => string = greedy,
): { tokens: string[]; steps: { context: string[]; distribution: TokenProb[]; chosen: string }[] } {
  const tokens = tokenize(prompt);
  const steps: { context: string[]; distribution: TokenProb[]; chosen: string }[] = [];

  for (let i = 0; i < maxTokens; i++) {
    const distribution = nextTokenDistribution(model, tokens);
    if (distribution.length === 0) break;
    const chosen = pick(distribution);
    steps.push({ context: [...tokens], distribution, chosen });
    tokens.push(chosen);
    if (chosen === '.' || chosen === '!' || chosen === '?') break;
  }

  return { tokens, steps };
}

/** Greedy decoding: always take the most probable token. Deterministic; the default pick. */
export function greedy(dist: TokenProb[]): string {
  return dist.reduce((best, d) => (d.prob > best.prob ? d : best)).token;
}
