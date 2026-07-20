/**
 * The Model-provider-features build project (ADR-0005, plan §3): a deterministic,
 * dependency-free model of the outermost, most volatile ring of the atlas — the
 * proprietary features a provider bolts onto the shared primitives.
 *
 * The whole lesson reduces to one distinction this module makes concrete: under every
 * vendor feature there is a STABLE PRIMITIVE you already understand (a token count, a tool
 * call, a schema you validate, a request you can repeat), and the feature is a CONVENIENCE
 * WRAPPER around it — a native structured-output mode, a prompt-caching API, a hosted tool,
 * a batch endpoint, provider-side memory. The wrapper is genuinely useful and genuinely
 * faster to reach for. It is also provider-specific, so every one you adopt is a portability
 * cost you pay on purpose.
 *
 * This file does three things, all as plain, testable functions:
 *   1. names the CATEGORIES of provider feature (a registry), each with its underlying
 *      primitive, its native convenience, and its portable fallback;
 *   2. a "capability shim" — express ONE neutral need, then resolve it against a provider to
 *      the native feature (if offered) or the portable fallback (which works everywhere,
 *      because the primitive is portable);
 *   3. a portability / lock-in scoring model — given how an app satisfies each need, compute
 *      how portable it is and which choices park state on the provider.
 *
 * Everything is NEUTRAL by design. The providers here are abstract profiles (a broad native
 * surface, a partial one, a primitives-only one), not real vendors, and no named API is
 * asserted as fact — the specific surfaces change fast and any real name would be stale by
 * the time you read it. What is real and load-bearing is the SHAPE: a wrapper over a
 * primitive, and a lock-in cost that scales with how much provider-specific surface (and
 * provider-held state) you build on.
 *
 * Plain TypeScript — no Astro, React, UI, or SDK imports. Read it as course material.
 */

/** The categories of proprietary provider feature this lesson names. Deliberately a small,
 * stable set of KINDS, not a catalogue of any vendor's endpoints. */
export type CapabilityId =
  | 'structured-output'
  | 'prompt-caching'
  | 'hosted-tools'
  | 'batch'
  | 'provider-memory';

/**
 * One category of provider feature. The four fields after the label are the lesson in a
 * row: the stable thing underneath (`primitive`), what the wrapper buys (`nativeConvenience`),
 * how to meet the same need without it (`portableFallback`), and the two honesty fields —
 * how hard it is to leave (`lockInWeight`) and whether choosing native parks your state on
 * the provider (`holdsProviderState`), which is the data-residency and auditability question.
 */
export interface Capability {
  id: CapabilityId;
  label: string;
  /** The stable, portable primitive the vendor feature wraps. This is what to learn first. */
  primitive: string;
  /** What the native feature buys over building on the primitive yourself. Real value. */
  nativeConvenience: string;
  /** How to meet the SAME need without the native feature — the portable path, which always
   * exists because the primitive is portable. Usually more of your own code, sometimes worse
   * latency or cost, but it runs on any provider. */
  portableFallback: string;
  /** 0..1 — how expensive it is to migrate off the native feature once you have built on it.
   * Higher = more provider-specific surface (and, when state is held, more to move). This is
   * a teaching weight, not a measurement. */
  lockInWeight: number;
  /** True when choosing the native feature places application state (conversation history,
   * cached content, uploaded corpora) on the provider's side rather than yours — the
   * data-residency, retention, and auditability consideration. */
  holdsProviderState: boolean;
}

/**
 * The five categories, as a registry keyed by id. Ordered from the cheapest to leave
 * (structured output — a thin wrapper over "generate then validate") to the most locking
 * (provider-side memory — the provider holds the state you would have to migrate).
 */
