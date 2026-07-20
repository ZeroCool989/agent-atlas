/**
 * The Cost-engineering build project's public surface (plan §3). A deterministic,
 * dependency-free cost estimator + optimizer: price a request, compare two, or apply a
 * sequence of levers and watch the running cost drop. See `estimator.ts` for the math and
 * `demo.ts` for the lesson's worked example.
 */
export {
  ILLUSTRATIVE_PRICES,
  estimateCallCost,
  estimateCost,
  uniformRequest,
  callFromText,
  atScale,
  compare,
  applyLevers,
} from './estimator';
export type {
  ModelPrice,
  PriceTable,
  ModelCall,
  AgentRequest,
  CallCost,
  CostBreakdown,
  Comparison,
  Lever,
  LeverStep,
} from './estimator';
export {
  COST_DEMO_BASELINE,
  COST_DEMO_LEVERS,
  COST_DEMO_STEPS,
  COST_DEMO_MONTHLY_REQUESTS,
  COST_DEMO_BASELINE_COST,
} from './demo';
