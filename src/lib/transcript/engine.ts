/**
 * The deterministic transcript engine (ADR-0006, Study mode). Given a pasted transcript
 * and the Atlas's concept corpus, it answers — with no model and no network — "which
 * concepts does this cover, in what order should I learn them, and how do I test myself?"
 *
 * The method is classical information retrieval: build a TF-IDF term vector for each
 * concept and for the transcript, rank concepts by cosine similarity, and keep the
 * overlapping terms so every match is explainable. This is honest about what it is — term
 * overlap, not semantic understanding — which is exactly why "good summaries" are Lab
 * mode's job (a real model), while grounding, paths and quizzes are deterministic here.
 */
import type {
  ConceptMatch,
  ConceptRef,
  Flashcard,
  InterviewRef,
  LearningStep,
  QuizItem,
  StudyMaterial,
  StudyOptions,
} from './types';
import { splitSentences, termCounts, tokenize } from './text';

/** Essentiality layers in learn-first order (plan §2); index = teaching depth rank. */
const LAYER_ORDER = [
  'foundation',
  'core-mechanism',
  'useful-addition',
  'advanced-system',
  'framework-abstraction',
  'vendor-specific',
] as const;

export function layerRank(layer: string): number {
  const i = LAYER_ORDER.indexOf(layer as (typeof LAYER_ORDER)[number]);
  return i === -1 ? LAYER_ORDER.length : i;
}

/** Field weights: a term in the title/tags is far more indicative than one in the blurb. */
const FIELD_WEIGHTS = { title: 3, tags: 3, oneLiner: 2, id: 1 } as const;

interface ConceptVector {
  concept: ConceptRef;
  /** Raw weighted term frequencies (pre-IDF). */
  weights: Map<string, number>;
}

/** The corpus prepared for matching: per-concept weighted term bags + document frequencies. */
export interface ConceptIndex {
  vectors: readonly ConceptVector[];
  /** term → number of concepts containing it (for IDF). */
  docFreq: Map<string, number>;
  size: number;
}

function addWeighted(weights: Map<string, number>, text: string, weight: number): void {
  for (const term of tokenize(text)) weights.set(term, (weights.get(term) ?? 0) + weight);
}