export const CAPABILITIES: Record<CapabilityId, Capability> = {
  'structured-output': {
    id: 'structured-output',
    label: 'Structured-output mode',
    primitive:
      'a schema plus generation: ask the model for JSON, validate it against your schema, retry or repair on a miss',
    nativeConvenience:
      'the provider constrains decoding to your schema, so valid JSON comes back first time without a validate-and-retry loop',
    portableFallback:
      'prompt for JSON and validate against the same schema yourself (the Structured-outputs lesson builds exactly this); you own the retry',
    lockInWeight: 0.2,
    holdsProviderState: false,
  },
  'prompt-caching': {
    id: 'prompt-caching',
    label: 'Prompt-caching API',
    primitive:
      'a token count and a price: a stable prompt prefix is the same tokens every call, and you are billed for them every time',
    nativeConvenience:
      'the provider bills a marked, repeated prefix at a fraction of the input price on later calls — a real cost cut for free, per the Cost-engineering lesson',
    portableFallback:
      'pay full price for the prefix, or run your own application-level response cache for repeated whole requests; correct everywhere, just not as cheap',
    lockInWeight: 0.3,
    holdsProviderState: true,
  },
  'hosted-tools': {
    id: 'hosted-tools',
    label: 'Hosted tools (web search, code execution)',
    primitive:
      'tool calling: the model names a tool and arguments, something runs the tool, the result goes back in the loop',
    nativeConvenience:
      'the provider runs the tool (a web search, a sandboxed interpreter) for you, so there is nothing to build, host, or secure',
    portableFallback:
      'define the same tool in your own registry and run it yourself — a search API, your own sandbox — behind the tool-calling interface you already have',
    lockInWeight: 0.5,
    holdsProviderState: false,
  },
  batch: {
    id: 'batch',
    label: 'Batch endpoint',
    primitive:
      'many independent requests: the same call, repeated over a list of inputs, with no ordering between them',
    nativeConvenience:
      'submit the whole list once and collect results later at a discount, with the queueing and rate-limiting handled for you',
    portableFallback:
      'loop over the inputs yourself with a concurrency limit and backoff; more of your own plumbing, no discount, runs anywhere',
    lockInWeight: 0.3,
    holdsProviderState: false,
  },
  'provider-memory': {
    id: 'provider-memory',
    label: 'Provider-side memory / threads',
    primitive:
      'conversation state: the messages so far, stored somewhere and replayed into the next prompt (the Memory lesson builds this)',
    nativeConvenience:
      'the provider stores the thread and its state for you, so you pass an id instead of assembling the history each turn',
    portableFallback:
      'keep the conversation state in your own store and replay it into the prompt yourself — the portable memory the Memory lesson already teaches',
    lockInWeight: 0.9,
    holdsProviderState: true,
  },
};

/** The registry as an ordered list, for iteration and rendering. */
export const CAPABILITY_LIST: readonly Capability[] = Object.values(CAPABILITIES);

/** How a provider supports a capability. `native` = it offers the wrapper; `fallback-only` =
 * it exposes only the primitive, so you build the portable path; the portable path is ALWAYS
 * available regardless, which is the whole point. */
export type Support = 'native' | 'fallback-only';

/**
 * A NEUTRAL, abstract provider profile — not a real vendor. Three of them make the lesson's
 * point: the same neutral need maps to a native feature on one provider and to the portable
 * fallback on another, and your code only stays the same across all of them if it targets the
 * primitive.
 */
export interface ProviderProfile {
  id: string;
  label: string;
  /** For each capability: native wrapper offered, or primitives only. */
  support: Record<CapabilityId, Support>;
}

const allNative: Record<CapabilityId, Support> = {
  'structured-output': 'native',
  'prompt-caching': 'native',
  'hosted-tools': 'native',
  batch: 'native',
  'provider-memory': 'native',
};

/** Three abstract providers along a spectrum of native surface area. Labelled generically on
 * purpose — do not read real vendors into them. */
export const PROVIDERS: Record<string, ProviderProfile> = {
  broad: {
    id: 'broad',
    label: 'Provider A (broad native surface)',
    support: { ...allNative },
  },
  partial: {
    id: 'partial',
    label: 'Provider B (partial surface)',
    support: {
      'structured-output': 'native',
      'prompt-caching': 'native',
      'hosted-tools': 'fallback-only',
      batch: 'native',
      'provider-memory': 'fallback-only',
    },
  },
  primitivesOnly: {
    id: 'primitivesOnly',
    label: 'Provider C (primitives only)',
    support: {
      'structured-output': 'fallback-only',
      'prompt-caching': 'fallback-only',
      'hosted-tools': 'fallback-only',
      batch: 'fallback-only',
      'provider-memory': 'fallback-only',
    },
  },
};

/** How a need is met once resolved: on the provider's native feature, or on the portable
 * primitive. This is the single choice the whole model turns on. */
export type Strategy = 'native' | 'portable';

