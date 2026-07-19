import { describe, expect, it } from 'vitest';

import {
  CircuitBreaker,
  CircuitOpenError,
  ManualClock,
  seededRng,
  TimeoutError,
  withFallback,
  withRetry,
  withTimeout,
  type ResilienceEvent,
} from './patterns';

/** Collect events for assertions. */
function recorder() {
  const events: ResilienceEvent[] = [];
  return { onEvent: (e: ResilienceEvent) => events.push(e), events };
}

describe('ManualClock — deterministic virtual time', () => {
  it('advances now() to the target of each sleep, resolving the earliest first', async () => {
    const clock = new ManualClock();
    const order: number[] = [];
    const a = clock.sleep(300).then(() => order.push(clock.now()));
    const b = clock.sleep(100).then(() => order.push(clock.now()));
    await Promise.all([a, b]);
    // The 100ms sleep resolves before the 300ms one, and now() reflects virtual time.
    expect(order).toEqual([100, 300]);
    expect(clock.now()).toBe(300);
  });

  it('does not advance time on its own — only scheduled sleeps move the clock', async () => {
    const clock = new ManualClock();
    expect(clock.now()).toBe(0);
    await clock.sleep(0);
    expect(clock.now()).toBe(0);
  });
});

describe('seededRng — reproducible randomness', () => {
  it('produces the same sequence for the same seed, in [0, 1)', () => {
    const a = seededRng(1);
    const b = seededRng(1);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(seededRng(2)()).not.toBe(seededRng(1)());
  });
});

describe('withRetry — backoff + jitter, bounded', () => {
  it('returns the first success and stops retrying', async () => {
    const clock = new ManualClock();
    const { onEvent, events } = recorder();
    let calls = 0;
    const value = await withRetry(
      async (attempt) => {
        calls += 1;
        if (attempt < 3) throw new Error('transient');
        return 'ok';
      },
      { maxAttempts: 5, baseDelayMs: 100, clock, rng: seededRng(1), onEvent },
    );
    expect(value).toBe('ok');
    expect(calls).toBe(3);
    expect(events.filter((e) => e.kind === 'success')).toHaveLength(1);
    expect(events.filter((e) => e.kind === 'backoff')).toHaveLength(2); // two waits before attempt 3
  });

  it('backoff ceilings grow exponentially and the jittered delay never exceeds the ceiling', async () => {
    const clock = new ManualClock();
    const { onEvent, events } = recorder();
    await withRetry(async () => Promise.reject(new Error('always')), {
      maxAttempts: 4,
      baseDelayMs: 200,
      factor: 2,
      jitter: 'full',
      clock,
      rng: seededRng(7),
      onEvent,
    }).catch(() => undefined);
    const backoffs = events.filter((e) => e.kind === 'backoff') as Extract<ResilienceEvent, { kind: 'backoff' }>[];
    expect(backoffs.map((b) => b.ceilingMs)).toEqual([200, 400, 800]);
    for (const b of backoffs) {
      expect(b.delayMs).toBeGreaterThanOrEqual(0);
      expect(b.delayMs).toBeLessThanOrEqual(b.ceilingMs);
      expect(b.resumeAt).toBe(b.at + b.delayMs);
    }
  });

  it('honors maxDelayMs as a cap on the exponential ceiling', async () => {
    const clock = new ManualClock();
    const { onEvent, events } = recorder();
    await withRetry(async () => Promise.reject(new Error('x')), {
      maxAttempts: 5,
      baseDelayMs: 1000,
      factor: 10,
      maxDelayMs: 3000,
      jitter: 'none',
      clock,
      onEvent,
    }).catch(() => undefined);
    const ceilings = (events.filter((e) => e.kind === 'backoff') as Extract<ResilienceEvent, { kind: 'backoff' }>[]).map((b) => b.ceilingMs);
    expect(ceilings).toEqual([1000, 3000, 3000, 3000]); // 1000, 10000→cap, 100000→cap, ...
  });

  it('re-throws immediately on a non-retryable error without waiting', async () => {
    const clock = new ManualClock();
    const { onEvent, events } = recorder();
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('permanent');
        },
        { maxAttempts: 4, baseDelayMs: 100, retryable: () => false, clock, onEvent },
      ),
    ).rejects.toThrow('permanent');
    expect(calls).toBe(1);
    expect(events.filter((e) => e.kind === 'backoff')).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'giveup')).toHaveLength(1);
  });

  it('gives up after maxAttempts and re-throws the last error', async () => {
    const clock = new ManualClock();
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error(`fail-${calls}`);
        },
        { maxAttempts: 3, baseDelayMs: 10, clock, rng: seededRng(1) },
      ),
    ).rejects.toThrow('fail-3');
    expect(calls).toBe(3);
  });

  it('is deterministic under a seeded rng — identical runs, identical delays', async () => {
    const run = async () => {
      const { onEvent, events } = recorder();
      await withRetry(async () => Promise.reject(new Error('x')), {
        maxAttempts: 4,
        baseDelayMs: 250,
        clock: new ManualClock(),
        rng: seededRng(99),
        onEvent,
      }).catch(() => undefined);
      return (events.filter((e) => e.kind === 'backoff') as Extract<ResilienceEvent, { kind: 'backoff' }>[]).map((b) => b.delayMs);
    };
    expect(await run()).toEqual(await run());
  });
});

