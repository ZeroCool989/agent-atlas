/**
 * Demo mode for the Transcript Studio (ADR-0006): a keyless, network-free agent run the
 * learner can watch. It drives the REAL `runAgent` loop with a `ScriptedProvider`, so the
 * think → tool → observe → answer trace is genuine — only the model's decisions are
 * scripted, and the tools execute for real.
 *
 * The scenario is BUILT from the deterministic engine at runtime rather than hand-authored
 * as static JSON, so the scripted "the agent chose these concepts" step can never drift
 * from what the live corpus actually matches. Same engine, same transcript → consistent
 * scenario, every time.
 */
import { parseScenario } from '../model';
import type { Scenario } from '../model';
import { buildStudyMaterial } from './engine';
import type { ConceptRef, InterviewRef } from './types';

/** A compact, realistic lecture excerpt that touches several Atlas concepts. */
export const DEMO_TRANSCRIPT = `
So the problem with a plain language model is that it only knows what was in its training
data, and it will confidently make things up when you ask about anything else. The fix most
teams reach for is retrieval augmented generation. The idea is simple: before you answer,
you retrieve relevant documents and put them into the prompt as context, so the model is
answering from grounded material instead of memory. To find the right documents you turn
your text into embeddings, which are just vectors, and you look for the nearest ones.
Once you have that, you can go further and let the model call tools — search this database,
run this function — and now it is not just answering, it is taking actions. That is the step
from a chatbot to an agent, and it is also where reliability and evaluation start to matter,
because an agent that takes actions can be wrong in ways that cost you.
`.trim();

/** Declared (not measured) usage so the trace shows realistic cost/latency for teaching. */
const USAGE = (inputTokens: number, outputTokens: number) => ({
  latencyMs: 900,
  inputTokens,
  outputTokens,
  totalTokens: inputTokens + outputTokens,
  cost: { amount: Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6)), currency: 'USD', basis: 'estimated' as const },
});

/**
 * Build a self-consistent 3-step scenario: the agent grounds itself (match_concepts),
 * builds practice (make_quiz over the concepts the engine actually matched), then answers.
 */
export function buildDemoScenario(corpus: readonly ConceptRef[], interview: readonly InterviewRef[]): Scenario {
  const material = buildStudyMaterial(DEMO_TRANSCRIPT, corpus, interview, { maxConcepts: 5 });
  const conceptIds = material.matches.map((m) => m.concept.id);
  const titles = material.matches.map((m) => m.concept.title);

  const summary =
    `Here is your study guide. This talk moves from a core limitation of language models — ` +
    `they answer from memory and hallucinate — to the standard fix and then to agents:\n\n` +
    `• The problem: a plain model only knows its training data and makes things up beyond it.\n` +
    `• The fix: retrieval-augmented generation puts grounded documents in the prompt, found via embeddings.\n` +
    `• The step up: letting the model call tools turns answering into acting — that is what makes it an agent.\n` +
    `• The catch: acting agents can be wrong in costly ways, so reliability and evaluation now matter.\n\n` +
    `Concepts this covers: ${titles.join(', ')}. Work through them in the learning path below, then take the quiz.`;

  return parseScenario({
    id: 'transcript-studio-demo',
    description: 'Keyless demo: the study agent grounds itself in the Atlas, builds a quiz, and answers.',
    model: 'scripted-demo',
    turns: [
      {
        respond: {
          text: 'Let me first ground myself in which Atlas concepts this transcript actually covers.',
          toolCalls: [{ id: 'call_match', toolName: 'match_concepts', arguments: { text: DEMO_TRANSCRIPT } }],
          stopReason: 'tool-call',
          usage: USAGE(320, 40),
        },
        teaching: 'The agent does not guess the topic — it calls a tool that runs the real matcher.',
      },
      {
        respond: {
          text: 'Good — now I will build practice questions for those concepts.',
          toolCalls: [{ id: 'call_quiz', toolName: 'make_quiz', arguments: { conceptIds, count: 5 } }],
          stopReason: 'tool-call',
          usage: USAGE(410, 30),
        },
        teaching: 'A second tool call turns the grounded concept list into quiz material.',
      },
      {
        respond: {
          text: summary,
          stopReason: 'completed',
          usage: USAGE(520, 210),
        },
        teaching: 'With tools done, the model writes the final study guide from grounded facts.',
      },
    ],
  });
}
