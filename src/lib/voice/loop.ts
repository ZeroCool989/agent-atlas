/**
 * The voice loop — one spoken turn, start to finish (plan §3 L4, ADR-0005). It threads
 * the [pipeline](./pipeline.ts) (ASR → agent → TTS) through the
 * [turn-taking machine](./turn-taking.ts) and an [injected clock](./clock.ts), emitting
 * one event per beat with the accumulated latency budget attached. Read it top to bottom;
 * it is the whiteboard answer to "what actually happens when someone talks to a voice
 * agent":
 *
 *   idle
 *    → user speaks            (listening)
 *    → endpoint detected      (thinking)   + endpointing delay
 *    → ASR transcribes        (thinking)   + asr latency   [a mistranscription starts here]
 *    → agent thinks           (thinking)   + agent latency [a wrong transcript compounds here]
 *    → TTS synthesizes        (thinking)   + tts latency
 *    → playback starts        (speaking)   ← the user's perceived latency is the sum so far
 *    → response done | barge-in            (idle | listening)
 *
 * Two honesty rules the code enforces:
 *  - Latency is measured, not asserted. Every stage advances the clock, and `elapsedMs`
 *    is the running total the user waits before hearing anything. Voice is a REAL-TIME
 *    problem: the budget is a first-class output, not a footnote.
 *  - The event stream is the whole truth. Nothing happens that is not an event; a viewer
 *    (or a test) replays the beats and can never disagree with the run.
 */
import { createManualClock, type Clock } from './clock';
import {
  runAgentStage,
  runAsr,
  runTts,
  type Agent,
  type Fidelity,
  type Payload,
  type StageLatencies,
} from './pipeline';
import { applyTurnSignal, type TurnSignal, type TurnState } from './turn-taking';

/** One scenario for the loop: what was said, who answers, how slow, and what goes wrong. */
export interface VoiceTurnInput {
  /** What the user actually said — the ground truth ASR is trying to recover. */
  readonly utterance: string;
  /** The agent that answers the transcript (injected; a fixture or a real agent). */
  readonly agent: Agent;
  /** Modeled, illustrative per-stage latencies. */
  readonly latencies: StageLatencies;
  /** The conversational latency budget to measure against (illustrative, e.g. ~800ms). */
  readonly budgetMs: number;
  /** If set and different from `utterance`, ASR mis-hears this instead (a mistranscription). */
  readonly mishear?: string;
  /** If set, the user barges in this many ms into playback, cutting the agent off. */
  readonly bargeInAfterMs?: number;
}

export type VoiceEventKind =
  | 'speech-start'
  | 'endpoint'
  | 'asr'
  | 'agent'
  | 'tts'
  | 'playback-start'
  | 'barge-in'
  | 'response-done';

/**
 * One beat of the turn. `state` is the turn-taking state AFTER this beat; `elapsedMs` is
 * the response-path latency accumulated so far (it stops growing once playback starts —
 * the user is already hearing the reply). `at` is the virtual wall-clock timestamp, which
 * DOES keep advancing through playback so a barge-in has a real time.
 */
export interface VoiceEvent {
  readonly kind: VoiceEventKind;
  readonly step: number;
  /** Virtual wall-clock time of this beat (ms), from the injected clock. */
  readonly at: number;
  readonly state: TurnState;
  readonly label: string;
  readonly detail: string;
  /** Response-path latency accumulated so far (ms) — what the user waits to be answered. */
  readonly elapsedMs: number;
  /** This beat's own modeled latency contribution, when it is a pipeline stage. */
  readonly stageLatencyMs?: number;
  readonly budgetMs: number;
  /** True once the accumulated latency has blown the budget. */
  readonly overBudget: boolean;
  /** The text in the pipeline at this beat (utterance → transcript → reply). */
  readonly streamText: string;
  readonly fidelity: Fidelity;
  /** This stage corrupted a previously-faithful stream. */
  readonly introducedError?: boolean;
  /** This stage passed on an already-corrupted stream, blind to the fault. */
  readonly propagatedError?: boolean;
}

export type VoiceOutcome = 'answered' | 'interrupted';

export interface VoiceTurnResult {
  readonly outcome: VoiceOutcome;
  readonly events: readonly VoiceEvent[];
  /** Ground truth — what the user meant. */
  readonly utterance: string;
  /** What ASR produced (may differ from `utterance`). */
  readonly transcript: string;
  /** What the agent said (fully, even if the user barged in over part of it). */
  readonly reply: string;
  /** End-to-end response latency the user waited before hearing anything (ms). */
  readonly totalLatencyMs: number;
  readonly budgetMs: number;
  /** True when the reply the user heard was built on a mis-heard transcript. */
  readonly corrupted: boolean;
  /** How far into playback the barge-in landed, when there was one (ms). */
  readonly interruptedAtMs?: number;
}

/**
 * Run one spoken turn. Deterministic given a deterministic agent and clock — the returned
 * `events` are the full, replayable trace. The clock is injected (default: a manual clock
 * from 0) precisely so tests can assert exact timings.
 */
