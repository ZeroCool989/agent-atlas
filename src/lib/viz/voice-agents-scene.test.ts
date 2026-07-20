import { describe, expect, it } from 'vitest';

import { VOICE_AGENTS_DEMO, createVoiceAgentsScene } from './voice-agents-scene';

const sceneAt = (step: number) => createVoiceAgentsScene(VOICE_AGENTS_DEMO, step);

describe('createVoiceAgentsScene', () => {
  it('step 0 is the user starting to speak, in the listening state — the SSR first frame', () => {
    const scene = sceneAt(0);
    expect(scene.step).toBe(0);
    expect(scene.kind).toBe('speech-start');
    expect(scene.state).toBe('listening');
    expect(scene.elapsedMs).toBe(0);
  });

  it('clamps out-of-range steps to a renderable scene', () => {
    expect(sceneAt(-5).step).toBe(0);
    const last = sceneAt(9999);
    expect(last.step).toBe(last.totalSteps - 1);
  });

  it('every step carries a title and description (doubles as the a11y text)', () => {
    const total = sceneAt(0).totalSteps;
    for (let i = 0; i < total; i += 1) {
      const scene = sceneAt(i);
      expect(scene.title.length).toBeGreaterThan(0);
      expect(scene.description.length).toBeGreaterThan(0);
    }
  });

  it('accumulates the latency budget and flags going over it by the playback beat', () => {
    const scenes = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i));
    const elapsed = scenes.map((s) => s.elapsedMs);
    for (let i = 1; i < elapsed.length; i += 1) {
      expect(elapsed[i]!).toBeGreaterThanOrEqual(elapsed[i - 1]!);
    }
    const playback = scenes.find((s) => s.kind === 'playback-start')!;
    expect(playback.elapsedMs).toBeGreaterThan(playback.budgetMs);
    expect(playback.overBudget).toBe(true);
  });

  it('has a beat where ASR mis-hears and the stream turns corrupted', () => {
    const asr = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i)).find(
      (s) => s.kind === 'asr',
    )!;
    expect(asr.mistranscribed).toBe(true);
    expect(asr.fidelity).toBe('corrupted');
    // The transcript diverges from what the user actually said.
    expect(asr.streamText).not.toBe(asr.utterance);
  });

  it('marks the agent and TTS stages as carrying the error, not introducing it', () => {
    const scenes = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i));
    const ttsBeat = scenes.find((s) => s.kind === 'tts')!;
    const asrStage = ttsBeat.stages.find((st) => st.name === 'asr')!;
    const agentStage = ttsBeat.stages.find((st) => st.name === 'agent')!;
    expect(asrStage.corrupted).toBe(true);
    expect(agentStage.corrupted).toBe(true);
    // Each stage reports its modeled latency once it has run.
    expect(asrStage.latencyMs).toBeGreaterThan(0);
  });

  it('has a barge-in beat that hands the floor back (state listening)', () => {
    const scenes = Array.from({ length: sceneAt(0).totalSteps }, (_, i) => sceneAt(i));
    const barge = scenes.find((s) => s.interrupted)!;
    expect(barge).toBeDefined();
    expect(barge.kind).toBe('barge-in');
    expect(barge.state).toBe('listening');
  });

  it('ends on the terminal beat with the outcome and whether a wrong answer was spoken', () => {
    const last = sceneAt(sceneAt(0).totalSteps - 1);
    expect(last.outcome).toBe('interrupted');
    expect(last.corruptedOutcome).toBe(true);
  });
});
