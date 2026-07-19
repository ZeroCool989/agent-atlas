/**
 * The built-in checks a verification pipeline composes. The design rule here is REUSE,
 * not reinvention: each factory wraps a mechanism another lesson already teaches, so the
 * pipeline is literally the same code the learner met before, now run as an independent
 * gate over a candidate output.
 *
 *   schemaCheck   → structured-outputs' isolate-then-validate (Zod)   [kind: 'schema']
 *   valueCheck    → the eval harness assertion kinds (scoreAssertion) [kind: 'value']
 *   groundingCheck→ the reliability citation checker (checkCitations) [kind: 'grounding']
 *   policyCheck   → a deterministic guardrail (denylist scan)         [kind: 'policy']
 *   check         → a generic escape hatch for any custom predicate
 *
 * What each gate proves is deliberately narrow — that is the honest teaching point.
 * `schemaCheck` proves SHAPE, never value. `valueCheck` proves the specific value rule
 * you wrote, never "the answer is right". `groundingCheck` proves a citation RESOLVES to
 * a provided source, never that the source SUPPORTS the claim. `policyCheck` proves the
 * text does not contain banned content, never that it is correct. A green pipeline means
 * "tripped no check", not "correct".
 */
import { scoreAssertion, type EvalAssertion } from '../eval/harness';
import { checkCitations } from '../reliability/citation-check';
import { isolateJson } from '../structured';

import type { Candidate, Check, CheckKind, CheckOutcome } from './pipeline';

/** Minimal structural type for a validator (Zod's `safeParse`), so this file needs no
 * hard dependency beyond what `../structured` already pulls in. Kept loose (PropertyKey
 * paths, readonly arrays) so a real Zod schema is structurally assignable. */
export interface SafeParseIssue {
  path: ReadonlyArray<PropertyKey>;
  message: string;
}
export interface SafeParser {
  safeParse: (data: unknown) => {
    success: boolean;
    error?: { issues: ReadonlyArray<SafeParseIssue> };
  };
}

/** Isolate + parse a candidate's JSON the same way structured-outputs does. Returns the
 * parsed value, or an error string when the text is not JSON. Shared by the checks that
 * operate on a structured output. */
function parseCandidate(text: string): { value?: unknown; error?: string } {
  const isolated = isolateJson(text);
  try {
    return { value: JSON.parse(isolated.text) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * SCHEMA gate — reuses structured-outputs' pipeline: isolate the JSON, parse it, and
 * validate it against a schema. Proves the output has the right shape (keys, types), the
 * exact guarantee `structured-outputs` gives — and nothing about whether the values are
 * correct. Any Zod schema (or anything with `safeParse`) works.
 */
export function schemaCheck(name: string, schema: SafeParser): Check {
  return {
    name,
    kind: 'schema',
    run(candidate: Candidate): CheckOutcome {
      const parsed = parseCandidate(candidate.text);
      if (parsed.error) {
        return { passed: false, detail: `not valid JSON — ${parsed.error}`, offending: ['(unparseable)'] };
      }
      const result = schema.safeParse(parsed.value);
      if (result.success) return { passed: true, detail: 'matches the schema (shape and types)' };
      const issues = result.error?.issues ?? [];
      const offending = issues.map((i) => i.path.map(String).join('.') || '(root)');
      const detail = issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`).join('; ');
      return { passed: false, detail: `schema-invalid — ${detail}`, offending };
    },
  };
}

/**
 * VALUE gate — reuses the eval harness assertion kinds (`exact` / `contains` / `json`
 * with expected values). This is the semantic/constraint check: a value rule you can
 * state deterministically (an enum the field must be in, a currency the policy requires,
 * a substring that must appear). It is where a schema-valid-but-wrong output is caught —
 * the same "shape ≠ value" lesson evaluation makes, now applied inline per request.
 * It proves only the rule you encoded; it cannot know the one true answer.
 */
export function valueCheck(name: string, assertion: EvalAssertion): Check {
  return {
    name,
    kind: 'value',
    run(candidate: Candidate): CheckOutcome {
      const verdict = scoreAssertion(candidate.text, assertion);
      return verdict.pass
        ? { passed: true, detail: verdict.detail }
        : { passed: false, detail: verdict.detail, ...(verdict.failReason ? { offending: [verdict.failReason] } : {}) };
    },
  };
}

/**
 * GROUNDING gate — reuses the reliability citation checker. It reads the `[source-id]`
 * citations in a field of the output (default `rationale`) and resolves them against the
 * ids a retriever actually provided. Catches fabricated citations (an id never retrieved)
 * and uncited claims. Its documented limit is the concept in miniature: a citation that
 * RESOLVES is not a citation that SUPPORTS — resolution is necessary, not sufficient.
 */
export function groundingCheck(name: string, options?: { field?: string }): Check {
  const field = options?.field ?? 'rationale';
  return {
    name,
    kind: 'grounding',
    run(candidate: Candidate): CheckOutcome {
      const parsed = parseCandidate(candidate.text);
      const grounded =
        parsed.value && typeof parsed.value === 'object' && field in (parsed.value as Record<string, unknown>)
          ? String((parsed.value as Record<string, unknown>)[field])
          : candidate.text;
      const report = checkCitations(grounded, candidate.providedSourceIds ?? []);
      if (report.ok) return { passed: true, detail: 'every claim cites a source that was actually retrieved' };
      const offending = [...report.fabricatedCitations];
      const parts: string[] = [];
      if (report.fabricatedCitations.length > 0) parts.push(`fabricated citation(s): ${report.fabricatedCitations.join(', ')}`);
      if (report.uncitedClaims > 0) parts.push(`${report.uncitedClaims} uncited claim(s)`);
      return { passed: false, detail: `not grounded — ${parts.join('; ')}`, offending };
    },
  };
}

/**
 * POLICY gate — a deterministic guardrail. Guardrails enforce a POLICY on text (what is
 * allowed to be said / passed through), on the way in (user input) or the way out (model
 * output). This one scans for forbidden patterns and blocks on a match. Note what it does
 * and does not do: it can keep disallowed content out, but it says nothing about whether
 * the allowed content is correct — guardrails are about policy, not accuracy.
 */
export function policyCheck(name: string, options: { forbidden: readonly (string | RegExp)[] }): Check {
  return {
    name,
    kind: 'policy',
    run(candidate: Candidate): CheckOutcome {
      const hits: string[] = [];
      for (const pattern of options.forbidden) {
        const re = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
        const match = re.exec(candidate.text);
        if (match) hits.push(match[0]);
      }
      return hits.length === 0
        ? { passed: true, detail: 'no forbidden content found' }
        : { passed: false, detail: `policy violation — matched: ${hits.join(', ')}`, offending: hits };
    },
  };
}

/** Generic escape hatch: wrap any predicate as a check of a chosen kind. Useful for
 * cross-field invariants (a total equals the sum of line items) or range constraints. */
export function check(name: string, kind: CheckKind, fn: (candidate: Candidate) => CheckOutcome): Check {
  return { name, kind, run: fn };
}
