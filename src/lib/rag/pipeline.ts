/**
 * The RAG build project (ADR-0005, plan §3 L2 artifact): a retrieve-then-generate
 * pipeline assembled from parts that already exist elsewhere in this repo. RAG is not a
 * new algorithm — it is a *composition*: embed and rank (the `retrieval` engine), then
 * build a prompt from what you retrieved (the `prompt` assembler), then hand that to a
 * model (the `model` layer). This module makes the composition explicit and testable, and
 * powers the RAG-pipeline visualization.
 *
 * Plain TypeScript — no Astro, React, UI, or SDK imports, and no real model call. It stops
 * at a provider-neutral `ModelRequest` (the shape the ScriptedProvider consumes) and a
 * deterministic, clearly-labelled stand-in answer, so the whole pipeline stays a pure
 * function of its inputs. Read it as course material: every stage is a named function.
 *
 * The vectors below are hand-placed in a tiny 2-D space so the geometry is visible on a
 * page — exactly as in the Embeddings and Vector-search lessons. The *math* (cosine
 * ranking, budget accounting) is the real thing a production pipeline runs; only the
 * embedding *values* are illustrative.
 */
import type { ModelRequest } from '../model/types';
import { assemblePrompt, budgetFor, estimateTokens, type PromptBudget } from '../prompt/assemble';
import { cosineSimilarity, type Embedded, type Vector } from '../retrieval/embeddings';

/** A retrievable passage: text plus its (illustrative) embedding and a citation id. */
export interface RagPassage extends Embedded {
  /** Stable id used for citations, e.g. `[KB1]`. */
  readonly id: string;
}

/** A retrieved passage with its cosine score to the query. */
export interface RetrievedPassage {
  readonly id: string;
  readonly text: string;
  /** Cosine similarity to the query vector, in [-1, 1]. */
  readonly score: number;
}

/**
 * A tiny illustrative knowledge base (a product's help centre). The 2-D vectors are
 * hand-placed so "billing" passages sit near each other and far from "password" or
 * "shipping" — the geometry is visible; the ranking math is real.
 */
export const RAG_CORPUS: readonly RagPassage[] = [
  {
    id: 'KB1',
    text: 'To cancel your subscription, open Settings then Billing and choose Cancel plan. Your access continues until the end of the current billing period.',
    vector: [0.94, 0.24],
  },
  {
    id: 'KB2',
    text: 'Refunds are issued for annual plans cancelled within 14 days of purchase. Monthly plans are not refunded, but you keep access until the period ends.',
    vector: [0.82, 0.36],
  },
  {
    id: 'KB3',
    text: 'You can upgrade or downgrade your plan at any time from the Billing page. Changes are prorated against the current period.',
    vector: [0.7, 0.5],
  },
  {
    id: 'KB4',
    text: 'To reset your password, click Forgot password on the login screen and follow the link in the email we send you.',
    vector: [-0.35, 0.9],
  },
  {
    id: 'KB5',
    text: 'Standard shipping takes three to five business days. Expedited options and their prices are shown at checkout.',
    vector: [0.15, -0.92],
  },
] as const;

/** The demo question and its (illustrative) query embedding — lands in the billing region. */
export const RAG_DEMO_QUESTION = 'How do I cancel my subscription?';
export const RAG_DEMO_QUERY_VECTOR: Vector = [0.95, 0.2];

/**
 * Below this cosine, the top passage is treated as "not really about the question", so the
 * pipeline refuses rather than grounding an answer on an irrelevant passage. Retrieval
 * quality is the ceiling on answer quality; an honest system says "I don't know" when the
 * corpus doesn't contain the answer instead of inventing one.
 */
export const RELEVANCE_FLOOR = 0.5;

/**
 * A deliberately simple chunker for the "chunk" stage of the pipeline: greedily pack whole
 * sentences into chunks no longer than `maxChars`. Chunking is where much RAG quality is
 * quietly won or lost — too small and a chunk loses its context, too large and retrieval
 * gets imprecise. Real systems add overlap and structure-awareness; this is the honest
 * minimum that makes the trade-off concrete.
 */
