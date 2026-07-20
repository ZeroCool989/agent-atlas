/**
 * Voice agents — the speech-to-text → agent → text-to-speech loop, its turn-taking state
 * machine, and its latency budget, as a dependency-free, unit-tested TypeScript toy
 * (plan §3 L4, ADR-0005). No real audio, microphone, or network: the loop shape and the
 * timing are modelled in memory so they can be read, replayed, and tested. Public surface:
 */
export { createManualClock, type Clock } from './clock';
export {
  TURN_TRANSITIONS,
  applyTurnSignal,
  nextTurnState,
  type TurnSignal,
  type TurnState,
} from './turn-taking';
export {
  runAgentStage,
  runAsr,
  runTts,
  totalResponseLatency,
  type Agent,
  type Fidelity,
  type Payload,
  type StageLatencies,
  type StageName,
  type StageResult,
} from './pipeline';
export {
  runVoiceTurn,
  type VoiceEvent,
  type VoiceEventKind,
  type VoiceOutcome,
  type VoiceTurnInput,
  type VoiceTurnResult,
} from './loop';
export {
  BARGE_IN_TURN,
  CLEAN_TURN,
  DEMO_BUDGET_MS,
  DEMO_LATENCIES,
  MISTRANSCRIPTION_TURN,
  VOICE_DEMO_INPUT,
  demoAgent,
} from './demo';
