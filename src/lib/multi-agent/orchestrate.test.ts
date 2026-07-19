import { describe, expect, it } from 'vitest';

import {
  orchestrate,
  type OrchestrationInput,
  type SupervisorPlanner,
  type Worker,
} from './orchestrate';
import {
  BRIEF_WORKERS,
  MULTI_AGENT_DEMO,
  SINGLE_AGENT_BASELINE,
  briefComposer,
  briefPlanner,
} from './demo';

// A trivial always-succeeding worker factory for focused unit cases.
const worker = (role: string, calls = 1): Worker => ({
  role,
  specialty: `does ${role}`,
  run: () => ({ ok: true, result: `${role} ok`, modelCalls: calls }),
});

const twoStepPlanner: SupervisorPlanner = () => [
  { id: 's1', description: 'first', tool: 'a' },
  { id: 's2', description: 'second', tool: 'b' },
];

const compose = ({ results }: { results: readonly { result: string }[] }) =>
  results.map((r) => r.result).join(' | ');

describe('orchestrate — happy path', () => {
  const input: OrchestrationInput = {
    goal: 'g',
    planner: twoStepPlanner,
    workers: { a: worker('a', 2), b: worker('b', 3) },
    compose,
  };

  it('completes, delegating each subtask to its role and composing the results', () => {
    const run = orchestrate(input);
    expect(run.outcome).toBe('completed');
    expect(run.finalAnswer).toBe('a ok | b ok');
    expect(run.redelegations).toBe(0);
    expect(run.subtasks.map((s) => s.state)).toEqual(['done', 'done']);
  });

  it('sums model calls across every agent (supervisor plan + workers + compose)', () => {
    const run = orchestrate(input);
    // planner(1) + worker a(2) + worker b(3) + compose(1) = 7
    expect(run.totalModelCalls).toBe(7);
    expect(run.events.at(-1)!.totalModelCalls).toBe(7);
  });

  it('emits a planned → delegate/result pairs → composed → finished trace', () => {
    const run = orchestrate(input);
    const kinds = run.events.map((e) => e.kind);
    expect(kinds[0]).toBe('planned');
    expect(kinds).toContain('delegated');
    expect(kinds).toContain('worker-succeeded');
    expect(kinds).toContain('composed');
    expect(kinds.at(-1)).toBe('finished');
  });

  it('every event snapshots the full roster (supervisor + all workers)', () => {
    const run = orchestrate(input);
    for (const event of run.events) {
      expect(event.agents.map((a) => a.id)).toEqual(['supervisor', 'a', 'b']);
      expect(event.agents[0]!.kind).toBe('supervisor');
    }
  });

  it('a delegate message names the worker role; a result message flows back to the supervisor', () => {
    const run = orchestrate(input);
    const delegate = run.events.find((e) => e.message?.kind === 'delegate')!;
    expect(delegate.message!.from).toBe('supervisor');
    expect(delegate.message!.to).toBe('a');
    const result = run.events.find((e) => e.message?.kind === 'result')!;
    expect(result.message!.to).toBe('supervisor');
  });
});

describe('orchestrate — failure and re-delegation', () => {
  const failingThenFixed: SupervisorPlanner = ({ failure }) =>
    failure
      ? [{ id: 'retry', description: 'retry via fallback', tool: 'fallback' }]
      : [{ id: 'try', description: 'try primary', tool: 'primary' }];

  const input: OrchestrationInput = {
    goal: 'g',
    planner: failingThenFixed,
    workers: {
      primary: { role: 'primary', specialty: 'x', run: () => ({ ok: false, result: 'boom', modelCalls: 1 }) },
      fallback: worker('fallback', 1),
    },
    compose,
  };

  it('re-delegates around a recoverable worker failure and then completes', () => {
    const run = orchestrate(input);
    expect(run.outcome).toBe('completed');
    expect(run.redelegations).toBe(1);
    const kinds = run.events.map((e) => e.kind);
    expect(kinds).toContain('worker-failed');
    expect(kinds).toContain('re-delegated');
  });

  it('marks the failed worker and failed subtask in the snapshot', () => {
    const run = orchestrate(input);
    const failEvent = run.events.find((e) => e.kind === 'worker-failed')!;
    expect(failEvent.agents.find((a) => a.id === 'primary')!.state).toBe('failed');
    expect(failEvent.subtasks.find((s) => s.id === 'try')!.state).toBe('failed');
  });

  it('a failure message flows from the worker back to the supervisor', () => {
    const run = orchestrate(input);
    const failMsg = run.events.find((e) => e.message?.kind === 'failure')!;
    expect(failMsg.message!.from).toBe('primary');
    expect(failMsg.message!.to).toBe('supervisor');
  });
});

