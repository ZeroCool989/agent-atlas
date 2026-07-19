/**
 * Fabricated-citation detector — the L1 reliability build project behind the
 * "Hallucination & failure modes" concept. A deterministic, model-free control that
 * catches ONE class of failure: an answer that cites a source id which was never
 * retrieved (a fabricated citation), and claims made with no citation at all.
 *
 * The honest teaching point lives in what this CANNOT do: it verifies that a citation
 * *resolves* to a provided source, not that the cited source actually *supports* the
 * claim. Resolution is necessary, not sufficient — see `citation-check-scene.ts`, which
 * shows a sentence that passes this checker yet is still wrong. No language model is
 * involved; this is plain string work you can read end to end.
 */

/** A citation token in the text, written as `[source-id]` (ids are kebab-case/alnum). */
const CITATION_RE = /\[([a-z0-9][a-z0-9-]*)\]/gi;

/** Split prose into sentences on ., !, ? boundaries. Citations stay with their sentence. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Every citation id referenced in a piece of text, in order, with duplicates kept. */
export function extractCitations(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(CITATION_RE)) ids.push(match[1]!.toLowerCase());
  return ids;
}

export type SentenceStatus = 'supported' | 'fabricated-citation' | 'uncited-claim';

export interface SentenceCheck {
  sentence: string;
  /** Citation ids found in this sentence (lowercased). */
  citations: string[];
  /** Cited ids that are NOT in the provided source set — fabricated. */
  fabricated: string[];
  status: SentenceStatus;
}

export interface CitationReport {
  sentences: SentenceCheck[];
  /** Distinct fabricated citation ids across the whole answer. */
  fabricatedCitations: string[];
  /** Sentences that assert something with no citation at all. */
  uncitedClaims: number;
  /** True only when every sentence is supported by a resolvable citation. */
  ok: boolean;
}

/**
 * Check an answer's citations against the set of source ids that were actually provided
 * to the model (e.g. the retrieved documents in a RAG pipeline). Pure and deterministic.
 *
 * A sentence is:
 *  - `fabricated-citation` if it cites any id not in `providedSourceIds`;
 *  - `uncited-claim` if it cites nothing (in a grounded answer, every claim should cite);
 *  - `supported` if it cites at least one id and all cited ids resolve.
 */
export function checkCitations(answer: string, providedSourceIds: readonly string[]): CitationReport {
  const provided = new Set(providedSourceIds.map((id) => id.toLowerCase()));
  const sentences: SentenceCheck[] = splitSentences(answer).map((sentence) => {
    const citations = extractCitations(sentence);
    const fabricated = citations.filter((id) => !provided.has(id));
    let status: SentenceStatus;
    if (citations.length === 0) status = 'uncited-claim';
    else if (fabricated.length > 0) status = 'fabricated-citation';
    else status = 'supported';
    return { sentence, citations, fabricated, status };
  });

  const fabricatedCitations = [
    ...new Set(sentences.flatMap((s) => s.fabricated)),
  ].sort();
  const uncitedClaims = sentences.filter((s) => s.status === 'uncited-claim').length;
  const ok = sentences.every((s) => s.status === 'supported');

  return { sentences, fabricatedCitations, uncitedClaims, ok };
}
