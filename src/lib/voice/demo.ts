/**
 * Concrete, deterministic voice-turn scenarios for the lesson's visual and its tests
 * (plan §3 L4, ADR-0005). The task is mundane — a spoken money transfer — so the
 * MECHANISM stands out: modest per-stage latencies still blow a conversational budget,
 * a single mis-heard word cascades into a confident wrong action, and the user has to
 * barge in to stop it.
 *
 * Nothing here calls a model or touches audio. The `Agent` is a fixed function and the
 * latencies are illustrative constants, so every run is replayable and the point is
 * falsifiable: swap in a real tool-calling agent and the loop (`loop.ts`) is unchanged.
 */
import type { Agent, StageLatencies } from './pipeline';
import type { VoiceTurnInput } from './loop';

/**
 * A toy voice assistant. It takes the transcript at FACE VALUE and confirms the action —
 * it has no way to know the words were mis-heard, which is exactly the blindness the
 * lesson teaches. In production this is a [tool-calling](/concepts/tool-calling) agent
 * that would actually move the money; here it only speaks the confirmation.
 */
export const demoAgent: Agent = (transcript) =>
  `Okay — ${transcript.replace(/^transfer\b/i, 'transferring').replace(/[.!]\s*$/, '')} now.`;

/**
 * Illustrative per-stage latencies (NOT measured benchmarks). Chosen so the sum (850ms)
 * lands just over a tight conversational budget (800ms): the lesson is that voice latency
 * is death by a thousand cuts — no single stage is outrageous, yet the total is felt. The
 * agent's think-time dominates, as it usually does once a real model and tools are in play.
 */
export const DEMO_LATENCIES: StageLatencies = {
  endpointMs: 200,
  asrMs: 150,
  agentMs: 350,
  ttsMs: 150,
};

export const DEMO_BUDGET_MS = 800;

const TRANSFER_UTTERANCE = 'Transfer fifty dollars to Rob.';
// The canonical ASR confusion: "fifty" ↔ "fifteen", plus a name swap. One phoneme's
// slip becomes a different amount to a different person — and every later stage is blind.
const TRANSFER_MISHEARD = 'Transfer fifteen dollars to Rob.';

/**
 * The happy path: a faithful transcript, comfortably completed, so the ONLY thing on
 * display is the latency budget (which the illustrative numbers still blow). Answered.
 */
export const CLEAN_TURN: VoiceTurnInput = {
  utterance: 'What time is my meeting?',
  agent: (t) => `Your meeting is at 3 p.m. — you asked: ${t}`,
  latencies: DEMO_LATENCIES,
  budgetMs: DEMO_BUDGET_MS,
};

/**
 * The barge-in fixture: a faithful turn where the user talks over the agent mid-reply,
 * so the agent must stop and hand back the floor. Interrupted.
 */
export const BARGE_IN_TURN: VoiceTurnInput = {
  utterance: 'Actually, tell me the weather instead.',
  agent: (t) => `Sure — here's the forecast. You said: ${t}`,
  latencies: DEMO_LATENCIES,
  budgetMs: DEMO_BUDGET_MS,
  bargeInAfterMs: 250,
};

/**
 * The mistranscription-cascade fixture: ASR mis-hears one word, the agent faithfully acts
 * on the wrong transcript, and TTS speaks the wrong confirmation in a confident voice. The
 * turn "succeeds" mechanically while telling the user something false. Answered, corrupted.
 */
export const MISTRANSCRIPTION_TURN: VoiceTurnInput = {
  utterance: TRANSFER_UTTERANCE,
  mishear: TRANSFER_MISHEARD,
  agent: demoAgent,
  latencies: DEMO_LATENCIES,
  budgetMs: DEMO_BUDGET_MS,
};

/**
 * The lesson's centrepiece, shown in the visual: everything at once, as it really goes.
 * ASR mis-hears the amount, the agent confidently confirms the WRONG transfer, and the
 * user — hearing the mistake spoken aloud — barges in to correct it. One scenario that
 * teaches the pipeline, the latency budget, error compounding, endpointing, and barge-in.
 */
export const VOICE_DEMO_INPUT: VoiceTurnInput = {
  utterance: TRANSFER_UTTERANCE,
  mishear: TRANSFER_MISHEARD,
  agent: demoAgent,
  latencies: DEMO_LATENCIES,
  budgetMs: DEMO_BUDGET_MS,
  bargeInAfterMs: 300,
};
