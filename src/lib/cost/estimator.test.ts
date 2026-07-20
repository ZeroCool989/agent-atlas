import { describe, expect, it } from 'vitest';

import {
  applyLevers,
  atScale,
  callFromText,
  compare,
  estimateCallCost,
  estimateCost,
  ILLUSTRATIVE_PRICES,
  uniformRequest,
  type AgentRequest,
  type Lever,
} from './estimator';
import { COST_DEMO_BASELINE, COST_DEMO_LEVERS, COST_DEMO_STEPS } from './demo';

describe('estimateCallCost — the core identity cost = tokens × price', () => {
  it('prices input and output separately at the illustrative rates', () => {
    const cost = estimateCallCost({ label: 'x', model: 'frontier', inputTokens: 1000, outputTokens: 500 });
    // 1000/1e6 * 3.00 = 0.003 ; 500/1e6 * 15.00 = 0.0075
    expect(cost.inputCostUsd).toBeCloseTo(0.003, 9);
    expect(cost.outputCostUsd).toBeCloseTo(0.0075, 9);
    expect(cost.totalUsd).toBeCloseTo(0.0105, 9);
  });

  it('bills output more than input for the SAME token count (the pricing asymmetry)', () => {
    const c = estimateCallCost({ label: 'x', model: 'frontier', inputTokens: 1000, outputTokens: 1000 });
    expect(c.outputCostUsd).toBeGreaterThan(c.inputCostUsd);
    // frontier output is 5× input per token in the illustrative table.
    expect(c.outputCostUsd / c.inputCostUsd).toBeCloseTo(5, 9);
  });

  it('a cached prefix is billed far cheaper than a fresh read', () => {
    const cached = estimateCallCost({ label: 'x', model: 'frontier', inputTokens: 1000, outputTokens: 0, cacheHitRate: 0.5 });
    // fresh 500*3/1e6 = 0.0015 ; cached 500*0.3/1e6 = 0.00015
    expect(cached.inputCostUsd).toBeCloseTo(0.00165, 9);
    expect(cached.uncachedInputCostUsd).toBeCloseTo(0.003, 9);
    expect(cached.cachedInputTokens).toBe(500);
    expect(cached.freshInputTokens).toBe(500);
  });

  it('clamps an out-of-range cache-hit rate into [0,1]', () => {
    const over = estimateCallCost({ label: 'x', model: 'frontier', inputTokens: 1000, outputTokens: 0, cacheHitRate: 5 });
    expect(over.cacheHitRate).toBe(1);
    expect(over.cachedInputTokens).toBe(1000);
  });

  it('throws for an unknown model and for negative tokens', () => {
    expect(() => estimateCallCost({ label: 'x', model: 'nope', inputTokens: 1, outputTokens: 1 })).toThrow(/no price for model/);
    expect(() => estimateCallCost({ label: 'x', model: 'frontier', inputTokens: -1, outputTokens: 0 })).toThrow(/non-negative/);
  });

  it('the small model is much cheaper than the frontier model for identical work', () => {
    const call = { label: 'x', inputTokens: 1000, outputTokens: 500 } as const;
    const frontier = estimateCallCost({ ...call, model: 'frontier' });
    const small = estimateCallCost({ ...call, model: 'small' });
    expect(small.totalUsd).toBeLessThan(frontier.totalUsd);
  });
});

describe('estimateCost — a whole request, calls × price, then response cache', () => {
  it('multiplies the per-call cost by how many calls the architecture makes', () => {
    const req = uniformRequest({ model: 'frontier', inputTokens: 1000, outputTokens: 500, callsPerRequest: 3 });
    const cost = estimateCost(req);
    expect(cost.callCount).toBe(3);
    // 3 × 0.0105
    expect(cost.grossCostUsd).toBeCloseTo(0.0315, 9);
    expect(cost.perRequestCostUsd).toBeCloseTo(0.0315, 9);
  });

  it('a response cache skips a fraction of requests entirely', () => {
    const req = uniformRequest({
      model: 'frontier',
      inputTokens: 1000,
      outputTokens: 500,
      callsPerRequest: 1,
      responseCacheHitRate: 0.5,
    });
    const cost = estimateCost(req);
    expect(cost.grossCostUsd).toBeCloseTo(0.0105, 9);
    expect(cost.perRequestCostUsd).toBeCloseTo(0.00525, 9); // half the requests cost $0
  });

  it('reports the prompt-cache saving on the breakdown', () => {
    const req: AgentRequest = {
      calls: [{ label: 'x', model: 'frontier', inputTokens: 1000, outputTokens: 0, cacheHitRate: 0.5 }],
    };
    expect(estimateCost(req).promptCacheSavingsUsd).toBeCloseTo(0.00135, 9);
  });
});

