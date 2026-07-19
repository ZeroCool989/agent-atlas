/**
 * Reliability patterns — the smallest honest versions of the classic distributed-systems
 * techniques, adapted to LLM apps (plan §3 L5 "reliability patterns", ADR-0005). Models and
 * tools fail *probabilistically*: timeouts, rate limits, malformed output, bad tool results.
 * You cannot make the failures go away; you build patterns AROUND the call so the system stays
 * usable despite them. This module implements four composable wrappers plus a circuit breaker:
 *
 *   withRetry     — re-attempt a transient failure with exponential backoff + jitter.
 *   withTimeout   — bound how long a single call may take (latency and cost budget).
 *   withFallback  — when the primary fails, serve a cheaper/cached/degraded answer instead.
 *   CircuitBreaker — stop hammering a dependency that is already down (fast-fail).
 *
 * Two design choices make the whole thing teachable and testable:
 *
 *  1. **Time is injected** (`Clock`). Backoff sleeps and timeouts go through `clock.sleep`, so a
 *     `ManualClock` replays the exact same code with virtual time — deterministic, no real
 *     waiting, exact assertions. Production passes `systemClock`; nothing else changes.
 *  2. **Randomness is injected** (`rng`). Jitter needs randomness to actually spread retries; a
 *     seeded rng makes the demo's delays reproducible while the production default is `Math.random`.
 *
 * The honest limits this module refuses to hide (see the lesson):
 *  - A retry costs money and latency, and a retry with the *same* prompt may fail the same way —
 *    sometimes you must retry with a REPAIR prompt, not just try again (the LLM twist).
 *  - Retrying a side-effecting operation repeats the side effect. Retries are only safe on
 *    IDEMPOTENT operations; a non-idempotent action needs an idempotency key, not a blind retry.
 *  - A fallback can silently serve a worse answer — you only know it fired if you OBSERVE it,
 *    which is why every wrapper emits structured events for a trace (ties to observability).
 */

/** A source of time. `systemClock` in production; `ManualClock` in tests and the demo. Injecting
 * it is what makes backoff and timeouts deterministic without real waiting. */
export interface Clock {
  /** Current time in milliseconds (virtual or wall-clock). */
  now(): number;
  /** Resolves after `ms` of (virtual or real) time. */
  sleep(ms: number): Promise<void>;
}

/** A random source in [0, 1). Injected so jitter is reproducible in tests; defaults to Math.random. */
export type Rng = () => number;

/** Real time. Never used by tests — the whole point of injecting `Clock` is to avoid it there. */
export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * A deterministic virtual clock. `sleep` does not wait — it schedules against a virtual timeline
 * and the clock advances to the next due timer, resolving the EARLIEST sleep first. Because every
 * wait in this module goes through `sleep`, a `ManualClock` replays retries, backoff, and timeouts
 * in exact virtual time with zero real delay. `Promise.race` in `withTimeout` settles correctly:
 * the shorter virtual sleep resolves first.
 *
 * The drain runs on a macrotask (`setTimeout(…, 0)`), not a microtask, on purpose: a macrotask
 * fires only after the microtask queue is fully drained, so every promise continuation logically
 * happening "at time T" (a resolved sleep, its `.then`, the awaiting code that reads `now()`) runs
 * BEFORE the clock advances to the next timer. That keeps event timestamps exact.
 */
export class ManualClock implements Clock {
  private t = 0;
  private seq = 0;
  private pending: Array<{ at: number; seq: number; resolve: () => void }> = [];
  private draining = false;

  now(): number {
    return this.t;
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pending.push({ at: this.t + Math.max(0, ms), seq: this.seq++, resolve });
      this.scheduleDrain();
    });
  }

  /** Advance one timer per macrotask turn. Firing on a macrotask lets all currently-runnable
   * promise work (and any newly scheduled, possibly-earlier sleeps) settle before the next timer,
   * so virtual time only moves when nothing else can run at the current instant. */
  private scheduleDrain(): void {
    if (this.draining) return;
    this.draining = true;
    setTimeout(() => {
      this.draining = false;
      if (this.pending.length === 0) return;
      this.pending.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = this.pending.shift()!;
      this.t = Math.max(this.t, next.at);
      next.resolve();
      this.scheduleDrain();
    }, 0);
  }
}

