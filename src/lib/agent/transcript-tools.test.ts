import { describe, expect, it } from 'vitest';

import { createTranscriptTools, TRANSCRIPT_AGENT_SYSTEM } from './transcript-tools';
import { runAgent } from './runner';
import { ScriptedProvider } from '../model';
import { buildDemoScenario, DEMO_TRANSCRIPT } from '../transcript';
import type { ConceptRef, InterviewRef } from '../transcript';

const CORPUS: ConceptRef[] = [
  { id: 'rag', title: 'Retrieval-augmented generation', oneLiner: 'Retrieve relevant documents and put them in the prompt so the model answers from grounded context instead of memory.', layer: 'core-mechanism', status: 'complete', tags: ['rag', 'retrieval', 'grounding'] },
  { id: 'embeddings', title: 'Embeddings', oneLiner: 'Turn text into vectors so semantic similarity becomes measurable distance.', layer: 'core-mechanism', status: 'complete', tags: ['embeddings', 'vectors'] },
  { id: 'tool-calling', title: 'Tool calling', oneLiner: 'Let the model request functions the runtime executes, turning answering into acting.', layer: 'core-mechanism', status: 'complete', tags: ['tools', 'function-calling', 'agent', 'action'] },
  { id: 'evaluation', title: 'Evaluation', oneLiner: 'Measure whether the system is actually good over a set of cases.', layer: 'core-mechanism', status: 'complete', tags: ['evaluation', 'reliability'] },
];

const INTERVIEW: InterviewRef[] = [
  { concepts: ['rag'], question: 'What does RAG solve?', answer: 'It grounds answers in retrieved documents.', difficulty: 'screen' },
  { concepts: ['tool-calling'], question: 'What turns a chatbot into an agent?', answer: 'Letting the model call tools that take actions.', difficulty: 'standard' },
];

describe('transcript tools', () => {
  const tools = createTranscriptTools(CORPUS, INTERVIEW);

  it('registers exactly the two grounded tools', () => {
    expect(tools.definitions().map((d) => d.name).sort()).toEqual(['make_quiz', 'match_concepts']);
  });

  it('match_concepts grounds in the real corpus and is explainable', () => {
    const tool = tools.get('match_concepts')!;
    const parsed = tool.parseArgs({ text: 'retrieval augmented generation with embeddings and vectors' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('parse failed');
    const result = tool.execute(parsed.value);
    if (!result.ok) throw new Error('execute failed');
    const ids = (result.value as Array<{ id: string }>).map((c) => c.id);
    expect(ids).toContain('rag');
    expect(ids).toContain('embeddings');
  });

  it('match_concepts rejects malformed arguments at the validation gate', () => {
    const tool = tools.get('match_concepts')!;
    expect(tool.parseArgs({}).ok).toBe(false);
    expect(tool.parseArgs({ text: '' }).ok).toBe(false);
    expect(tool.parseArgs({ text: 'x', extra: 1 }).ok).toBe(false); // strict: no unknown keys
  });

  it('make_quiz draws from the interview bank and rejects unknown ids', () => {
    const tool = tools.get('make_quiz')!;
    const ok = tool.execute({ conceptIds: ['rag', 'tool-calling'], count: 5 });
    if (!ok.ok) throw new Error('execute failed');
    const value = ok.value as Array<{ concept: string; prompt: string }>;
    expect(value.length).toBeGreaterThan(0);

    const bad = tool.execute({ conceptIds: ['does-not-exist'] });
    expect(bad.ok).toBe(false);
  });
});

describe('demo agent run (keyless, scripted brain, real tools)', () => {
  it('runs the full loop to a grounded answer with a visible trace', async () => {
    const provider = new ScriptedProvider(buildDemoScenario(CORPUS, INTERVIEW));
    const tools = createTranscriptTools(CORPUS, INTERVIEW);

    const result = await runAgent(provider, tools, {
      system: TRANSCRIPT_AGENT_SYSTEM,
      goal: DEMO_TRANSCRIPT,
      maxSteps: 6,
    });

    expect(result.outcome).toBe('completed');
    expect(result.finalText).toContain('study guide');
    // The trace proves the agent actually called and executed both tools.
    const executed = result.trace.filter((e) => e.type === 'tool-executed').map((e) => e.toolName);
    expect(executed).toContain('match_concepts');
    expect(executed).toContain('make_quiz');
    // Three model calls: ground, quiz, answer.
    expect(result.modelCalls).toBe(3);
  });
});
