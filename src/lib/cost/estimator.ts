/**
 * The Cost-engineering build project (ADR-0005, plan §3): a deterministic, dependency-free
 * LLM cost estimator + optimizer. Cost engineering is not a trick — it is arithmetic you
 * make explicit, then levers you pull against it. The whole discipline reduces to one
 * identity, which this module computes and nothing hides:
 *
 *     cost  =  Σ over model calls of ( input_tokens × input_price
 *                                     + output_tokens × output_price )
 *
 * with three refinements that are the actual levers: input and output are priced
 * DIFFERENTLY (output is the expensive half), a cached prefix is billed at a fraction of
 * the input price, and a whole request can be skipped by a response cache. Multiply the
 * per-call cost by how many calls your architecture makes (agent-loop turns) and you have
 * the bill.
 *
 * Plain TypeScript — no Astro, React, UI, or SDK imports. Read it as course material:
 * every stage is a named, testable function, and every number the lesson's visual shows
 * comes from `estimateCost` here, so the picture can never drift from the math.
 *
 * Prices are ILLUSTRATIVE, configurable constants — round teaching numbers, NOT any real
 * vendor's current prices. What is real and load-bearing is the *shape*: output costs more
 * than input, and a cache hit costs far less than a fresh read. Swap real numbers in behind
 * the same interface when you actually budget; never treat the constants below as fact.
 */
import { estimateTokens } from '../prompt/assemble';

/** Prices for one model, in USD per 1,000,000 tokens. ILLUSTRATIVE — see the file header. */
export interface ModelPrice {
  id: string;
  label: string;
  /** USD per 1M input (prompt) tokens. */
  inputPerMTok: number;
  /** USD per 1M output (completion) tokens — deliberately higher than input; that asymmetry
   * is real and drives which lever pays off. */
  outputPerMTok: number;
  /** USD per 1M input tokens served from the prompt cache — a small fraction of input price.
   * A cache hit does not read the tokens fresh, so it is billed far cheaper. */
  cachedInputPerMTok: number;
}

/**
 * A two-model price table: one frontier model and one small/cheap model. ILLUSTRATIVE round
 * numbers, chosen only to teach the ratios (output ≫ input; cached ≪ input; small ≪
 * frontier). NOT any provider's real prices — do not cite them as such.
 */
export const ILLUSTRATIVE_PRICES: Record<string, ModelPrice> = {
  frontier: { id: 'frontier', label: 'Frontier model', inputPerMTok: 3.0, outputPerMTok: 15.0, cachedInputPerMTok: 0.3 },
  small: { id: 'small', label: 'Small model', inputPerMTok: 0.2, outputPerMTok: 0.8, cachedInputPerMTok: 0.02 },
};

export type PriceTable = Record<string, ModelPrice>;

/** One model call in a request. An agent request is a sequence of these — the loop. */
export interface ModelCall {
  /** Human label for the step, e.g. "plan", "summarize retrieved docs", "draft answer". */
  label: string;
  /** Model id — looked up in the price table. */
  model: string;
  /** Prompt tokens sent on this call (system + history + retrieved context + task). */
  inputTokens: number;
  /** Completion tokens the model writes back. */
  outputTokens: number;
  /**
   * Fraction (0..1) of this call's input tokens served from the PROMPT cache — the repeated
   * prefix (system instructions, tool definitions) that a later call reuses. The tokens are
   * still sent, but billed at `cachedInputPerMTok`. 0 = nothing cached.
   */
  cacheHitRate?: number;
}

/**
 * One agent request: the calls it makes, and whether a RESPONSE cache can serve the whole
 * request without calling the model at all. Prompt caching (per-call `cacheHitRate`) and
 * response caching (`responseCacheHitRate`) are DIFFERENT levers — the first cheapens a
 * repeated prefix inside a call, the second skips the model entirely for a repeated query.
 */
export interface AgentRequest {
  label?: string;
  calls: ModelCall[];
  /** Fraction (0..1) of identical requests answered from a response cache — those pay $0. */
  responseCacheHitRate?: number;
}

/** Cost of a single model call, USD, with its parts split out so the breakdown is legible. */
export interface CallCost {
  label: string;
  model: string;
  modelLabel: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitRate: number;
  /** Input tokens billed at the fresh (uncached) input price. */
  freshInputTokens: number;
  /** Input tokens billed at the cached input price. */
  cachedInputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  /** What the input would have cost with no prompt cache — used to surface the cache saving. */
  uncachedInputCostUsd: number;
  totalUsd: number;
}

/** The full cost picture for one request: per-call parts, rolled up, before and after the
 * response cache. Every field is derived; nothing is asserted. */
