/**
 * The `(input, step) => Scene` function for the verification demo (ADR-0004, plan §8).
 * Pure and deterministic. Every verdict is computed live by the real verification module
 * (`src/lib/verification/`) running its four gates — schema → value → grounding → policy —
 * over each candidate output, so the visual can never drift from the pipeline it teaches.
 *
 * The scenario: an AI support agent drafts a refund decision from a retrieved policy. The
 * walkthrough reveals one candidate output at a time and shows which gate catches it:
 *   • a clean output passes every gate and may proceed;
 *   • a malformed output is stopped at the SCHEMA gate;
 *   • a schema-valid output in the wrong currency is stopped at the VALUE gate;
 *   • an output citing a policy that was never retrieved is stopped at the GROUNDING gate;
 *   • an output leaking an internal-only note is stopped at the POLICY gate.
 * The final candidate is the honest limit: it passes ALL FOUR gates and is still wrong —
 * because a check only catches what it is written to catch, and no deterministic check
 * verifies that a decision actually follows from the policy. Green ≠ correct.
 */
import {
  groundingCheck,
  policyCheck,
  runChecks,
  schemaCheck,
  valueCheck,
  type Check,
  type CheckKind,
} from '../verification';
import { clampStep } from './timeline';

/** Minimal Zod-shaped validator for the demo schema, expressed without importing zod here
 * (the scene stays a thin data layer). It proves shape only — the point of the value gate
 * existing at all. */
const REFUND_DECISION_SCHEMA = {
  safeParse(data: unknown) {
    const issues: { path: (string | number)[]; message: string }[] = [];
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { success: false, error: { issues: [{ path: [], message: 'expected an object' }] } };
    }
    const obj = data as Record<string, unknown>;
    if (obj.decision !== 'approve' && obj.decision !== 'deny')
      issues.push({ path: ['decision'], message: "must be 'approve' or 'deny'" });
    if (typeof obj.amountUsd !== 'number' || obj.amountUsd < 0)
      issues.push({ path: ['amountUsd'], message: 'must be a non-negative number' });
    if (typeof obj.currency !== 'string') issues.push({ path: ['currency'], message: 'must be a string' });
    if (typeof obj.rationale !== 'string') issues.push({ path: ['rationale'], message: 'must be a string' });
    return issues.length === 0 ? { success: true } : { success: false, error: { issues } };
  },
};

/** The four gates of the demo pipeline, each built by reusing an existing mechanism. */
export const VERIFICATION_DEMO_CHECKS: readonly Check[] = [
  schemaCheck('shape: RefundDecision', REFUND_DECISION_SCHEMA),
  valueCheck('policy: refunds are USD only', {
    kind: 'json',
    requiredKeys: ['currency'],
    expectedValues: { currency: 'USD' },
  }),
  groundingCheck('grounding: rationale cites a retrieved policy', { field: 'rationale' }),
  policyCheck('guardrail: no internal-only notes leaked', {
    forbidden: [/internal[- ]only/i, /do not tell the customer/i],
  }),
];

/** Source ids a retriever actually returned — the grounding ground truth. */
const PROVIDED_SOURCE_IDS = ['refund-policy', 'shipping-policy'];

export interface VerificationCandidateInput {
  /** Short human label for what this candidate demonstrates. */
  label: string;
  /** The raw JSON the model produced. */
  text: string;
  /** True for the honest-limit candidate that passes every gate yet is wrong. */
  trap?: boolean;
}

export interface VerificationSceneInput {
  checks: readonly Check[];
  providedSourceIds: readonly string[];
  candidates: readonly VerificationCandidateInput[];
  /** One line explaining why the trap candidate is wrong despite a green pipeline. */
  trapNote: string;
}

export type GateStatus = 'pending' | 'passed' | 'failed' | 'skipped';

export interface VerificationGateView {
  kind: CheckKind;
  label: string;
  status: GateStatus;
  detail?: string;
  offending?: string[];
}

export interface VerificationCandidateView {
  label: string;
  text: string;
  revealed: boolean;
  gates: VerificationGateView[];
  verdict: 'pending' | 'proceeds' | 'blocked';
  /** Which gate kind stopped it, when blocked. */
  blockedAtKind?: CheckKind;
  /** Set on the final step for the candidate that passes every gate yet is still wrong. */
  trapExposed: boolean;
}

export interface VerificationScene {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  /** The gate lineup (kind + label), so the renderer can show the pipeline header. */
  gates: { kind: CheckKind; label: string }[];
  candidates: VerificationCandidateView[];
  /** How many candidates have had their verdict revealed. */
  checkedCount: number;
  /** Set on the final step. */
  limitNote?: string;
}

function pendingGates(checks: readonly Check[]): VerificationGateView[] {
  return checks.map((c) => ({ kind: c.kind, label: c.name, status: 'pending' as GateStatus }));
}

