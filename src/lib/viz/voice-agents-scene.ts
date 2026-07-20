/**
 * The `(input, step) => Scene` function for the Voice agents lesson (ADR-0004, plan §8).
 * Pure and deterministic: it replays one spoken turn from the build project
 * (`src/lib/voice/`) a beat at a time — user speaks → endpoint detected → ASR (with its
 * latency) → agent thinks → TTS speaks → playback → the user barges in and the agent
 * stops. Every state, latency number and line of text comes from `runVoiceTurn`, so the
 * picture can never disagree with the mechanism. Step 0 is the SSR first frame.
 */
import {
  VOICE_DEMO_INPUT,
  runVoiceTurn,
  type TurnState,
  type VoiceEvent,
  type VoiceEventKind,
  type VoiceTurnInput,
} from '../voice';
import { clampStep } from './timeline';

export interface VoiceAgentsSceneInput extends VoiceTurnInput {}

export const VOICE_AGENTS_DEMO: VoiceAgentsSceneInput = VOICE_DEMO_INPUT;

/** The four turn-taking states, in order, so the visual can draw the machine as a track. */
export const TURN_STATES: readonly TurnState[] = ['idle', 'listening', 'thinking', 'speaking'];

/** The three pipeline stages, in order, for the pipeline diagram. */
export const PIPELINE_STAGES = [
  { name: 'asr', label: 'ASR' },
  { name: 'agent', label: 'Agent' },
  { name: 'tts', label: 'TTS' },
] as const;

export type StageStatus = 'pending' | 'active' | 'done' | 'error';

/** One pipeline stage as the visual draws it at the current beat. */
export interface StageView {
  readonly name: 'asr' | 'agent' | 'tts';
  readonly label: string;
  readonly status: StageStatus;
  /** The modeled latency this stage contributes, once it has run (ms). */
  readonly latencyMs?: number;
  /** True when this stage carries a corrupted stream (introduced or propagated an error). */
  readonly corrupted: boolean;
}

export interface VoiceAgentsScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  /** Teaching text; doubles as the accessible scene description. */
  readonly description: string;
  readonly kind: VoiceEventKind;
  /** The turn-taking state at this beat (drives the state-machine track). */
  readonly state: TurnState;
  /** Ground truth — what the user actually said. */
  readonly utterance: string;
  /** The text in the pipeline at this beat (transcript, then reply). */
  readonly streamText: string;
  readonly fidelity: 'faithful' | 'corrupted';
  /** Accumulated response-path latency so far (ms). */
  readonly elapsedMs: number;
  readonly budgetMs: number;
  readonly overBudget: boolean;
  readonly stages: readonly StageView[];
  /** True on the beat where ASR mis-hears (mark the divergence). */
  readonly mistranscribed: boolean;
  /** True on the barge-in beat. */
  readonly interrupted: boolean;
  /** Present on the terminal beat: the run's outcome, and whether a wrong answer was spoken. */
  readonly outcome?: 'answered' | 'interrupted';
  readonly corruptedOutcome?: boolean;
}

const STAGE_ORDER: Record<string, number> = { asr: 0, agent: 1, tts: 2 };

/** How far down the pipeline this beat is (which stages have completed). */
function stageProgress(kind: VoiceEventKind): number {
  switch (kind) {
    case 'speech-start':
    case 'endpoint':
      return -1; // no stage has run yet
    case 'asr':
      return 0;
    case 'agent':
      return 1;
    case 'tts':
      return 2;
    default:
      return 3; // playback and beyond: all stages done
  }
}

function buildStages(events: readonly VoiceEvent[], current: number): StageView[] {
  const progress = stageProgress(events[current]!.kind);
  return PIPELINE_STAGES.map((stage) => {
    const order = STAGE_ORDER[stage.name]!;
    const stageEvent = events.find((e) => e.kind === stage.name);
    const done = order < progress;
    const active = order === progress;
    const corrupted = stageEvent?.fidelity === 'corrupted' && (done || active);
    const status: StageStatus = active
      ? corrupted
        ? 'error'
        : 'active'
      : done
        ? corrupted
          ? 'error'
          : 'done'
        : 'pending';
    return {
      name: stage.name,
      label: stage.label,
      status,
      ...(done || active ? { latencyMs: stageEvent?.stageLatencyMs } : {}),
      corrupted,
    };
  });
}

export function createVoiceAgentsScene(input: VoiceAgentsSceneInput, step: number): VoiceAgentsScene {
  const run = runVoiceTurn(input);
  const events = run.events;
  const totalSteps = events.length;
  const current = clampStep(step, totalSteps);
  const event = events[current]!;
  const terminal = event.kind === 'response-done' || event.kind === 'barge-in';

  return {
    step: current,
    totalSteps,
    title: event.label,
    description: event.detail,
    kind: event.kind,
    state: event.state,
    utterance: run.utterance,
    streamText: event.streamText,
    fidelity: event.fidelity,
    elapsedMs: event.elapsedMs,
    budgetMs: event.budgetMs,
    overBudget: event.overBudget,
    stages: buildStages(events, current),
    mistranscribed: event.kind === 'asr' && event.introducedError === true,
    interrupted: event.kind === 'barge-in',
    ...(terminal ? { outcome: run.outcome, corruptedOutcome: run.corrupted } : {}),
  };
}
