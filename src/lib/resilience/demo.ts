/**
 * Three concrete, deterministic reliability scenarios for the lesson's visual and its tests. Each
 * runs the REAL wrappers from `patterns.ts` against a scripted flaky operation under a fresh
 * `ManualClock` and a seeded rng, so the trace is exact and replayable — swap `systemClock` for the
 * manual clock and the very same code runs in production. Nothing here is a mock of the patterns;
 * the patterns are the thing under test, the operations are the fixtures.
 *
 *  RETRY            — a transient failure rides out backoff+jitter and succeeds. The LLM twist is
 *                     built in: the same prompt fails twice; the winning attempt sends a REPAIR
 *                     prompt, because retrying an identical prompt can fail identically.
 *  TIMEOUT+FALLBACK — a slow primary model trips its deadline, and the stack degrades gracefully to
 *                     a cheaper model. The answer is worse but the system stays usable.
 *  CIRCUIT          — a dependency is down; after N failures the breaker opens and fast-fails the
 *                     next calls (protecting the dependency), then a half-open trial finds it
 *                     recovered and closes again.
 */
import {
  CircuitBreaker,
  ManualClock,
  seededRng,
  withFallback,
  withRetry,
  withTimeout,
  type ResilienceEvent,
} from './patterns';

/** A failure a retry or a breaker could plausibly recover from (timeout, 503, rate limit, a
 * malformed response a repair prompt could fix). The retry predicate keys on this type. */
export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientError';
  }
}

const isTransient = (err: unknown) => err instanceof TransientError;

export type ScenarioId = 'retry' | 'timeout-fallback' | 'circuit';
export type OutcomeKind = 'recovered' | 'degraded' | 'protected';

export interface ScenarioTrace {
  readonly id: ScenarioId;
  readonly title: string;
  readonly subtitle: string;
  /** One-line description of how the scenario ended. */
  readonly outcome: string;
  readonly outcomeKind: OutcomeKind;
  /** The honest lesson — what this pattern bought and what it cost. */
  readonly takeaway: string;
  readonly events: readonly ResilienceEvent[];
}

/** Collect the event stream a scenario emits into an array — the trace the viz steps through. */
function record(): { sink: (e: ResilienceEvent) => void; events: ResilienceEvent[] } {
  const events: ResilienceEvent[] = [];
  return { sink: (e) => events.push(e), events };
}

// --- Scenario RETRY: transient failure + repair-prompt retry --------------------------------

/**
 * A structured-extraction call to a model. The model is briefly flaky: on the first two attempts it
 * wraps its JSON in prose (a malformed, but transient and fixable, failure). The retry loop backs
 * off, and on the third attempt the operation sends a REPAIR prompt — "return ONLY valid JSON" —
 * which parses. This is the LLM twist: retrying the identical prompt failed twice; changing the
 * prompt is what fixed it.
 */
export async function runRetryScenario(): Promise<ScenarioTrace> {
  const clock = new ManualClock();
  const rng = seededRng(42);
  const { sink, events } = record();

  const extract = async (attempt: number): Promise<string> => {
    if (attempt < 3) {
      throw new TransientError('malformed output: the model wrapped its JSON in prose');
    }
    // The winning attempt repaired the prompt rather than repeating it.
    return '{"sentiment":"positive"} — parsed after a repair-prompt retry';
  };

  await withRetry(extract, {
    maxAttempts: 3,
    baseDelayMs: 200,
    factor: 2,
    jitter: 'full',
    retryable: isTransient,
    clock,
    rng,
    onEvent: sink,
  });

  return {
    id: 'retry',
    title: 'Retry with backoff + jitter',
    subtitle: 'A transient failure that a retry can actually fix',
    outcome: 'Succeeded on attempt 3 after two backoffs',
    outcomeKind: 'recovered',
    takeaway:
      'Backoff spaces out retries so you do not hammer a struggling dependency; jitter de-correlates ' +
      'many clients so they do not all retry in lockstep. But a retry only helps a TRANSIENT failure — ' +
      'the same prompt failed twice identically, so the fix was a repair prompt, not another blind try. ' +
      'And every retry costs latency and tokens.',
    events,
  };
}

