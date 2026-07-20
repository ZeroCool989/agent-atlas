/**
 * Builds the lesson's central artifact: the SAME agent task, run two ways — once with the
 * hand-built loop wired by hand (src/lib/agent), once through the `defineAgent` facade —
 * and the proof that both produce byte-for-byte the same trace. Executed server-side at
 * build time (the .astro wrapper awaits it), so the visualization renders what actually
 * happened, not a drawing.
 *
 * The honest claim the artifact makes concrete: a framework is not a new capability. Run
 * the identical scenario through both surfaces and the runtime behaviour — every model
 * call, every validation, every tool dispatch, every observation — is identical, because
 * underneath, the facade is calling the very loop the hand-built code calls directly. What
 * changes is not what happens; it is who owns and can see the code that makes it happen.
 */
import { calculatorTool, runAgent, ToolRegistry, DEFAULT_MAX_STEPS } from '../agent';
import type { AgentRunResult, TraceEvent, TraceEventType } from '../agent';
import { parseScenario, ScriptedProvider } from '../model';
import calculatorScenario from '../model/scenarios/calculator-tool-use.scenario.json';
import { defineAgent } from './declarative';
import type { FrameworkComparison, RuntimeStepView } from './types';

export const COMPARISON_GOAL = 'What is 127 * 49?';
const SYSTEM = 'You are a careful assistant. Use tools for arithmetic.';
const AGENT_NAME = 'calculator-agent';

/** Short, human labels for the trace events the visualization steps through. */
const STEP_LABELS: Record<TraceEventType, string> = {
  'run-started': 'run started',
  'fixed-step': 'fixed step',
  'branch-selected': 'branch selected',
  'model-requested': 'model call requested',
  'model-responded': 'model responded',
  'tool-selected': 'tool selected (model)',
  'tool-validated': 'arguments validated (runtime)',
  'tool-rejected': 'tool rejected (runtime)',
  'tool-executed': 'tool executed (runtime)',
  'observation-appended': 'observation appended',
  'run-completed': 'run completed',
  'run-stopped-limit': 'stopped: step limit',
  'run-failed': 'run failed',
};

/** The hand-built path: every wire is written and owned by the developer. */
async function runHandBuilt(): Promise<AgentRunResult> {
  const provider = new ScriptedProvider(parseScenario(calculatorScenario));
  const registry = new ToolRegistry([calculatorTool]);
  return runAgent(provider, registry, {
    system: SYSTEM,
    goal: COMPARISON_GOAL,
    maxSteps: DEFAULT_MAX_STEPS,
  });
}

/** The framework path: the same run, expressed as a declaration compiled by the facade. */
async function runFramework(): Promise<AgentRunResult> {
  // A fresh provider: the ScriptedProvider is stateful (it advances through turns), so the
  // two runs must not share one, or the second would start mid-scenario.
  const provider = new ScriptedProvider(parseScenario(calculatorScenario));
  const agent = defineAgent(provider, {
    name: AGENT_NAME,
    system: SYSTEM,
    tools: [calculatorTool],
    // maxSteps deliberately omitted — the facade falls through to DEFAULT_MAX_STEPS, the
    // same limit the hand-built path sets explicitly. Same value, but here it is invisible.
  });
  return agent.run(COMPARISON_GOAL);
}

const stepViews = (trace: readonly TraceEvent[]): RuntimeStepView[] =>
  trace.map((event, index) => ({
    index,
    label: STEP_LABELS[event.type],
    decidedBy: event.decidedBy,
    detail: event.detail,
    // Identical runtime code drives every step in both runs; the only difference is
    // authorship of the invocation — yours to read in the hand-built run, the framework's
    // (reached only through `.run()`) in the framework run.
    ownerHandBuilt: 'you',
    ownerFramework: 'framework',
  }));

export async function buildFrameworkComparison(): Promise<FrameworkComparison> {
  const handBuilt = await runHandBuilt();
  const framework = await runFramework();

  // The load-bearing invariant, verified rather than asserted in prose: the two surfaces
  // produced the same trace. If a future change to either path breaks this, the lesson's
  // whole claim is false — so the unit test pins it, and it is recomputed here at build.
  const tracesMatch = JSON.stringify(handBuilt.trace) === JSON.stringify(framework.trace);

  return {
    goal: COMPARISON_GOAL,
    handBuilt: {
      key: 'hand-built',
      label: 'Hand-built loop',
      summary: 'Every wire in the open: you build the registry, choose the limit, call the loop, and own runner.ts.',
      authoring: [
        {
          code: 'const provider = new ScriptedProvider(parseScenario(scenario));',
          owns: 'you',
          concern: 'choose the model provider',
        },
        {
          code: 'const registry = new ToolRegistry([calculatorTool]);',
          owns: 'you',
          concern: 'build the tool allowlist by hand',
        },
        {
          code: 'const result = await runAgent(provider, registry, {',
          owns: 'you',
          concern: 'invoke the loop yourself',
        },
        {
          code: '  system, goal, maxSteps: 6,',
          owns: 'you',
          concern: 'choose the loop-safety limit',
        },
        {
          code: '}); // and runner.ts — every line of the loop — is yours to read',
          owns: 'you',
          concern: 'the loop itself is your code',
        },
      ],
    },
    framework: {
      key: 'framework',
      label: 'Framework-style declaration',
      summary: 'A short declaration: name it, hand it tools, call .run(). The wiring and the loop move inside the box.',
      authoring: [
        {
          code: 'const agent = defineAgent(provider, {',
          owns: 'you',
          concern: 'declare the agent',
        },
        {
          code: `  name: '${AGENT_NAME}',`,
          owns: 'you',
          concern: 'a name the framework asks for',
        },
        {
          code: '  system, tools: [calculatorTool],',
          owns: 'you',
          concern: 'the system prompt and tools',
        },
        {
          code: '}); // registry built + step limit chosen for you, out of sight',
          owns: 'framework',
          concern: 'the wiring is now the framework’s',
        },
        {
          code: 'const result = await agent.run(goal); // runner.ts runs inside here',
          owns: 'framework',
          concern: 'the loop runs inside .run()',
        },
      ],
    },
    hidden: [
      'The ToolRegistry allowlist — built for you inside defineAgent, not a line you wrote.',
      `The step limit — it defaults to ${DEFAULT_MAX_STEPS} model calls, a loop-safety choice you never made and might not know exists.`,
      'The loop itself — context assembly, model call, argument validation, tool dispatch, observation append, and every stop condition run inside .run(); runner.ts is never in your code.',
      'Debugging a misbehaving run now means understanding two layers: your declaration AND the framework’s loop.',
    ],
    steps: stepViews(handBuilt.trace),
    ...(handBuilt.finalText !== undefined ? { finalText: handBuilt.finalText } : {}),
    tracesMatch,
    handBuiltTrace: handBuilt.trace,
    frameworkTrace: framework.trace,
  };
}
