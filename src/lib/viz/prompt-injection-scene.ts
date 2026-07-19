/**
 * The `(input, step) => Scene` function for the Prompt injection lesson (ADR-0004, plan §8).
 * Pure and deterministic: it replays the build project's combined run
 * (`src/lib/security/`) one event at a time — the trusted request and an untrusted retrieved
 * article are concatenated into one stream, a provenance-blind model proposes both the real
 * reply AND the injected exfiltration, the NAIVE pipeline executes the attack, then the SAME
 * attack meets the MITIGATED pipeline whose architectural controls refuse it while the real
 * reply still completes. Every segment, call, and control decision comes from the module, so
 * the picture can never disagree with the mechanism.
 */
import {
  assemblePrompt,
  runPromptInjectionScenario,
  type Phase,
  type PromptInjectionScenarioInput,
  type SecurityEvent,
  type SecurityEventKind,
  type Trust,
} from '../security';
import { PROMPT_INJECTION_DEMO_INPUT } from '../security';
import { clampStep } from './timeline';

export type PromptInjectionSceneInput = PromptInjectionScenarioInput;

export const PROMPT_INJECTION_DEMO: PromptInjectionSceneInput = PROMPT_INJECTION_DEMO_INPUT;

/** One segment of the assembled prompt, as the visual draws the "one token stream". */
export interface PromptInjectionSegmentView {
  readonly source: string;
  readonly role: string;
  readonly trust: Trust;
  readonly text: string;
  /** True when the directive in play was read from this segment (highlight it). */
  readonly active: boolean;
}

export type PromptInjectionStatus =
  | 'assembling'
  | 'reading'
  | 'executed'
  | 'harm'
  | 'allowed'
  | 'blocked'
  | 'outcome';

/** A compact view of the tool call in play. */
export interface PromptInjectionCallView {
  readonly tool: string;
  readonly consequence: string;
  readonly origin: Trust;
}

export interface PromptInjectionOutcomeView {
  readonly phase: Phase;
  readonly injectionSucceeded: boolean;
  readonly legitimateActionCompleted: boolean;
}

export interface PromptInjectionScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  /** Teaching text; doubles as the accessible scene description. */
  readonly description: string;
  readonly phase: Phase;
  readonly kind: SecurityEventKind;
  readonly status: PromptInjectionStatus;
  /** The assembled prompt, drawn every step so the "one stream" is always visible. */
  readonly segments: readonly PromptInjectionSegmentView[];
  readonly call?: PromptInjectionCallView;
  readonly intent?: string;
  /** On a mitigated block: which layered controls refused the call. */
  readonly firedControls?: readonly string[];
  /** True on the naive harm beat. */
  readonly harmful?: boolean;
  /** Present on an `outcome` beat: the phase's result. */
  readonly outcome?: PromptInjectionOutcomeView;
}

const PHASE_LABEL: Record<Phase, string> = {
  setup: 'The attack',
  naive: 'Naive pipeline',
  mitigated: 'Mitigated pipeline',
};

const STATUS: Record<SecurityEventKind, PromptInjectionStatus> = {
  assemble: 'assembling',
  read: 'reading',
  execute: 'executed',
  harm: 'harm',
  gate: 'reading',
  allow: 'allowed',
  block: 'blocked',
  outcome: 'outcome',
};

function titleFor(event: SecurityEvent): string {
  const prefix = PHASE_LABEL[event.phase];
  switch (event.kind) {
    case 'assemble':
      return event.phase === 'setup' ? 'One request, two pipelines' : `${prefix}: one concatenated stream`;
    case 'read':
      return `${prefix}: the model proposes an action`;
    case 'execute':
      return `${prefix}: the action runs (no gate)`;
    case 'harm':
      return `${prefix}: injected action exfiltrates data`;
    case 'allow':
      return `${prefix}: legitimate action allowed`;
    case 'block':
      return `${prefix}: injected action blocked`;
    case 'outcome':
      return `${prefix}: outcome`;
    default:
      return prefix;
  }
}

function segmentsFor(input: PromptInjectionSceneInput, event: SecurityEvent): PromptInjectionSegmentView[] {
  return assemblePrompt(input.request).map((segment) => ({
    source: segment.source,
    role: segment.role,
    trust: segment.trust,
    text: segment.text,
    active: event.sourceLabel !== undefined && segment.source === event.sourceLabel,
  }));
}

export function createPromptInjectionScene(
  input: PromptInjectionSceneInput,
  step: number,
): PromptInjectionScene {
  const scenario = runPromptInjectionScenario(input);
  const events = scenario.events;
  const totalSteps = events.length;
  const current = clampStep(step, totalSteps);
  const event = events[current]!;

  const outcome: PromptInjectionOutcomeView | undefined =
    event.kind === 'outcome'
      ? event.phase === 'naive'
        ? {
            phase: 'naive',
            injectionSucceeded: scenario.naive.injectionSucceeded,
            legitimateActionCompleted: scenario.naive.legitimateActionCompleted,
          }
        : {
            phase: 'mitigated',
            injectionSucceeded: scenario.mitigated.injectionSucceeded,
            legitimateActionCompleted: scenario.mitigated.legitimateActionCompleted,
          }
      : undefined;

  return {
    step: current,
    totalSteps,
    title: titleFor(event),
    description: event.detail,
    phase: event.phase,
    kind: event.kind,
    status: STATUS[event.kind],
    segments: segmentsFor(input, event),
    ...(event.call
      ? { call: { tool: event.call.tool, consequence: event.call.consequence, origin: event.origin ?? 'trusted' } }
      : {}),
    ...(event.intent ? { intent: event.intent } : {}),
    ...(event.firedControls ? { firedControls: [...event.firedControls] } : {}),
    ...(event.harmful ? { harmful: true } : {}),
    ...(outcome ? { outcome } : {}),
  };
}
