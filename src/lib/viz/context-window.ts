/**
 * Pure context-window capacity computation. The bar is a CONCEPTUAL visualization of
 * finite context capacity — providers differ in how context is counted and managed,
 * and the renderer says so.
 *
 * Edge-case policy (documented, tested): impossible inputs (negative values, zero or
 * negative capacity, non-integers) produce `status: 'invalid'` with human-readable
 * `problems` — the renderer shows an error state instead of a mathematically
 * misleading bar. Over-capacity is a legitimate teaching state (`overflow`), not an
 * error. Segment totals that disagree with `usedTokens` keep the used/capacity math
 * but append a problem so the mismatch is visible, never silent.
 */
import type { ContextWindowStatus, ContextWindowView } from './types';

export interface ContextWindowInput {
  usedTokens: number;
  capacityTokens: number;
  segments?: Array<{ label: string; tokenCount: number; kind: string }>;
}

/** Fraction of capacity at which the bar reports 'near-capacity'. */
export const NEAR_CAPACITY_THRESHOLD = 0.9;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeContextWindow(input: ContextWindowInput): ContextWindowView {
  const problems: string[] = [];

  if (!Number.isInteger(input.capacityTokens) || input.capacityTokens <= 0) {
    problems.push(`capacityTokens must be a positive integer (got ${input.capacityTokens})`);
  }
  if (!Number.isInteger(input.usedTokens) || input.usedTokens < 0) {
    problems.push(`usedTokens must be a non-negative integer (got ${input.usedTokens})`);
  }
  for (const segment of input.segments ?? []) {
    if (!Number.isInteger(segment.tokenCount) || segment.tokenCount < 0) {
      problems.push(
        `segment "${segment.label}" tokenCount must be a non-negative integer (got ${segment.tokenCount})`,
      );
    }
  }

  if (problems.length > 0) {
    return {
      usedTokens: input.usedTokens,
      capacityTokens: input.capacityTokens,
      remainingTokens: 0,
      percentUsed: 0,
      status: 'invalid',
      problems,
      segments: [],
    };
  }

  const { usedTokens, capacityTokens } = input;
  const percentUsed = round1((usedTokens / capacityTokens) * 100);

  let status: ContextWindowStatus = 'ok';
  if (usedTokens > capacityTokens) status = 'overflow';
  else if (usedTokens === capacityTokens) status = 'full';
  else if (usedTokens >= capacityTokens * NEAR_CAPACITY_THRESHOLD) status = 'near-capacity';

  const segments = (input.segments ?? []).map((segment) => ({
    label: segment.label,
    tokenCount: segment.tokenCount,
    kind: segment.kind,
    percent: round1((segment.tokenCount / capacityTokens) * 100),
  }));

  const segmentTotal = segments.reduce((sum, s) => sum + s.tokenCount, 0);
  if (segments.length > 0 && segmentTotal !== usedTokens) {
    problems.push(
      `segment totals (${segmentTotal}) do not match usedTokens (${usedTokens}) — the bar shows usedTokens; fix the segment data`,
    );
  }

  return {
    usedTokens,
    capacityTokens,
    remainingTokens: Math.max(0, capacityTokens - usedTokens),
    percentUsed,
    status,
    problems,
    segments,
  };
}
