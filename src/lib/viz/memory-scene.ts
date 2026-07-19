/**
 * Scene builder for the agent-memory visual (ADR-0004, plan §8 Tier 2/3). Pure data:
 * `() => MemoryScene[]`, no React/Astro/timers — the renderer draws, this module decides only
 * what is TRUE at each step. Token counts and retrieval scores are computed by the real
 * `src/lib/memory` module (which reuses the prompt token-estimate and the embeddings ranking);
 * the turn vectors are illustrative, the maths over them is real.
 *
 * The story: a conversation grows past a small working-memory budget → older turns are compacted
 * into a lossy summary → a later question re-surfaces a specific early fact via episodic
 * retrieval (relevance beats recency), which working memory had already summarised away.
 */
import {
  DEMO_QUERY_VECTOR,
  DEMO_SESSION,
  type EpisodicHit,
  EpisodicMemory,
  packContext,
  type Turn,
  turnTokens,
} from '../memory/store';

/** Illustrative small working window, chosen so the session must compact. */
export const MEMORY_WINDOW_TOKENS = 60;

/** The later question whose relevant fact lives in an early, summarised-away turn. */
export const MEMORY_QUERY = 'What snack should I pack for the flight?';

export interface MemoryScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  readonly description: string;
  readonly stage: 'converse' | 'compact' | 'retrieve' | 'assemble';
  /** The working-memory turns kept verbatim at this step (newest-suffix of the session). */
  readonly recent: readonly Turn[];
  /** The compaction summary of older turns ('' until compaction). */
  readonly summary: string;
  readonly summarizedCount: number;
  /** Estimated tokens the working set (summary + recent) spends. */
  readonly workingTokens: number;
  readonly windowTokens: number;
  /** Episodic retrieval hits for the query ([] until the retrieve step). */
  readonly retrieved: readonly EpisodicHit[];
  readonly query: string;
}

export function buildMemoryScenes(): MemoryScene[] {
  // Real working-memory packing over the demo session.
  const naiveTokens = DEMO_SESSION.reduce((n, t) => n + turnTokens(t), 0);
  const packed = packContext(DEMO_SESSION, MEMORY_WINDOW_TOKENS);

  // Real episodic retrieval: the query is nearest the allergy turn, not the recent trip turns.
  const episodic = new EpisodicMemory();
  DEMO_SESSION.forEach((t) => episodic.add(t));
  const hits = episodic.retrieve(DEMO_QUERY_VECTOR, 3);
  const top = hits[0]!;

  const scenes: Array<Omit<MemoryScene, 'step' | 'totalSteps'>> = [
    {
      title: 'The conversation grows',
      stage: 'converse',
      description: `The model is stateless between calls, so "the conversation" is just the transcript we keep and resend. Five turns cost ~${naiveTokens} tokens verbatim — already over this small ${MEMORY_WINDOW_TOKENS}-token working window. Something has to give. Press Next.`,
      recent: DEMO_SESSION,
      summary: '',
      summarizedCount: 0,
      workingTokens: naiveTokens,
      windowTokens: MEMORY_WINDOW_TOKENS,
      retrieved: [],
      query: MEMORY_QUERY,
    },
    {
      title: 'Compact the oldest turns',
      stage: 'compact',
      description: `Working memory keeps the newest turns verbatim and compacts the oldest ${packed.summarizedCount} into a summary. That drops the working set from ~${naiveTokens} to ${packed.tokens} tokens — but the summary is lossy: the specific fact in turn 1 ("allergic to peanuts") is gone from working memory. Compaction buys space by spending detail.`,
      recent: packed.recent,
      summary: packed.summary,
      summarizedCount: packed.summarizedCount,
      workingTokens: packed.tokens,
      windowTokens: MEMORY_WINDOW_TOKENS,
      retrieved: [],
      query: MEMORY_QUERY,
    },
    {
      title: 'Retrieve from episodic memory',
      stage: 'retrieve',
      description: `A new question arrives: “${MEMORY_QUERY}”. The needed fact was summarised out of working memory — but every turn was also stored in long-term (episodic) memory. Ranking the store by similarity re-surfaces turn "${top.turn.id}" ("${firstWords(top.turn.text)}") at cosine ${top.score.toFixed(2)} — even though the most RECENT turns were about Lisbon. Relevance beats recency. This is RAG, pointed at the transcript.`,
      recent: packed.recent,
      summary: packed.summary,
      summarizedCount: packed.summarizedCount,
      workingTokens: packed.tokens,
      windowTokens: MEMORY_WINDOW_TOKENS,
      retrieved: hits,
      query: MEMORY_QUERY,
    },
    {
      title: 'Assemble memory into context',
      stage: 'assemble',
      description: `The final prompt combines working memory (summary + recent turns) with the retrieved episodic fact. Now the model can answer the snack question WITHOUT peanuts — a fact from turn 1 that neither the raw window nor the summary still held. Memory is state carried across calls; it is not the model learning — the weights never changed.`,
      recent: packed.recent,
      summary: packed.summary,
      summarizedCount: packed.summarizedCount,
      workingTokens: packed.tokens,
      windowTokens: MEMORY_WINDOW_TOKENS,
      retrieved: hits,
      query: MEMORY_QUERY,
    },
  ];

  const totalSteps = scenes.length;
  return scenes.map((s, step) => ({ ...s, step, totalSteps }));
}

function firstWords(text: string): string {
  const words = text.split(/\s+/).slice(0, 6).join(' ');
  return words.length < text.length ? `${words}…` : words;
}
