import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildComparison,
  calculatorTool,
  evaluateExpression,
  extractExpression,
  runAgent,
  runDeterministicWorkflow,
  ToolRegistry,
} from '../../src/lib/agent';
import { parseScenario, ScriptedProvider } from '../../src/lib/model';
import type { Scenario } from '../../src/lib/model';

const registry = new ToolRegistry([calculatorTool]);

const agentScenario: Scenario = parseScenario(
  JSON.parse(readFileSync(join(process.cwd(), 'src/lib/model/scenarios/calculator-tool-use.scenario.json'), 'utf8')),
);

/** Inline scenario builder for failure-path tests. */
const scenario = (turns: Scenario['turns']): Scenario =>
  parseScenario({ id: 'inline-test', description: 'inline', turns });

const textTurn = (text: string): Scenario['turns'][number] => ({
  respond: { text, stopReason: 'completed' },
});
const toolTurn = (id: string, toolName: string, args: Record<string, string>): Scenario['turns'][number] => ({
  respond: { toolCalls: [{ id, toolName, arguments: args }], stopReason: 'tool-call' },
});

const run = (s: Scenario, goal = 'What is 127 * 49?', maxSteps?: number) =>
  runAgent(new ScriptedProvider(s), registry, {
    system: 'You are a careful assistant. Use tools for arithmetic.',
    goal,
    ...(maxSteps !== undefined ? { maxSteps } : {}),
  });

describe('calculator (the safe tool)', () => {
  it('evaluates precedence and parentheses correctly', () => {
    expect(evaluateExpression('2 + 3 * 4')).toEqual({ ok: true, value: 14 });
    expect(evaluateExpression('(2 + 3) * 4')).toEqual({ ok: true, value: 20 });
    expect(evaluateExpression('-3 + 10 / 4')).toEqual({ ok: true, value: -0.5 });
    expect(evaluateExpression('127 * 49')).toEqual({ ok: true, value: 6223 });
  });

  it('rejects division by zero, junk, and code — never eval()', () => {
    expect(evaluateExpression('1 / 0').ok).toBe(false);
    expect(evaluateExpression('2 + fetch()').ok).toBe(false);
    expect(evaluateExpression('process.exit(1)').ok).toBe(false);
    expect(evaluateExpression('').ok).toBe(false);
  });

  it('validates arguments strictly (unknown keys, wrong types)', () => {
    expect(calculatorTool.parseArgs({ expression: '1+1' }).ok).toBe(true);
    expect(calculatorTool.parseArgs({ expr: '1+1' }).ok).toBe(false);
    expect(calculatorTool.parseArgs({ expression: '1+1', shell: 'rm -rf' }).ok).toBe(false);
    expect(calculatorTool.parseArgs({}).ok).toBe(false);
  });
});

describe('runAgent — happy paths', () => {
  it('plain completion with no tool call ends "completed" with the answer', async () => {
    const result = await run(scenario([textTurn('It is 6,223.')]));
    expect(result.outcome).toBe('completed');
    expect(result.finalText).toBe('It is 6,223.');
    expect(result.modelCalls).toBe(1);
    expect(result.trace.map((e) => e.type)).toEqual([
      'run-started',
      'model-requested',
      'model-responded',
      'run-completed',
    ]);
  });

  it('multi-step model → tool → model flow: full trace in deterministic order', async () => {
    const result = await run(agentScenario);
    expect(result.outcome).toBe('completed');
    expect(result.finalText).toContain('6,223');
    expect(result.modelCalls).toBe(2);
    expect(result.trace.map((e) => e.type)).toEqual([
      'run-started',
      'model-requested',
      'model-responded',
      'tool-selected',
      'tool-validated',
      'tool-executed',
      'observation-appended',
      'model-requested',
      'model-responded',
      'run-completed',
    ]);
    // The observation really is in the conversation state.
    const toolMessage = result.messages.find((m) => m.role === 'tool');
    expect(toolMessage).toMatchObject({ toolCallId: 'call-1', toolName: 'calculator', result: 6223 });
  });

  it('the tool result is computed by the real calculator, not scripted', async () => {
    const result = await run(agentScenario);
    const executed = result.trace.find((e) => e.type === 'tool-executed')!;
    expect(executed.detail).toContain('6223');
    expect(executed.decidedBy).toBe('runtime');
    const selected = result.trace.find((e) => e.type === 'tool-selected')!;
    expect(selected.decidedBy).toBe('model'); // selection vs execution, in the trace itself
  });
});