describe('orchestrate — bounded, never hangs', () => {
  it('stops at the re-delegation cap and ends failed, not looping', () => {
    // A planner that keeps producing a failing subtask forever.
    const alwaysFails: SupervisorPlanner = () => [{ id: 'x', description: 'x', tool: 'bad' }];
    const run = orchestrate(
      {
        goal: 'g',
        planner: alwaysFails,
        workers: { bad: { role: 'bad', specialty: 'x', run: () => ({ ok: false, result: 'no', modelCalls: 1 }) } },
        compose,
      },
      { maxRedelegations: 2 },
    );
    expect(run.outcome).toBe('failed');
    expect(run.redelegations).toBe(2);
  });

  it('stops at the delegation cap with a step-limit outcome', () => {
    const manySteps: SupervisorPlanner = () =>
      Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, description: 'd', tool: 'a' }));
    const run = orchestrate(
      { goal: 'g', planner: manySteps, workers: { a: worker('a') }, compose },
      { maxDelegations: 3 },
    );
    expect(run.outcome).toBe('step-limit');
  });

  it('treats a subtask routed to a missing role as a recoverable failure', () => {
    const run = orchestrate(
      {
        goal: 'g',
        planner: () => [{ id: 's', description: 'd', tool: 'ghost' }],
        workers: { a: worker('a') },
        compose,
      },
      { maxRedelegations: 0 },
    );
    expect(run.outcome).toBe('failed');
    expect(run.events.some((e) => e.detail.includes('No worker is registered'))).toBe(true);
  });
});

describe('orchestrate — the brief demo (drives the visualizer)', () => {
  const run = orchestrate(MULTI_AGENT_DEMO);

  it('completes after the critic catches the writer and the supervisor re-delegates a fix', () => {
    expect(run.outcome).toBe('completed');
    expect(run.redelegations).toBe(1);
    // The critic fails the first draft, the writer revises, the critic re-verifies.
    const kinds = run.events.map((e) => e.kind);
    expect(kinds).toContain('worker-failed');
    expect(kinds).toContain('re-delegated');
  });

  it('the final answer is the corrected draft (2025–2027, not the invented 2024)', () => {
    expect(run.finalAnswer).toContain('2025–2027');
    expect(run.finalAnswer).not.toContain('binding in 2024');
  });

  it('the demo costs 9 model calls — the honest cost the baseline contrasts', () => {
    // researcher 2 + writer(draft) 1 + critic 1 + writer(revise) 1 + critic(re-verify) 1
    // + supervisor plan 1 + supervisor re-plan 1 + supervisor compose 1 = 9
    expect(run.totalModelCalls).toBe(9);
    expect(SINGLE_AGENT_BASELINE[0]!.multiAgent.modelCalls).toBe(9);
  });

  it('the independent critic is what fails the draft (not the writer self-checking)', () => {
    const failEvent = run.events.find((e) => e.kind === 'worker-failed')!;
    expect(failEvent.message!.from).toBe('critic');
    expect(failEvent.subtasks.find((s) => s.id === 'verify')!.state).toBe('failed');
  });
});

describe('demo baseline fixture — honest both ways', () => {
  it('multi-agent wins the vetted-brief case, single-agent wins the trivial case', () => {
    expect(SINGLE_AGENT_BASELINE.find((c) => c.winner === 'multi-agent')).toBeTruthy();
    expect(SINGLE_AGENT_BASELINE.find((c) => c.winner === 'single-agent')).toBeTruthy();
  });

  it('the roster is exactly researcher, writer, critic', () => {
    expect(Object.keys(BRIEF_WORKERS)).toEqual(['researcher', 'writer', 'critic']);
  });

  it('briefPlanner re-plans to a writer/critic fix loop on failure', () => {
    const replan = briefPlanner({ goal: 'g', completed: [], failure: { step: { id: 'verify', description: '', tool: 'critic', status: 'failed' }, reason: 'bad' } });
    expect(replan.map((s) => s.tool)).toEqual(['writer', 'critic']);
  });

  it('briefComposer returns the last writer draft', () => {
    expect(
      briefComposer({
        goal: 'g',
        results: [
          { subtaskId: 'research', role: 'researcher', result: 'facts' },
          { subtaskId: 'draft', role: 'writer', result: 'first' },
          { subtaskId: 'revise', role: 'writer', result: 'fixed' },
        ],
      }),
    ).toBe('fixed');
  });
});
