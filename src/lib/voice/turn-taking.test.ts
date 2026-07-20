import { describe, expect, it } from 'vitest';

import { applyTurnSignal, nextTurnState, type TurnState } from './turn-taking';

describe('turn-taking state machine', () => {
  it('walks a clean turn idle → listening → thinking → speaking → idle', () => {
    let s: TurnState = 'idle';
    s = applyTurnSignal(s, 'speech-start');
    expect(s).toBe('listening');
    s = applyTurnSignal(s, 'endpoint');
    expect(s).toBe('thinking');
    s = applyTurnSignal(s, 'response-ready');
    expect(s).toBe('speaking');
    s = applyTurnSignal(s, 'response-done');
    expect(s).toBe('idle');
  });

  it('barge-in interrupts speaking and returns to listening', () => {
    expect(nextTurnState('speaking', 'barge-in')).toBe('listening');
  });

  it('barge-in is only legal from speaking — there is nothing else to interrupt', () => {
    expect(nextTurnState('idle', 'barge-in')).toBeNull();
    expect(nextTurnState('listening', 'barge-in')).toBeNull();
    expect(nextTurnState('thinking', 'barge-in')).toBeNull();
  });

  it('rejects illegal transitions loudly', () => {
    expect(nextTurnState('idle', 'endpoint')).toBeNull();
    expect(() => applyTurnSignal('idle', 'endpoint')).toThrow(/illegal turn-taking transition/);
  });
});
