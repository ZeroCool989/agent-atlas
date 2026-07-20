/**
 * Transcript Studio deterministic engine (ADR-0006). Barrel export. Consumed by the
 * `/studio` island (Study mode) and by the agent's grounding tool (Lab mode).
 */
export type {
  ConceptRef,
  ConceptMatch,
  Flashcard,
  InterviewRef,
  LearningStep,
  QuizItem,
  QuizKind,
  StudyMaterial,
  StudyOptions,
} from './types';
export {
  buildConceptIndex,
  buildFlashcards,
  buildLearningPath,
  buildQuiz,
  buildStudyMaterial,
  extractKeyTerms,
  extractiveSummary,
  layerRank,
  matchConcepts,
} from './engine';
export type { ConceptIndex } from './engine';
export { normalizeToken, splitSentences, tokenize } from './text';
export { DEMO_TRANSCRIPT, buildDemoScenario } from './demo';
