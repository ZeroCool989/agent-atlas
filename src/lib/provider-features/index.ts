/**
 * The Model-provider-features build project's public surface (plan §3). A deterministic,
 * dependency-free model of the vendor-specific ring: name the categories of provider feature,
 * resolve one neutral need to a native wrapper or its portable fallback (the capability shim),
 * recommend native vs portable from real decision factors, and score how portable an app is.
 * See `features.ts` for the model and the reasoning behind every field.
 */
export {
  CAPABILITIES,
  CAPABILITY_LIST,
  PROVIDERS,
  resolve,
  recommendStrategy,
  scorePortability,
  uniformProfile,
} from './features';
export type {
  CapabilityId,
  Capability,
  Support,
  ProviderProfile,
  Strategy,
  CapabilityRequest,
  Resolution,
  DecisionFactors,
  Recommendation,
  AppProfile,
  PortabilityReport,
} from './features';
