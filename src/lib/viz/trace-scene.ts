/**
 * Step-scene function for execution traces (flagship lesson, Tier 2). One scene per
 * trace event: the timeline of what has happened so far, with the current event
 * active and future events dimmed-but-visible — the learner sees the whole
 * architecture's shape while stepping through it (drawable-on-a-whiteboard is the
 * goal). Only observable behavior: the rows are the runtime's own trace events.
 */
import type { TraceEvent } from '../agent/types';
import { clampStep } from './timeline';
import type { TokenState } from './types';

export type TraceActor = 'application' | 'model' | 'runtime' | 'tool';

export interface TraceRow {
  index: number;
  actor: TraceActor;
  decidedBy: TraceEvent['decidedBy'];
  label: string;
  /** 'completed' = already happened, 'active' = current, 'inactive' = not yet. */
  state: TokenState;
  hasUsage: boolean;
}

export interface TraceScene {
  step: number;
  totalSteps: number;
  title: string;
  /** The current event's teaching explanation. */
  description: string;
  rows: TraceRow[];
  /** Usage metadata of the current event, when the provider declared any. */
  usage?: TraceEvent['usage'];
}

const ACTOR_BY_TYPE: Record<TraceEvent['type'], TraceActor> = {
  'run-started': 'runtime',
  'fixed-step': 'application',
  'branch-selected': 'model',
  'model-requested': 'application',
  'model-responded': 'model',
  'tool-selected': 'model',
  'tool-validated': 'runtime',
  'tool-rejected': 'runtime',
  'tool-executed': 'tool',
  'observation-appended': 'runtime',
  'run-completed': 'runtime',
  'run-stopped-limit': 'runtime',
  'run-failed': 'runtime',
};

export function traceEventLabel(event: TraceEvent): string {
  switch (event.type) {
    case 'run-started':
      return 'Run started';
    case 'fixed-step':
      return event.toolName ? `Fixed step: ${event.toolName}` : 'Fixed step';
    case 'branch-selected':
      return 'Branch selected by model';
    case 'model-requested':
      return `Model call ${event.step} requested`;
    case 'model-responded':
      return `Model responded (${event.stopReason})`;
    case 'tool-selected':
      return `Model selected tool: ${event.toolName}`;
    case 'tool-validated':
      return `Runtime validated arguments`;
    case 'tool-rejected':
      return `Runtime REJECTED tool request`;
    case 'tool-executed':
      return event.outcome === 'tool-error'
        ? `Tool execution failed: ${event.toolName}`
        : `Runtime executed tool: ${event.toolName}`;
    case 'observation-appended':
      return 'Observation appended to state';
    case 'run-completed':
      return 'Run completed';
    case 'run-stopped-limit':
      return 'Run stopped: step limit';
    case 'run-failed':
      return `Run failed (${event.outcome})`;
  }
}

export function createTraceScene(trace: TraceEvent[], step: number): TraceScene {
  const totalSteps = Math.max(trace.length, 1);
  const current = clampStep(step, totalSteps);
  const event = trace[current];

  return {
    step: current,
    totalSteps,
    title: event ? traceEventLabel(event) : 'Empty trace',
    description: event?.detail ?? '',
    rows: trace.map((e, index) => ({
      index,
      actor: ACTOR_BY_TYPE[e.type],
      decidedBy: e.decidedBy,
      label: traceEventLabel(e),
      state: index < current ? 'completed' : index === current ? 'active' : 'inactive',
      hasUsage: e.usage !== undefined,
    })),
    ...(event?.usage ? { usage: event.usage } : {}),
  };
}
