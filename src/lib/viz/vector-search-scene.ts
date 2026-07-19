/**
 * Scene builder for the flat-vs-approximate vector-search visual (ADR-0004, plan §8 Tier 2).
 * Pure data: `() => Scene[]`, no React/Astro/timers. Every number shown — comparison
 * counts, cosine scores, recall — is computed from the real `src/lib/retrieval` engine, so
 * the picture can never drift from the algorithm.
 *
 * The story in four steps: the query and corpus; an exact flat scan (compare everything,
 * perfect recall); an approximate scan of the single nearest cluster (fewer comparisons,
 * but it misses a true neighbor that sat across a boundary); and a two-cluster probe that
 * pays more to recover full recall. This is the one trade-off a vector database exists for.
 */
import {
  ClusteredIndex,
  FlatIndex,
  recall,
  VECTOR_SEARCH_CORPUS,
  VECTOR_SEARCH_QUERY,
  VECTOR_SEARCH_SEEDS,
} from '../retrieval/vector-index';

export interface VectorSearchRow {
  readonly text: string;
  readonly cluster: string;
  /** Cosine score to the query (rounded), or null if this row was never scanned. */
  readonly score: number | null;
  /** True if this row is in the exact (flat) top-k. */
  readonly inTrueTopK: boolean;
  /** True if this row is in the result the current step actually returned. */
  readonly returned: boolean;
  /** True if this row is a true top-k neighbor the current step failed to return. */
  readonly missed: boolean;
}

export interface VectorSearchScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  readonly description: string;
  readonly mode: 'setup' | 'flat' | 'approx';
  /** Comparisons this step performed (0 for setup). */
  readonly comparisons: number;
  /** Total corpus size, for the "out of N" framing. */
  readonly corpusSize: number;
  readonly probedClusters: readonly string[];
  /** Fraction of the true top-k recovered by this step, in [0, 1]. */
  readonly recall: number;
  readonly rows: readonly VectorSearchRow[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const K = 3;

/** Which seed cluster a corpus entry was bucketed into (for display grouping). */
function clusterOf(index: ClusteredIndex, text: string): string {
  return index.clusters.find((c) => c.members.some((m) => m.text === text))?.name ?? '';
}

export function buildVectorSearchScenes(): VectorSearchScene[] {
  const flat = new FlatIndex(VECTOR_SEARCH_CORPUS);
  const clustered = ClusteredIndex.fromSeeds(VECTOR_SEARCH_CORPUS, VECTOR_SEARCH_SEEDS);
  const exact = flat.search(VECTOR_SEARCH_QUERY, K);
  const trueTopK = new Set(exact.results.map((r) => r.text));
  const scoreOf = new Map(exact.results.map((r) => [r.text, round2(r.score)]));
  // Full scores for the flat step come from a rank over the whole corpus.
  const allScored = flat.search(VECTOR_SEARCH_QUERY, VECTOR_SEARCH_CORPUS.length).results;
  const fullScore = new Map(allScored.map((r) => [r.text, round2(r.score)]));

  const probe1 = clustered.search(VECTOR_SEARCH_QUERY, K, 1);
  const probe2 = clustered.search(VECTOR_SEARCH_QUERY, K, 2);

  const rowsFor = (opts: {
    returnedTexts: Set<string>;
    scannedTexts: Set<string> | null; // null = every row scanned
  }): VectorSearchRow[] =>
    VECTOR_SEARCH_CORPUS.map((entry) => {
      const scanned = opts.scannedTexts === null || opts.scannedTexts.has(entry.text);
      const returned = opts.returnedTexts.has(entry.text);
      return {
        text: entry.text,
        cluster: clusterOf(clustered, entry.text),
        score: scanned ? (fullScore.get(entry.text) ?? scoreOf.get(entry.text) ?? 0) : null,
        inTrueTopK: trueTopK.has(entry.text),
        returned,
        missed: trueTopK.has(entry.text) && !returned,
      };
    });

  const scenes: VectorSearchScene[] = [
    {
      step: 0,
      totalSteps: 4,
      title: 'A query against a corpus',
      description: `A query vector and ${VECTOR_SEARCH_CORPUS.length} stored vectors, grouped into ${clustered.clusters.length} clusters. The task: return the ${K} nearest by cosine. Press Next to run an exact search.`,
      mode: 'setup',
      comparisons: 0,
      corpusSize: flat.size,
      probedClusters: [],
      recall: 0,
      rows: rowsFor({ returnedTexts: new Set(), scannedTexts: new Set() }),
    },
    {
      step: 1,
      totalSteps: 4,
      title: 'Flat search — exact, scans everything',
      description: `Compare the query to all ${flat.size} vectors, sort, take the top ${K}: ${exact.results
        .map((r) => `${r.text} (${round2(r.score)})`)
        .join(', ')}. ${exact.comparisons} comparisons, recall 1.0 — this is always the true answer. The cost is that it grows with the corpus.`,
      mode: 'flat',
      comparisons: exact.comparisons,
      corpusSize: flat.size,
      probedClusters: [],
      recall: 1,
      rows: rowsFor({ returnedTexts: trueTopK, scannedTexts: null }),
    },
    {
      step: 2,
      totalSteps: 4,
      title: 'Approximate — probe the 1 nearest cluster',
      description: `Compare the query to the ${clustered.clusters.length} centroids, open only the nearest cluster ("${probe1.probedClusters.join(', ')}"), rank its members. Just ${probe1.comparisons} comparisons — but a true neighbor ("${allScored.find((r) => trueTopK.has(r.text) && !new Set(probe1.results.map((x) => x.text)).has(r.text))?.text}") sat in a cluster we never opened. Recall ${round2(recall(probe1.results, exact.results, K))}.`,
      mode: 'approx',
      comparisons: probe1.comparisons,
      corpusSize: flat.size,
      probedClusters: probe1.probedClusters,
      recall: round2(recall(probe1.results, exact.results, K)),
      rows: rowsFor({
        returnedTexts: new Set(probe1.results.map((r) => r.text)),
        scannedTexts: new Set(
          clustered.clusters
            .filter((c) => probe1.probedClusters.includes(c.name))
            .flatMap((c) => c.members.map((m) => m.text)),
        ),
      }),
    },
    {
      step: 3,
      totalSteps: 4,
      title: 'Approximate — probe 2 clusters',
      description: `Open the two nearest clusters ("${probe2.probedClusters.join(', ')}") instead of one. ${probe2.comparisons} comparisons recovers the missing neighbor: recall ${round2(recall(probe2.results, exact.results, K))}. Raising the probe count trades speed back for recall — the dial every vector database exposes.`,
      mode: 'approx',
      comparisons: probe2.comparisons,
      corpusSize: flat.size,
      probedClusters: probe2.probedClusters,
      recall: round2(recall(probe2.results, exact.results, K)),
      rows: rowsFor({
        returnedTexts: new Set(probe2.results.map((r) => r.text)),
        scannedTexts: new Set(
          clustered.clusters
            .filter((c) => probe2.probedClusters.includes(c.name))
            .flatMap((c) => c.members.map((m) => m.text)),
        ),
      }),
    },
  ];

  return scenes;
}
