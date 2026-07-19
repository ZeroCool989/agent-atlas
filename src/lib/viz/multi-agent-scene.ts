/**
 * The `(input, step) => Scene` function for the Multi-agent systems lesson (ADR-0004, plan §8 —
 * "the most ambitious visual"). Pure and deterministic: it replays the real trace of the
 * orchestration build project (`src/lib/multi-agent/`) one event at a time — the supervisor
 * decomposes the goal, delegates to specialists, a worker's output is REJECTED by an independent
 * critic, the supervisor re-delegates a fix, and the answer is composed — then a final CONTRAST
 * beat sets the whole run's cost against a single well-structured agent on the same work.
 *
 * The graph LAYOUT is pure trigonometry (an arc of workers under the supervisor) — no D3, no new
 * dependency, matching the atlas graph home. Every node state, edge, message, and the model-call
 * count come from the harness, so the picture can never disagree with the mechanism it teaches.
 */
import {
  orchestrate,
  type AgentState,
  type AgentView,
  type MessageKind,
  type OrchestrationEventKind,
  type OrchestrationInput,
  type OrchestrationMessage,
  type OrchestrationOutcome,
  type SubtaskView,
} from '../multi-agent/orchestrate';
import { MULTI_AGENT_DEMO, SINGLE_AGENT_BASELINE, type BaselineCase } from '../multi-agent/demo';
import { clampStep } from './timeline';

export type MultiAgentSceneInput = OrchestrationInput;

export const MULTI_AGENT_DEMO_INPUT: MultiAgentSceneInput = MULTI_AGENT_DEMO;
export const MULTI_AGENT_BASELINE: readonly BaselineCase[] = SINGLE_AGENT_BASELINE;

export type NodeKind = 'supervisor' | 'worker' | 'output';

/** A positioned node in the org-chart graph. Coordinates are in a 0–100 viewBox space. */
export interface AgentNode {
  readonly id: string;
  readonly label: string;
  readonly kind: NodeKind;
  readonly specialty?: string;
  readonly state: AgentState;
  readonly modelCalls: number;
  readonly x: number;
  readonly y: number;
}

/** A structural edge; `active` (and `kind`) mark the message flowing on it at this step. */
export interface AgentEdge {
  readonly from: string;
  readonly to: string;
  readonly active: boolean;
  readonly kind?: MessageKind;
}

export type MultiAgentSceneKind = OrchestrationEventKind | 'contrast';

export interface MultiAgentScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  /** Teaching text; doubles as the accessible scene description. */
  readonly description: string;
  readonly kind: MultiAgentSceneKind;
  readonly nodes: readonly AgentNode[];
  readonly edges: readonly AgentEdge[];
  /** The message flowing at this step (absent on plan/finish/contrast beats). */
  readonly activeMessage?: OrchestrationMessage;
  readonly subtasks: readonly SubtaskView[];
  /** Running model-call total — the compounding cost, shown every step. */
  readonly totalModelCalls: number;
  readonly outcome?: OrchestrationOutcome;
  /** The composed answer, present from the compose beat onward. */
  readonly finalAnswer?: string;
  /** The single-agent contrast, present only on the final contrast beat. */
  readonly baseline?: readonly BaselineCase[];
}

const OUTPUT_ID = 'output';
const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Lay the org chart out with trigonometry: the supervisor on top, the workers on a shallow arc
 * beneath it, the output node at the bottom. Deterministic and dependency-free.
 */
