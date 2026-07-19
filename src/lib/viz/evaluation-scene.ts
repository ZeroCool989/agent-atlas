/**
 * The `(input, step) => Scene` function for the evaluation demo (ADR-0004, plan §8).
 * Pure and deterministic. It runs a small eval SUITE against a deliberately-buggy SUBJECT
 * through the real harness (`src/lib/eval/harness.ts`) and reveals the scoring one case at
 * a time: each case passes or fails with a reason, then the aggregate score lands.
 *
 * The pivotal step is the "valid-but-wrong" case — output that is valid JSON with the
 * right key yet the wrong value. A schema validator would wave it through; the eval
 * catches it. That is the whole reason evaluation is its own concept: structured output
 * guarantees a form's SHAPE, evaluation is how you learn the form was filled in
 * CORRECTLY. Every score comes from the harness, so the picture can never drift from the
 * code that judges it.
 */
import { runEval, type EvalCase, type Subject } from '../eval/harness';
import { clampStep } from './timeline';
import type { EvalCaseView, EvaluationScene, Timeline } from './types';

/** A small "review → sentiment" subject with a planted bug: case C is valid JSON with
 * the wrong sentiment. Everything is a fixed lookup — deterministic, no model. */
export const EVAL_DEMO_SUBJECT: Subject = (input) =>
  ({
    'greet the user': 'hello',
    'extract the total from the receipt': 'The total is 42 dollars.',
    'classify: "cracked in a week, support ignored me"': '{"sentiment":"positive"}',
    'classify: "battery lasts forever, arrived early"': '{"sentiment":"positive"}',
  })[input] ?? '';

export const EVAL_DEMO_CASES: readonly (EvalCase & { label: string })[] = [
  {
    id: 'greeting',
    label: 'Greeting — exact match',
    input: 'greet the user',
    assertion: { kind: 'exact', expected: 'hello' },
  },
  {
    id: 'extraction',
    label: 'Receipt total — contains "42"',
    input: 'extract the total from the receipt',
    assertion: { kind: 'contains', needle: '42' },
  },
  {
    id: 'valid-but-wrong',
    label: 'Negative review — must be classified negative',
    input: 'classify: "cracked in a week, support ignored me"',
    // Valid JSON, right key, WRONG value — the case only an eval catches.
    assertion: { kind: 'json', requiredKeys: ['sentiment'], expectedValues: { sentiment: 'negative' } },
  },
  {
    id: 'correct-positive',
    label: 'Positive review — must be classified positive',
    input: 'classify: "battery lasts forever, arrived early"',
    assertion: { kind: 'json', requiredKeys: ['sentiment'], expectedValues: { sentiment: 'positive' } },
  },
];

export interface EvaluationSceneInput {
  subject: Subject;
  cases: readonly (EvalCase & { label: string })[];
}

export const EVALUATION_DEMO_INPUT: EvaluationSceneInput = {
  subject: EVAL_DEMO_SUBJECT,
  cases: EVAL_DEMO_CASES,
};

/** Step timeline: intro, one step per case, then the aggregate. Descriptions are the
 * teaching text and double as the accessible scene description. */
function buildTimeline(input: EvaluationSceneInput): Timeline {
  const steps = [
    {
      label: 'The eval set',
      description:
        'An eval is a fixed set of cases: an input, and an assertion about the output you would accept. Nothing is scored yet — this is the ruler you will measure every change against. A change that improves the score is progress; one that lowers it is a regression you can see.',
    },
  ];
  for (const c of input.cases) {
    steps.push({ label: c.label, description: '' }); // filled per-step from the real result
  }
  steps.push({
    label: 'The score',
    description:
      'The aggregate: passed over total. One number to compare runs — but read the failures, not just the number. A rising score can still hide a case getting worse if another improved more, and a score you optimize directly stops measuring what you care about (Goodhart’s law).',
  });
  return { steps };
}

export function createEvaluationScene(input: EvaluationSceneInput, step: number): EvaluationScene {
  const report = runEval(input.subject, input.cases);
  const timeline = buildTimeline(input);
  const totalSteps = timeline.steps.length;
  const current = clampStep(step, totalSteps);

  const total = input.cases.length;
  // Step 0 reveals nothing; steps 1..total reveal that many cases; the last step keeps all.
  const revealedCount = Math.min(current, total);
  const scored = current === totalSteps - 1;

  const cases: EvalCaseView[] = input.cases.map((c, i) => {
    const result = report.results[i]!;
    const revealed = i < revealedCount;
    return {
      id: c.id,
      label: c.label,
      assertionKind: c.assertion.kind,
      revealed,
      ...(revealed ? { pass: result.pass } : {}),
      ...(revealed && result.failReason ? { failReason: result.failReason } : {}),
      ...(revealed ? { detail: result.detail } : {}),
    };
  });

  const passed = cases.filter((c) => c.revealed && c.pass).length;

  // The per-case steps narrate the actual result; intro and final use the timeline text.
  let description = timeline.steps[current]!.description ?? '';
  if (current >= 1 && current <= total) {
    const r = report.results[current - 1]!;
    description = r.pass
      ? `Case "${input.cases[current - 1]!.label}" passes: ${r.detail}.`
      : `Case "${input.cases[current - 1]!.label}" FAILS (${r.failReason}): ${r.detail}. This is exactly what the eval exists to catch — a validator checking only shape would have missed it.`;
  }

  return {
    step: current,
    totalSteps,
    title: timeline.steps[current]!.label,
    description,
    cases,
    passed,
    revealedCount,
    total,
    scorePercent: Math.round(report.score * 1000) / 10,
    scored,
  };
}
