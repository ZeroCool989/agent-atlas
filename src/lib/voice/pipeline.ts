/**
 * The speech pipeline: speech-to-text (ASR) → the agent → text-to-speech (TTS)
 * (plan §3 L4, ADR-0005). A voice agent is an ordinary agent with a microphone bolted to
 * its input and a speaker bolted to its output. This file models the three stages the
 * words pass through, and — the load-bearing part — how an error in one stage is invisible
 * to every stage after it.
 *
 * WHY MODEL FIDELITY. Each payload carries not just text but whether that text still
 * FAITHFULLY represents what the user meant. ASR is the only stage that perceives the
 * real world (audio); if it mis-hears, the transcript becomes the agent's ONLY source of
 * truth, and a mistake there is laundered into a confident, fluent, wrong answer. The
 * agent and TTS do their jobs perfectly and still produce a wrong result, because
 * "perfectly processing the wrong input" is exactly what error compounding is. Newer
 * end-to-end speech-to-speech models collapse these three stages into one — which removes
 * the seams where a transcript can be inspected or corrected, a different trade, not a
 * free win.
 *
 * Pure functions, no audio, no network. The `Agent` is injected (a fixture here; a real
 * tool-calling / workflow agent in production) — swap it and the pipeline is unchanged.
 */

/** Whether the text still means what the speaker meant, or has been corrupted upstream. */
export type Fidelity = 'faithful' | 'corrupted';

/** The three stages of the classic pipeline. */
export type StageName = 'asr' | 'agent' | 'tts';

/** Text plus whether it still faithfully represents the user's intent. */
export interface Payload {
  readonly text: string;
  readonly fidelity: Fidelity;
}

/**
 * The agent stage as a black box: transcript in, reply out. In this repo it is a plain
 * injected function so the loop is deterministic and testable; in production it is a
 * [tool-calling](/concepts/tool-calling) or [workflow](/concepts/workflows-vs-agents)
 * agent. The pipeline neither knows nor cares which — that substitution is the point of
 * ADR-0005.
 */
export type Agent = (transcript: string) => string;

/** What one stage did to the stream — enough to render a beat and explain it. */
export interface StageResult {
  readonly name: StageName;
  readonly input: Payload;
  readonly output: Payload;
  /** This stage put an error INTO a previously-faithful stream (only ASR can, here). */
  readonly introducedError: boolean;
  /** The stream arrived corrupted and this stage passed it on, blind to the fault. */
  readonly propagatedError: boolean;
  /** Human-readable explanation of what happened — doubles as the visual's caption. */
  readonly note: string;
}

/**
 * ASR (automatic speech recognition): audio → transcript. The audio faithfully carried
 * what the user said; `mishear`, when present and different, models a mistranscription —
 * the system "hears" different words. From this point the transcript is the only truth
 * the rest of the pipeline has, and it may be a lie.
 */
export function runAsr(spoken: string, mishear?: string): StageResult {
  const corrupted = mishear !== undefined && mishear !== spoken;
  const heard = corrupted ? mishear! : spoken;
  return {
    name: 'asr',
    // The audio faithfully carried the user's words; ASR is where truth can be lost.
    input: { text: spoken, fidelity: 'faithful' },
    output: { text: heard, fidelity: corrupted ? 'corrupted' : 'faithful' },
    introducedError: corrupted,
    propagatedError: false,
    note: corrupted
      ? `ASR mis-heard “${spoken}” as “${heard}”. No later stage can detect this — the transcript is now the agent's only source of truth.`
      : `ASR transcribed the audio faithfully: “${heard}”.`,
  };
}

/**
 * The agent stage: transcript → reply, via the injected `agent`. It preserves fidelity —
 * a faithful transcript yields a faithful reply, a corrupted one yields a confidently
 * wrong reply — because the agent has no way to know the transcript was mis-heard. This
 * is error compounding made mechanical.
 */
export function runAgentStage(transcript: Payload, agent: Agent): StageResult {
  const reply = agent(transcript.text);
  const corrupted = transcript.fidelity === 'corrupted';
  return {
    name: 'agent',
    input: transcript,
    output: { text: reply, fidelity: transcript.fidelity },
    introducedError: false,
    propagatedError: corrupted,
    note: corrupted
      ? `The agent answered the transcript correctly — but the transcript was wrong, so a well-formed reply is built on a false premise. The mistake is now downstream of anywhere it could be caught.`
      : `The agent produced a reply from the transcript: “${reply}”.`,
  };
}

/**
 * TTS (text-to-speech): reply text → spoken audio. It changes the medium, not the words,
 * so it preserves fidelity. The quiet danger: a fluent, natural voice speaks a wrong
 * answer with exactly the same confidence as a right one — good synthesis HIDES an
 * upstream error rather than surfacing it.
 */
export function runTts(reply: Payload): StageResult {
  const corrupted = reply.fidelity === 'corrupted';
  return {
    name: 'tts',
    input: reply,
    output: { text: reply.text, fidelity: reply.fidelity },
    introducedError: false,
    propagatedError: corrupted,
    note: corrupted
      ? `TTS speaks the reply aloud in a natural voice — just as confidently wrong as it would be confidently right. Fluent delivery conceals the upstream error.`
      : `TTS synthesized the reply as speech.`,
  };
}

/**
 * Modeled per-stage latencies for a turn, in milliseconds. These are ILLUSTRATIVE
 * teaching numbers, not measured benchmarks — real figures depend on the models,
 * hardware, network, and audio length. What is real is the SHAPE: every stage adds
 * delay, they add up in series, and a human notices a conversational gap of more than a
 * few hundred milliseconds.
 */
export interface StageLatencies {
  /** Trailing silence endpointing waits before it declares the turn over. */
  readonly endpointMs: number;
  readonly asrMs: number;
  readonly agentMs: number;
  readonly ttsMs: number;
}

/** Sum of the response-path latencies — the number the budget is measured against. */
export function totalResponseLatency(l: StageLatencies): number {
  return l.endpointMs + l.asrMs + l.agentMs + l.ttsMs;
}