export function createVerificationScene(input: VerificationSceneInput, step: number): VerificationScene {
  const candidateCount = input.candidates.length;
  // step 0 = pipeline shown, nothing run; steps 1..N reveal each candidate's verdict.
  const totalSteps = candidateCount + 1;
  const current = clampStep(step, totalSteps);
  const revealedThrough = current; // candidates 0..current-1 are revealed
  const isLimitStep = current === totalSteps - 1;

  const candidates: VerificationCandidateView[] = input.candidates.map((cand, i) => {
    const revealed = i < revealedThrough;
    if (!revealed) {
      return {
        label: cand.label,
        text: cand.text,
        revealed: false,
        gates: pendingGates(input.checks),
        verdict: 'pending',
        trapExposed: false,
      };
    }
    const report = runChecks({ text: cand.text, providedSourceIds: input.providedSourceIds }, input.checks);
    const gates: VerificationGateView[] = report.results.map((r) => ({
      kind: r.kind,
      label: r.name,
      status: r.status,
      ...(r.detail ? { detail: r.detail } : {}),
      ...(r.offending ? { offending: r.offending } : {}),
    }));
    return {
      label: cand.label,
      text: cand.text,
      revealed: true,
      gates,
      verdict: report.mayProceed ? 'proceeds' : 'blocked',
      ...(report.failedAt ? { blockedAtKind: report.failedAt.kind } : {}),
      trapExposed: Boolean(cand.trap) && isLimitStep,
    };
  });

  let title: string;
  let description: string;
  if (current === 0) {
    title = 'A verification pipeline: four independent gates';
    description =
      'An AI support agent drafts a refund decision from a retrieved policy. Before we act on any output, it must clear four checks — schema, value, grounding, policy — each one deterministic code the model cannot talk its way past. Nothing has been run yet.';
  } else {
    const cand = input.candidates[current - 1]!;
    const report = runChecks({ text: cand.text, providedSourceIds: input.providedSourceIds }, input.checks);
    if (isLimitStep && cand.trap) {
      title = 'What every gate still misses';
      description = input.trapNote;
    } else if (report.mayProceed) {
      title = `“${cand.label}” — clears every gate`;
      description = 'Schema, value, grounding and policy all pass, so this output may proceed. That means it tripped no check — not that it is correct.';
    } else {
      const gate = report.failedAt!;
      title = `“${cand.label}” — blocked at the ${gate.kind} gate`;
      description = `The ${gate.kind} gate rejects it: ${gate.detail} The pipeline stops here — later gates never run, and the output is never acted on.`;
    }
  }

  return {
    step: current,
    totalSteps,
    title,
    description,
    gates: input.checks.map((c) => ({ kind: c.kind, label: c.name })),
    candidates,
    checkedCount: Math.min(revealedThrough, candidateCount),
    ...(isLimitStep ? { limitNote: input.trapNote } : {}),
  };
}

/**
 * Deterministic demo data. Each candidate is a raw JSON output; the checking is the real
 * pipeline. The last candidate is the honest limit — it passes all four gates yet is
 * wrong, because the true refund window is 14 days (so the correct decision was deny) and
 * no gate encodes that rule; the resolving citation does not actually support the claim.
 */
export const VERIFICATION_DEMO_INPUT: VerificationSceneInput = {
  checks: VERIFICATION_DEMO_CHECKS,
  providedSourceIds: PROVIDED_SOURCE_IDS,
  candidates: [
    {
      label: 'Clean approval',
      text: '{"decision":"approve","amountUsd":40,"currency":"USD","rationale":"The order is within the 30-day refund window [refund-policy]."}',
    },
    {
      label: 'Malformed output',
      text: '{"decision":"approve","rationale":"Approved for the customer [refund-policy]."}',
    },
    {
      label: 'Wrong currency',
      text: '{"decision":"approve","amountUsd":40,"currency":"EUR","rationale":"Refund approved [refund-policy]."}',
    },
    {
      label: 'Invented policy citation',
      text: '{"decision":"deny","amountUsd":0,"currency":"USD","rationale":"Refunds require a receipt within 14 days [refund-policy-2020]."}',
    },
    {
      label: 'Leaked internal note',
      text: '{"decision":"deny","amountUsd":0,"currency":"USD","rationale":"Deny this — internal-only: the customer is a known chargeback risk [refund-policy]."}',
    },
    {
      label: 'Plausible but wrong',
      trap: true,
      text: '{"decision":"approve","amountUsd":40,"currency":"USD","rationale":"The order is within the refund window [refund-policy]."}',
    },
  ],
  trapNote:
    'This output is schema-valid, in USD, cites a real retrieved policy, and leaks nothing — so all four gates pass and it may proceed. Yet it is wrong: the policy’s refund window is 14 days and this order was placed 45 days ago, so the correct decision was deny. No gate checks that the decision actually follows from the policy, and the citation merely resolves — it does not support the “within the window” claim. A green pipeline means the output tripped no check you wrote, never that it is correct. Open-ended correctness like this is not something a deterministic check can settle; that is the job of evaluation offline and a human reviewer for high-stakes calls.',
};
