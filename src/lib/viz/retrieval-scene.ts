/**
 * Scene builder for the nearest-neighbor retrieval visual (ADR-0004, plan §8 Tier 2).
 * Pure data: `(query) => Scene[]`, no React/Astro/timers. The renderer decides how the
 * ranking is displayed; this module decides only what is TRUE at each step.
 *
 * The visual: pick a query word, then rank the rest of the corpus by cosine similarity,
 * revealing the ranking one neighbor at a time (nearest first) so the "retrieve the most
 * relevant" operation is watchable. Every score shown is computed from the real
 * `src/lib/retrieval` engine — no invented numbers.
 */
import {
  cosineSimilarity,
  type Embedded,
  embeddingFor,
  ILLUSTRATIVE_EMBEDDINGS,
} from '../retrieval/embeddings';

export interface RetrievalCandidate {
  readonly text: string;
  /** Cosine similarity to the query, in [-1, 1]. */
  readonly score: number;
  /** 1-based rank once revealed. */
  readonly rank: number;
  /** False until this neighbor's step; the renderer hides the score until then. */
  readonly revealed: boolean;
}

export interface RetrievalScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  /** Teaching text; doubles as the accessible scene description. */
  readonly description: string;
  readonly query: string;
  /** Candidates in ranked order (nearest first); scores are hidden until revealed. */
  readonly candidates: readonly RetrievalCandidate[];
}

/** Round to 2 decimals for display without hiding sign. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Build the step sequence for ranking `corpus` against `queryText` (which must be an
 * entry in the corpus). Step 0 sets up the query with nothing revealed; each later step
 * reveals the next-nearest neighbor.
 */
export function buildRetrievalScenes(
  queryText: string,
  corpus: readonly Embedded[] = ILLUSTRATIVE_EMBEDDINGS,
): RetrievalScene[] {
  const queryVector = embeddingFor(queryText, corpus);
  if (!queryVector) {
    throw new Error(`buildRetrievalScenes: "${queryText}" is not in the corpus`);
  }

  const ranked = corpus
    .filter((entry) => entry.text !== queryText)
    .map((entry) => ({ text: entry.text, score: cosineSimilarity(queryVector, entry.vector) }))
    .sort((a, b) => b.score - a.score)
    .map((entry, i) => ({ ...entry, score: round2(entry.score), rank: i + 1 }));

  const totalSteps = ranked.length + 1;

  const sceneAt = (step: number): RetrievalScene => {
    const revealedCount = step; // step 0 reveals nothing; step k reveals the top k
    const candidates = ranked.map((entry) => ({
      ...entry,
      revealed: entry.rank <= revealedCount,
    }));
    const description =
      step === 0
        ? `Query: “${queryText}”. Every other word is ranked by cosine similarity to it — closest in meaning first. Press Next to reveal the ranking.`
        : step < totalSteps - 1
          ? `Nearest #${step}: “${ranked[step - 1]!.text}” at cosine ${ranked[step - 1]!.score.toFixed(2)}. The score is direction-only, so it ignores how “big” a vector is.`
          : `Full ranking. The top of the list is what a retriever would return for “${queryText}”; the bottom (low or negative cosine) is what it would ignore.`;
    return {
      step,
      totalSteps,
      title: `Nearest neighbors of “${queryText}”`,
      description,
      query: queryText,
      candidates,
    };
  };

  return Array.from({ length: totalSteps }, (_, step) => sceneAt(step));
}