// --- Scenario TIMEOUT + FALLBACK: bound latency, then degrade gracefully --------------------

/**
 * A big, high-quality primary model that is running slow today (5s) behind a 2s deadline, with a
 * cheaper, faster model as the fallback. The timeout converts the hang into a fast failure; the
 * fallback trades answer quality for staying up.
 */
export async function runTimeoutFallbackScenario(): Promise<ScenarioTrace> {
  const clock = new ManualClock();
  const { sink, events } = record();

  const slowPrimaryModel = async (): Promise<string> => {
    await clock.sleep(5000); // the big model is overloaded today
    return 'primary-model answer (high quality)';
  };
  const cheaperModel = async (): Promise<string> => {
    await clock.sleep(300);
    return 'cheaper-model answer (good enough, lower quality)';
  };

  await withFallback(
    () => withTimeout(slowPrimaryModel, { limitMs: 2000, clock, onEvent: sink }),
    () => cheaperModel(),
    { clock, onEvent: sink },
  );

  return {
    id: 'timeout-fallback',
    title: 'Timeout → fallback',
    subtitle: 'Bound the wait, then degrade instead of failing',
    outcome: 'Primary timed out at 2000ms; served the cheaper model at 2300ms',
    outcomeKind: 'degraded',
    takeaway:
      'A timeout turns an unbounded hang into a fast, handleable failure; the fallback keeps the ' +
      'system usable by degrading to a cheaper answer. The catch is real: the fallback answer is ' +
      'worse, and if you do not OBSERVE how often it fires, quality can silently rot while every ' +
      'request still returns 200.',
    events,
  };
}

// --- Scenario CIRCUIT: stop hammering a dead dependency -------------------------------------

/**
 * A search dependency that is down and recovers at t = 4000ms. A breaker with a 3-failure threshold
 * and a 4000ms cooldown: three failures trip it OPEN, the next calls fast-fail without touching the
 * dependency, and after the cooldown a single HALF-OPEN trial finds it healthy and closes again.
 */
export async function runCircuitScenario(): Promise<ScenarioTrace> {
  const clock = new ManualClock();
  const { sink, events } = record();
  const recoverAt = 4000;

  const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 4000, clock, onEvent: sink });
  const searchApi = async (): Promise<string> => {
    if (clock.now() < recoverAt) throw new TransientError('search API returned 503 (dependency down)');
    return 'search results (dependency recovered)';
  };

  // Five calls while the dependency is down: 3 real failures trip the breaker, then 2 fast-fails.
  for (let i = 0; i < 5; i += 1) {
    try {
      await breaker.execute(searchApi);
    } catch {
      // Swallow — the trace already records failures and rejections; the loop just keeps calling.
    }
  }

  // Time passes; the dependency recovers. One more call goes half-open and finds it healthy.
  await clock.sleep(recoverAt);
  await breaker.execute(searchApi);

  return {
    id: 'circuit',
    title: 'Circuit breaker',
    subtitle: 'Fast-fail a dead dependency instead of piling on',
    outcome: 'Opened after 3 failures, fast-failed 2 calls, then closed on a healthy trial',
    outcomeKind: 'protected',
    takeaway:
      'When a dependency is durably down, retries make it worse — you turn an outage into a ' +
      'self-inflicted DDoS. A breaker fast-fails instead, giving the dependency room to recover and ' +
      'your callers an instant, cheap error instead of a pile of timeouts. The half-open trial is how ' +
      'it discovers recovery without a flood.',
    events,
  };
}

/** All three scenarios, in teaching order. Async because the wrappers are real (Promise-based); the
 * `ManualClock` makes each one resolve in virtual time with no real waiting. */
export async function runAllScenarios(): Promise<ScenarioTrace[]> {
  return [
    await runRetryScenario(),
    await runTimeoutFallbackScenario(),
    await runCircuitScenario(),
  ];
}
