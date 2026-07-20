/**
 * The demonstration the Cost-engineering lesson walks through: one realistic agent request
 * — a support agent answering a customer question in a five-turn loop — optimized by
 * applying the four headline levers one at a time. Every number the lesson's visual shows is
 * produced by `applyLevers` over this baseline, so the picture is exactly the arithmetic.
 *
 * The baseline is deliberately unoptimized: every one of the five loop turns runs on the
 * frontier model, carries the full retrieved context, and caches nothing. That is what a
 * first cut looks like before anyone measures the bill.
 *
 * Prices are the ILLUSTRATIVE constants from the estimator — round teaching numbers, not any
 * vendor's real prices. What the demo teaches is the *shape* of the savings and the trade
 * each lever makes, not the absolute dollars.
 */
import {
  applyLevers,
  estimateCost,
  ILLUSTRATIVE_PRICES,
  type AgentRequest,
  type Lever,
  type LeverStep,
  type ModelCall,
} from './estimator';

/** The five loop turns of the unoptimized baseline. Labels drive the routing/capping levers. */
export const PLAN = 'Plan / classify';
export const SUMMARIZE = 'Summarize retrieved docs';
export const DRAFT = 'Draft answer';
export const SELF_CHECK = 'Self-check';
export const FINALIZE = 'Finalize answer';

/** The two easy sub-tasks a cheaper model handles well, plus the critique step. The
 * load-bearing DRAFT and FINALIZE stay on the frontier model. */
const EASY_STEPS = new Set([PLAN, SUMMARIZE, SELF_CHECK]);
/** After capping, only these three turns remain. */
const KEEP_AFTER_CAP = new Set([PLAN, DRAFT, FINALIZE]);

export const COST_DEMO_BASELINE: AgentRequest = {
  label: 'Support agent — 5-turn loop, unoptimized',
  responseCacheHitRate: 0,
  calls: [
    { label: PLAN, model: 'frontier', inputTokens: 1500, outputTokens: 150 },
    { label: SUMMARIZE, model: 'frontier', inputTokens: 2500, outputTokens: 300 },
    { label: DRAFT, model: 'frontier', inputTokens: 2200, outputTokens: 400 },
    { label: SELF_CHECK, model: 'frontier', inputTokens: 1800, outputTokens: 200 },
    { label: FINALIZE, model: 'frontier', inputTokens: 1600, outputTokens: 350 },
  ],
};

const mapCalls = (req: AgentRequest, fn: (c: ModelCall, i: number) => ModelCall): AgentRequest => ({
  ...req,
  calls: req.calls.map(fn),
});

/** The four levers, applied cumulatively, in the order the lesson steps through them. */
export const COST_DEMO_LEVERS: Lever[] = [
  {
    id: 'route',
    label: 'Right-size the model',
    note:
      'Route the easy turns — classify, summarize, self-check — to the small model; keep the frontier model only for the load-bearing draft and finalize. Biggest single lever here. Trade: the small model is weaker, so measure the quality of the routed turns (see evaluation) before you trust the saving.',
    apply: (req) => mapCalls(req, (c) => (EASY_STEPS.has(c.label) ? { ...c, model: 'small' } : c)),
  },
  {
    id: 'cache-prefix',
    label: 'Cache the system prefix',
    note:
      'The system instructions and tool definitions repeat on every turn. Prompt caching bills that shared prefix at a fraction of the input price on turns after the first (the first turn pays full to write the cache). Trade: only helps a stable, repeated prefix — change the prefix and every turn is a cache miss at full price.',
    apply: (req) => mapCalls(req, (c, i) => (i === 0 ? c : { ...c, cacheHitRate: 0.4 })),
  },
  {
    id: 'trim-context',
    label: 'Trim retrieved context',
    note:
      'Retrieve fewer, better chunks: shave ~30% of the input tokens on every turn. Input is the cheaper half per token, but it is most of the volume, so this compounds. Trade: trim too hard and you drop the passage that held the answer — measure retrieval recall (see rag) and answer quality, not just the bill.',
    apply: (req) => mapCalls(req, (c) => ({ ...c, inputTokens: Math.round(c.inputTokens * 0.7) })),
  },
  {
    id: 'cap-iterations',
    label: 'Cap loop iterations',
    note:
      'Cap the loop from five turns to three, dropping the redundant summarize and self-check turns. Each turn is a whole extra call of tokens. Here the dropped turns were already routed to the small model, so the saving is modest — but on a loop that runs away to 15+ turns, capping is the single biggest lever there is. Trade: fewer turns can cut off a self-correction the agent needed (see workflows-vs-agents and reflection).',
    apply: (req) => ({ ...req, calls: req.calls.filter((c) => KEEP_AFTER_CAP.has(c.label)) }),
  },
];

/** The full optimization walkthrough: baseline (index 0) then one step per lever. This is
 * the exact data the viz renders. */
export const COST_DEMO_STEPS: LeverStep[] = applyLevers(
  COST_DEMO_BASELINE,
  COST_DEMO_LEVERS,
  ILLUSTRATIVE_PRICES,
);

/** Illustrative monthly volume, used to show that per-request pennies are a real bill at
 * scale — the whole reason cost engineering exists (plan §7: it scales with volume). */
export const COST_DEMO_MONTHLY_REQUESTS = 1_000_000;

/** Convenience for tests and prose: the baseline's cost per request. */
export const COST_DEMO_BASELINE_COST = estimateCost(COST_DEMO_BASELINE, ILLUSTRATIVE_PRICES).perRequestCostUsd;
