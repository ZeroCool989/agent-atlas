/**
 * The `(input, step) => Scene` function for the Cost-engineering demo (ADR-0004, plan §8).
 * Pure and deterministic. It takes the real optimization walkthrough from the cost build
 * project (`src/lib/cost/`) — a five-turn support-agent request, then the four levers applied
 * one at a time — and reveals it a step at a time: the running per-request cost drops, the
 * cumulative saving grows, and each step carries the honest trade it made.
 *
 * Steps:
 *   0 — baseline: every turn on the frontier model, full context, no caching.
 *   1 — right-size the model: route the easy turns to the small model.
 *   2 — cache the system prefix: the repeated prefix billed cheap after the first turn.
 *   3 — trim retrieved context: ~30% fewer input tokens per turn.
 *   4 — cap loop iterations: five turns down to three.
 *
 * Every number comes from `applyLevers`/`estimateCost`, so the picture can never drift from
 * the arithmetic that produced it.
 */
import { atScale, COST_DEMO_MONTHLY_REQUESTS, type LeverStep } from '../cost';
import { clampStep } from './timeline';

/** One model call as a render-ready row: its step, its cost, and whether it was routed to the
 * cheap model or dropped by the cap. */
export interface CostCallRow {
  label: string;
  model: string;
  modelLabel: string;
  inputTokens: number;
  outputTokens: number;
  /** 0..1 share of this call's input served from the prompt cache at the current step. */
  cacheHitRate: number;
  costUsd: number;
  /** True when this turn currently runs on the small (cheap) model. */
  onSmallModel: boolean;
  /** True when the cap has removed this turn at the current step — shown as a ghost row. */
  dropped: boolean;
}

export interface CostScene {
  step: number;
  totalSteps: number;
  leverId: string;
  /** The lever's name (the step title). */
  title: string;
  /** The honest trade this lever makes; doubles as the accessible scene description. */
  description: string;
  /** Every baseline turn, in order; dropped turns are marked rather than removed. */
  rows: CostCallRow[];
  perRequestCostUsd: number;
  baselineCostUsd: number;
  /** Change versus the previous step (negative = cheaper); 0 on the baseline. */
  stepDeltaUsd: number;
  /** How much of the baseline cost has been removed so far, as a positive percent. */
  cumulativeSavingsPercent: number;
  isBaseline: boolean;
  isFinal: boolean;
  /** Current cost as a percent of the baseline (0..100), for the cost bar geometry. */
  costPercentOfBaseline: number;
  monthlyRequests: number;
  /** Illustrative monthly bill at the current step and at the baseline, for the at-scale note. */
  monthlyCostUsd: number;
  monthlyBaselineCostUsd: number;
}

export type CostSceneInput = LeverStep[];

function usd4(n: number): string {
  return `$${n.toFixed(4)}`;
}

/**
 * Derive the full scene at `step` from the pre-computed optimization walkthrough. The rows
 * are keyed off the baseline's turns so a dropped turn stays visible (as a ghost) rather than
 * silently vanishing — the learner sees exactly which turn the cap removed.
 */
export function createCostScene(input: CostSceneInput, step: number): CostScene {
  const totalSteps = input.length;
  const current = clampStep(step, totalSteps);
  const stepData = input[current]!;
  const baseline = input[0]!;
  const baselineCostUsd = baseline.perRequestCostUsd;

  const byLabel = new Map(stepData.breakdown.calls.map((c) => [c.label, c]));

  const rows: CostCallRow[] = baseline.breakdown.calls.map((baseCall) => {
    const call = byLabel.get(baseCall.label);
    if (!call) {
      // Dropped by the cap: show the baseline shape as a ghost, contributing $0 now.
      return {
        label: baseCall.label,
        model: baseCall.model,
        modelLabel: baseCall.modelLabel,
        inputTokens: baseCall.inputTokens,
        outputTokens: baseCall.outputTokens,
        cacheHitRate: 0,
        costUsd: 0,
        onSmallModel: false,
        dropped: true,
      };
    }
    return {
      label: call.label,
      model: call.model,
      modelLabel: call.modelLabel,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      cacheHitRate: call.cacheHitRate,
      costUsd: call.totalUsd,
      onSmallModel: call.model === 'small',
      dropped: false,
    };
  });

  const perRequestCostUsd = stepData.perRequestCostUsd;
  const costPercentOfBaseline =
    baselineCostUsd === 0 ? 0 : Math.round((perRequestCostUsd / baselineCostUsd) * 1000) / 10;

  let description: string;
  if (current === 0) {
    description =
      `The unoptimized baseline: a five-turn support agent, every turn on the frontier model, ` +
      `full retrieved context, nothing cached. That is ${usd4(perRequestCostUsd)} per request — ` +
      `and at ${COST_DEMO_MONTHLY_REQUESTS.toLocaleString('en-US')} requests a month, ` +
      `${usd4(atScale(perRequestCostUsd, COST_DEMO_MONTHLY_REQUESTS)).replace('.0000', '')} of bill. ` +
      `Now measure, then pull one lever at a time.`;
  } else {
    description = stepData.note;
  }

  return {
    step: current,
    totalSteps,
    leverId: stepData.id,
    title: stepData.label,
    description,
    rows,
    perRequestCostUsd,
    baselineCostUsd,
    stepDeltaUsd: stepData.stepDeltaUsd,
    cumulativeSavingsPercent: stepData.cumulativeSavingsPercent,
    isBaseline: current === 0,
    isFinal: current === totalSteps - 1,
    costPercentOfBaseline,
    monthlyRequests: COST_DEMO_MONTHLY_REQUESTS,
    monthlyCostUsd: atScale(perRequestCostUsd, COST_DEMO_MONTHLY_REQUESTS),
    monthlyBaselineCostUsd: atScale(baselineCostUsd, COST_DEMO_MONTHLY_REQUESTS),
  };
}
