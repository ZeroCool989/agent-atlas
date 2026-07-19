/**
 * The scene builder for the Reliability-patterns Tier-2 visual (ADR-0004, plan §8). Pure data:
 * `buildResilienceScenes(traces) => ResilienceScene[]`, one beat per real event. It replays the
 * three scenarios of the build project (`src/lib/resilience/`) — a transient failure recovered by
 * backoff+retry, a slow call that times out and degrades to a fallback, and a dead dependency that
 * trips a circuit breaker and then recovers — stepping a request through the reliability stack.
 *
 * Every number the viz shows (attempt counts, backoff ceilings and jittered delays, the timeout
 * deadline, the fallback timestamp, the failure threshold, the cooldown) comes from the recorded
 * event trace, computed by the real wrappers under a deterministic clock. No invented numbers.
 *
 * The traces are produced asynchronously by the real Promise-based wrappers (`runAllScenarios`), so
 * the composition-root `.astro` awaits them at build time and hands the resulting plain-data array
 * to this pure builder — the same split the RAG viz uses. This module never touches a clock or a
 * promise; it only reshapes recorded events into render-ready beats.
 */
import type { CircuitState, ResilienceEvent } from '../resilience/patterns';
import type { OutcomeKind, ScenarioId, ScenarioTrace } from '../resilience/demo';

/** Colour/word tone for a beat — the renderer maps this to styles; never colour alone. */
export type BeatTone = 'neutral' | 'ok' | 'fail' | 'warn' | 'open' | 'half-open' | 'closed';

export interface ResilienceScene {
  readonly step: number;
  readonly totalSteps: number;

  // Which scenario this beat belongs to.
  readonly scenarioId: ScenarioId;
  readonly scenarioIndex: number;
  readonly scenarioCount: number;
  readonly scenarioTitle: string;
  readonly scenarioSubtitle: string;

  // The beat itself.
  readonly title: string;
  /** Teaching text; doubles as the accessible scene description. */
  readonly description: string;
  readonly event: ResilienceEvent;
  /** Virtual elapsed time at this event, in ms. */
  readonly elapsedMs: number;
  /** Short label + tone for the event log and badges. */
  readonly badge: string;
  readonly tone: BeatTone;

  // Running state reconstructed up to and including this beat.
  readonly attempt?: number;
  readonly circuitState?: CircuitState;

  readonly isScenarioStart: boolean;
  readonly isScenarioEnd: boolean;
  /** Present on the final beat of each scenario. */
  readonly outcome?: string;
  readonly outcomeKind?: OutcomeKind;
  readonly takeaway?: string;
}

interface BeatCopy {
  title: string;
  description: string;
  badge: string;
  tone: BeatTone;
}

