import { describe, expect, it } from 'vitest';

import { CAPABILITY_LIST, type CapabilityId, type Strategy } from '../provider-features';
import { createProviderFeaturesScene } from './provider-features-scene';

function strategies(value: Strategy): Record<CapabilityId, Strategy> {
  return Object.fromEntries(CAPABILITY_LIST.map((c) => [c.id, value])) as Record<CapabilityId, Strategy>;
}

describe('createProviderFeaturesScene', () => {
  it('all-portable on any provider is fully portable, score 100, nothing held', () => {
    const scene = createProviderFeaturesScene({ strategies: strategies('portable'), providerId: 'broad' });
    expect(scene.isFullyPortable).toBe(true);
    expect(scene.score).toBe(100);
    expect(scene.providerHeldState).toHaveLength(0);
    expect(scene.rows.every((r) => r.effective === 'portable')).toBe(true);
  });

  it('all-native on the broad provider is fully native, score 0, and lists migrations', () => {
    const scene = createProviderFeaturesScene({ strategies: strategies('native'), providerId: 'broad' });
    expect(scene.isFullyNative).toBe(true);
    expect(scene.score).toBe(0);
    expect(scene.migrationNotes.length).toBe(CAPABILITY_LIST.length);
    expect(scene.providerHeldState.length).toBeGreaterThan(0);
  });

  it('a native pick on a primitives-only provider is forced to the portable path', () => {
    const scene = createProviderFeaturesScene({
      strategies: strategies('native'),
      providerId: 'primitivesOnly',
    });
    // The wrapper is provider-specific; the primitive is not — every native pick runs portable.
    expect(scene.rows.every((r) => r.forcedPortable)).toBe(true);
    expect(scene.rows.every((r) => r.effective === 'portable')).toBe(true);
    expect(scene.score).toBe(100);
  });

  it('switching providers changes which needs can be met natively', () => {
    const onBroad = createProviderFeaturesScene({ strategies: strategies('native'), providerId: 'broad' });
    const onPartial = createProviderFeaturesScene({ strategies: strategies('native'), providerId: 'partial' });
    const broadNative = onBroad.rows.filter((r) => r.effective === 'native').length;
    const partialNative = onPartial.rows.filter((r) => r.effective === 'native').length;
    // Provider B (partial) offers fewer native features than Provider A (broad).
    expect(partialNative).toBeLessThan(broadNative);
    expect(onPartial.score).toBeGreaterThan(onBroad.score);
  });

  it('going native on high-lock-in memory drops the score more than native structured output', () => {
    const base = strategies('portable');
    const memory = createProviderFeaturesScene({
      strategies: { ...base, 'provider-memory': 'native' },
      providerId: 'broad',
    });
    const structured = createProviderFeaturesScene({
      strategies: { ...base, 'structured-output': 'native' },
      providerId: 'broad',
    });
    expect(memory.score).toBeLessThan(structured.score);
  });

  it('flags native state-holding features on the data-residency watch-list', () => {
    const scene = createProviderFeaturesScene({
      strategies: { ...strategies('portable'), 'provider-memory': 'native' },
      providerId: 'broad',
    });
    expect(scene.providerHeldState).toContain('provider-memory');
  });

  it('falls back to the first provider for an unknown provider id, never throwing', () => {
    const scene = createProviderFeaturesScene({ strategies: strategies('portable'), providerId: 'nope' });
    expect(scene.rows).toHaveLength(CAPABILITY_LIST.length);
    expect(scene.providerId).toBe('broad'); // the first provider is the default
  });

  it('every row carries the primitive, the native convenience, and the portable fallback', () => {
    const scene = createProviderFeaturesScene({ strategies: strategies('portable'), providerId: 'broad' });
    for (const row of scene.rows) {
      expect(row.primitive.length).toBeGreaterThan(0);
      expect(row.nativeConvenience.length).toBeGreaterThan(0);
      expect(row.portableFallback.length).toBeGreaterThan(0);
      expect(row.rationale.length).toBeGreaterThan(0);
    }
  });
});