export function chunkText(document: string, maxChars = 240): string[] {
  const sentences = document
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + 1 + sentence.length > maxChars) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Retrieve the top-`k` passages for a query vector by cosine similarity — the same
 * nearest-neighbor operation the Embeddings and Vector-search lessons build, reused here.
 * Deterministic: ties break by corpus order.
 */
export function retrieve(
  queryVector: Vector,
  corpus: readonly RagPassage[] = RAG_CORPUS,
  k = 3,
): RetrievedPassage[] {
  return corpus
    .map((p) => ({ id: p.id, text: p.text, score: cosineSimilarity(queryVector, p.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, k));
}

/** Format retrieved passages into a labelled context block the model can cite from. */
export function buildContext(retrieved: readonly RetrievedPassage[]): string {
  return retrieved.map((p) => `[${p.id}] ${p.text}`).join('\n');
}

/**
 * Assemble the grounded prompt: a system instruction that pins the model to the context
 * and demands citations, and a task that carries the question plus the retrieved context.
 * Reuses the prompt assembler and its token budget — the context you retrieve competes for
 * the same context window as everything else (see the Context-windows lesson).
 */
export function assembleRagPrompt(
  question: string,
  retrieved: readonly RetrievedPassage[],
  windowTokens = 512,
): { request: ModelRequest; budget: PromptBudget; context: string } {
  const context = buildContext(retrieved);
  const parts = {
    system:
      'Answer the question using only the numbered context passages. Cite the passages you use by their id, like [KB1]. If the context does not contain the answer, say you do not know — do not use outside knowledge.',
    task: `Question: ${question}\n\nContext:\n${context}`,
    formatSpec: 'Answer in one or two sentences, with a citation for every claim.',
  };
  return { request: assemblePrompt(parts), budget: budgetFor(parts, windowTokens), context };
}

/**
 * A deterministic, clearly-labelled stand-in for the generation step (no model is called
 * in the deployed site — ADR-0005). If the best passage clears the relevance floor it
 * echoes that passage with its citation; otherwise it refuses. This exists so the pipeline
 * has an honest final stage to show; a real model would phrase the grounded answer, but it
 * would be answering from exactly this retrieved context.
 */
export function groundedAnswer(
  retrieved: readonly RetrievedPassage[],
  floor = RELEVANCE_FLOOR,
): { text: string; grounded: boolean; citations: string[] } {
  const top = retrieved[0];
  if (!top || top.score < floor) {
    return {
      text: 'The provided context does not contain the answer, so I can’t answer from it.',
      grounded: false,
      citations: [],
    };
  }
  return {
    text: `${top.text} [${top.id}]`,
    grounded: true,
    citations: [top.id],
  };
}

/** The whole pipeline as one pure function: retrieve, assemble, "generate". */
export function runRagPipeline(options?: {
  question?: string;
  queryVector?: Vector;
  corpus?: readonly RagPassage[];
  k?: number;
  windowTokens?: number;
}): {
  question: string;
  retrieved: RetrievedPassage[];
  context: string;
  request: ModelRequest;
  budget: PromptBudget;
  answer: { text: string; grounded: boolean; citations: string[] };
} {
  const question = options?.question ?? RAG_DEMO_QUESTION;
  const queryVector = options?.queryVector ?? RAG_DEMO_QUERY_VECTOR;
  const corpus = options?.corpus ?? RAG_CORPUS;
  const k = options?.k ?? 3;
  const windowTokens = options?.windowTokens ?? 512;

  const retrieved = retrieve(queryVector, corpus, k);
  const { request, budget, context } = assembleRagPrompt(question, retrieved, windowTokens);
  const answer = groundedAnswer(retrieved);
  return { question, retrieved, context, request, budget, answer };
}

/** Rough token size of the retrieved context, for the budget visual. */
export function contextTokens(retrieved: readonly RetrievedPassage[]): number {
  return estimateTokens(buildContext(retrieved));
}
