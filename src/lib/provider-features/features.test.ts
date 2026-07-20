import { describe, expect, it } from 'vitest';

import {
  CAPABILITIES,
  CAPABILITY_LIST,
  PROVIDERS,
  recommendStrategy,
  resolve,
  scorePortability,
  uniformProfile,
  type CapabilityId,
  type DecisionFactors,
} from './features';

describe('the capability registry', () => {
  it('has a primitive, a native convenience, and a portable fallback for every category', () => {
    for (const cap of CAPABILITY_LIST) {
      expect(cap.primitive.length).toBeGreaterThan(0);
      expect(cap.nativeConvenience.length).toBeGreaterThan(0);
      expect(cap.portableFallback.length).toBeGreaterThan(0);
      expect(cap.lockInWeight).toBeGreaterThanOrEqual(0);
      expect(cap.lockInWeight).toBeLessThanOrEqual(1);
    }
  });

  it('ranks provider-side memory as the hardest to leave and structured output as the easiest', () => {
    const weights = CAPABILITY_LIST.map((c) => c.lockInWeight);
    expect(CAPABILITIES['provider-memory'].lockInWeight).toBe(Math.max(...weights));
    expect(CAPABILITIES['structured-output'].lockInWeight).toBe(Math.min(...weights));
  });

  it('only the state-holding features flag provider-held state (the data-residency ones)', () => {
    expect(CAPABILITIES['provider-memory'].holdsProviderState).toBe(true);
    expect(CAPABILITIES['prompt-caching'].holdsProviderState).toBe(true);
    expect(CAPABILITIES['structured-output'].holdsProviderState).toBe(false);
    expect(CAPABILITIES['hosted-tools'].holdsProviderState).toBe(false);
  });
});

describe('resolve — the capability shim', () => {
  it('takes the native feature when the provider offers it and portability was not preferred', () => {
    const r = resolve({ capability: 'hosted-tools' }, 'broad');
    expect(r.strategy).toBe('native');
    expect(r.portableEverywhere).toBe(false);
  });

  it('falls back to the primitive when the provider exposes only primitives', () => {
    const r = resolve({ capability: 'hosted-tools' }, 'primitivesOnly');
    expect(r.strategy).toBe('portable');
    expect(r.portableEverywhere).toBe(true);
    expect(r.holdsProviderState).toBe(false);
  });

  it('honours preferPortable even where a native feature exists', () => {
    const r = resolve({ capability: 'provider-memory', preferPortable: true }, 'broad');
    expect(r.strategy).toBe('portable');
    expect(r.holdsProviderState).toBe(false);
  });

  it('the same neutral request resolves differently per provider but never fails', () => {
    // The whole point: one expressed need, portable on any provider because the primitive is.
    const strategies = Object.keys(PROVIDERS).map((p) => resolve({ capability: 'batch' }, p).strategy);
    expect(strategies).toContain('native');
    expect(strategies).toContain('portable');
  });

  it('a native resolution surfaces provider-held state for state-holding capabilities', () => {
    expect(resolve({ capability: 'provider-memory' }, 'broad').holdsProviderState).toBe(true);
    expect(resolve({ capability: 'structured-output' }, 'broad').holdsProviderState).toBe(false);
  });

  it('rejects an unknown capability or provider with a helpful message', () => {
    expect(() => resolve({ capability: 'nope' as CapabilityId }, 'broad')).toThrow(/unknown capability/);
    expect(() => resolve({ capability: 'batch' }, 'imaginary')).toThrow(/unknown provider/);
  });
});

describe('recommendStrategy — the native-vs-portable decision', () => {
  const base: DecisionFactors = {
    portabilityPriority: 0.2,
    volume: 'low',
    needsManagedInfra: false,
    dataResidencyConstraint: false,
  };

  it('forces portable when residency forbids parking state on the provider', () => {
    const rec = recommendStrategy('provider-memory', { ...base, dataResidencyConstraint: true });
    expect(rec.strategy).toBe('portable');
    expect(rec.forced).toBe(true);
  });

  it('does not force a residency choice on a feature that holds no state', () => {
    // Hosted tools do not park your state, so residency alone does not force the hand.
    const rec = recommendStrategy('hosted-tools', { ...base, dataResidencyConstraint: true });
    expect(rec.forced).toBe(false);
  });

  it('tips to portable when portability priority is high', () => {
    const rec = recommendStrategy('batch', { ...base, portabilityPriority: 0.8 });
    expect(rec.strategy).toBe('portable');
    expect(rec.forced).toBe(false);
  });

  it('recommends native when managed infrastructure at high volume is worth the lock-in', () => {
    const rec = recommendStrategy('hosted-tools', {
      ...base,
      needsManagedInfra: true,
      volume: 'high',
    });
    expect(rec.strategy).toBe('native');
  });

  it('defaults to portable — learn the primitive first', () => {
    expect(recommendStrategy('structured-output', base).strategy).toBe('portable');
  });
});

describe('scorePortability — the lock-in model', () => {
  it('an all-portable app scores 100 with no provider-held state', () => {
    const report = scorePortability(uniformProfile('portable'));
    expect(report.score).toBe(100);
    expect(report.lockInIndex).toBe(0);
    expect(report.nativeCount).toBe(0);
    expect(report.providerHeldState).toHaveLength(0);
  });

  it('an all-native app scores 0 and lists every migration', () => {
    const report = scorePortability(uniformProfile('native'));
    expect(report.score).toBe(0);
    expect(report.lockInIndex).toBe(1);
    expect(report.portableCount).toBe(0);
    expect(report.migrationNotes).toHaveLength(CAPABILITY_LIST.length);
  });

  it('weights lock-in: going native on memory costs the score more than going native on structured output', () => {
    const memoryNative = scorePortability({ 'provider-memory': 'native', batch: 'portable' });
    const structuredNative = scorePortability({ 'structured-output': 'native', batch: 'portable' });
    expect(memoryNative.score).toBeLessThan(structuredNative.score);
  });

  it('flags exactly the native state-holding features for the data-residency watch-list', () => {
    const report = scorePortability({
      'provider-memory': 'native',
      'prompt-caching': 'portable',
      'hosted-tools': 'native',
    });
    expect(report.providerHeldState).toEqual(['provider-memory']);
  });

  it('an empty app is trivially portable (score 100), not a divide-by-zero', () => {
    const report = scorePortability({});
    expect(report.score).toBe(100);
    expect(report.lockInIndex).toBe(0);
  });

  it('score is monotonic: swapping any need from portable to native never raises the score', () => {
    const start = scorePortability(uniformProfile('portable')).score;
    let prev = start;
    const profile = uniformProfile('portable');
    for (const cap of CAPABILITY_LIST) {
      profile[cap.id] = 'native';
      const next = scorePortability(profile).score;
      expect(next).toBeLessThanOrEqual(prev);
      prev = next;
    }
    expect(prev).toBe(0);
  });
});
