/**
 * Tools for the Transcript Studio agent (ADR-0006, Lab mode). These are ordinary
 * `AgentTool`s — deterministic functions over their arguments, no network — that the
 * runtime (`runAgent`) validates and executes on the model's request.
 *
 * The load-bearing idea: `match_concepts` runs the SAME deterministic engine that powers
 * keyless Study mode. So when the Lab-mode LLM agent asks "which Atlas concepts does this
 * transcript cover?", the answer is grounded in the real corpus, not free-associated. The
 * model summarizes and explains (what a model is good at); the tool supplies the facts
 * (what a model should not invent). That division is the whole reliability lesson.
 */
import { z } from 'zod';

import type { AgentTool } from './types';
import { ToolRegistry } from './tools';
import type { ConceptRef, InterviewRef } from '../transcript';
import { buildConceptIndex, buildQuiz, matchConcepts } from '../transcript';

const matchArgs = z.object({ text: z.string().min(1) }).strict();
const quizArgs = z
  .object({ conceptIds: z.array(z.string().min(1)).min(1), count: z.number().int().positive().max(12).optional() })
  .strict();

/**
 * Build the transcript tool registry, closing over the Atlas corpus and interview bank
 * injected by the page. The index is built once and reused across tool calls.
 */
export function createTranscriptTools(
  corpus: readonly ConceptRef[],
  interview: readonly InterviewRef[],
): ToolRegistry {
  const index = buildConceptIndex(corpus);
  const byId = new Map(corpus.map((c) => [c.id, c] as const));

  const matchConceptsTool: AgentTool<{ text: string }> = {
    definition: {
      name: 'match_concepts',
      description:
        'Find which Agent Atlas concepts a passage covers, grounded in the real concept corpus. ' +
        'Returns ranked concepts with the terms that matched. Use this instead of guessing what a transcript is about.',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string', description: 'The transcript or passage to analyze.' } },
        required: ['text'],
        additionalProperties: false,
      },
    },
    parseArgs(args) {
      const r = matchArgs.safeParse(args);
      return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.issues.map((i) => i.message).join('; ') };
    },
    execute({ text }) {
      const matches = matchConcepts(text, index);
      return {
        ok: true,
        value: matches.map((m) => ({
          id: m.concept.id,
          title: m.concept.title,
          layer: m.concept.layer,
          oneLiner: m.concept.oneLiner,
          score: Number(m.score.toFixed(3)),
          matchedTerms: [...m.matchedTerms],
        })),
      };
    },
  };

  const makeQuizTool: AgentTool<{ conceptIds: string[]; count?: number }> = {
    definition: {
      name: 'make_quiz',
      description:
        'Generate quiz questions for the given Atlas concept ids, drawn from the real interview bank (falling back to fill-in-the-blank). ' +
        'Call after match_concepts. Returns questions with reference answers.',
      inputSchema: {
        type: 'object',
        properties: {
          conceptIds: { type: 'array', items: { type: 'string' }, description: 'Concept ids from match_concepts.' },
          count: { type: 'number', description: 'Max questions (default 5).' },
        },
        required: ['conceptIds'],
        additionalProperties: false,
      },
    },
    parseArgs(args) {
      const r = quizArgs.safeParse(args);
      return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.issues.map((i) => i.message).join('; ') };
    },
    execute({ conceptIds, count }) {
      const known = conceptIds.filter((id) => byId.has(id));
      if (known.length === 0) {
        return { ok: false, error: `no known concept ids among: ${conceptIds.join(', ')}` };
      }
      // Reuse the deterministic quiz builder over the requested concepts (as pseudo-matches).
      const pseudoMatches = known.map((id) => ({ concept: byId.get(id)!, score: 1, matchedTerms: [] as string[] }));
      const quiz = buildQuiz(pseudoMatches, interview, index, count ?? 5);
      return {
        ok: true,
        value: quiz.map((q) => ({
          kind: q.kind,
          concept: q.conceptTitle,
          prompt: q.prompt,
          answer: q.answer,
        })),
      };
    },
  };

  return new ToolRegistry([matchConceptsTool, makeQuizTool]);
}

/** The system prompt that turns the generic loop into a transcript-study agent. */
export const TRANSCRIPT_AGENT_SYSTEM = [
  'You are a study assistant inside Agent Atlas, a site that teaches how AI systems work.',
  'You are given a transcript (e.g. from a lecture video). Your job:',
  '1. Call match_concepts on the transcript to ground yourself in which Atlas concepts it actually covers.',
  '2. Write a clear, faithful summary of the transcript in a few sentences — only claims the transcript supports.',
  '3. Call make_quiz with the matched concept ids to get practice questions.',
  '4. Produce a final study guide: the summary, the key points, the concepts covered (with their ids so the UI can link them), and the quiz.',
  'Never invent concepts that match_concepts did not return. If the transcript is off-topic for the Atlas, say so plainly.',
].join('\n');
