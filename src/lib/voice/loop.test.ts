import { describe, expect, it } from 'vitest';

import { createManualClock } from './clock';
import {
  BARGE_IN_TURN,
  CLEAN_TURN,
  DEMO_LATENCIES,
  MISTRANSCRIPTION_TURN,
  VOICE_DEMO_INPUT,
} from './demo';
import { runVoiceTurn } from './loop';
import { totalResponseLatency } from './pipeline';

describe('runVoiceTurn — the pipeline and latency budget', () => {
  it('threads a clean turn through every stage in order and ends answered', () => {
    const run = runVoiceTurn(CLEAN_TURN);
    expect(run.outcome).toBe('answered');
    const kinds = run.events.map((e) => e.kind);
    expect(kinds).toEqual([
      'speech-start',
      'endpoint',
      'asr',
      'agent',
      'tts',
      'playback-start',
      'response-done',
    ]);
  });

  it('accumulates end-to-end latency as the sum of the modeled stage costs', () => {
    const run = runVoiceTurn(CLEAN_TURN);
    // endpoint + asr + agent + tts, and nothing else.
    expect(run.totalLatencyMs).toBe(totalResponseLatency(DEMO_LATENCIES));
    expect(run.totalLatencyMs).toBe(850);
    // elapsed is monotonic non-decreasing and freezes at the total once playback starts.
    const elapsed = run.events.map((e) => e.elapsedMs);
    for (let i = 1; i < elapsed.length; i += 1) {
      expect(elapsed[i]!).toBeGreaterThanOrEqual(elapsed[i - 1]!);
    }
    const playback = run.events.find((e) => e.kind === 'playback-start')!;
    expect(playback.elapsedMs).toBe(run.totalLatencyMs);
  });

  it('flags going over the conversational budget (850ms modeled vs 800ms budget)', () => {
    const run = runVoiceTurn(CLEAN_TURN);
    const playback = run.events.find((e) => e.kind === 'playback-start')!;
    expect(playback.overBudget).toBe(true);
    expect(run.totalLatencyMs).toBeGreaterThan(run.budgetMs);
  });

  it('is deterministic under an injected clock — timestamps are exact', () => {
    const run = runVoiceTurn(CLEAN_TURN, createManualClock(0));
    const at = (kind: string) => run.events.find((e) => e.kind === kind)!.at;
    expect(at('speech-start')).toBe(0);
    expect(at('endpoint')).toBe(200); // + endpointMs
    expect(at('asr')).toBe(350); // + asrMs
    expect(at('agent')).toBe(700); // + agentMs
    expect(at('tts')).toBe(850); // + ttsMs
    expect(at('playback-start')).toBe(850); // playback does not add to response latency
  });
});

describe('runVoiceTurn — barge-in / interruption', () => {
  it('interrupts the agent mid-response and returns to listening', () => {
    const run = runVoiceTurn(BARGE_IN_TURN);
    expect(run.outcome).toBe('interrupted');
    const barge = run.events.find((e) => e.kind === 'barge-in')!;
    expect(barge).toBeDefined();
    expect(barge.state).toBe('listening'); // the floor is back with the user
    expect(run.interruptedAtMs).toBe(BARGE_IN_TURN.bargeInAfterMs);
    // No clean 'response-done' beat when the user cut in.
    expect(run.events.some((e) => e.kind === 'response-done')).toBe(false);
  });

  it('advances the wall clock into playback for the barge-in, but not the response budget', () => {
    const run = runVoiceTurn(BARGE_IN_TURN);
    const barge = run.events.find((e) => e.kind === 'barge-in')!;
    // elapsed (response latency) is frozen at the total; `at` has moved further.
    expect(barge.elapsedMs).toBe(run.totalLatencyMs);
    expect(barge.at).toBe(run.totalLatencyMs + BARGE_IN_TURN.bargeInAfterMs!);
  });
});

describe('runVoiceTurn — mistranscription cascade', () => {
  it('corrupts the transcript at ASR and lets it flow, unnoticed, to a wrong reply', () => {
    const run = runVoiceTurn(MISTRANSCRIPTION_TURN);
    expect(run.outcome).toBe('answered');
    expect(run.corrupted).toBe(true);
    expect(run.transcript).not.toBe(run.utterance); // ASR heard something else
    expect(run.transcript).toBe(MISTRANSCRIPTION_TURN.mishear);

    const asr = run.events.find((e) => e.kind === 'asr')!;
    expect(asr.introducedError).toBe(true);

    // Every stage AFTER ASR is corrupted yet only propagates — none introduces the error.
    for (const kind of ['agent', 'tts'] as const) {
      const e = run.events.find((ev) => ev.kind === kind)!;
      expect(e.fidelity).toBe('corrupted');
      expect(e.propagatedError).toBe(true);
      expect(e.introducedError).toBeFalsy();
    }
    // The wrong amount is what the agent confirms.
    expect(run.reply).toContain('fifteen');
    expect(run.reply).not.toContain('fifty');
  });
});

describe('runVoiceTurn — the lesson centrepiece (cascade + corrective barge-in)', () => {
  it('mis-hears, confidently confirms the wrong action, and is interrupted to be corrected', () => {
    const run = runVoiceTurn(VOICE_DEMO_INPUT);
    expect(run.corrupted).toBe(true);
    expect(run.outcome).toBe('interrupted');
    // It reached playback (the user heard the wrong answer) before being cut off.
    const order = run.events.map((e) => e.kind);
    expect(order.indexOf('playback-start')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('barge-in')).toBeGreaterThan(order.indexOf('playback-start'));
  });

  it('every step carries a non-empty label and detail (they double as a11y text)', () => {
    const run = runVoiceTurn(VOICE_DEMO_INPUT);
    for (const e of run.events) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.detail.length).toBeGreaterThan(0);
    }
  });
});
