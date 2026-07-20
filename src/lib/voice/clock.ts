/**
 * A minimal injectable clock (plan §3 L4, ADR-0005). The voice loop reads time from
 * this interface instead of `Date.now()`, so a test can supply a clock it fully
 * controls and every timestamp in a run becomes deterministic and asserted — the same
 * reason `src/lib/model` injects its provider and `src/lib/computer-use` injects its
 * world. A real voice runtime would back this with a monotonic wall clock; a lesson
 * backs it with arithmetic.
 *
 * The clock here is a *virtual* one: the loop never sleeps or waits on real audio. It
 * models a stage taking `n` ms by advancing the clock `n` ms. Timing is the whole point
 * of voice — so we make it a first-class, inspectable number rather than a real delay.
 */
export interface Clock {
  /** The current virtual time in milliseconds. */
  now(): number;
  /** Move time forward by `ms` (a modeled stage latency). Never backwards. */
  advance(ms: number): void;
}

/** A clock the caller drives by hand. Starts at `startMs` (default 0). */
export function createManualClock(startMs = 0): Clock {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      if (ms < 0) throw new Error(`a clock cannot advance backwards (got ${ms}ms)`);
      t += ms;
    },
  };
}