describe('withTimeout — bound a single call', () => {
  it('throws TimeoutError when the deadline passes before the op resolves', async () => {
    const clock = new ManualClock();
    const { onEvent, events } = recorder();
    const slow = async () => {
      await clock.sleep(5000);
      return 'late';
    };
    await expect(withTimeout(slow, { limitMs: 2000, clock, onEvent })).rejects.toBeInstanceOf(TimeoutError);
    const timeout = events.find((e) => e.kind === 'timeout') as Extract<ResilienceEvent, { kind: 'timeout' }>;
    expect(timeout.limitMs).toBe(2000);
    expect(timeout.at).toBe(2000);
  });

  it('returns the value when the op resolves before the deadline', async () => {
    const clock = new ManualClock();
    const fast = async () => {
      await clock.sleep(50);
      return 'quick';
    };
    await expect(withTimeout(fast, { limitMs: 2000, clock })).resolves.toBe('quick');
  });
});

describe('withFallback — degrade instead of fail', () => {
  it('returns the primary value when the primary succeeds (fallback untouched)', async () => {
    const clock = new ManualClock();
    let fallbackCalled = false;
    const value = await withFallback(
      async () => 'primary',
      async () => {
        fallbackCalled = true;
        return 'fallback';
      },
      { clock },
    );
    expect(value).toBe('primary');
    expect(fallbackCalled).toBe(false);
  });

  it('runs the fallback when the primary throws, and reports it', async () => {
    const clock = new ManualClock();
    const { onEvent, events } = recorder();
    const value = await withFallback(
      async () => {
        throw new Error('primary down');
      },
      async (err) => `fallback saw: ${(err as Error).message}`,
      { clock, onEvent },
    );
    expect(value).toBe('fallback saw: primary down');
    expect(events.find((e) => e.kind === 'fallback')).toBeDefined();
  });
});

describe('CircuitBreaker — closed / open / half-open', () => {
  const failing = async () => {
    throw new Error('dep down');
  };

  it('opens after the failure threshold and then fast-fails without calling the dependency', async () => {
    const clock = new ManualClock();
    const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000, clock });
    let realCalls = 0;
    const op = async () => {
      realCalls += 1;
      throw new Error('dep down');
    };
    for (let i = 0; i < 3; i += 1) await breaker.execute(op).catch(() => undefined);
    expect(breaker.getState()).toBe('open');
    expect(realCalls).toBe(3);

    // Now open: the next call is rejected WITHOUT touching the dependency.
    await expect(breaker.execute(op)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(realCalls).toBe(3); // unchanged — the dependency was protected
  });

  it('goes half-open after cooldown and closes on a successful trial', async () => {
    const clock = new ManualClock();
    const { onEvent, events } = recorder();
    let healthy = false;
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 500, clock, onEvent });
    const op = async () => {
      if (!healthy) throw new Error('dep down');
      return 'ok';
    };
    await breaker.execute(op).catch(() => undefined);
    await breaker.execute(op).catch(() => undefined);
    expect(breaker.getState()).toBe('open');

    healthy = true;
    await clock.sleep(500);
    await expect(breaker.execute(op)).resolves.toBe('ok');
    expect(breaker.getState()).toBe('closed');
    const transitions = events.filter((e) => e.kind === 'circuit-transition') as Extract<ResilienceEvent, { kind: 'circuit-transition' }>[];
    expect(transitions.map((t) => t.to)).toEqual(['open', 'half-open', 'closed']);
  });

  it('reopens if the half-open trial fails again', async () => {
    const clock = new ManualClock();
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 500, clock });
    await breaker.execute(failing).catch(() => undefined);
    await breaker.execute(failing).catch(() => undefined);
    expect(breaker.getState()).toBe('open');
    await clock.sleep(500);
    await breaker.execute(failing).catch(() => undefined); // trial fails
    expect(breaker.getState()).toBe('open');
  });

  it('a success in the closed state resets the consecutive-failure count', async () => {
    const clock = new ManualClock();
    let mode: 'fail' | 'ok' = 'fail';
    const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 500, clock });
    const op = async () => {
      if (mode === 'fail') throw new Error('x');
      return 'ok';
    };
    await breaker.execute(op).catch(() => undefined); // 1 failure
    await breaker.execute(op).catch(() => undefined); // 2 failures
    mode = 'ok';
    await breaker.execute(op); // success resets the counter
    mode = 'fail';
    await breaker.execute(op).catch(() => undefined); // 1 failure again
    expect(breaker.getState()).toBe('closed'); // never reached the threshold of 3 in a row
  });

  it('ignores errors the isFailure predicate rejects (a caller bug is not a dependency outage)', async () => {
    const clock = new ManualClock();
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      cooldownMs: 500,
      clock,
      isFailure: (err) => (err as Error).message !== 'bad-request',
    });
    const op = async () => {
      throw new Error('bad-request');
    };
    await breaker.execute(op).catch(() => undefined);
    await breaker.execute(op).catch(() => undefined);
    await breaker.execute(op).catch(() => undefined);
    expect(breaker.getState()).toBe('closed'); // 400s never trip the breaker
  });
});