describe('callFromText — reuses the prompt build project token estimator', () => {
  it('derives token counts from text via the ≈4-chars/token heuristic', () => {
    const call = callFromText({ label: 'x', model: 'small', promptText: 'a'.repeat(400), outputText: 'b'.repeat(40) });
    expect(call.inputTokens).toBe(100); // 400 / 4
    expect(call.outputTokens).toBe(10); // 40 / 4
  });
});

describe('compare — the delta a single lever buys', () => {
  it('reports a negative delta and percent when the variant is cheaper', () => {
    const baseline = uniformRequest({ model: 'frontier', inputTokens: 1000, outputTokens: 500, callsPerRequest: 1 });
    const variant = uniformRequest({ model: 'small', inputTokens: 1000, outputTokens: 500, callsPerRequest: 1 });
    const c = compare(baseline, variant);
    expect(c.cheaper).toBe(true);
    expect(c.deltaUsd).toBeLessThan(0);
    expect(c.deltaPercent).toBeLessThan(0);
  });
});

describe('applyLevers — cumulative optimization', () => {
  const baseline = uniformRequest({ model: 'frontier', inputTokens: 2000, outputTokens: 400, callsPerRequest: 4 });
  const levers: Lever[] = [
    { id: 'route', label: 'route', note: 'n', apply: (r) => ({ ...r, calls: r.calls.map((c) => ({ ...c, model: 'small' })) }) },
    { id: 'trim', label: 'trim', note: 'n', apply: (r) => ({ ...r, calls: r.calls.map((c) => ({ ...c, inputTokens: c.inputTokens / 2 })) }) },
  ];

  it('emits the baseline plus one step per lever', () => {
    const steps = applyLevers(baseline, levers);
    expect(steps).toHaveLength(3);
    expect(steps[0]!.id).toBe('baseline');
    expect(steps[1]!.id).toBe('route');
  });

  it('running cost is monotonically non-increasing across cost-reducing levers', () => {
    const steps = applyLevers(baseline, levers);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.perRequestCostUsd).toBeLessThanOrEqual(steps[i - 1]!.perRequestCostUsd);
    }
    // Cumulative savings grows and is positive by the end.
    expect(steps.at(-1)!.cumulativeSavingsPercent).toBeGreaterThan(0);
  });
});

describe('atScale — per-request pennies become a real monthly bill', () => {
  it('multiplies cost per request by request volume', () => {
    expect(atScale(0.05, 1_000_000)).toBeCloseTo(50_000, 6);
  });
});

describe('the lesson demo (real numbers the visual renders)', () => {
  it('baseline costs 0.0498 per request (5 frontier turns, no caching)', () => {
    expect(estimateCost(COST_DEMO_BASELINE).perRequestCostUsd).toBeCloseTo(0.0498, 9);
  });

  it('produces baseline + one step per lever, each cheaper than the last', () => {
    expect(COST_DEMO_STEPS).toHaveLength(COST_DEMO_LEVERS.length + 1);
    for (let i = 1; i < COST_DEMO_STEPS.length; i++) {
      expect(COST_DEMO_STEPS[i]!.perRequestCostUsd).toBeLessThan(COST_DEMO_STEPS[i - 1]!.perRequestCostUsd);
    }
  });

  it('routing to the small model is the single biggest lever', () => {
    const routeStep = COST_DEMO_STEPS.find((s) => s.id === 'route')!;
    // Its step saving is larger in magnitude than any later lever's step saving.
    const laterSavings = COST_DEMO_STEPS.filter((s) => s.index > routeStep.index).map((s) => Math.abs(s.stepDeltaUsd));
    for (const s of laterSavings) expect(Math.abs(routeStep.stepDeltaUsd)).toBeGreaterThan(s);
  });

  it('ends well over half the baseline cost removed', () => {
    expect(COST_DEMO_STEPS.at(-1)!.cumulativeSavingsPercent).toBeGreaterThan(60);
  });

  it('capping the loop actually removes calls', () => {
    const capped = COST_DEMO_STEPS.at(-1)!;
    expect(capped.breakdown.callCount).toBe(3);
    expect(COST_DEMO_STEPS[0]!.breakdown.callCount).toBe(5);
  });

  it('uses the illustrative price table (output dearer than input on both models)', () => {
    for (const p of Object.values(ILLUSTRATIVE_PRICES)) {
      expect(p.outputPerMTok).toBeGreaterThan(p.inputPerMTok);
      expect(p.cachedInputPerMTok).toBeLessThan(p.inputPerMTok);
    }
  });
});
