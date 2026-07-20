import { describe, expect, it } from 'vitest';

import {
  buildConceptIndex,
  buildFlashcards,
  buildLearningPath,
  buildQuiz,
  buildStudyMaterial,
  extractiveSummary,
  extractKeyTerms,
  layerRank,
  matchConcepts,
} from './engine';
import { normalizeToken, splitSentences, tokenize } from './text';
import type { ConceptRef, InterviewRef } from './types';

const CORPUS: ConceptRef[] = [
  {
    id: 'rag',
    title: 'Retrieval-augmented generation',
    oneLiner: 'Retrieve relevant documents and put them in the prompt so the model answers from grounded context instead of memory.',
    layer: 'core-mechanism',
    status: 'complete',
    tags: ['rag', 'retrieval', 'grounding', 'context'],
  },
  {
    id: 'embeddings',
    title: 'Embeddings',
    oneLiner: 'Turn text into vectors so that semantic similarity becomes distance you can measure.',
    layer: 'core-mechanism',
    status: 'complete',
    tags: ['embeddings', 'vectors', 'similarity'],
  },
  {
    id: 'tokens',
    title: 'Tokens',
    oneLiner: 'Models read and write tokens, not characters or words; tokenization is the unit of everything.',
    layer: 'foundation',
    status: 'complete',
    tags: ['tokens', 'tokenization', 'bpe'],
  },
  {
    id: 'voice-agents',
    title: 'Voice agents',
    oneLiner: 'A speech-to-text, agent, text-to-speech loop that talks with a person in real time under a latency budget.',
    layer: 'advanced-system',
    status: 'complete',
    tags: ['voice', 'speech', 'latency'],
  },
];

const INTERVIEW: InterviewRef[] = [
  {
    concepts: ['rag'],
    question: 'What problem does retrieval-augmented generation solve?',
    answer: 'It grounds answers in retrieved documents instead of the model’s parametric memory.',
    difficulty: 'screen',
  },
  {
    concepts: ['embeddings'],
    question: 'Why do embeddings enable semantic search?',
    answer: 'Similar meanings map to nearby vectors, so nearness approximates relatedness.',
    difficulty: 'standard',
  },
];

const TRANSCRIPT = `
Today we are going to talk about retrieval augmented generation.
The core idea of RAG is that you retrieve relevant documents and put them into the context.
That way the model can answer from grounded context instead of its memory.
To retrieve, you first turn your documents into embeddings, which are vectors.
Similar meaning becomes nearby vectors, so you can measure similarity as distance.
`;

describe('text utilities', () => {
  it('normalizes common morphology conservatively', () => {
    expect(normalizeToken('embeddings')).toBe('embedding');
    expect(normalizeToken('retrieving')).toBe('retriev');
    expect(normalizeToken('vectors')).toBe('vector');
    expect(normalizeToken('class')).toBe('class'); // -ss preserved
  });

  it('tokenizes, lowercases, and drops stopwords and short tokens', () => {
    const tokens = tokenize('The model reads Tokens, not words!');
    expect(tokens).toContain('model');
    expect(tokens).toContain('read');
    expect(tokens).toContain('token');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('not');
  });

  it('splits sentences on punctuation and newlines', () => {
    expect(splitSentences('One. Two!\nThree')).toEqual(['One.', 'Two!', 'Three']);
  });
});

describe('layerRank', () => {
  it('orders foundation before advanced and unknown last', () => {
    expect(layerRank('foundation')).toBe(0);
    expect(layerRank('core-mechanism')).toBe(1);
    expect(layerRank('advanced-system')).toBeGreaterThan(layerRank('core-mechanism'));
    expect(layerRank('nonsense')).toBe(6);
  });
});

describe('matchConcepts', () => {
  const index = buildConceptIndex(CORPUS);

  it('ranks the on-topic concepts above the off-topic one', () => {
    const matches = matchConcepts(TRANSCRIPT, index);
    const ids = matches.map((m) => m.concept.id);
    expect(ids).toContain('rag');
    expect(ids).toContain('embeddings');
    expect(ids).not.toContain('voice-agents'); // below threshold — not covered
    expect(ids[0]).toBe('rag'); // the dominant topic
  });

  it('is explainable: every match carries the terms that drove it', () => {
    const rag = matchConcepts(TRANSCRIPT, index).find((m) => m.concept.id === 'rag');
    expect(rag).toBeDefined();
    expect(rag!.matchedTerms.length).toBeGreaterThan(0);
    expect(rag!.matchedTerms).toContain('retrieve');
    expect(rag!.score).toBeGreaterThan(0);
    expect(rag!.score).toBeLessThanOrEqual(1);
  });

  it('is deterministic — identical input yields identical output', () => {
    expect(matchConcepts(TRANSCRIPT, index)).toEqual(matchConcepts(TRANSCRIPT, index));
  });

  it('respects maxConcepts and minScore', () => {
    expect(matchConcepts(TRANSCRIPT, index, { maxConcepts: 1 })).toHaveLength(1);
    expect(matchConcepts(TRANSCRIPT, index, { minScore: 0.99 })).toHaveLength(0);
  });

  it('returns nothing for an empty transcript', () => {
    expect(matchConcepts('', index)).toEqual([]);
  });
});

