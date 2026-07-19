/**
 * Agent memory, in a few readable functions (ADR-0005: plain TS, no framework).
 *
 * A base model is stateless across calls — frozen weights, a finite context window. "Memory"
 * is not a model feature; it is engineering that carries information across turns and sessions.
 * This module implements the two mechanisms the lesson teaches, REUSING the engines the earlier
 * concepts built rather than reinventing them:
 *
 *  - Working memory: recent turns kept inside a token budget (reuses `estimateTokens` from the
 *    prompt-assembly concept). When the budget would overflow, the oldest turns are compacted
 *    into a lossy summary instead of silently dropped — the honest trade-off the lesson makes
 *    visible (a summary spends fewer tokens AND loses detail).
 *  - Episodic memory: relevant past turns retrieved by similarity (reuses `cosineSimilarity` /
 *    `nearestNeighbors` from the embeddings concept). "Episodic memory" is, honestly, RAG over
 *    your own transcript — the same retrieve-then-inject pattern, pointed at the conversation.
 *
 * Vectors here are illustrative (hand-placed, labelled as such in the lesson); the token maths
 * and the ranking are real.
 */
import { estimateTokens } from '../prompt/assemble';
import {
  cosineSimilarity,
  type Embedded,
  nearestNeighbors,
  type Ranked,
  type Vector,
} from '../retrieval/embeddings';

export type Role = 'user' | 'assistant';

export interface Turn {
  readonly id: string;
  readonly role: Role;
  readonly text: string;
}

/** How many tokens a turn costs in the window (role label + text). */
export function turnTokens(turn: Turn): number {
  return estimateTokens(`${turn.role}: ${turn.text}`);
}

/**
 * A deterministic, lossy compaction of turns into one summary line. There is no model call
 * here — a real system would summarise with an LLM; the point the lesson makes is structural,
 * not the phrasing: the summary is SHORTER than the turns it replaces (saves tokens) and DROPS
 * detail (a real cost). We keep the first sentence of each turn and label the omission.
 */
const SUMMARY_GIST_CHARS = 60;

export function summarize(turns: readonly Turn[]): string {
  if (turns.length === 0) return '';
  // Bounded and lossy by construction: the summary length does NOT grow with the number of
  // turns it compacts — it keeps a capped gist of the oldest turn and a count. That is exactly
  // the trade-off the lesson makes visible: compaction saves tokens (bounded size) at the cost
  // of detail (everything but the gist is gone).
  const oldest = turns[0]!;
  const firstSentence = oldest.text.split(/(?<=[.?!])\s/)[0]!.trim();
  const gist =
    firstSentence.length > SUMMARY_GIST_CHARS
      ? `${firstSentence.slice(0, SUMMARY_GIST_CHARS - 1)}…`
      : firstSentence;
  return `[summary of ${turns.length} earlier turn(s), detail lost] ${oldest.role}: ${gist}`;
}

export interface PackedContext {
  /** Compacted older turns (empty string if nothing was summarised). */
  readonly summary: string;
  /** Recent turns kept verbatim, oldest→newest, that fit the budget alongside the summary. */
  readonly recent: readonly Turn[];
  /** How many turns were compacted into `summary`. */
  readonly summarizedCount: number;
  /** Total estimated tokens of summary + recent turns (≤ budget when possible). */
  readonly tokens: number;
  /** True when the summary itself + newest turn still exceed the budget (unavoidable overflow). */
  readonly overBudget: boolean;
}

/**
 * Pack a conversation into a token budget: keep the most recent turns verbatim, and compact
 * everything older into a single summary line. Newest turns are the last to be dropped, so the
 * model always sees the immediate context; distant turns degrade to a lossy summary. This is
 * the working-memory strategy — bounded window, graceful compaction, not a hard cut-off.
 */
export function packContext(turns: readonly Turn[], budgetTokens: number): PackedContext {
  // Greedily keep newest turns whole while they fit.
  const recent: Turn[] = [];
  let recentTokens = 0;
  let i = turns.length - 1;
  for (; i >= 0; i--) {
    const cost = turnTokens(turns[i]!);
    if (recentTokens + cost > budgetTokens) break;
    recent.unshift(turns[i]!);
    recentTokens += cost;
  }

  const older = turns.slice(0, i + 1);
  const summary = summarize(older);
  const summaryTokens = summary ? estimateTokens(summary) : 0;

  // If the summary pushes us over, drop the oldest kept turns until it fits (summary wins —
  // losing the gist of the whole past is worse than losing one more recent turn).
  while (summary && recent.length > 1 && summaryTokens + recentTokens > budgetTokens) {
    recentTokens -= turnTokens(recent.shift()!);
  }

  const tokens = summaryTokens + recentTokens;
  return {
    summary,
    recent,
    summarizedCount: older.length,
    tokens,
    overBudget: tokens > budgetTokens,
  };
}

export interface EpisodicTurn extends Turn {
  /** Illustrative embedding of the turn (hand-placed for the demo; the maths over it is real). */
  readonly vector: Vector;
}

export interface EpisodicHit extends Ranked {
  readonly turn: EpisodicTurn;
}

/**
 * Long-term / episodic memory: retrieve the past turns most relevant to a query vector. This is
 * literally RAG (nearest-neighbour retrieval) applied to the conversation transcript — the same
 * engine the embeddings and RAG concepts use, no new machinery.
 */
export class EpisodicMemory {
  private readonly turns: EpisodicTurn[] = [];

  add(turn: EpisodicTurn): void {
    this.turns.push(turn);
  }

  get size(): number {
    return this.turns.length;
  }

  /** Most relevant stored turns to `query`, nearest first. */
  retrieve(query: Vector, k = 3): EpisodicHit[] {
    if (this.turns.length === 0) return [];
    const corpus: Embedded[] = this.turns.map((t) => ({ text: t.id, vector: t.vector }));
    const byId = new Map(this.turns.map((t) => [t.id, t]));
    return nearestNeighbors(query, corpus, k).map((r) => ({ ...r, turn: byId.get(r.text)! }));
  }

  /** Direct similarity of a stored turn to a query (exposed for teaching/tests). */
  static similarity(a: Vector, b: Vector): number {
    return cosineSimilarity(a, b);
  }
}

/**
 * A small illustrative session used by the visualization: a multi-turn conversation whose
 * vectors are hand-placed so a later question clearly re-surfaces one specific early turn.
 * Real token maths, real cosine ranking; illustrative geometry.
 */
export const DEMO_SESSION: readonly EpisodicTurn[] = [
  {
    id: 't1',
    role: 'user',
    text: 'My name is Dana and I am allergic to peanuts.',
    vector: [0.9, 0.1],
  },
  {
    id: 't2',
    role: 'assistant',
    text: 'Noted, Dana. I will keep your peanut allergy in mind for any food suggestions.',
    vector: [0.85, 0.15],
  },
  {
    id: 't3',
    role: 'user',
    text: 'I am planning a trip to Lisbon in spring and want museum recommendations.',
    vector: [0.1, 0.9],
  },
  {
    id: 't4',
    role: 'assistant',
    text: 'For Lisbon, the Gulbenkian and the MAAT are strong picks in spring.',
    vector: [0.15, 0.85],
  },
  {
    id: 't5',
    role: 'user',
    text: 'What snack should I pack for the flight?',
    vector: [0.6, 0.35],
  },
];

/** The query turn the demo answers — semantically closest to the allergy turn, not the trip. */
export const DEMO_QUERY_VECTOR: Vector = [0.88, 0.12];