/** A small, seedable linear-congruential rng so the demo's jitter is reproducible (Numerical
 * Recipes constants). Not cryptographic — it only needs to be deterministic and well-spread. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// --- errors ---------------------------------------------------------------------------------

/** Thrown by `withTimeout` when the deadline passes before the operation resolves. */
export class TimeoutError extends Error {
  constructor(public readonly limitMs: number) {
    super(`operation exceeded its ${limitMs}ms timeout`);
    this.name = 'TimeoutError';
  }
}

/** Thrown by an OPEN `CircuitBreaker` — the call is rejected WITHOUT touching the dependency. */
export class CircuitOpenError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`circuit is open; retry after ~${retryAfterMs}ms`);
    this.name = 'CircuitOpenError';
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// --- observability: every wrapper emits structured events ------------------------------------

export type Wrapper = 'retry' | 'timeout' | 'fallback' | 'circuit';
export type CircuitState = 'closed' | 'open' | 'half-open';

/** The trace a reliability stack produces. You need these events to know WHAT was retried, WHY a
 * fallback fired, and WHEN a breaker opened — the pattern is only observable if it says so. */
export type ResilienceEvent =
  /** A call is about to be attempted. */
  | { readonly kind: 'call'; readonly wrapper: Wrapper; readonly attempt: number; readonly at: number; readonly note: string }
  /** A call returned a value. */
  | { readonly kind: 'success'; readonly wrapper: Wrapper; readonly attempt: number; readonly at: number; readonly value: string }
  /** A call threw. `retryable` reflects the retry predicate's verdict. */
  | { readonly kind: 'failure'; readonly wrapper: Wrapper; readonly attempt: number; readonly at: number; readonly error: string; readonly retryable: boolean }
  /** Waiting before the next retry. `ceilingMs` is the exponential cap; `delayMs` is after jitter. */
  | { readonly kind: 'backoff'; readonly attempt: number; readonly at: number; readonly ceilingMs: number; readonly delayMs: number; readonly resumeAt: number }
  /** Retries exhausted (or a non-retryable error) — the error is re-thrown to the caller. */
  | { readonly kind: 'giveup'; readonly wrapper: 'retry'; readonly attempts: number; readonly at: number; readonly error: string }
  /** The deadline tripped before the operation resolved. */
  | { readonly kind: 'timeout'; readonly at: number; readonly limitMs: number }
  /** The primary failed; the fallback is being used instead. */
  | { readonly kind: 'fallback'; readonly at: number; readonly reason: string }
  /** The breaker changed state. */
  | { readonly kind: 'circuit-transition'; readonly at: number; readonly from: CircuitState; readonly to: CircuitState; readonly reason: string }
  /** An OPEN breaker fast-failed a call without touching the dependency. */
  | { readonly kind: 'circuit-rejected'; readonly at: number; readonly retryAfterMs: number };

export type EventSink = (event: ResilienceEvent) => void;

// --- withRetry ------------------------------------------------------------------------------

/** The operation a retry wraps. It receives the 1-based `attempt` number, so it can send a
 * REPAIR prompt on a retry instead of blindly re-sending the same one (the LLM twist). */
export type RetryableOperation<T> = (attempt: number) => Promise<T>;

export type JitterMode = 'none' | 'full' | 'equal';

export interface RetryOptions {
  /** Total attempts, including the first. `maxAttempts: 3` = one call + two retries. */
  readonly maxAttempts: number;
  /** Delay before the first retry; doubles (× `factor`) each subsequent retry. */
  readonly baseDelayMs: number;
  /** Multiplier per retry. Default 2 (exponential). */
  readonly factor?: number;
  /** Cap on the exponential delay before jitter. Default 30_000ms — unbounded backoff is a bug. */
  readonly maxDelayMs?: number;
  /** How to spread the delay. 'full' = uniform(0, ceiling) — the AWS-recommended default: it
   * de-correlates clients so a rate-limited swarm doesn't retry in lockstep. */
  readonly jitter?: JitterMode;
  /** Which errors are worth retrying. Default: all. Retrying a non-transient error (a 400, a
   * validation failure) just wastes time and money — only retry what a retry could fix. */
  readonly retryable?: (error: unknown) => boolean;
  readonly clock: Clock;
  readonly rng?: Rng;
  readonly onEvent?: EventSink;
}

