/**
 * The evaluation build project (plan §3 L5 seed): a tiny, dependency-free eval harness.
 * You give it a SUBJECT (any `(input) => output` function — a prompt template, a parser,
 * or the ScriptedProvider from `src/lib/model/`) and a set of CASES, each pairing an
 * input with an ASSERTION about the expected output. It runs every case and returns a
 * scored report: which passed, which failed, and — the part that matters — *why* each
 * failure failed.
 *
 * The teaching payload lives in the `json` assertion: it separates SHAPE from VALUE.
 * An output can be valid JSON with all the right keys (shape) and still hold the wrong
 * value — `wrong-value`, not `wrong-shape`. That is the same "valid shape ≠ correct
 * value" lesson `structured-outputs` sets up, now made measurable: structured output
 * gets you a form you can parse; evaluation is how you learn the form was filled in
 * *correctly*. Everything here is pure and deterministic — no model calls, no clock.
 */

/** What we assert about a subject's output for one case. */
export type EvalAssertion =
  | { readonly kind: 'exact'; readonly expected: string }
  | { readonly kind: 'contains'; readonly needle: string }
  | {
      readonly kind: 'json';
      /** Keys that must be present — this is the SHAPE check. */
      readonly requiredKeys: readonly string[];
      /** Exact values that must match — this is the VALUE check (shape ≠ value). */
      readonly expectedValues?: Readonly<Record<string, unknown>>;
    };

export interface EvalCase<I = string> {
  readonly id: string;
  readonly input: I;
  /** Optional human note about what this case is probing. */
  readonly note?: string;
  readonly assertion: EvalAssertion;
}

/** Why a case failed — distinct reasons so a report is diagnostic, not just red/green. */
export type FailReason =
  | 'mismatch' // exact assertion: output differed
  | 'missing-substring' // contains assertion: needle absent
  | 'not-json' // json assertion: output did not parse
  | 'wrong-shape' // json assertion: parsed, but a required key is missing / not an object
  | 'wrong-value'; // json assertion: right shape, wrong value — the valid-but-wrong case

export interface CaseResult<I = string> {
  readonly id: string;
  readonly input: I;
  readonly output: string;
  readonly assertionKind: EvalAssertion['kind'];
  readonly pass: boolean;
  /** Present only on failure. */
  readonly failReason?: FailReason;
  /** Human-readable explanation of the pass/fail, safe to show in a UI. */
  readonly detail: string;
}

export interface EvalReport<I = string> {
  readonly results: readonly CaseResult<I>[];
  readonly passed: number;
  readonly total: number;
  /** Fraction passed, 0–1, rounded to two decimals. 0 for an empty suite. */
  readonly score: number;
}

/** The thing under test: turns an input into a single output string. Deterministic. */
export type Subject<I = string> = (input: I) => string;

interface Verdict {
  readonly pass: boolean;
  readonly failReason?: FailReason;
  readonly detail: string;
}

/** Score one output against one assertion. Pure; the whole judgment lives here. */
export function scoreAssertion(output: string, assertion: EvalAssertion): Verdict {
  switch (assertion.kind) {
    case 'exact':
      return output === assertion.expected
        ? { pass: true, detail: `exact match: "${output}"` }
        : {
            pass: false,
            failReason: 'mismatch',
            detail: `expected exactly "${assertion.expected}", got "${output}"`,
          };
    case 'contains':
      return output.includes(assertion.needle)
        ? { pass: true, detail: `output contains "${assertion.needle}"` }
        : {
            pass: false,
            failReason: 'missing-substring',
            detail: `expected output to contain "${assertion.needle}"`,
          };
    case 'json': {
      let parsed: unknown;
      try {
        parsed = JSON.parse(output);
      } catch {
        return { pass: false, failReason: 'not-json', detail: 'output is not valid JSON' };
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { pass: false, failReason: 'wrong-shape', detail: 'expected a JSON object' };
      }
      const obj = parsed as Record<string, unknown>;
      for (const key of assertion.requiredKeys) {
        if (!(key in obj)) {
          return {
            pass: false,
            failReason: 'wrong-shape',
            detail: `valid JSON, but missing required key "${key}"`,
          };
        }
      }
      if (assertion.expectedValues) {
        for (const [key, want] of Object.entries(assertion.expectedValues)) {
          if (obj[key] !== want) {
            return {
              pass: false,
              failReason: 'wrong-value',
              // The headline lesson: the shape is right, the value is wrong.
              detail: `valid shape, wrong value — key "${key}": expected ${JSON.stringify(
                want,
              )}, got ${JSON.stringify(obj[key])}`,
            };
          }
        }
      }
      return { pass: true, detail: 'valid shape and correct value(s)' };
    }
  }
}

/** Run a subject against a case set and return a scored, diagnostic report. */
export function runEval<I>(subject: Subject<I>, cases: readonly EvalCase<I>[]): EvalReport<I> {
  const results: CaseResult<I>[] = cases.map((c) => {
    const output = subject(c.input);
    const verdict = scoreAssertion(output, c.assertion);
    return {
      id: c.id,
      input: c.input,
      output,
      assertionKind: c.assertion.kind,
      pass: verdict.pass,
      ...(verdict.failReason ? { failReason: verdict.failReason } : {}),
      detail: verdict.detail,
    };
  });
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const score = total === 0 ? 0 : Math.round((passed / total) * 100) / 100;
  return { results, passed, total, score };
}
