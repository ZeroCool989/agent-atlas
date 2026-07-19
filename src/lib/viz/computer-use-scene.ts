/**
 * The `(input, step) => Scene` function for the Computer use lesson (ADR-0004, plan §8).
 * Pure and deterministic: it replays the perceive → decide → act run from the build project
 * (`src/lib/computer-use/`) one event at a time — screenshot → proposed action (target +
 * click point) → the runtime gate (an injected instruction refused; a consequential action
 * confirmed) → the screen updates → next perception → goal reached. Every element, coordinate
 * and line of text comes from the loop, so the picture can never disagree with the mechanism.
 */
import {
  COMPUTER_USE_DEMO_INPUT,
  runComputerUse,
  type ComputerUseDemoInput,
  type ComputerUseEvent,
  type EventKind,
  type Point,
} from '../computer-use';
import { clampStep } from './timeline';

export interface ComputerUseSceneInput extends ComputerUseDemoInput {}

export const COMPUTER_USE_DEMO: ComputerUseSceneInput = COMPUTER_USE_DEMO_INPUT;

/** One element as the visual draws it — appearance plus the runtime facts the caption needs. */
export interface SceneElement {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** True when this element is the target of the action in play (draw a highlight). */
  readonly targeted: boolean;
  /** True when this element is the on-screen injected instruction (mark it). */
  readonly injected: boolean;
}

export type SceneStatus =
  | 'perceiving'
  | 'proposed'
  | 'awaiting-confirmation'
  | 'refused'
  | 'confirmed'
  | 'acted'
  | 'done'
  | 'stopped';

export interface ComputerUseScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  /** Teaching text; doubles as the accessible scene description. */
  readonly description: string;
  readonly kind: EventKind;
  readonly status: SceneStatus;
  readonly view: string;
  readonly elements: readonly SceneElement[];
  /** The click point to draw, when an action targets a coordinate. */
  readonly point?: Point;
  /** The risk of the action in play, for the caption/badge. */
  readonly risk?: string;
  readonly goal: string;
  /** Present on the final beat: the run's outcome and how many actions were refused. */
  readonly outcome?: string;
  readonly refusals?: number;
}

const TITLES: Record<EventKind, string> = {
  perceived: 'Perceive: take a screenshot',
  decided: 'Decide: the policy proposes an action',
  'confirmation-requested': 'Gate: a consequential action pauses for confirmation',
  confirmed: 'Confirmed by a human (or an allow-list)',
  refused: 'Refused: the injected instruction is blocked',
  acted: 'Act: the screen updates',
  completed: 'Goal reached',
  'step-limit': 'Stopped at the step limit',
};

const STATUS: Record<EventKind, SceneStatus> = {
  perceived: 'perceiving',
  decided: 'proposed',
  'confirmation-requested': 'awaiting-confirmation',
  confirmed: 'confirmed',
  refused: 'refused',
  acted: 'acted',
  completed: 'done',
  'step-limit': 'stopped',
};

function drawElements(event: ComputerUseEvent): SceneElement[] {
  return event.screen.elements.map((element) => ({
    id: element.id,
    label: element.label,
    kind: element.kind,
    bounds: element.bounds,
    targeted: event.targetLabel !== undefined && element.label === event.targetLabel,
    injected: element.looksLikeInstruction === true,
  }));
}

export function createComputerUseScene(input: ComputerUseSceneInput, step: number): ComputerUseScene {
  const run = runComputerUse(input);
  const events = run.events;
  const totalSteps = events.length;
  const current = clampStep(step, totalSteps);
  const event = events[current]!;

  const terminal = event.kind === 'completed' || event.kind === 'step-limit';

  return {
    step: current,
    totalSteps,
    title: TITLES[event.kind],
    description: event.detail,
    kind: event.kind,
    status: STATUS[event.kind],
    view: event.screen.view,
    elements: drawElements(event),
    ...(event.point ? { point: event.point } : {}),
    ...(event.risk ? { risk: event.risk } : {}),
    goal: input.goal,
    ...(terminal ? { outcome: run.outcome, refusals: run.refusals } : {}),
  };
}