function applyJitter(ceilingMs: number, mode: JitterMode, rng: Rng): number {
  switch (mode) {
    case 'none':
      return ceilingMs;
    // Keep half the delay fixed, jitter the other half — less spread, guarantees a minimum wait.
    case 'equal':
      return ceilingMs / 2 + rng() * (ceilingMs / 2);
    // Full jitter: anywhere in [0, ceiling]. Maximum de-correlation across clients.
    case 'full':
    default:
      return rng() * ceilingMs;
  }
}

/**
 * Re-attempt a transient failure with exponential backoff + jitter, bounded by `maxAttempts`.
 * Returns the first success; re-throws the last error if every attempt fails or an error is
 * non-retryable. Deterministic given a deterministic `clock` and `rng`.
 *
 * The load-bearing honesty: a retry only helps a TRANSIENT failure (a timeout, a rate limit, a
 * 503). It cannot fix a deterministic one — the same prompt hitting the same bug fails the same
 * way. That is what `retryable` and the repair-prompt `attempt` argument are for.
 */
export async function withRetry<T>(op: RetryableOperation<T>, options: RetryOptions): Promise<T> {
  const {
    maxAttempts,
    baseDelayMs,
    factor = 2,
    maxDelayMs = 30_000,
    jitter = 'full',
    retryable = () => true,
    clock,
    rng = Math.random,
    onEvent,
  } = options;

  let lastError: unknown;
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    onEvent?.({
      kind: 'call',
      wrapper: 'retry',
      attempt,
      at: clock.now(),
      note: attempt === 1 ? 'first attempt' : `retry ${attempt - 1}`,
    });
    try {
      const value = await op(attempt);
      onEvent?.({ kind: 'success', wrapper: 'retry', attempt, at: clock.now(), value: String(value) });
      return value;
    } catch (err) {
      lastError = err;
      const canRetry = retryable(err);
      onEvent?.({
        kind: 'failure',
        wrapper: 'retry',
        attempt,
        at: clock.now(),
        error: errorMessage(err),
        retryable: canRetry,
      });
      if (!canRetry || attempt >= maxAttempts) break;

      const ceiling = Math.min(maxDelayMs, baseDelayMs * factor ** (attempt - 1));
      const delay = Math.round(applyJitter(ceiling, jitter, rng));
      const start = clock.now();
      onEvent?.({
        kind: 'backoff',
        attempt,
        at: start,
        ceilingMs: Math.round(ceiling),
        delayMs: delay,
        resumeAt: start + delay,
      });
      await clock.sleep(delay);
    }
  }

  onEvent?.({ kind: 'giveup', wrapper: 'retry', attempts: attempt, at: clock.now(), error: errorMessage(lastError) });
  throw lastError;
}

// --- withTimeout ----------------------------------------------------------------------------

export interface TimeoutOptions {
  readonly limitMs: number;
  readonly clock: Clock;
  readonly onEvent?: EventSink;
}

const TIMED_OUT = Symbol('timed-out');

/**
 * Bound a single call to `limitMs`. If the deadline passes first, throw `TimeoutError`; the slow
 * operation is abandoned (its result is ignored if it ever resolves). A timeout is how you turn an
 * unbounded hang into a fast, handleable failure — the thing a fallback or retry can react to.
 *
 * Note the honest caveat baked into the shape: JavaScript can't truly cancel a running promise, so
 * the abandoned work still completes in the background. `withTimeout` bounds how long you WAIT, not
 * how long the dependency works — real cancellation needs an AbortSignal the operation respects.
 */
export async function withTimeout<T>(op: () => Promise<T>, options: TimeoutOptions): Promise<T> {
  const { limitMs, clock, onEvent } = options;
  onEvent?.({ kind: 'call', wrapper: 'timeout', attempt: 1, at: clock.now(), note: `budget ${limitMs}ms` });

  const deadline = clock.sleep(limitMs).then(() => TIMED_OUT);
  const result = await Promise.race([op(), deadline]);
  if (result === TIMED_OUT) {
    onEvent?.({ kind: 'timeout', at: clock.now(), limitMs });
    throw new TimeoutError(limitMs);
  }
  onEvent?.({ kind: 'success', wrapper: 'timeout', attempt: 1, at: clock.now(), value: String(result) });
  return result as T;
}

// --- withFallback ---------------------------------------------------------------------------

export interface FallbackOptions {
  readonly clock: Clock;
  readonly onEvent?: EventSink;
}