/** Turn one recorded event into teaching copy, using only numbers the event carries. */
function describe(event: ResilienceEvent, scenarioId: ScenarioId): BeatCopy {
  switch (event.kind) {
    case 'call': {
      if (event.wrapper === 'timeout') {
        return {
          title: 'Call the primary, with a deadline',
          description: `Calling the primary model with a ${event.note} — a timeout bounds how long we are willing to wait and how much a single request can cost.`,
          badge: 'call',
          tone: 'neutral',
        };
      }
      if (event.wrapper === 'circuit') {
        return {
          title: `Call ${event.attempt} — breaker ${event.note.replace('state: ', '')}`,
          description: `The breaker is ${event.note.replace('state: ', '')}, so the call is allowed through to the dependency.`,
          badge: 'call',
          tone: 'neutral',
        };
      }
      // retry
      if (event.attempt === 1) {
        return { title: 'First attempt', description: 'The first call to the model.', badge: 'call', tone: 'neutral' };
      }
      return {
        title: `Retry ${event.attempt - 1}`,
        description:
          scenarioId === 'retry' && event.attempt >= 3
            ? 'Retrying — but the same prompt already failed twice, so this attempt sends a REPAIR prompt ("return only valid JSON") instead of blindly repeating itself. Retrying an identical prompt can fail identically.'
            : 'Retrying the call after backing off.',
        badge: 'retry',
        tone: 'neutral',
      };
    }
    case 'failure':
      return {
        title: `Attempt ${event.attempt} failed`,
        description: `${event.error}. ${event.retryable ? 'This is a transient failure, so a retry may recover it.' : 'This is not retryable — retrying would just waste time and money.'}`,
        badge: 'fail',
        tone: 'fail',
      };
    case 'backoff':
      return {
        title: `Back off ${event.delayMs}ms before the retry`,
        description: `Exponential backoff caps this wait at ${event.ceilingMs}ms; full jitter picks an actual delay of ${event.delayMs}ms inside that. Jitter matters: without it, many clients retry in lockstep and hammer the dependency in synchronised waves.`,
        badge: 'backoff',
        tone: 'warn',
      };
    case 'success': {
      if (event.wrapper === 'fallback') {
        return {
          title: `Fallback answered at ${event.at}ms`,
          description: `The cheaper model returned: "${event.value}". The system stayed usable — but this answer is lower quality, so you must track how often the fallback fires, or quality rots silently.`,
          badge: 'fallback ok',
          tone: 'warn',
        };
      }
      if (event.wrapper === 'circuit') {
        return {
          title: 'Trial call succeeded',
          description: `The half-open trial returned: "${event.value}". The dependency is healthy again.`,
          badge: 'success',
          tone: 'ok',
        };
      }
      return {
        title: `Attempt ${event.attempt} succeeded`,
        description: `The call returned: "${event.value}".`,
        badge: 'success',
        tone: 'ok',
      };
    }
    case 'giveup':
      return {
        title: `Gave up after ${event.attempts} attempts`,
        description: `${event.error}. Retries are bounded — you fail honestly rather than loop forever.`,
        badge: 'give up',
        tone: 'fail',
      };
    case 'timeout':
      return {
        title: `Deadline hit at ${event.limitMs}ms`,
        description: `The primary did not answer within ${event.limitMs}ms, so the timeout aborts the wait and raises a fast, handleable failure instead of hanging. (JavaScript can't truly cancel the slow call — the timeout bounds how long we WAIT, not how long the dependency works.)`,
        badge: 'timeout',
        tone: 'warn',
      };
    case 'fallback':
      return {
        title: 'Primary failed → fall back',
        description: `Primary failed (${event.reason}). Fall back to the cheaper model — a partial or lower-quality answer beats a hard failure.`,
        badge: 'fallback',
        tone: 'warn',
      };
    case 'circuit-transition': {
      const tone: BeatTone = event.to === 'open' ? 'open' : event.to === 'half-open' ? 'half-open' : 'closed';
      const verb = event.to === 'open' ? 'OPENS' : event.to === 'half-open' ? 'goes HALF-OPEN' : 'CLOSES';
      return {
        title: `Breaker ${verb}`,
        description: `${event.reason}. ${
          event.to === 'open'
            ? 'While open, calls fast-fail instantly instead of piling more load onto a struggling dependency.'
            : event.to === 'half-open'
              ? 'One trial call is allowed through to test whether the dependency has recovered.'
              : 'Normal operation resumes.'
        }`,
        badge: event.to,
        tone,
      };
    }
    case 'circuit-rejected':
      return {
        title: 'Fast-fail — breaker is open',
        description: `The breaker is open, so this call is rejected instantly (about ${event.retryAfterMs}ms until a trial) WITHOUT touching the dependency. The caller gets a cheap, immediate error instead of waiting for another timeout.`,
        badge: 'fast-fail',
        tone: 'open',
      };
  }
}

/** Fold the events of one scenario into render-ready beats, tracking attempt and circuit state. */
function scenesForScenario(trace: ScenarioTrace): Omit<ResilienceScene, 'step' | 'totalSteps' | 'scenarioIndex' | 'scenarioCount'>[] {
  let attempt: number | undefined;
  let circuitState: CircuitState | undefined = trace.id === 'circuit' ? 'closed' : undefined;

  return trace.events.map((event, i) => {
    if ('attempt' in event) attempt = event.attempt;
    if (event.kind === 'circuit-transition') circuitState = event.to;

    const copy = describe(event, trace.id);
    const isEnd = i === trace.events.length - 1;
    return {
      scenarioId: trace.id,
      scenarioTitle: trace.title,
      scenarioSubtitle: trace.subtitle,
      title: copy.title,
      description: copy.description,
      event,
      elapsedMs: event.at,
      badge: copy.badge,
      tone: copy.tone,
      ...(attempt !== undefined ? { attempt } : {}),
      ...(circuitState !== undefined ? { circuitState } : {}),
      isScenarioStart: i === 0,
      isScenarioEnd: isEnd,
      ...(isEnd ? { outcome: trace.outcome, outcomeKind: trace.outcomeKind, takeaway: trace.takeaway } : {}),
    };
  });
}

/**
 * Flatten the three scenario traces into one stepped walkthrough. The learner scrubs a single
 * request through the whole reliability stack: retry+backoff → timeout+fallback → circuit breaker.
 */
export function buildResilienceScenes(traces: readonly ScenarioTrace[]): ResilienceScene[] {
  const grouped = traces.map((t) => scenesForScenario(t));
  const totalSteps = grouped.reduce((n, g) => n + g.length, 0);
  const scenarioCount = traces.length;

  const scenes: ResilienceScene[] = [];
  let step = 0;
  grouped.forEach((group, scenarioIndex) => {
    for (const beat of group) {
      scenes.push({ ...beat, step, totalSteps, scenarioIndex, scenarioCount });
      step += 1;
    }
  });
  return scenes;
}
