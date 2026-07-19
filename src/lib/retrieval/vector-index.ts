/**
 * Vector search — flat (exact) vs cluster-probing (approximate) nearest-neighbor search.
 * The L2 build project's second half: it builds directly on the cosine core in
 * `embeddings.ts` and is what RAG retrieves through next.
 *
 * Plain TypeScript, no dependencies, written to be read (ADR-0005). The teaching goal is
 * the one trade-off every vector database is an answer to: exact search compares the query
 * to *every* stored vector (perfect recall, cost grows with the corpus); an approximate
 * index compares against *fewer* vectors by skipping regions it judges irrelevant (cheaper,
 * but it can miss a true neighbor that sat in a skipped region — recall drops below 1).
 *
 * Honesty boundary: the vectors here are hand-placed 2-D points, labelled illustrative,
 * chosen so the trade-off is visible on a page. The *counting* is real — every
 * `comparisons` number below is the literal count of `cosineSimilarity` calls made — and
 * the cluster-probing strategy is a faithful, stripped-down version of the IVF ("inverted
 * file": bucket by nearest centroid, scan only the nearest buckets) family of indexes.
 * Production ANN indexes (HNSW, IVF-PQ) are far more sophisticated, but they buy speed the
 * same way: look at less of the corpus, accept approximate results.
 */
import {
  cosineSimilarity,
  type Embedded,
  nearestNeighbors,
  type Ranked,
  type Vector,
} from './embeddings';

export interface SearchResult {
  /** Top-k neighbors, nearest first. */
  readonly results: Ranked[];
  /** How many full cosine comparisons this search actually computed. */
  readonly comparisons: number;
}

export interface ApproxSearchResult extends SearchResult {
  /** Names of the clusters whose members were scanned. */
  readonly probedClusters: readonly string[];
  /** Members scanned (excludes the per-centroid comparisons). */
  readonly scanned: number;
}

/**
 * A flat index: search compares the query to every vector in the corpus. This is exact —
 * the returned top-k is always the true top-k — and its cost is exactly `corpus.length`
 * comparisons per query. Perfectly fine up to millions of vectors; the reason vector
 * databases exist is that "every query scans everything" eventually stops being fine.
 */
export class FlatIndex {
  constructor(private readonly corpus: readonly Embedded[]) {}

  get size(): number {
    return this.corpus.length;
  }

  search(query: Vector, k: number): SearchResult {
    return { results: nearestNeighbors(query, this.corpus, k), comparisons: this.corpus.length };
  }
}

export interface Cluster {
  readonly name: string;
  readonly centroid: Vector;
  readonly members: readonly Embedded[];
}

/** The mean of a set of vectors — the natural centre of a cluster. Throws on empty/mismatch. */
export function meanVector(vectors: readonly Vector[]): Vector {
  if (vectors.length === 0) throw new Error('meanVector: no vectors');
  const dim = vectors[0]!.length;
  const sum = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) throw new Error(`meanVector: dimension mismatch (${v.length} vs ${dim})`);
    for (let i = 0; i < dim; i++) sum[i]! += v[i]!;
  }
  return sum.map((s) => s / vectors.length);
}

/** Fraction of the exact top-k that an approximate result actually recovered, in [0, 1]. */
export function recall(approx: readonly Ranked[], exact: readonly Ranked[], k: number): number {
  const want = exact.slice(0, k);
  if (want.length === 0) return 1;
  const found = new Set(approx.slice(0, k).map((r) => r.text));
  const hits = want.filter((r) => found.has(r.text)).length;
  return hits / want.length;
}

/**
 * A cluster-probing (IVF-style) approximate index. The corpus is pre-grouped into named
 * clusters; each cluster's centroid is the mean of its members. A search first compares
 * the query to every *centroid* (a handful of comparisons), probes the `nProbe` nearest
 * clusters, and ranks only *their* members.
 *
 * Cost = (number of clusters) + (members in the probed clusters) comparisons — which can
 * be far less than scanning everything. The catch: a true neighbor living in an unprobed
 * cluster is invisible, so recall can fall below 1. Raising `nProbe` trades speed back for
 * recall; at `nProbe = clusters.length` it degenerates to an exact (flat) search.
 */
