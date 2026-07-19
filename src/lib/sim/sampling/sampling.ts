/**
 * The L0 sampling build project — the decoding step every language model runs after it
 * produces logits, implemented from first principles (plan §3 build projects, ADR-0005).
 *
 * A model's forward pass ends with a vector of **logits**: one real-valued score per
 * vocabulary token. Those scores are not yet probabilities and are not yet a choice.
 * Two things happen next, and this file is both of them, kept deliberately separate:
 *
 *   1. `softmax` turns logits into a probability distribution, with a **temperature**
 *      that reshapes how peaked or flat that distribution is.
 *   2. `applyTopK` / `applyTopP` optionally **truncate** the distribution to a candidate
 *      set before a token is drawn, and `sample` draws one with a seeded PRNG so the
 *      draw is reproducible.
 *
 * Everything is pure and deterministic given its inputs (the PRNG is explicit, never
 * `Math.random`), so the same functions power the lesson's visualization and its tests.
 * No dependencies, no model, no network — this is course material meant to be read.
 */

export interface TokenLogit {
  token: string;
  logit: number;
}

export interface TokenProb {
  token: string;
  prob: number;
}

/** A candidate after truncation: its post-renormalization probability and whether it survived the cut. */
export interface Candidate {
  token: string;
  prob: number;
  kept: boolean;
}

/**
 * Softmax with temperature: `p_i = exp(z_i / T) / Σ_j exp(z_j / T)`.
 *
 * Temperature `T` reshapes the distribution without adding any information:
 *   - `T → 0`  collapses onto the single highest logit (argmax; one-hot) — "greedy".
 *   - `T = 1`  is the model's raw distribution.
 *   - `T > 1`  flattens it, giving lower-probability tokens a real chance.
 *
 * We subtract the max logit before exponentiating (a standard numerical-stability trick;
 * it shifts every term equally and so leaves the result unchanged). `T ≤ 0` is treated as
 * greedy: the exact argmax gets probability 1, ties split evenly — mirroring how real
 * decoders special-case `temperature: 0`, since `exp(z/0)` is otherwise undefined.
 */
export function softmax(logits: number[], temperature = 1): number[] {
  if (logits.length === 0) return [];

  if (temperature <= 0) {
    const max = Math.max(...logits);
    const winners = logits.map((z) => (z === max ? 1 : 0));
    const count = winners.reduce<number>((a, b) => a + b, 0);
    return winners.map((w) => w / count);
  }

  const scaled = logits.map((z) => z / temperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((z) => Math.exp(z - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Softmax over labelled logits — the token-aware form used by the lesson and the viz. */
export function softmaxTokens(items: TokenLogit[], temperature = 1): TokenProb[] {
  const probs = softmax(
    items.map((i) => i.logit),
    temperature,
  );
  return items.map((item, i) => ({ token: item.token, prob: probs[i]! }));
}

/**
 * Top-k truncation: keep the `k` highest-probability tokens, drop the rest, and
 * renormalize the survivors so they sum to 1. A **fixed-size** cut — always exactly `k`
 * candidates regardless of how confident the distribution is.
 *
 * Order of the input is preserved in the output (the viz relies on stable positions);
 * `kept` marks survivors and dropped tokens get `prob: 0`. Ties at the k-th place are
 * broken by original index, so the result is deterministic.
 */
export function applyTopK(dist: TokenProb[], k: number): Candidate[] {
  if (k <= 0) return dist.map((d) => ({ token: d.token, prob: 0, kept: false }));
  if (k >= dist.length) return renormalizeKept(dist.map((_, i) => ({ index: i, keep: true })), dist);

  const ranked = dist
    .map((d, index) => ({ index, prob: d.prob }))
    .sort((a, b) => b.prob - a.prob || a.index - b.index);
  const keptIndices = new Set(ranked.slice(0, k).map((r) => r.index));
  return renormalizeKept(
    dist.map((_, index) => ({ index, keep: keptIndices.has(index) })),
    dist,
  );
}

/**
 * Top-p (nucleus) truncation: sort by probability descending, then keep the **smallest**
 * set of tokens whose cumulative probability first reaches `p`, drop the rest, and
 * renormalize. A **dynamic** cut — a confident distribution yields few candidates, a flat
 * one yields many. This is the key difference from top-k, which is blind to confidence.
 *
 * `p` is clamped to [0, 1]. At least one token is always kept (the single most likely),
 * so `p = 0` still yields the greedy token rather than an empty set. Ties are broken by
 * original index; input order is preserved in the output.
 */
export function applyTopP(dist: TokenProb[], p: number): Candidate[] {
  const target = Math.min(1, Math.max(0, p));
  const ranked = dist
    .map((d, index) => ({ index, prob: d.prob }))
    .sort((a, b) => b.prob - a.prob || a.index - b.index);

  const keptIndices = new Set<number>();
  let cumulative = 0;
  for (const r of ranked) {
    keptIndices.add(r.index);
    cumulative += r.prob;
    if (cumulative >= target) break;
  }
  return renormalizeKept(
    dist.map((_, index) => ({ index, keep: keptIndices.has(index) })),
    dist,
  );
}

/** Renormalize the kept subset to sum to 1, preserving input order; dropped tokens get prob 0. */
function renormalizeKept(
  flags: Array<{ index: number; keep: boolean }>,
  dist: TokenProb[],
): Candidate[] {
  const keptMass = flags.reduce((sum, f) => (f.keep ? sum + dist[f.index]!.prob : sum), 0);
  return flags.map((f) => ({
    token: dist[f.index]!.token,
    prob: f.keep && keptMass > 0 ? dist[f.index]!.prob / keptMass : 0,
    kept: f.keep,
  }));
}

/**
 * A small, fast, seeded PRNG (mulberry32). Explicit and reproducible — the same seed
 * always yields the same stream — which is exactly what makes sampling testable and what
 * "set a seed for reproducibility" means in practice.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw one token from a distribution by inverse-CDF: walk the cumulative probabilities
 * and return the token whose interval contains `rng()`. Tokens with `prob: 0` (cut by
 * truncation) can never be drawn. The distribution is assumed to sum to ~1 (as the
 * functions above guarantee); the final token catches any floating-point remainder.
 */
export function sample(dist: TokenProb[] | Candidate[], rng: () => number): string {
  const roll = rng();
  let cumulative = 0;
  for (const d of dist) {
    cumulative += d.prob;
    if (roll < cumulative) return d.token;
  }
  return dist[dist.length - 1]!.token;
}
