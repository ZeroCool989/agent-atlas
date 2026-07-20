/**
 * The turn-taking state machine — the half of voice that has nothing to do with the
 * model (plan §3 L4, ADR-0005). A text agent has no notion of "whose turn is it"; a
 * voice agent lives or dies on it. The machine names four states and the signals that
 * move between them:
 *
 *   idle ──speech-start──▶ listening ──endpoint──▶ thinking ──response-ready──▶ speaking
 *     ▲                                                                            │
 *     └──────────────── response-done ────────────────────────────────────────────┘
 *                                                                                  │
 *   listening ◀────────────────────── barge-in ─────────────────────────────────── (interrupt)
 *
 * Two transitions carry the whole lesson:
 *  - `endpoint` (listening → thinking) is ENDPOINTING: deciding the user has actually
 *    stopped talking. It is a guess, not a fact — the microphone only ever reports
 *    "silence so far". End too early and you cut the user off mid-sentence; end too late
 *    and every reply feels laggy. That trade-off is a tuning parameter, not a solved
 *    problem.
 *  - `barge-in` (speaking → listening) is INTERRUPTION: the user starts talking while the
 *    agent is still speaking, so the agent must stop *immediately* and listen. A system
 *    that cannot barge-in feels broken the first time it says something wrong and you
 *    can't cut in to correct it.
 *
 * Pure data + a pure reducer: no timers, no audio, no I/O. The loop drives it; the
 * visualization renders it.
 */

/** The four states a spoken turn moves through. */
export type TurnState = 'idle' | 'listening' | 'thinking' | 'speaking';

/**
 * The signals that drive the machine.
 *  - `speech-start`   — the voice-activity detector hears the user begin.
 *  - `endpoint`       — endpointing decides the user has stopped; the turn is theirs no more.
 *  - `response-ready` — the pipeline has audio to play; playback begins.
 *  - `response-done`  — the agent finished speaking with no interruption.
 *  - `barge-in`       — the user speaks over the agent; the agent must yield the floor.
 */
export type TurnSignal =
  | 'speech-start'
  | 'endpoint'
  | 'response-ready'
  | 'response-done'
  | 'barge-in';

/**
 * The transition table. A missing (state, signal) pair is an ILLEGAL transition — the
 * machine is total about what it refuses, which is how the loop catches its own bugs.
 * Note `barge-in` is defined only from `speaking`: interrupting means cutting off an
 * agent that is mid-utterance. There is nothing to interrupt in any other state.
 */
export const TURN_TRANSITIONS: Readonly<
  Record<TurnState, Partial<Record<TurnSignal, TurnState>>>
> = {
  idle: { 'speech-start': 'listening' },
  listening: { endpoint: 'thinking' },
  thinking: { 'response-ready': 'speaking' },
  speaking: { 'response-done': 'idle', 'barge-in': 'listening' },
};

/** The next state for a signal, or `null` if the machine forbids it in this state. */
export function nextTurnState(state: TurnState, signal: TurnSignal): TurnState | null {
  return TURN_TRANSITIONS[state][signal] ?? null;
}

/**
 * Apply a signal, throwing on an illegal transition. The loop uses this so a wrong
 * sequence of beats fails loudly in a test rather than silently drawing an impossible
 * state in the UI.
 */
export function applyTurnSignal(state: TurnState, signal: TurnSignal): TurnState {
  const next = nextTurnState(state, signal);
  if (next === null) {
    throw new Error(`illegal turn-taking transition: ${state} --${signal}-->`);
  }
  return next;
}
