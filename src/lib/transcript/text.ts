/**
 * Text utilities for the transcript engine — tokenization, stopword removal, light
 * normalization, and sentence splitting. Deterministic and dependency-free: the same
 * transcript always yields the same tokens, which is what makes Study mode replayable
 * and testable. This is intentionally a classical lexical pipeline, not a learned
 * embedder — the Atlas's embeddings lib is an illustrative teaching toy, so matching a
 * real transcript honestly means term overlap, not fake semantic vectors (ADR-0006).
 */

/** Common English function words that carry no topic signal — dropped before matching. */
const STOPWORDS = new Set<string>([
  'a', 'about', 'above', 'after', 'again', 'all', 'also', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'did', 'do', 'does', 'doing', 'done', 'down', 'each', 'few', 'for', 'from',
  'further', 'get', 'got', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers',
  'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'like', 'me',
  'more', 'most', 'my', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or',
  'other', 'our', 'out', 'over', 'own', 'said', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'thing',
  'things', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'us', 'very',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'why', 'will',
  'with', 'would', 'you', 'your', 'yeah', 'okay', 'ok', 'going', 'really', 'actually',
  'kind', 'sort', 'lot', 'thats', 'youre', 'were', 'gonna', 'want', 'know', 'think', 'see',
]);

/**
 * Light normalization so obvious morphological variants collapse to one term:
 * plural → singular, common verb endings dropped. Deliberately conservative — a crude
 * stemmer that mangles words hurts matching more than it helps.
 */
export function normalizeToken(raw: string): string {
  let t = raw.toLowerCase();
  if (t.length > 4 && t.endsWith('ing')) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith('ies')) t = `${t.slice(0, -3)}y`;
  else if (t.length > 4 && t.endsWith('ed')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('es')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  return t;
}

/** Split on any non-letter/digit run, normalize, drop stopwords and 1-char tokens. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[^a-z0-9]+/i)) {
    if (!raw) continue;
    const norm = normalizeToken(raw);
    if (norm.length < 2) continue;
    if (STOPWORDS.has(norm) || STOPWORDS.has(raw.toLowerCase())) continue;
    out.push(norm);
  }
  return out;
}

/** A term → count bag for one document. */
export function termCounts(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
}

/**
 * Sentence splitter for extractive summarization. Splits on sentence-final punctuation
 * followed by whitespace, and on line breaks (transcripts are often newline-delimited
 * with no punctuation). Trims and drops empties.
 */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const STOPWORDS_FOR_TEST = STOPWORDS;
