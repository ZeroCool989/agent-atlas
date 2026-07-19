/**
 * Verification — the L3/L5 "reliable agent" build project (plan §2 autonomy spectrum:
 * "reliable agent = stateful + verification, retries, guardrails, evals, observability").
 *
 * A verification pipeline is a set of INDEPENDENT, deterministic checks you run over a
 * candidate model output BEFORE you trust it or act on it. Each check is model-free code
 * the model cannot talk its way past — that independence is the whole point, and what
 * separates verification from reflection (the model critiquing itself, which shares the
 * model's blind spots) and from evaluation (offline, aggregate measurement over a fixed
 * set — verification is inline and per-request).
 *
 * This file is the composition layer: the `Check` shape, and `runChecks`, which runs
 * checks in order as GATES and stops at the first failure — the output "may proceed" only
 * if every gate passes. The concrete checks live in `checks.ts` and are deliberately
 * built by REUSING the pieces other lessons already teach (structured-outputs' schema
 * validation, the eval assertion kinds, the reliability citation checker) rather than
 * duplicating them — verification is the pattern that generalizes all of them.
 *
 * The honest limit, load-bearing and stated up front: a passing pipeline does NOT mean
 * the output is correct. It means the output did not trip any check you wrote — and a
 * check only ever catches the specific failure it tests for. Open-ended correctness is
 * not deterministically verifiable; see the `verification-scene` trap and the lesson.
 */

/** The kind of guarantee a check provides — drives how the visual groups the gates. */
export type CheckKind = 'schema' | 'value' | 'grounding' | 'policy';

/** What one check needs to judge an output. Built-in checks read `text` (the raw model
 * output, usually JSON) and `providedSourceIds` (what a retriever actually returned, the
 * ground truth a grounding check resolves citations against). */
export interface Candidate {
  /** The raw output the model produced. */
  text: string;
  /** Source ids actually provided to the model — grounding ground truth. */
  providedSourceIds?: readonly string[];
}

/** The verdict one check returns for one candidate. Deterministic; no model involved. */
export interface CheckOutcome {
  passed: boolean;
  /** Human-readable why, safe to show in a UI. */
  detail: string;
  /** On failure, the specific things that tripped the check (fabricated ids, banned
   * terms, failing field paths) — the diagnostic payload. */
  offending?: string[];
}

/** A composable, independent check. `run` is pure over the candidate. */
export interface Check {
  /** Human label shown as the gate name (e.g. "shape: RefundDecision"). */
  name: string;
  kind: CheckKind;
  run: (candidate: Candidate) => CheckOutcome;
}

/** Whether a gate ran and what it decided. `skipped` = an earlier gate already failed,
 * so this one never ran (fail-fast) — distinct from `failed`, which is a real rejection. */
export type CheckStatus = 'passed' | 'failed' | 'skipped';

export interface CheckResult {
  name: string;
  kind: CheckKind;
  status: CheckStatus;
  detail: string;
  offending?: string[];
}

export interface VerificationReport {
  /** One result per check, in pipeline order. */
  results: CheckResult[];
  /** The first failing gate — where a fail-fast pipeline rejects the output. */
  failedAt?: CheckResult;
  /** True only when every check passed. */
  passed: boolean;
  /** Whether the output may be trusted / acted on. Equal to `passed` — named separately
   * because "may proceed" is the decision the caller actually consumes. */
  mayProceed: boolean;
}

/**
 * Run `checks` over a `candidate` as an ordered pipeline of gates. Stops at the first
 * failure (a real guardrail rejects before wasting downstream work and before acting);
 * gates after the failure are reported `skipped`, never silently dropped. Pure and
 * deterministic — the same candidate always yields the same report.
 *
 * A production system may instead run every check to collect a full failure list; the
 * gate/stop-at-first model here is the one that matches "verify before you act", and it
 * keeps the honest lesson visible: passing means "tripped no check", not "is correct".
 */
export function runChecks(candidate: Candidate, checks: readonly Check[]): VerificationReport {
  const results: CheckResult[] = [];
  let failedAt: CheckResult | undefined;

  for (const check of checks) {
    if (failedAt) {
      results.push({
        name: check.name,
        kind: check.kind,
        status: 'skipped',
        detail: 'not run — an earlier gate already rejected the output',
      });
      continue;
    }
    const outcome = check.run(candidate);
    const result: CheckResult = {
      name: check.name,
      kind: check.kind,
      status: outcome.passed ? 'passed' : 'failed',
      detail: outcome.detail,
      ...(outcome.offending && outcome.offending.length > 0 ? { offending: outcome.offending } : {}),
    };
    results.push(result);
    if (!outcome.passed) failedAt = result;
  }

  const passed = !failedAt;
  return {
    results,
    ...(failedAt ? { failedAt } : {}),
    passed,
    mayProceed: passed,
  };
}