/** Build the reusable index once per corpus; matching many transcripts reuses it. */
export function buildConceptIndex(corpus: readonly ConceptRef[]): ConceptIndex {
  const vectors: ConceptVector[] = [];
  const docFreq = new Map<string, number>();
  for (const concept of corpus) {
    const weights = new Map<string, number>();
    addWeighted(weights, concept.title, FIELD_WEIGHTS.title);
    addWeighted(weights, concept.oneLiner, FIELD_WEIGHTS.oneLiner);
    addWeighted(weights, concept.id.replace(/-/g, ' '), FIELD_WEIGHTS.id);
    for (const tag of concept.tags) addWeighted(weights, tag, FIELD_WEIGHTS.tags);
    for (const term of weights.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    vectors.push({ concept, weights });
  }
  return { vectors, docFreq, size: corpus.length };
}

/** Smoothed inverse document frequency: rare terms across concepts weigh more. */
function idf(term: string, index: ConceptIndex): number {
  const df = index.docFreq.get(term) ?? 0;
  return Math.log((index.size + 1) / (df + 1)) + 1;
}

function tfidfVector(weights: Map<string, number>, index: ConceptIndex): Map<string, number> {
  const v = new Map<string, number>();
  for (const [term, tf] of weights) v.set(term, tf * idf(term, index));
  return v;
}

function cosine(a: Map<string, number>, b: Map<string, number>): { score: number; shared: string[] } {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const shared: Array<{ term: string; contribution: number }> = [];
  for (const w of a.values()) magA += w * w;
  for (const [term, wb] of b) {
    magB += wb * wb;
    const wa = a.get(term);
    if (wa !== undefined) {
      dot += wa * wb;
      shared.push({ term, contribution: wa * wb });
    }
  }
  if (magA === 0 || magB === 0) return { score: 0, shared: [] };
  shared.sort((x, y) => y.contribution - x.contribution);
  return { score: dot / (Math.sqrt(magA) * Math.sqrt(magB)), shared: shared.map((s) => s.term) };
}

/** Rank concepts the transcript appears to cover. Pure over (transcript, index, opts). */
export function matchConcepts(
  transcript: string,
  index: ConceptIndex,
  opts: StudyOptions = {},
): ConceptMatch[] {
  const minScore = opts.minScore ?? 0.06;
  const maxConcepts = opts.maxConcepts ?? 8;
  const transcriptVec = tfidfVector(termCounts(tokenize(transcript)), index);
  const matches: ConceptMatch[] = [];
  for (const { concept, weights } of index.vectors) {
    const { score, shared } = cosine(transcriptVec, tfidfVector(weights, index));
    if (score >= minScore) {
      matches.push({ concept, score, matchedTerms: shared.slice(0, 6) });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, maxConcepts);
}

/** Top salient terms in the transcript (weighted by how rare they are across concepts). */
export function extractKeyTerms(transcript: string, index: ConceptIndex, limit = 12): string[] {
  const counts = termCounts(tokenize(transcript));
  return [...counts.entries()]
    .map(([term, tf]) => ({ term, weight: tf * idf(term, index) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((e) => e.term);
}

/**
 * Extractive summary: score each sentence by the salience of the terms it contains and
 * return the top-N in original order. Honest and free — it surfaces the transcript's own
 * most information-dense sentences. It does NOT paraphrase; that is Lab mode's job.
 */
export function extractiveSummary(transcript: string, index: ConceptIndex, n = 5): string[] {
  const sentences = splitSentences(transcript);
  if (sentences.length <= n) return sentences;
  const scored = sentences.map((sentence, order) => {
    const tokens = tokenize(sentence);
    const salience = tokens.reduce((sum, t) => sum + idf(t, index), 0);
    // Normalize by sqrt(length) so we don't just pick the longest sentences.
    return { sentence, order, score: tokens.length ? salience / Math.sqrt(tokens.length) : 0 };
  });
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, n);
  return top.sort((a, b) => a.order - b.order).map((s) => s.sentence);
}

/** Order matched concepts into a study path: foundational layers first, then by relevance. */
export function buildLearningPath(matches: readonly ConceptMatch[]): LearningStep[] {
  return matches
    .map((m) => ({ concept: m.concept, score: m.score, layerRank: layerRank(m.concept.layer) }))
    .sort((a, b) => a.layerRank - b.layerRank || b.score - a.score);
}

/** A cloze (fill-the-blank) item from a concept's oneLiner: blank its most salient term. */
function clozeFrom(concept: ConceptRef, index: ConceptIndex): QuizItem | null {
  const words = concept.oneLiner.split(/(\s+)/); // keep separators for faithful reconstruction
  let best: { i: number; term: string; weight: number } | null = null;
  words.forEach((w, i) => {
    const clean = w.replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length < 4) return;
    const norm = tokenize(clean)[0];
    if (!norm) return;
    const weight = idf(norm, index);
    if (!best || weight > best.weight) best = { i, term: clean, weight };
  });
  if (!best) return null;
  const chosen: { i: number; term: string } = best;
  const blanked = words.map((w, i) => (i === chosen.i ? w.replace(chosen.term, '_____') : w)).join('');
  return {
    kind: 'cloze',
    conceptId: concept.id,
    conceptTitle: concept.title,
    prompt: blanked,
    answer: chosen.term,
    clozeTerm: chosen.term,
  };
}

/**
 * Build a quiz from matched concepts. Prefers real interview questions (already written,
 * high quality) for each matched concept; fills the rest with cloze items from oneLiners.
 * Deterministic order: interview questions of the top matches first.
 */
export function buildQuiz(
  matches: readonly ConceptMatch[],
  interview: readonly InterviewRef[],
  index: ConceptIndex,
  max = 8,
): QuizItem[] {
  const byConcept = new Map<string, InterviewRef[]>();
  for (const q of interview) {
    for (const cid of q.concepts) {
      const list = byConcept.get(cid) ?? [];
      list.push(q);
      byConcept.set(cid, list);
    }
  }
  const quiz: QuizItem[] = [];
  // One interview question per matched concept, in match order (breadth before depth).
  for (const m of matches) {
    const qs = byConcept.get(m.concept.id);
    if (qs && qs.length > 0) {
      const q = qs[0];
      quiz.push({
        kind: 'interview',
        conceptId: m.concept.id,
        conceptTitle: m.concept.title,
        prompt: q.question,
        answer: q.answer,
      });
    }
    if (quiz.length >= max) return quiz;
  }
  // Backfill with cloze items so a thin match set still yields a usable quiz.
  for (const m of matches) {
    if (quiz.length >= max) break;
    const cloze = clozeFrom(m.concept, index);
    if (cloze) quiz.push(cloze);
  }
  return quiz.slice(0, max);
}

export function buildFlashcards(matches: readonly ConceptMatch[]): Flashcard[] {
  return matches.map((m) => ({
    conceptId: m.concept.id,
    front: m.concept.title,
    back: m.concept.oneLiner,
  }));
}

/** The whole deterministic bundle — Study mode's output and Lab mode's grounding tool. */
export function buildStudyMaterial(
  transcript: string,
  corpus: readonly ConceptRef[],
  interview: readonly InterviewRef[],
  opts: StudyOptions = {},
): StudyMaterial {
  const index = buildConceptIndex(corpus);
  const matches = matchConcepts(transcript, index, opts);
  return {
    extractiveSummary: extractiveSummary(transcript, index, opts.summarySentences ?? 5),
    keyTerms: extractKeyTerms(transcript, index),
    matches,
    learningPath: buildLearningPath(matches),
    quiz: buildQuiz(matches, interview, index, opts.maxQuiz ?? 8),
    flashcards: buildFlashcards(matches),
    wordCount: tokenize(transcript).length,
  };
}
