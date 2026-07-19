/**
 * Embeddings & similarity — the reusable retrieval core (L2 build project seed).
 *
 * Plain TypeScript, no dependencies, written to be read (ADR-0005). This is the code the
 * Embeddings concept points at, and the foundation vector-search and RAG build on later.
 *
 * Honesty boundary (stated in the lesson too): a *real* embedding is a high-dimensional
 * vector produced by a trained model. Nothing here trains anything. What is real and
 * reusable is the **geometry**: once text is a vector, "similar in meaning" becomes
 * "close in direction," and that is pure, testable math — `cosineSimilarity` and
 * `nearestNeighbors` below are exactly what a production retriever runs over millions of
 * learned vectors. The bundled `ILLUSTRATIVE_EMBEDDINGS` are hand-placed 2-D vectors,
 * labelled as illustrative, chosen so the geometry is visible on a page — never presented
 * as learned representations.
 */

export type Vector = readonly number[];

export interface Embedded {
  /** The text this vector stands in for. */
  readonly text: string;
  readonly vector: Vector;
}

export interface Ranked {
  readonly text: string;
  /** Cosine similarity to the query, in [-1, 1]. */
  readonly score: number;
}

/** Sum of element-wise products. Throws on a dimension mismatch — a real bug, not a 0. */
export function dot(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error(`dot: dimension mismatch (${a.length} vs ${b.length})`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

/** Euclidean length ‖v‖. */
export function magnitude(v: Vector): number {
  return Math.sqrt(dot(v, v));
}

/**
 * Cosine similarity: the cosine of the angle between two vectors, i.e. dot product
 * normalized by both magnitudes. In [-1, 1]: 1 = same direction, 0 = orthogonal
 * (unrelated), -1 = opposite. It measures *direction only*, so it is scale-invariant —
 * doubling a vector's length does not change its similarity to anything. That is exactly
 * why it, not raw distance, is the default for comparing embeddings.
 *
 * A zero vector has no direction, so similarity to it is undefined; we return 0
 * (treat "no signal" as "unrelated") rather than dividing by zero.
 */
export function cosineSimilarity(a: Vector, b: Vector): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot(a, b) / (magA * magB);
}

/** Unit vector in the same direction (or the zero vector unchanged). */
export function normalize(v: Vector): Vector {
  const mag = magnitude(v);
  if (mag === 0) return v.slice();
  return v.map((x) => x / mag);
}

/**
 * Rank a corpus by cosine similarity to a query vector, most similar first. Returns the
 * top `k` (all of them if `k` is omitted or ≥ corpus size). This is nearest-neighbor
 * search — the literal operation behind "retrieve the most relevant chunks."
 *
 * Ties (equal scores) preserve the corpus's original order, so results are deterministic
 * and testable. A production vector database does the same ranking approximately, over
 * far more vectors, far faster — the idea is identical.
 */
export function nearestNeighbors(query: Vector, corpus: readonly Embedded[], k?: number): Ranked[] {
  const scored = corpus.map((entry, index) => ({
    text: entry.text,
    score: cosineSimilarity(query, entry.vector),
    index,
  }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const limit = k === undefined ? scored.length : Math.max(0, Math.min(k, scored.length));
  return scored.slice(0, limit).map(({ text, score }) => ({ text, score }));
}

/** Look up an entry's vector by its text (exact match), or undefined. */
export function embeddingFor(text: string, corpus: readonly Embedded[]): Vector | undefined {
  return corpus.find((entry) => entry.text === text)?.vector;
}

/**
 * A tiny, hand-placed 2-D corpus for teaching. NOT learned — the coordinates are chosen
 * so related words point in similar directions (royalty up-right, animals down-right,
 * fruit down-left), making cosine ranking visible. Real embeddings are hundreds to
 * thousands of dimensions and are trained; these exist only so the *geometry* can be seen.
 */
export const ILLUSTRATIVE_EMBEDDINGS: readonly Embedded[] = [
  { text: 'king', vector: [0.94, 0.34] },
  { text: 'queen', vector: [0.9, 0.44] },
  { text: 'prince', vector: [0.86, 0.51] },
  { text: 'dog', vector: [0.42, -0.91] },
  { text: 'cat', vector: [0.36, -0.93] },
  { text: 'wolf', vector: [0.5, -0.87] },
  { text: 'apple', vector: [-0.8, -0.6] },
  { text: 'banana', vector: [-0.86, -0.51] },
  { text: 'grape', vector: [-0.74, -0.67] },
];