describe('extractiveSummary', () => {
  const index = buildConceptIndex(CORPUS);

  it('returns the requested number of sentences from the transcript', () => {
    const summary = extractiveSummary(TRANSCRIPT, index, 2);
    expect(summary).toHaveLength(2);
    for (const s of summary) expect(TRANSCRIPT).toContain(s);
  });

  it('returns all sentences when fewer than requested', () => {
    expect(extractiveSummary('Only one sentence here.', index, 5)).toHaveLength(1);
  });

  it('preserves original order of the selected sentences', () => {
    const summary = extractiveSummary(TRANSCRIPT, index, 3);
    const positions = summary.map((s) => TRANSCRIPT.indexOf(s));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('extractKeyTerms', () => {
  it('surfaces salient topic terms, not stopwords', () => {
    const terms = extractKeyTerms(TRANSCRIPT, buildConceptIndex(CORPUS));
    expect(terms).toContain('retrieve');
    expect(terms).not.toContain('the');
  });
});

describe('buildLearningPath', () => {
  it('orders foundational layers before advanced ones', () => {
    const index = buildConceptIndex(CORPUS);
    const matches = matchConcepts(
      'tokens tokenization rag retrieval grounding embeddings vectors',
      index,
      { minScore: 0 },
    );
    const path = buildLearningPath(matches);
    const ranks = path.map((s) => s.layerRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(path[0].concept.layer).toBe('foundation'); // tokens first
  });
});

describe('buildQuiz', () => {
  const index = buildConceptIndex(CORPUS);
  const matches = matchConcepts(TRANSCRIPT, index);

  it('prefers real interview questions for matched concepts', () => {
    const quiz = buildQuiz(matches, INTERVIEW, index);
    const interviewItems = quiz.filter((q) => q.kind === 'interview');
    expect(interviewItems.length).toBeGreaterThan(0);
    expect(interviewItems.map((q) => q.conceptId)).toContain('rag');
    expect(interviewItems[0].answer).toBeTruthy();
  });

  it('backfills with cloze items whose answer is blanked in the prompt', () => {
    const quiz = buildQuiz(matches, [], index, 4); // no interview data → all cloze
    expect(quiz.length).toBeGreaterThan(0);
    for (const item of quiz) {
      expect(item.kind).toBe('cloze');
      expect(item.prompt).toContain('_____');
      expect(item.prompt).not.toContain(item.answer);
    }
  });

  it('never exceeds the max', () => {
    expect(buildQuiz(matches, INTERVIEW, index, 2).length).toBeLessThanOrEqual(2);
  });
});

describe('buildFlashcards', () => {
  it('makes a card per match with the concept oneLiner on the back', () => {
    const index = buildConceptIndex(CORPUS);
    const cards = buildFlashcards(matchConcepts(TRANSCRIPT, index));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].back).toBe(CORPUS.find((c) => c.id === cards[0].conceptId)!.oneLiner);
  });
});

describe('buildStudyMaterial', () => {
  it('assembles a complete, self-consistent bundle', () => {
    const material = buildStudyMaterial(TRANSCRIPT, CORPUS, INTERVIEW);
    expect(material.matches.length).toBeGreaterThan(0);
    expect(material.learningPath.length).toBe(material.matches.length);
    expect(material.quiz.length).toBeGreaterThan(0);
    expect(material.flashcards.length).toBe(material.matches.length);
    expect(material.extractiveSummary.length).toBeGreaterThan(0);
    expect(material.wordCount).toBeGreaterThan(0);
  });

  it('is fully deterministic', () => {
    expect(buildStudyMaterial(TRANSCRIPT, CORPUS, INTERVIEW)).toEqual(
      buildStudyMaterial(TRANSCRIPT, CORPUS, INTERVIEW),
    );
  });

  it('degrades gracefully on an unrelated transcript', () => {
    const material = buildStudyMaterial('The weather in Lisbon is sunny and warm today.', CORPUS, INTERVIEW);
    expect(material.matches).toEqual([]);
    expect(material.quiz).toEqual([]);
    expect(material.flashcards).toEqual([]);
  });
});