describe('runAgent — the runtime rejects what it must', () => {
  it('unknown tool → invalid-tool-request with an allowlist explanation', async () => {
    const result = await run(scenario([toolTurn('c1', 'shell', { expression: 'rm -rf /' })]));
    expect(result.outcome).toBe('invalid-tool-request');
    const rejected = result.trace.find((e) => e.type === 'tool-rejected')!;
    expect(rejected.toolName).toBe('shell');
    expect(rejected.detail).toContain('allowlist');
  });

  it('invalid arguments → invalid-tool-request naming the validation failure', async () => {
    const result = await run(scenario([toolTurn('c1', 'calculator', { wrong: '1+1' })]));
    expect(result.outcome).toBe('invalid-tool-request');
    expect(result.trace.find((e) => e.type === 'tool-rejected')!.detail).toContain('validation');
  });

  it('duplicate call ids → invalid-tool-request (no double execution)', async () => {
    const s = scenario([
      {
        respond: {
          toolCalls: [
            { id: 'same-id', toolName: 'calculator', arguments: { expression: '1+1' } },
            { id: 'same-id', toolName: 'calculator', arguments: { expression: '2+2' } },
          ],
          stopReason: 'tool-call',
        },
      },
    ]);
    const result = await run(s);
    expect(result.outcome).toBe('invalid-tool-request');
    expect(result.trace.filter((e) => e.type === 'tool-executed')).toHaveLength(1); // second call never ran
  });

  it('tool execution failure → tool-error, surfaced honestly', async () => {
    const result = await run(scenario([toolTurn('c1', 'calculator', { expression: '1 / 0' })]));
    expect(result.outcome).toBe('tool-error');
    const executed = result.trace.find((e) => e.type === 'tool-executed')!;
    expect(executed.outcome).toBe('tool-error');
    expect(executed.detail).toContain('division by zero');
  });

  it('model failure → model-error via run-failed (never converted to fake text)', async () => {
    const exhausted = new ScriptedProvider(scenario([textTurn('only turn')]));
    await exhausted.complete({ messages: [{ role: 'user', text: 'consume the only turn' }] });
    const result = await runAgent(exhausted, registry, { goal: 'again?' });
    expect(result.outcome).toBe('model-error');
    expect(result.finalText).toBeUndefined();
    expect(result.trace.at(-1)!.type).toBe('run-failed');
    expect(result.trace.at(-1)!.detail).toContain('scenario-exhausted');
  });

  it('maximum steps → max-steps-reached (loop protection is an outcome, not a crash)', async () => {
    const looping = scenario([
      toolTurn('c1', 'calculator', { expression: '1+1' }),
      toolTurn('c2', 'calculator', { expression: '2+2' }),
      toolTurn('c3', 'calculator', { expression: '3+3' }),
    ]);
    const result = await run(looping, 'keep calculating', 3);
    expect(result.outcome).toBe('max-steps-reached');
    expect(result.modelCalls).toBe(3);
    expect(result.trace.at(-1)!.type).toBe('run-stopped-limit');
  });
});

describe('runAgent — determinism, isolation, honesty', () => {
  it('identical runs produce identical traces (deterministic order)', async () => {
    const a = await run(agentScenario);
    const b = await run(agentScenario);
    expect(b.trace).toEqual(a.trace);
    expect(b.messages).toEqual(a.messages);
  });

  it('no shared mutable state: interleaved runs are independent', async () => {
    const [a, b] = await Promise.all([run(agentScenario), run(agentScenario)]);
    expect(a.outcome).toBe('completed');
    expect(b.outcome).toBe('completed');
    expect(b.trace).toEqual(a.trace);
  });

  it('usage metadata appears in the trace only when the provider declared it', async () => {
    const withUsage = await run(agentScenario);
    expect(withUsage.trace.find((e) => e.type === 'model-responded')!.usage).toMatchObject({
      latencyMs: 420,
    });
    const withoutUsage = await run(scenario([textTurn('hi')]));
    expect(withoutUsage.trace.find((e) => e.type === 'model-responded')!.usage).toBeUndefined();
  });
});

describe('the three non-agent architectures', () => {
  it('deterministic workflow: every step decidedBy developer, no model events, correct answer', () => {
    const result = runDeterministicWorkflow('What is 127 * 49?');
    expect(result.finalText).toBe('127 × 49 = 6,223');
    expect(result.trace.some((e) => e.type === 'model-requested')).toBe(false);
    expect(
      result.trace.filter((e) => e.type === 'fixed-step').every((e) => e.decidedBy === 'developer'),
    ).toBe(true);
  });

  it('deterministic workflow fails loudly on inputs outside its design', () => {
    const result = runDeterministicWorkflow('Tell me a joke');
    expect(result.finalText).toBeUndefined();
    expect(result.trace.at(-1)!.type).toBe('run-failed');
  });

  it('extractExpression finds arithmetic and rejects prose', () => {
    expect(extractExpression('What is 127 * 49?')).toBe('127 * 49');
    expect(extractExpression('no math here')).toBeUndefined();
  });

  it('buildComparison runs all four architectures with the expected deciders and answers', async () => {
    const runs = await buildComparison();
    expect(runs.map((r) => r.key)).toEqual(['direct', 'deterministic', 'model-assisted', 'agent']);
    const byKey = Object.fromEntries(runs.map((r) => [r.key, r]));
    expect(byKey['direct']!.finalText).toContain('6,213'); // the scripted wrong answer
    expect(byKey['deterministic']!.finalText).toContain('6,223');
    expect(byKey['model-assisted']!.finalText).toContain('6,223');
    expect(byKey['agent']!.finalText).toContain('6,223');
    expect(byKey['model-assisted']!.trace.some((e) => e.type === 'branch-selected')).toBe(true);
    expect(byKey['agent']!.trace.some((e) => e.type === 'tool-selected' && e.decidedBy === 'model')).toBe(true);
    // Deterministic: identical on repeat.
    expect(await buildComparison()).toEqual(runs);
  });
});