function layout(workerIds: readonly string[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  pos.set('supervisor', { x: 50, y: 13 });
  pos.set(OUTPUT_ID, { x: 50, y: 90 });
  const n = workerIds.length;
  const cx = 50;
  const cy = 16; // arc centre (near the supervisor)
  const radius = 42;
  const spreadDeg = Math.min(96, 34 * Math.max(n, 1)); // wider fan for more workers
  workerIds.forEach((id, i) => {
    const t = n <= 1 ? 0 : i / (n - 1) - 0.5; // -0.5 … 0.5 across the fan
    const a = ((t * spreadDeg) * Math.PI) / 180;
    pos.set(id, { x: round(cx + radius * Math.sin(a)), y: round(cy + radius * Math.cos(a)) });
  });
  return pos;
}

function buildNodes(agents: readonly AgentView[], composed: boolean): AgentNode[] {
  const workerIds = agents.filter((a) => a.kind === 'worker').map((a) => a.id);
  const pos = layout(workerIds);
  const nodes: AgentNode[] = agents.map((a) => ({
    id: a.id,
    label: a.label,
    kind: a.kind,
    ...(a.specialty ? { specialty: a.specialty } : {}),
    state: a.state,
    modelCalls: a.modelCalls,
    x: pos.get(a.id)!.x,
    y: pos.get(a.id)!.y,
  }));
  nodes.push({
    id: OUTPUT_ID,
    label: 'Final answer',
    kind: 'output',
    state: composed ? 'done' : 'idle',
    modelCalls: 0,
    x: pos.get(OUTPUT_ID)!.x,
    y: pos.get(OUTPUT_ID)!.y,
  });
  return nodes;
}

/** Structural edges: supervisor↔each worker, and supervisor→output. Active edge = the message. */
function buildEdges(
  agents: readonly AgentView[],
  message: OrchestrationMessage | undefined,
): AgentEdge[] {
  const touches = (a: string, b: string) =>
    message !== undefined &&
    ((message.from === a && message.to === b) || (message.from === b && message.to === a));
  const edges: AgentEdge[] = agents
    .filter((a) => a.kind === 'worker')
    .map((w) => ({
      from: 'supervisor',
      to: w.id,
      active: touches('supervisor', w.id),
      ...(touches('supervisor', w.id) ? { kind: message!.kind } : {}),
    }));
  const composeActive = message?.to === OUTPUT_ID;
  edges.push({
    from: 'supervisor',
    to: OUTPUT_ID,
    active: composeActive,
    ...(composeActive ? { kind: message!.kind } : {}),
  });
  return edges;
}

const CONTRAST_TITLE = 'The honest question: did the system earn its cost?';

export function createMultiAgentScene(input: MultiAgentSceneInput, step: number): MultiAgentScene {
  const run = orchestrate(input);
  const events = run.events;
  // One frame per trace event, plus a final contrast beat.
  const totalSteps = events.length + 1;
  const current = clampStep(step, totalSteps);

  // Whether the compose step has happened by a given event index (drives the output node + answer).
  const composedByNow = (idx: number) => events.slice(0, idx + 1).some((e) => e.kind === 'composed');
  const answerByNow = (idx: number) =>
    events.slice(0, idx + 1).find((e) => e.kind === 'composed')?.message?.summary;

  if (current < events.length) {
    const event = events[current]!;
    const composed = composedByNow(current);
    return {
      step: current,
      totalSteps,
      kind: event.kind,
      title: titleFor(event.kind),
      description: event.detail,
      nodes: buildNodes(event.agents, composed),
      edges: buildEdges(event.agents, event.message),
      ...(event.message ? { activeMessage: event.message } : {}),
      subtasks: event.subtasks,
      totalModelCalls: event.totalModelCalls,
      ...(composed && answerByNow(current) ? { finalAnswer: answerByNow(current) } : {}),
    };
  }

  // Final beat: the contrast. Freeze the finished graph and set its cost against one good agent.
  const last = events[events.length - 1]!;
  return {
    step: current,
    totalSteps,
    kind: 'contrast',
    title: CONTRAST_TITLE,
    description:
      'The run cost ' +
      `${run.totalModelCalls} model calls across three agents to catch one mistake. That is the trade: ` +
      'an independent critic earns its keep on work that needs checking — and is pure overhead on work ' +
      'that does not. Most tasks that look multi-agent are better as one well-structured agent or a workflow.',
    nodes: buildNodes(last.agents, true),
    edges: buildEdges(last.agents, undefined),
    subtasks: last.subtasks,
    totalModelCalls: run.totalModelCalls,
    outcome: run.outcome,
    ...(run.finalAnswer ? { finalAnswer: run.finalAnswer } : {}),
    baseline: MULTI_AGENT_BASELINE,
  };
}

const TITLES: Record<OrchestrationEventKind, string> = {
  planned: 'One goal, split across specialists',
  delegated: 'The supervisor delegates a subtask',
  'worker-succeeded': 'A specialist returns its result',
  'worker-failed': 'An independent critic rejects the work',
  're-delegated': 'The supervisor re-delegates to recover',
  composed: 'Composing the final answer',
  finished: 'Done — now count the cost',
};

function titleFor(kind: OrchestrationEventKind): string {
  return TITLES[kind];
}
