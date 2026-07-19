/**
 * Scene builder for the RAG-pipeline visual (ADR-0004, plan §8 Tier 3 / the "RAG Pipeline"
 * playground). Pure data: `() => RagScene[]`, no React/Astro/timers. The renderer decides
 * how each stage is drawn; this module decides only what is TRUE at each step.
 *
 * The visual walks one question through the whole pipeline — question → retrieve → assemble
 * context → grounded answer — with every cosine score and token count computed by the real
 * `src/lib/rag` pipeline (which itself reuses the retrieval and prompt engines). No invented
 * numbers; the embedding vectors are illustrative, the ranking and budgeting are real.
 */
import {
  contextTokens,
  RAG_DEMO_QUESTION,
  type RetrievedPassage,
  runRagPipeline,
} from '../rag/pipeline';

export interface RagScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  /** Teaching text; doubles as the accessible scene description. */
  readonly description: string;
  readonly question: string;
  /** Retrieved passages with scores; empty until the retrieve step. */
  readonly retrieved: readonly RetrievedPassage[];
  /** Estimated tokens the retrieved context spends in the window (0 until assembled). */
  readonly contextTokens: number;
  readonly windowTokens: number;
  /** The grounded answer text; empty until the final step. */
  readonly answer: string;
  /** Citations backing the answer; empty until the final step. */
  readonly citations: readonly string[];
  /** Which pipeline stage this step is in — the renderer highlights it. */
  readonly stage: 'question' | 'retrieve' | 'assemble' | 'generate';
}

/**
 * Five steps over one real pipeline run:
 *   0 the question (nothing retrieved yet)
 *   1 embed + retrieve the top-k passages, scores revealed
 *   2 assemble the retrieved context into the prompt, token budget revealed
 *   3 generate a grounded answer with citations
 *   4 the honest caveat: retrieval quality is the ceiling
 */
export function buildRagScenes(): RagScene[] {
  const run = runRagPipeline();
  const windowTokens = run.budget.windowTokens;
  const ctxTokens = contextTokens(run.retrieved);

  const scenes: Array<Omit<RagScene, 'step' | 'totalSteps'>> = [
    {
      title: 'The question',
      stage: 'question',
      description: `A user asks: “${RAG_DEMO_QUESTION}”. The model’s own weights may be stale or never contained this — so instead of answering from memory, we first go and find relevant text. Press Next to retrieve.`,
      question: run.question,
      retrieved: [],
      contextTokens: 0,
      windowTokens,
      answer: '',
      citations: [],
    },
    {
      title: 'Retrieve',
      stage: 'retrieve',
      description: `The question is embedded and ranked against the knowledge base by cosine similarity — the same nearest-neighbor search from the Embeddings and Vector-search lessons. The top ${run.retrieved.length} passages come back; [${run.retrieved[0]?.id}] at ${run.retrieved[0]?.score.toFixed(2)} is the closest. This ranking is the ceiling on the answer: nothing relevant retrieved, nothing good generated.`,
      question: run.question,
      retrieved: run.retrieved,
      contextTokens: 0,
      windowTokens,
      answer: '',
      citations: [],
    },
    {
      title: 'Assemble the context',
      stage: 'assemble',
      description: `The retrieved passages are packed into the prompt with a citation instruction. They cost ~${ctxTokens} tokens of the ${windowTokens}-token window (${run.budget.percentUsed}% used in total) — retrieved context competes for the same space as everything else, so more passages is not free.`,
      question: run.question,
      retrieved: run.retrieved,
      contextTokens: ctxTokens,
      windowTokens,
      answer: '',
      citations: [],
    },
    {
      title: 'Generate, grounded',
      stage: 'generate',
      description: `The model answers from the supplied context and cites it: ${run.answer.citations.map((c) => `[${c}]`).join(' ')}. Grounding + citations make the answer checkable — but they reduce hallucination, they don’t abolish it: a model can still misread a passage or cite the wrong one.`,
      question: run.question,
      retrieved: run.retrieved,
      contextTokens: ctxTokens,
      windowTokens,
      answer: run.answer.text,
      citations: run.answer.citations,
    },
  ];

  const totalSteps = scenes.length;
  return scenes.map((s, step) => ({ ...s, step, totalSteps }));
}
