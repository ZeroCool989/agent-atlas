import { describe, expect, it } from 'vitest';

import { MULTI_AGENT_DEMO_INPUT, createMultiAgentScene } from './multi-agent-scene';

const total = () => createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, 0).totalSteps;

describe('createMultiAgentScene', () => {
  it('opens on the decomposition beat with the supervisor, three workers, and an output node', () => {
    const s = createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, 0);
    expect(s.kind).toBe('planned');
    expect(s.nodes.filter((n) => n.kind === 'worker').map((n) => n.id)).toEqual([
      'researcher',
      'writer',
      'critic',
    ]);
    expect(s.nodes.some((n) => n.kind === 'supervisor')).toBe(true);
    expect(s.nodes.some((n) => n.kind === 'output')).toBe(true);
  });

  it('lays workers out at distinct, in-bounds coordinates (pure-trig arc)', () => {
    const s = createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, 0);
    const workers = s.nodes.filter((n) => n.kind === 'worker');
    const xs = new Set(workers.map((n) => n.x));
    expect(xs.size).toBe(workers.length); // no two workers share an x
    for (const n of s.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(100);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(100);
    }
  });

  it('walks delegation → an independent-critic rejection → re-delegation → compose → finish → contrast', () => {
    const kinds: string[] = [];
    for (let i = 0; i < total(); i += 1) kinds.push(createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, i).kind);
    expect(kinds[0]).toBe('planned');
    expect(kinds).toContain('delegated');
    expect(kinds).toContain('worker-failed');
    expect(kinds).toContain('re-delegated');
    expect(kinds).toContain('composed');
    expect(kinds).toContain('finished');
    expect(kinds.at(-1)).toBe('contrast');
  });

  it('lights up exactly the edge the current message flows on', () => {
    // Find the first delegation beat and check its active edge matches the message.
    for (let i = 0; i < total(); i += 1) {
      const s = createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, i);
      if (s.kind === 'delegated' && s.activeMessage) {
        const active = s.edges.filter((e) => e.active);
        expect(active).toHaveLength(1);
        expect(active[0]!.to).toBe(s.activeMessage.to);
        return;
      }
    }
    throw new Error('no delegation beat found');
  });

  it('shows the running model-call cost rising and never shrinking', () => {
    let prev = -1;
    for (let i = 0; i < total(); i += 1) {
      const s = createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, i);
      expect(s.totalModelCalls).toBeGreaterThanOrEqual(prev);
      prev = s.totalModelCalls;
    }
    expect(prev).toBe(9); // the demo's honest total
  });

  it('reveals the corrected final answer once composed', () => {
    const composed = createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, total() - 2); // finished beat
    expect(composed.finalAnswer).toContain('2025–2027');
  });

  it('the contrast beat carries the single-agent baseline, honest both ways', () => {
    const last = createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, total() - 1);
    expect(last.kind).toBe('contrast');
    expect(last.baseline!.some((c) => c.winner === 'multi-agent')).toBe(true);
    expect(last.baseline!.some((c) => c.winner === 'single-agent')).toBe(true);
    expect(last.outcome).toBe('completed');
  });

  it('clamps out-of-range steps and stays deterministic', () => {
    const a = createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, 999);
    const b = createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, 999);
    expect(a.kind).toBe('contrast');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
