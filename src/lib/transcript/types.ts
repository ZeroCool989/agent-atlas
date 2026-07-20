/**
 * Types for the Transcript Studio's deterministic engine (ADR-0006). Plain data — no
 * Astro, React, DOM, or network. Everything here is computed in the browser from a
 * pasted transcript plus a concept corpus injected by the page (`getCollection`), so the
 * whole Study-mode experience runs at $0 with no key and no server.
 */

/** A concept as the engine needs it — the fields the Astro page serializes from frontmatter. */
export interface ConceptRef {
  id: string;
  title: string;
  oneLiner: string;
  layer: string;
  status: string;
  /** interviewTags from frontmatter — high-signal vocabulary for matching. */
  tags: readonly string[];
}

/** One interview question attached to a concept — reused verbatim as quiz material. */
export interface InterviewRef {
  /** Concept ids this question belongs to. */
  concepts: readonly string[];
  question: string;
  /** The shortest model answer (frontmatter `answers.beginner`) — the quiz's reveal. */
  answer: string;
  difficulty: string;
}

/** A concept the transcript appears to cover, with why (explainable, not a black box). */
export interface ConceptMatch {
  concept: ConceptRef;
  /** 0..1 cosine similarity between transcript and concept term vectors. */
  score: number;
  /** The overlapping terms that drove the score, most-salient first. */
  matchedTerms: readonly string[];
}

/** An ordered step in the study path built from the matches. */
export interface LearningStep {
  concept: ConceptRef;
  score: number;
  /** 0-based rank of the concept's essentiality layer (foundation = 0). */
  layerRank: number;
}

export type QuizKind = 'interview' | 'cloze';

/** One quiz question. `interview` = a real interview Q; `cloze` = fill-the-blank from a oneLiner. */
export interface QuizItem {
  kind: QuizKind;
  conceptId: string;
  conceptTitle: string;
  prompt: string;
  /** The answer to reveal/check. For cloze, the single removed term. */
  answer: string;
  /** Cloze only: the answer's position is blanked in `prompt`; this is the accepted term. */
  clozeTerm?: string;
}

export interface Flashcard {
  conceptId: string;
  front: string;
  back: string;
}

/**
 * The full deterministic study bundle. Produced by `buildStudyMaterial` and used both by
 * Study mode directly AND as the grounded output of the agent's `match_concepts` tool in
 * Lab mode — so even the LLM agent is anchored to the Atlas's real corpus.
 */
export interface StudyMaterial {
  /** Extractive summary: the transcript's own highest-salience sentences, in order. */
  extractiveSummary: readonly string[];
  keyTerms: readonly string[];
  matches: readonly ConceptMatch[];
  learningPath: readonly LearningStep[];
  quiz: readonly QuizItem[];
  flashcards: readonly Flashcard[];
  wordCount: number;
}

export interface StudyOptions {
  /** Minimum similarity for a concept to count as covered. Default 0.06. */
  minScore?: number;
  /** Max concepts to surface. Default 8. */
  maxConcepts?: number;
  /** Sentences in the extractive summary. Default 5. */
  summarySentences?: number;
  /** Max quiz questions. Default 8. */
  maxQuiz?: number;
}