/**
 * A neutral capability request: the need, plus the team's stance. `preferPortable` is the
 * "learn the primitive first, treat the wrapper as swappable" default made explicit — set it
 * and the shim takes the portable path even where a native feature is on offer.
 */
export interface CapabilityRequest {
  capability: CapabilityId;
  /** When true, take the portable fallback even if the provider offers the native feature. */
  preferPortable?: boolean;
}

/** The result of resolving one need against one provider: which strategy, why, and the two
 * facts that make the trade honest. */
export interface Resolution {
  capability: CapabilityId;
  provider: string;
  strategy: Strategy;
  /** Why this strategy was chosen, in one sentence. */
  rationale: string;
  /** True when the native feature was available but not taken (portability was preferred),
   * or was simply unavailable — either way, the portable path is what runs. */
  portableEverywhere: boolean;
  /** True when this resolution (native) parks state on the provider. Always false for a
   * portable resolution. */
  holdsProviderState: boolean;
}

function capabilityOf(id: CapabilityId): Capability {
  const cap = CAPABILITIES[id];
  if (!cap) throw new Error(`unknown capability "${id}" (known: ${CAPABILITY_LIST.map((c) => c.id).join(', ')})`);
  return cap;
}

function providerOf(id: string): ProviderProfile {
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`unknown provider "${id}" (known: ${Object.keys(PROVIDERS).join(', ')})`);
  return provider;
}

/**
 * The capability shim: resolve ONE neutral need against ONE provider.
 *
 * The rule is simple and is the lesson: use the native feature only when the provider offers
 * it AND you did not ask to stay portable; otherwise take the fallback. The fallback is always
 * reachable, because it is built on the primitive, which every provider exposes. So a request
 * expressed once resolves to native on a provider that has the wrapper and to portable on one
 * that does not — and your calling code does not change, because it asked for the NEED, not the
 * vendor's endpoint.
 */
export function resolve(request: CapabilityRequest, providerId: string): Resolution {
  const cap = capabilityOf(request.capability);
  const provider = providerOf(providerId);
  const nativeAvailable = provider.support[cap.id] === 'native';
  const takeNative = nativeAvailable && !request.preferPortable;

  if (takeNative) {
    return {
      capability: cap.id,
      provider: provider.id,
      strategy: 'native',
      rationale: `${provider.label} offers ${cap.label} natively: ${cap.nativeConvenience}.`,
      portableEverywhere: false,
      holdsProviderState: cap.holdsProviderState,
    };
  }

  const reason = !nativeAvailable
    ? `${provider.label} exposes only the primitive here`
    : 'portability was preferred over the native convenience';
  return {
    capability: cap.id,
    provider: provider.id,
    strategy: 'portable',
    rationale: `Take the portable fallback because ${reason}: ${cap.portableFallback}.`,
    portableEverywhere: true,
    holdsProviderState: false,
  };
}

/** The decision inputs a team actually weighs when choosing native vs portable for one need. */
export interface DecisionFactors {
  /** 0..1 — how much a future provider switch matters. High = keep it portable. */
  portabilityPriority: number;
  /** Rough scale. The native convenience (a batch discount, managed hosting) is worth more the
   * more volume rides on it. */
  volume: 'low' | 'high';
  /** True when you would otherwise have to build and run real infrastructure (a sandbox, a
   * search stack, a cache tier) — the case where the wrapper saves the most. */
  needsManagedInfra: boolean;
  /** True when data residency, retention, or auditability rules constrain where state may
   * live — which forbids native features that hold your state elsewhere. */
  dataResidencyConstraint: boolean;
}

/** A recommendation with its reason and how firmly it holds — the output of the decision rule. */
export interface Recommendation {
  capability: CapabilityId;
  strategy: Strategy;
  /** True when the rule is a hard constraint (residency forbids parking state), not a judgment
   * call — a `forced` native/portable choice should not be overridden lightly. */
  forced: boolean;
  reason: string;
}

/**
 * Recommend native vs portable for one capability from the factors. The rule encodes the
 * atlas's stance without pretending the answer is always "stay portable":
 *
 *   1. A data-residency constraint on a capability that holds state on the provider is a HARD
 *      no — you cannot let the provider hold state you are required to keep. Portable, forced.
 *   2. A high portability priority tips to portable — the swap you are protecting is worth more
 *      than the convenience.
 *   3. Otherwise, the native feature earns its lock-in when it saves real work at real volume:
 *      managed infrastructure you would otherwise build, at high volume. Native.
 *   4. Default: portable. Learn the primitive first; adopt the wrapper deliberately, not by
 *      reflex.
 */