export class ClusteredIndex {
  readonly clusters: readonly Cluster[];

  constructor(groups: ReadonlyArray<{ name: string; members: readonly Embedded[] }>) {
    if (groups.length === 0) throw new Error('ClusteredIndex: no clusters');
    this.clusters = groups.map((g) => {
      if (g.members.length === 0) throw new Error(`ClusteredIndex: cluster "${g.name}" is empty`);
      return { name: g.name, centroid: meanVector(g.members.map((m) => m.vector)), members: g.members };
    });
  }

  /** Build clusters by assigning each corpus entry to its nearest of the given seed points. */
  static fromSeeds(
    corpus: readonly Embedded[],
    seeds: ReadonlyArray<{ name: string; vector: Vector }>,
  ): ClusteredIndex {
    const groups = seeds.map((s) => ({ name: s.name, members: [] as Embedded[] }));
    for (const entry of corpus) {
      let best = 0;
      let bestScore = -Infinity;
      for (let i = 0; i < seeds.length; i++) {
        const score = cosineSimilarity(entry.vector, seeds[i]!.vector);
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      groups[best]!.members.push(entry);
    }
    return new ClusteredIndex(groups.filter((g) => g.members.length > 0));
  }

  search(query: Vector, k: number, nProbe = 1): ApproxSearchResult {
    const probes = Math.max(1, Math.min(nProbe, this.clusters.length));
    // Step 1: compare the query to every centroid to decide which clusters to open.
    const byCentroid = this.clusters
      .map((cluster) => ({ cluster, score: cosineSimilarity(query, cluster.centroid) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, probes)
      .map((c) => c.cluster);
    // Step 2: rank only the members of the probed clusters.
    const candidates = byCentroid.flatMap((c) => c.members);
    const results = nearestNeighbors(query, candidates, k);
    return {
      results,
      comparisons: this.clusters.length + candidates.length,
      probedClusters: byCentroid.map((c) => c.name),
      scanned: candidates.length,
    };
  }
}

/**
 * A hand-placed 2-D corpus for the vector-search visual, in four labelled clusters. The
 * layout is chosen so that for the query below, the *true* top-3 neighbours straddle a
 * cluster boundary — so probing only the single nearest cluster misses one of them
 * (recall 2/3), while probing two clusters recovers it (recall 1). NOT learned vectors;
 * only the geometry and the counts are real.
 */
export const VECTOR_SEARCH_CORPUS: readonly Embedded[] = [
  // Cluster "east" (near 0°)
  { text: 'sedan', vector: [1.0, 0.09] },
  { text: 'coupe', vector: [1.0, 0.27] },
  { text: 'hatchback', vector: [1.0, -0.09] },
  { text: 'convertible', vector: [1.0, -0.27] },
  // Cluster "north-east" (near 45°) — holds the boundary neighbour
  { text: 'motorbike', vector: [1.0, 0.7] },
  { text: 'scooter', vector: [0.82, 1.0] },
  { text: 'moped', vector: [0.66, 1.0] },
  { text: 'e-bike', vector: [0.5, 1.0] },
  // Cluster "north-west" (near 135°)
  { text: 'canoe', vector: [-0.7, 1.0] },
  { text: 'kayak', vector: [-1.0, 0.9] },
  { text: 'raft', vector: [-1.0, 0.6] },
  { text: 'ferry', vector: [-1.0, 0.4] },
  // Cluster "south" (near -90°)
  { text: 'glider', vector: [0.2, -1.0] },
  { text: 'balloon', vector: [-0.2, -1.0] },
  { text: 'blimp', vector: [0.0, -1.0] },
  { text: 'drone', vector: [0.35, -1.0] },
];

/** Seed directions (one per cluster) used to bucket {@link VECTOR_SEARCH_CORPUS}. */
export const VECTOR_SEARCH_SEEDS: ReadonlyArray<{ name: string; vector: Vector }> = [
  { name: 'east', vector: [1, 0] },
  { name: 'north-east', vector: [1, 1] },
  { name: 'north-west', vector: [-1, 1] },
  { name: 'south', vector: [0, -1] },
];

/** The query used by the visual: sits between "east" and "north-east", closer to "east". */
export const VECTOR_SEARCH_QUERY: Vector = [1.0, 0.42];
