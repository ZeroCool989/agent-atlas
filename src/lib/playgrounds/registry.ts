/**
 * Playground registry — the single source of truth for the interactive simulations that
 * live inside concept lessons, surfaced together on /playgrounds (plan §4 supporting
 * surfaces, §8 Tier-3). This does NOT reimplement the playgrounds; each entry points at
 * the concept that hosts it. Pure data + a lookup, so it is testable and the /playgrounds
 * page stays a zero-JS index.
 */

export interface Playground {
  /** Stable id, also the on-concept anchor where useful. */
  readonly id: string;
  readonly title: string;
  /** One line: what you can do / see. */
  readonly summary: string;
  /** The concept slug that hosts this playground (must exist in the concepts collection). */
  readonly concept: string;
  /** The essentiality layer of the host concept, for grouping/colour parity with the atlas. */
  readonly layer:
    | 'foundation'
    | 'core-mechanism'
    | 'useful-addition'
    | 'advanced-system'
    | 'framework-abstraction'
    | 'vendor-specific';
}

export const PLAYGROUNDS: readonly Playground[] = [
  {
    id: 'tokenizer',
    title: 'Tokenizer & BPE trainer',
    summary:
      'Watch byte-pair encoding discover merges on a real corpus, then tokenize any text and see the ids, counts, and honest unknown-character handling.',
    concept: 'tokens',
    layer: 'foundation',
  },
  {
    id: 'generation',
    title: 'Next-token generation',
    summary:
      'A tiny real n-gram model emits a next-token probability distribution and generates autoregressively, one token at a time — training vs inference made concrete.',
    concept: 'what-is-a-language-model',
    layer: 'foundation',
  },
  {
    id: 'sampling',
    title: 'Sampling & temperature',
    summary:
      'Reshape a probability distribution with temperature, top-k, and top-p (nucleus) and see exactly which tokens can still be drawn — every probability computed live.',
    concept: 'sampling',
    layer: 'foundation',
  },
  {
    id: 'citation-check',
    title: 'Citation & hallucination checker',
    summary:
      'Step through a confident, grounded-looking answer as a deterministic checker flags a fabricated citation and an uncited claim — then meets its own honest limit.',
    concept: 'failure-modes',
    layer: 'foundation',
  },
  {
    id: 'prompt-assembly',
    title: 'Prompt assembly & token budget',
    summary:
      'Build a prompt part by part (system → few-shot → task → format) and watch the context budget fill — prompting as context construction, with real token estimates.',
    concept: 'prompt-engineering',
    layer: 'core-mechanism',
  },
  {
    id: 'structured-extraction',
    title: 'Structured-output extraction',
    summary:
      'Drive a prompt-to-typed-JSON pipeline through its failure modes — fenced JSON, wrong key, invalid shape — and see validation catch each and retry recover.',
    concept: 'structured-outputs',
    layer: 'core-mechanism',
  },
  {
    id: 'retrieval-ranking',
    title: 'Embeddings & nearest-neighbor retrieval',
    summary:
      'Rank a small corpus by real cosine similarity to a query vector, revealed one nearest neighbor at a time — the retrieval step, with every score visible.',
    concept: 'embeddings',
    layer: 'core-mechanism',
  },
  {
    id: 'vector-search',
    title: 'Vector search: flat vs approximate',
    summary:
      'Compare an exact flat scan with an approximate index that skips regions — see the comparison count drop and the recall trade-off (a missed neighbor) appear.',
    concept: 'vector-search',
    layer: 'core-mechanism',
  },
  {
    id: 'rag-pipeline',
    title: 'RAG pipeline',
    summary:
      'Send a query through the whole retrieve-then-generate pipeline — embed → retrieve top-k → assemble a budget-aware context → answer with citations — computed end to end.',
    concept: 'rag',
    layer: 'core-mechanism',
  },
  {
    id: 'tool-calling',
    title: 'Tool-calling outcomes',
    summary:
      'Replay the outcome classes of a tool call — success, schema failure, semantic failure, unknown tool, tool error — including measured traces from real model runs.',
    concept: 'tool-calling',
    layer: 'core-mechanism',
  },
  {
    id: 'evaluation',
    title: 'Evaluation harness',
    summary:
      'Run a small test suite against a deliberately-buggy subject and watch a valid-but-wrong output get caught — the payoff of "valid shape ≠ correct value".',
    concept: 'evaluation',
    layer: 'core-mechanism',
  },
  {
    id: 'workflows-vs-agents',
    title: 'Workflows vs agents',
    summary:
      'One problem solved four ways — direct call, deterministic workflow, model-assisted workflow, tool-using agent — with their real execution traces side by side.',
    concept: 'workflows-vs-agents',
    layer: 'core-mechanism',
  },
] as const;

/** All distinct host-concept slugs referenced by the registry (for integrity checks). */
export function playgroundConceptSlugs(): string[] {
  return [...new Set(PLAYGROUNDS.map((p) => p.concept))];
}