export interface CostBreakdown {
  label: string;
  calls: CallCost[];
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  /** How much the prompt cache saved versus reading every input token fresh. */
  promptCacheSavingsUsd: number;
  /** Cost of the calls, before the response cache is applied. */
  grossCostUsd: number;
  responseCacheHitRate: number;
  /** Expected cost per request AFTER the response cache skips a fraction of requests. This is
   * the number you multiply by request volume to get the bill. */
  perRequestCostUsd: number;
}

/** Kill floating-point dust so equal inputs give equal, comparable, presentable numbers. */
function roundUsd(n: number): number {
  return Math.round(n * 1e9) / 1e9;
}

function clamp01(n: number | undefined): number {
  if (n === undefined || Number.isNaN(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}

function priceFor(model: string, prices: PriceTable): ModelPrice {
  const price = prices[model];
  if (!price) {
    throw new Error(
      `estimateCost: no price for model "${model}". Add it to the price table (models: ${Object.keys(prices).join(', ') || 'none'}).`,
    );
  }
  return price;
}

/** Cost of ONE model call: fresh input + cached input + output, each at its own price. */
export function estimateCallCost(call: ModelCall, prices: PriceTable = ILLUSTRATIVE_PRICES): CallCost {
  if (call.inputTokens < 0 || call.outputTokens < 0) {
    throw new Error(`estimateCallCost: token counts must be non-negative (call "${call.label}").`);
  }
  const price = priceFor(call.model, prices);
  const hit = clamp01(call.cacheHitRate);
  const cachedInputTokens = call.inputTokens * hit;
  const freshInputTokens = call.inputTokens - cachedInputTokens;

  const inputCostUsd =
    (freshInputTokens * price.inputPerMTok) / 1e6 + (cachedInputTokens * price.cachedInputPerMTok) / 1e6;
  const uncachedInputCostUsd = (call.inputTokens * price.inputPerMTok) / 1e6;
  const outputCostUsd = (call.outputTokens * price.outputPerMTok) / 1e6;

  return {
    label: call.label,
    model: call.model,
    modelLabel: price.label,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    cacheHitRate: hit,
    freshInputTokens,
    cachedInputTokens,
    inputCostUsd: roundUsd(inputCostUsd),
    outputCostUsd: roundUsd(outputCostUsd),
    uncachedInputCostUsd: roundUsd(uncachedInputCostUsd),
    totalUsd: roundUsd(inputCostUsd + outputCostUsd),
  };
}

/** Cost of a whole agent request: sum the calls, then apply the response cache. */
export function estimateCost(req: AgentRequest, prices: PriceTable = ILLUSTRATIVE_PRICES): CostBreakdown {
  const calls = req.calls.map((c) => estimateCallCost(c, prices));
  const responseCacheHitRate = clamp01(req.responseCacheHitRate);

  const inputCostUsd = calls.reduce((s, c) => s + c.inputCostUsd, 0);
  const outputCostUsd = calls.reduce((s, c) => s + c.outputCostUsd, 0);
  const uncachedInputCostUsd = calls.reduce((s, c) => s + c.uncachedInputCostUsd, 0);
  const grossCostUsd = inputCostUsd + outputCostUsd;

  return {
    label: req.label ?? 'request',
    calls,
    callCount: calls.length,
    totalInputTokens: calls.reduce((s, c) => s + c.inputTokens, 0),
    totalOutputTokens: calls.reduce((s, c) => s + c.outputTokens, 0),
    totalTokens: calls.reduce((s, c) => s + c.inputTokens + c.outputTokens, 0),
    inputCostUsd: roundUsd(inputCostUsd),
    outputCostUsd: roundUsd(outputCostUsd),
    promptCacheSavingsUsd: roundUsd(uncachedInputCostUsd - inputCostUsd),
    grossCostUsd: roundUsd(grossCostUsd),
    responseCacheHitRate,
    perRequestCostUsd: roundUsd(grossCostUsd * (1 - responseCacheHitRate)),
  };
}

/**
 * Convenience matching the brief's headline shape: a request that makes `callsPerRequest`
 * IDENTICAL calls on one model. Expands into an `AgentRequest` so the same estimator serves
 * both the simple case and the heterogeneous (per-step routed) case the demo needs.
 */
export function uniformRequest(opts: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  callsPerRequest: number;
  cacheHitRate?: number;
  responseCacheHitRate?: number;
  label?: string;
}): AgentRequest {
  const calls: ModelCall[] = Array.from({ length: Math.max(0, Math.trunc(opts.callsPerRequest)) }, (_, i) => ({
    label: `call ${i + 1}`,
    model: opts.model,
    inputTokens: opts.inputTokens,
    outputTokens: opts.outputTokens,
    cacheHitRate: opts.cacheHitRate,
  }));
  return { label: opts.label, calls, responseCacheHitRate: opts.responseCacheHitRate };
}

/** Build a `ModelCall` from actual text, reusing the token estimator from the prompt build
 * project (`src/lib/prompt`) — the same ≈4-chars/token heuristic the Tokens lesson teaches.
 * The honest link: cost starts as a token count, and token counts are estimates until you
 * run the real tokenizer. */
export function callFromText(opts: {
  label: string;
  model: string;
  promptText: string;
  outputText?: string;
  outputTokens?: number;
  cacheHitRate?: number;
}): ModelCall {
  return {
    label: opts.label,
    model: opts.model,
    inputTokens: estimateTokens(opts.promptText),
    outputTokens: opts.outputTokens ?? (opts.outputText ? estimateTokens(opts.outputText) : 0),
    cacheHitRate: opts.cacheHitRate,
  };
}

/** Project a per-request cost to a monthly bill at a given request volume — the number that
 * tells you whether cost engineering is worth your time at all (plan §7: it scales with
 * volume). */
export function atScale(perRequestCostUsd: number, requestsPerMonth: number): number {
  return roundUsd(perRequestCostUsd * requestsPerMonth);
}

/** The result of pitting one request against another — the core of `compare`. */
export interface Comparison {
  baseline: CostBreakdown;
  variant: CostBreakdown;
  /** variant − baseline; negative means the variant is cheaper. */
  deltaUsd: number;
  /** Change as a percent of the baseline; negative means a saving. */
  deltaPercent: number;
  cheaper: boolean;
}

/** Compare two requests and report the delta — "what does this lever actually save?". */
export function compare(
  baseline: AgentRequest,
  variant: AgentRequest,
  prices: PriceTable = ILLUSTRATIVE_PRICES,
): Comparison {
  const b = estimateCost(baseline, prices);
  const v = estimateCost(variant, prices);
  const deltaUsd = roundUsd(v.perRequestCostUsd - b.perRequestCostUsd);
  const deltaPercent =
    b.perRequestCostUsd === 0 ? 0 : roundUsd((deltaUsd / b.perRequestCostUsd) * 100);
  return { baseline: b, variant: v, deltaUsd, deltaPercent, cheaper: v.perRequestCostUsd < b.perRequestCostUsd };
}

/**
 * One cost lever: a labelled, honest transform on a request, plus the note that keeps it
 * honest — every lever trades something (quality, latency, dev time, staleness) for the
 * saving, and the note says what.
 */
export interface Lever {
  id: string;
  label: string;
  /** The trade this lever makes — quality/latency/staleness cost of the saving. */
  note: string;
  apply: (req: AgentRequest) => AgentRequest;
}

/** One step of applying levers cumulatively: the request, its cost, and the deltas both
 * versus the previous step and versus the untouched baseline. */
export interface LeverStep {
  index: number;
  id: string;
  label: string;
  note: string;
  request: AgentRequest;
  breakdown: CostBreakdown;
  perRequestCostUsd: number;
  /** Change versus the previous step (negative = cheaper). */
  stepDeltaUsd: number;
  stepDeltaPercent: number;
  /** Cumulative change versus step 0 (the baseline). */
  cumulativeDeltaUsd: number;
  /** How much of the baseline cost has been removed so far, as a positive percent. */
  cumulativeSavingsPercent: number;
}

/**
 * Apply levers one at a time, each on top of the last, and return a step per stage
 * (index 0 = the untouched baseline). This is the optimizer analysis the lesson walks
 * through: watch the running cost drop as each lever lands, and read the trade each one made.
 */
export function applyLevers(
  baseline: AgentRequest,
  levers: Lever[],
  prices: PriceTable = ILLUSTRATIVE_PRICES,
): LeverStep[] {
  const steps: LeverStep[] = [];
  let current = baseline;
  const baseCost = estimateCost(baseline, prices).perRequestCostUsd;
  let previousCost = baseCost;

  const push = (index: number, id: string, label: string, note: string, request: AgentRequest) => {
    const breakdown = estimateCost(request, prices);
    const cost = breakdown.perRequestCostUsd;
    steps.push({
      index,
      id,
      label,
      note,
      request,
      breakdown,
      perRequestCostUsd: cost,
      stepDeltaUsd: roundUsd(cost - previousCost),
      stepDeltaPercent: previousCost === 0 ? 0 : roundUsd(((cost - previousCost) / previousCost) * 100),
      cumulativeDeltaUsd: roundUsd(cost - baseCost),
      cumulativeSavingsPercent: baseCost === 0 ? 0 : roundUsd(((baseCost - cost) / baseCost) * 100),
    });
    previousCost = cost;
  };

  push(0, 'baseline', 'Baseline', 'No optimization: every step on the frontier model, full context, no caching.', current);
  levers.forEach((lever, i) => {
    current = lever.apply(current);
    push(i + 1, lever.id, lever.label, lever.note, current);
  });
  return steps;
}
