/**
 * Builds the flagship lesson's four-architecture comparison by RUNNING all four
 * implementations on the same question and collecting their traces. Executed
 * server-side at build time (the .astro wrapper awaits it), so the lesson page ships
 * computed data — the visualization renders what actually happened, drawn from the
 * same runtime the learner is told to read.
 */
import directCallScenario from '../model/scenarios/direct-call-arithmetic.scenario.json';
import classifyScenario from '../model/scenarios/model-assisted-classify.scenario.json';
import agentScenario from '../model/scenarios/calculator-tool-use.scenario.json';
import { parseScenario, ScriptedProvider } from '../model';
import { calculatorTool } from './calculator';
import { runAgent } from './runner';
import { ToolRegistry } from './tools';
import type { TraceEvent } from './types';
import { runDeterministicWorkflow, runDirectCall, runModelAssistedWorkflow } from './workflows';

export const COMPARISON_QUESTION = 'What is 127 * 49?';

export interface ArchitectureRun {
  key: 'direct' | 'deterministic' | 'model-assisted' | 'agent';
  label: string;
  /** One-sentence architecture summary shown above the trace. */
  summary: string;
  /** Who decides the next step, in one phrase — the lesson's central comparison. */
  decider: string;
  finalText?: string;
  trace: TraceEvent[];
}

export async function buildComparison(): Promise<ArchitectureRun[]> {
  const direct = await runDirectCall(
    new ScriptedProvider(parseScenario(directCallScenario)),
    COMPARISON_QUESTION,
  );

  const deterministic = runDeterministicWorkflow(COMPARISON_QUESTION);

  const assisted = await runModelAssistedWorkflow(
    new ScriptedProvider(parseScenario(classifyScenario)),
    COMPARISON_QUESTION,
  );

  const agent = await runAgent(
    new ScriptedProvider(parseScenario(agentScenario)),
    new ToolRegistry([calculatorTool]),
    {
      system: 'You are a careful assistant. Use tools for arithmetic.',
      goal: COMPARISON_QUESTION,
    },
  );

  return [
    {
      key: 'direct',
      label: 'Direct model call',
      summary: 'One model call, no tools, no steps. The answer comes from weights alone.',
      decider: 'Nobody decides steps — there is only one',
      ...(direct.finalText !== undefined ? { finalText: direct.finalText } : {}),
      trace: direct.trace,
    },
    {
      key: 'deterministic',
      label: 'Deterministic workflow',
      summary: 'Developer-written pipeline: parse → calculate → format. No model anywhere.',
      decider: 'The developer decided every step, in advance',
      ...(deterministic.finalText !== undefined ? { finalText: deterministic.finalText } : {}),
      trace: deterministic.trace,
    },
    {
      key: 'model-assisted',
      label: 'Model-assisted workflow',
      summary: 'The model classifies once; the application follows one of two developer-written branches.',
      decider: 'The developer wrote the paths; the model picks between them once',
      ...(assisted.finalText !== undefined ? { finalText: assisted.finalText } : {}),
      trace: assisted.trace,
    },
    {
      key: 'agent',
      label: 'Tool-using agent',
      summary: 'A loop: the model observes state, selects actions; the runtime validates, executes, and appends observations.',
      decider: 'The model decides the next action each turn — inside runtime limits',
      ...(agent.finalText !== undefined ? { finalText: agent.finalText } : {}),
      trace: agent.trace,
    },
  ];
}