export function recommendStrategy(capabilityId: CapabilityId, factors: DecisionFactors): Recommendation {
  const cap = capabilityOf(capabilityId);

  if (factors.dataResidencyConstraint && cap.holdsProviderState) {
    return {
      capability: cap.id,
      strategy: 'portable',
      forced: true,
      reason: `${cap.label} would place state on the provider, which a data-residency constraint forbids — keep the state yours.`,
    };
  }
  if (factors.portabilityPriority >= 0.6) {
    return {
      capability: cap.id,
      strategy: 'portable',
      forced: false,
      reason: `Portability matters more here than the native convenience — build on the primitive so a provider switch stays cheap.`,
    };
  }
  if (factors.needsManagedInfra && factors.volume === 'high') {
    return {
      capability: cap.id,
      strategy: 'native',
      forced: false,
      reason: `At high volume the native feature saves infrastructure you would otherwise build and run — the lock-in is worth paying here, on purpose.`,
    };
  }
  return {
    capability: cap.id,
    strategy: 'portable',
    forced: false,
    reason: `No strong pull to native: learn the primitive first and treat the wrapper as a convenience you can swap in later.`,
  };
}

/** How an application meets each of its needs: a strategy per capability. Only the capabilities
 * the app actually uses need appear. */
export type AppProfile = Partial<Record<CapabilityId, Strategy>>;

/** The portability verdict for a whole application. */
export interface PortabilityReport {
  /** 0..100. 100 = every need met on a portable primitive; 0 = every need on a native wrapper,
   * weighted by how hard each is to leave. */
  score: number;
  nativeCount: number;
  portableCount: number;
  /** 0..1 — the lock-in-weighted fraction of the app's surface that sits on native features.
   * `score` is `round(100 * (1 - lockInIndex))`. */
  lockInIndex: number;
  /** Capabilities met natively that park state on the provider — the data-residency watch-list. */
  providerHeldState: CapabilityId[];
  /** One human note per native choice: what it would cost to migrate off. */
  migrationNotes: string[];
}

/**
 * Score an application's portability from how it meets each need.
 *
 * The index is a lock-in-WEIGHTED fraction, not a plain count: putting provider-side memory
 * (weight 0.9) on the native feature costs your score far more than putting structured output
 * (weight 0.2) on it, because memory is the one you would actually struggle to migrate. An app
 * that takes every portable fallback scores 100; one that adopts every native wrapper scores 0;
 * realistic apps land in between, and the score moves the way your migration bill would.
 */
export function scorePortability(app: AppProfile): PortabilityReport {
  const entries = (Object.entries(app) as Array<[CapabilityId, Strategy]>).filter(([, s]) => s !== undefined);

  let totalWeight = 0;
  let lockedWeight = 0;
  let nativeCount = 0;
  let portableCount = 0;
  const providerHeldState: CapabilityId[] = [];
  const migrationNotes: string[] = [];

  for (const [id, strategy] of entries) {
    const cap = capabilityOf(id);
    totalWeight += cap.lockInWeight;
    if (strategy === 'native') {
      nativeCount += 1;
      lockedWeight += cap.lockInWeight;
      if (cap.holdsProviderState) providerHeldState.push(id);
      migrationNotes.push(
        `${cap.label}: to leave, rebuild on the primitive — ${cap.primitive}${
          cap.holdsProviderState ? ', and migrate the state the provider holds' : ''
        }.`,
      );
    } else {
      portableCount += 1;
    }
  }

  const lockInIndex = totalWeight === 0 ? 0 : lockedWeight / totalWeight;
  const score = Math.round(100 * (1 - lockInIndex));

  return {
    score,
    nativeCount,
    portableCount,
    lockInIndex: Math.round(lockInIndex * 1000) / 1000,
    providerHeldState,
    migrationNotes,
  };
}

/** Build an `AppProfile` that meets every capability the same way — the two reference points
 * (all-native, all-portable) the demo starts and ends between. */
export function uniformProfile(strategy: Strategy): AppProfile {
  const profile: AppProfile = {};
  for (const cap of CAPABILITY_LIST) profile[cap.id] = strategy;
  return profile;
}