/**
 * Try `primary`; if it throws, run `fallback` instead. The fallback is the graceful-degradation
 * move: a cheaper/smaller model, a cached answer, or a partial result that beats a hard failure.
 * The fallback receives the primary's error, so it can decide how far to degrade.
 *
 * The cost this hides on purpose, so the lesson can name it: a fallback can silently serve a WORSE
 * answer. Success here means "we returned something", not "we returned the good answer" — which is
 * exactly why the `fallback` event exists, so a trace shows how often you're running on the backup.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: (error: unknown) => Promise<T>,
  options: FallbackOptions,
): Promise<T> {
  const { clock, onEvent } = options;
  try {
    return await primary();
  } catch (err) {
    onEvent?.({ kind: 'fallback', at: clock.now(), reason: errorMessage(err) });
    const value = await fallback(err);
    onEvent?.({ kind: 'success', wrapper: 'fallback', attempt: 1, at: clock.now(), value: String(value) });
    return value;
  }
}

// --- CircuitBreaker -------------------------------------------------------------------------

export interface CircuitBreakerOptions {
  /** Consecutive failures in the CLOSED state that trip the breaker OPEN. */
  readonly failureThreshold: number;
  /** How long to stay OPEN before allowing a single HALF-OPEN trial call. */
  readonly cooldownMs: number;
  readonly clock: Clock;
  /** Whether an error counts as a failure for the breaker. Default: all do. A 400 (your bug) and a
   * 503 (their outage) are both errors, but only the outage should be tripping the breaker. */
  readonly isFailure?: (error: unknown) => boolean;
  readonly onEvent?: EventSink;
}

/**
 * A tiny three-state circuit breaker. CLOSED: calls pass through and consecutive failures are
 * counted; at the threshold it trips OPEN. OPEN: calls fast-fail WITHOUT touching the dependency —
 * this is the whole point, you stop piling load onto something already down and you fail fast
 * instead of making every caller wait for a timeout. After `cooldownMs`, one HALF-OPEN trial is
 * allowed: success closes the breaker (dependency recovered), failure re-opens it.
 *
 * Retries and a breaker are complementary and easy to confuse: a retry rides out a BLIP for one
 * request; a breaker protects the SYSTEM when a dependency is durably down, so retries don't turn
 * an outage into a self-inflicted DDoS.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private calls = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  getState(): CircuitState {
    return this.state;
  }

  async execute<T>(op: () => Promise<T>): Promise<T> {
    const { clock, cooldownMs, onEvent } = this.options;

    if (this.state === 'open') {
      const elapsed = clock.now() - this.openedAt;
      if (elapsed < cooldownMs) {
        const retryAfterMs = cooldownMs - elapsed;
        onEvent?.({ kind: 'circuit-rejected', at: clock.now(), retryAfterMs });
        throw new CircuitOpenError(retryAfterMs);
      }
      this.transition('half-open', 'cooldown elapsed — allow one trial call');
    }

    this.calls += 1;
    onEvent?.({ kind: 'call', wrapper: 'circuit', attempt: this.calls, at: clock.now(), note: `state: ${this.state}` });
    try {
      const value = await op();
      onEvent?.({ kind: 'success', wrapper: 'circuit', attempt: this.calls, at: clock.now(), value: String(value) });
      this.onSuccess();
      return value;
    } catch (err) {
      const counts = this.options.isFailure?.(err) ?? true;
      onEvent?.({
        kind: 'failure',
        wrapper: 'circuit',
        attempt: this.calls,
        at: clock.now(),
        error: errorMessage(err),
        retryable: counts,
      });
      if (counts) this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.transition('closed', 'trial call succeeded — dependency healthy again');
    }
    this.consecutiveFailures = 0;
  }

  private onFailure(): void {
    if (this.state === 'half-open') {
      this.openedAt = this.options.clock.now();
      this.transition('open', 'trial call failed — dependency still down, stay open');
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.openedAt = this.options.clock.now();
      this.transition(
        'open',
        `${this.consecutiveFailures} consecutive failures — stop hammering the dependency`,
      );
    }
  }

  private transition(to: CircuitState, reason: string): void {
    const from = this.state;
    this.state = to;
    this.options.onEvent?.({ kind: 'circuit-transition', at: this.options.clock.now(), from, to, reason });
  }
}
