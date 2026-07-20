/**
 * The scene builder for the Model-provider-features demo (ADR-0004, plan §8). Pure and
 * deterministic — no DOM, no React, no timers. It takes the demo's state (a strategy per
 * capability, plus which abstract provider is selected) and derives everything the island
 * renders: one row per feature category and the app's portability verdict.
 *
 * The story it drives: each capability can be met on the provider's NATIVE wrapper or on the
 * portable PRIMITIVE underneath. Toggle one and watch two things move together — the fallback
 * path for that need, and the whole app's portability score. Switch providers and watch native
 * features that Provider A offers become "primitive only" on Provider C, which forces the
 * portable path (the fallback works everywhere; the wrapper does not).
 *
 * Every number comes from `scorePortability`/`resolve` in the build project
 * (`src/lib/provider-features/`), so the picture can never drift from the model.
 */
import {
  CAPABILITY_LIST,
  PROVIDERS,
  resolve,
  scorePortability,
  type AppProfile,
  type CapabilityId,
  type PortabilityReport,
  type Strategy,
} from '../provider-features';

/** The demo's state: what the learner picked for each need, and which provider is selected. */
export interface ProviderFeaturesSceneInput {
  strategies: Record<CapabilityId, Strategy>;
  providerId: string;
}

/** One capability as a render-ready row: the lesson in a line, plus what the current state
 * resolves it to. */
export interface ProviderFeatureRow {
  capability: CapabilityId;
  label: string;
  primitive: string;
  nativeConvenience: string;
  portableFallback: string;
  lockInWeight: number;
  /** Does the selected provider offer this as a native feature? */
  nativeAvailable: boolean;
  /** What the learner picked. */
  chosen: Strategy;
  /** What actually runs: `chosen`, unless native was picked on a provider that lacks it, in
   * which case the portable path runs instead. */
  effective: Strategy;
  /** True when native was picked but the provider exposes only the primitive — the visible
   * proof that a native feature is provider-specific while the fallback is not. */
  forcedPortable: boolean;
  /** Why the effective strategy is what it is, in one sentence (from `resolve`). */
  rationale: string;
  /** True when the effective (native) choice parks state on the provider. */
  holdsProviderState: boolean;
}

export interface ProviderFeaturesScene {
  providerId: string;
  providerLabel: string;
  rows: ProviderFeatureRow[];
  /** The portability verdict, computed from the EFFECTIVE strategies (what actually runs). */
  report: PortabilityReport;
  score: number;
  /** Score as 0..100 for bar geometry (same as `score`, named for the renderer's intent). */
  scorePercent: number;
  nativeCount: number;
  portableCount: number;
  /** Native features that hold state on the provider — the data-residency watch-list. */
  providerHeldState: CapabilityId[];
  migrationNotes: string[];
  /** Accessible one-line summary of the whole scene. */
  headline: string;
  isFullyPortable: boolean;
  isFullyNative: boolean;
}

/**
 * Derive the whole scene from the demo state. The effective strategy per row is the honest
 * one: picking "native" on a provider that only exposes the primitive still runs the portable
 * path, and the score reflects what runs, not what was wished for.
 */
export function createProviderFeaturesScene(input: ProviderFeaturesSceneInput): ProviderFeaturesScene {
  const providerId = PROVIDERS[input.providerId] ? input.providerId : Object.keys(PROVIDERS)[0]!;
  const provider = PROVIDERS[providerId]!;

  const rows: ProviderFeatureRow[] = CAPABILITY_LIST.map((cap) => {
    const chosen: Strategy = input.strategies[cap.id] ?? 'portable';
    const nativeAvailable = provider.support[cap.id] === 'native';
    // Resolve through the shim: preferPortable when the learner chose portable. The shim only
    // returns native when the provider offers it, so an unavailable native pick becomes portable.
    const resolution = resolve({ capability: cap.id, preferPortable: chosen === 'portable' }, providerId);
    const effective = resolution.strategy;
    return {
      capability: cap.id,
      label: cap.label,
      primitive: cap.primitive,
      nativeConvenience: cap.nativeConvenience,
      portableFallback: cap.portableFallback,
      lockInWeight: cap.lockInWeight,
      nativeAvailable,
      chosen,
      effective,
      forcedPortable: chosen === 'native' && !nativeAvailable,
      rationale: resolution.rationale,
      holdsProviderState: resolution.holdsProviderState,
    };
  });

  const effectiveProfile: AppProfile = {};
  for (const row of rows) effectiveProfile[row.capability] = row.effective;
  const report = scorePortability(effectiveProfile);

  const isFullyPortable = report.nativeCount === 0;
  const isFullyNative = report.portableCount === 0 && report.nativeCount === CAPABILITY_LIST.length;

  const headline = isFullyPortable
    ? `Every need met on the portable primitive: fully portable (${report.score}/100), nothing parked on ${provider.label}.`
    : `${report.nativeCount} of ${CAPABILITY_LIST.length} needs on ${provider.label}'s native features: portability ${report.score}/100, ` +
      `${report.providerHeldState.length} holding state on the provider.`;

  return {
    providerId,
    providerLabel: provider.label,
    rows,
    report,
    score: report.score,
    scorePercent: report.score,
    nativeCount: report.nativeCount,
    portableCount: report.portableCount,
    providerHeldState: report.providerHeldState,
    migrationNotes: report.migrationNotes,
    headline,
    isFullyPortable,
    isFullyNative,
  };
}