export function runVoiceTurn(input: VoiceTurnInput, clock: Clock = createManualClock(0)): VoiceTurnResult {
  const { budgetMs } = input;
  const events: VoiceEvent[] = [];
  let state: TurnState = 'idle';
  let step = 0;

  // The response-path accumulator: grows through endpointing + the three stages, then
  // freezes at playback — the user is now hearing the reply, so their WAIT is over.
  let responseMs = 0;
  // The stream of words as it moves down the pipeline: utterance → transcript → reply.
  let stream: Payload = { text: input.utterance, fidelity: 'faithful' };

  // A beat either drives the turn-taking machine (`signal`) or happens WITHIN a state
  // without changing it (`signal: null`). The ASR/agent/TTS stages all run while the
  // machine sits in `thinking`, so they carry no signal — modelling that faithfully is
  // why the transition table can stay strict about what it forbids.
  const emit = (
    signal: TurnSignal | null,
    kind: VoiceEventKind,
    label: string,
    detail: string,
    extra: Partial<VoiceEvent> = {},
  ) => {
    if (signal !== null) state = applyTurnSignal(state, signal);
    events.push({
      kind,
      step: step++,
      at: clock.now(),
      state,
      label,
      detail,
      elapsedMs: responseMs,
      budgetMs,
      overBudget: responseMs > budgetMs,
      streamText: stream.text,
      fidelity: stream.fidelity,
      ...extra,
    });
  };

  // 1. The user starts speaking. This does not count against the RESPONSE budget — the
  //    clock only starts ticking on the reply once the user stops.
  emit('speech-start', 'speech-start', 'User starts speaking', `The user says: “${input.utterance}”. Voice-activity detection hears speech and the agent begins listening.`);

  // 2. ENDPOINTING: decide the user has stopped. This is a guess from trailing silence,
  //    and the silence you wait through is the first slice of the latency budget.
  responseMs += input.latencies.endpointMs;
  clock.advance(input.latencies.endpointMs);
  emit(
    'endpoint',
    'endpoint',
    'Endpoint detected — the user stopped',
    `Endpointing waits ~${input.latencies.endpointMs}ms of silence to be confident the turn is over. Too short cuts the user off; too long feels laggy. Only now can work begin.`,
    { stageLatencyMs: input.latencies.endpointMs },
  );

  // 3. ASR: audio → transcript (this is where a mistranscription is born).
  const asr = runAsr(input.utterance, input.mishear);
  stream = asr.output;
  responseMs += input.latencies.asrMs;
  clock.advance(input.latencies.asrMs);
  const transcript = stream.text;
  emit(null, 'asr', 'ASR transcribes the audio', asr.note, {
    stageLatencyMs: input.latencies.asrMs,
    introducedError: asr.introducedError,
    propagatedError: asr.propagatedError,
  });

  // 4. The AGENT thinks: transcript → reply. A wrong transcript compounds here.
  const agentStep = runAgentStage(stream, input.agent);
  stream = agentStep.output;
  responseMs += input.latencies.agentMs;
  clock.advance(input.latencies.agentMs);
  const reply = stream.text;
  emit(null, 'agent', 'The agent thinks', agentStep.note, {
    stageLatencyMs: input.latencies.agentMs,
    introducedError: agentStep.introducedError,
    propagatedError: agentStep.propagatedError,
  });

  // 5. TTS: reply → audio. A fluent voice hides an upstream error.
  const tts = runTts(stream);
  stream = tts.output;
  responseMs += input.latencies.ttsMs;
  clock.advance(input.latencies.ttsMs);
  emit(null, 'tts', 'TTS synthesizes the reply', tts.note, {
    stageLatencyMs: input.latencies.ttsMs,
    introducedError: tts.introducedError,
    propagatedError: tts.propagatedError,
  });

  const corrupted = stream.fidelity === 'corrupted';
  const totalLatencyMs = responseMs; // frozen: the user starts hearing the reply now.

  // 6. PLAYBACK: the agent begins to speak. The perceived latency is the sum above.
  const overBy = totalLatencyMs - budgetMs;
  emit(
    'response-ready',
    'playback-start',
    'Playback starts — the agent speaks',
    `The user finally hears a reply. End-to-end latency: ${totalLatencyMs}ms against a ${budgetMs}ms budget — ${
      overBy > 0 ? `${overBy}ms OVER; the pause is noticeable` : `within budget`
    }. Every stage above added to this number.`,
  );

  // 7a. BARGE-IN: the user talks over the agent, which must stop and listen at once.
  if (input.bargeInAfterMs !== undefined) {
    clock.advance(input.bargeInAfterMs);
    emit(
      'barge-in',
      'barge-in',
      'Barge-in — the user interrupts',
      `${input.bargeInAfterMs}ms into playback the user starts talking${
        corrupted ? ' (they heard the wrong answer and cut in to correct it)' : ''
      }. The agent must stop speaking immediately and hand the floor back. A voice agent that cannot be interrupted feels broken.`,
    );
    return {
      outcome: 'interrupted',
      events,
      utterance: input.utterance,
      transcript,
      reply,
      totalLatencyMs,
      budgetMs,
      corrupted,
      interruptedAtMs: input.bargeInAfterMs,
    };
  }

  // 7b. Otherwise the agent finishes cleanly and the floor returns to the user.
  emit(
    'response-done',
    'response-done',
    'Response finished',
    corrupted
      ? `The agent finished speaking. The turn "succeeded" mechanically — yet it confidently told the user something wrong, because a mistranscription five steps back was never caught.`
      : `The agent finished speaking and the turn returns to idle, ready for the next one.`,
  );

  return {
    outcome: 'answered',
    events,
    utterance: input.utterance,
    transcript,
    reply,
    totalLatencyMs,
    budgetMs,
    corrupted,
  };
}
