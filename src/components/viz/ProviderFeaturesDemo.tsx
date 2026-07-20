/**
 * The Model-provider-features lesson's interactive visual. For each category of provider
 * feature, choose the NATIVE wrapper or the portable PRIMITIVE underneath, and watch two
 * things move together: the fallback path for that need, and the whole app's portability
 * score. Switch the abstract provider and watch native features that Provider A offers become
 * "primitive only" on Provider C — the wrapper is provider-specific, the primitive is not.
 *
 * State is a strategy per capability plus the selected provider; the pure
 * `createProviderFeaturesScene` (in `src/lib/viz`) derives the whole scene from the build
 * project's model, and this component only renders it. Server-rendered at its default state
 * (every need on the broad provider's native features), so the first frame — a low
 * portability score with everything locked in — is meaningful without JS.
 */
import { useState } from 'react';

import { CAPABILITY_LIST, PROVIDERS, type CapabilityId, type Strategy } from '../../lib/provider-features';
import { createProviderFeaturesScene } from '../../lib/viz';
import type { ProviderFeatureRow } from '../../lib/viz';

const PROVIDER_IDS = Object.keys(PROVIDERS);

function defaultStrategies(): Record<CapabilityId, Strategy> {
  return Object.fromEntries(CAPABILITY_LIST.map((c) => [c.id, 'native'])) as Record<CapabilityId, Strategy>;
}

function StrategyToggle({
  row,
  onChoose,
}: {
  row: ProviderFeatureRow;
  onChoose: (strategy: Strategy) => void;
}) {
  const base = 'rounded border px-2 py-0.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="inline-flex gap-1" role="group" aria-label={`How to meet ${row.label}`}>
      <button
        type="button"
        className={base}
        aria-pressed={row.chosen === 'native'}
        disabled={!row.nativeAvailable}
        onClick={() => onChoose('native')}
        style={{
          borderColor: row.effective === 'native' ? 'var(--viz-active, #6366f1)' : 'var(--viz-border, #cbd5e1)',
          color: row.effective === 'native' ? 'var(--viz-active, #6366f1)' : 'var(--viz-muted, #64748b)',
          background: row.effective === 'native' ? 'var(--viz-active-bg, #eef2ff)' : 'transparent',
        }}
        title={row.nativeAvailable ? 'Use the provider’s native feature' : 'This provider exposes only the primitive'}
      >
        Native
      </button>
      <button
        type="button"
        className={base}
        aria-pressed={row.chosen === 'portable'}
        onClick={() => onChoose('portable')}
        style={{
          borderColor: row.effective === 'portable' ? 'var(--viz-ok, #16a34a)' : 'var(--viz-border, #cbd5e1)',
          color: row.effective === 'portable' ? 'var(--viz-ok, #16a34a)' : 'var(--viz-muted, #64748b)',
          background: row.effective === 'portable' ? 'var(--viz-ok-bg, #f0fdf4)' : 'transparent',
        }}
        title="Build on the portable primitive yourself"
      >
        Portable
      </button>
    </div>
  );
}

function FeatureRow({
  row,
  onChoose,
}: {
  row: ProviderFeatureRow;
  onChoose: (strategy: Strategy) => void;
}) {
  const path = row.effective === 'native' ? row.nativeConvenience : row.portableFallback;
  return (
    <li className="space-y-1 px-3 py-2 text-sm" data-effective={row.effective} data-capability={row.capability}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium text-slate-700">{row.label}</span>
          <span className="rounded bg-slate-200 px-1 text-[10px] text-slate-600" title="How hard it is to leave">
            lock-in {row.lockInWeight.toFixed(1)}
          </span>
          {row.holdsProviderState && row.effective === 'native' && (
            <span className="rounded border border-amber-400 px-1 text-[10px] uppercase text-amber-700">
              holds your state
            </span>
          )}
          {row.forcedPortable && (
            <span className="rounded bg-slate-200 px-1 text-[10px] text-slate-600">primitive only here</span>
          )}
        </div>
        <StrategyToggle row={row} onChoose={onChoose} />
      </div>
      <p className="text-xs text-slate-500">
        <span className="font-semibold text-slate-600">
          {row.effective === 'native' ? 'Native wrapper: ' : 'Portable primitive: '}
        </span>
        {path}
      </p>
    </li>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="tabular-nums text-sm font-semibold text-slate-700">{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default function ProviderFeaturesDemo() {
  const [providerId, setProviderId] = useState(PROVIDER_IDS[0]!);
  const [strategies, setStrategies] = useState<Record<CapabilityId, Strategy>>(defaultStrategies);
  const scene = createProviderFeaturesScene({ strategies, providerId });

  const choose = (capability: CapabilityId, strategy: Strategy) =>
    setStrategies((prev) => ({ ...prev, [capability]: strategy }));

  const barColor =
    scene.score >= 67 ? 'var(--viz-ok, #16a34a)' : scene.score >= 34 ? 'var(--viz-warn, #d97706)' : 'var(--viz-error, #ef4444)';

  return (
    <section aria-label="Provider-features portability explorer" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Native wrapper, or portable primitive?</h2>
        <p className="mt-1 text-slate-600">{scene.headline}</p>
      </div>

      {/* Pick the provider: the same needs, a different native surface. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Select provider">
        <span className="text-xs uppercase tracking-wide text-slate-400">Provider</span>
        {PROVIDER_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            aria-pressed={id === scene.providerId}
            onClick={() => setProviderId(id)}
            style={{
              borderColor: id === scene.providerId ? 'var(--viz-active, #6366f1)' : undefined,
              color: id === scene.providerId ? 'var(--viz-active, #6366f1)' : undefined,
            }}
          >
            {PROVIDERS[id]!.label}
          </button>
        ))}
      </div>

      {/* Each need: native wrapper or portable primitive, with the resolved path shown. */}
      <ul
        className="divide-y divide-slate-200 rounded-md border border-slate-300 bg-slate-50"
        aria-label="Provider feature categories"
      >
        {scene.rows.map((row) => (
          <FeatureRow key={row.capability} row={row} onChoose={(s) => choose(row.capability, s)} />
        ))}
      </ul>

      {/* The portability verdict for the whole app. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Portability summary">
        <Metric label="Portability" value={`${scene.score} / 100`} />
        <Metric label="On native features" value={`${scene.nativeCount} of ${scene.rows.length}`} />
        <Metric label="On the primitive" value={`${scene.portableCount} of ${scene.rows.length}`} />
        <Metric
          label="State held by provider"
          value={`${scene.providerHeldState.length}`}
          sub={scene.providerHeldState.length > 0 ? 'data-residency watch-list' : 'nothing parked away'}
        />
      </div>

      {/* Portability bar: green = portable, red = locked in. */}
      <div aria-hidden="true" className="h-3 w-full overflow-hidden rounded bg-slate-100">
        <div
          className="h-full rounded"
          style={{ width: `${Math.max(scene.scorePercent, 2)}%`, background: barColor, transition: 'width 300ms ease' }}
        />
      </div>

      {scene.migrationNotes.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">To leave this provider you would have to:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {scene.migrationNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Every score and path comes from the model in this repo (<code>src/lib/provider-features/</code>). The
        providers are abstract profiles, not real vendors, and no named API is asserted — the specifics change
        fast. What is real is the shape: a wrapper over a stable primitive, and a lock-in cost that grows with how
        much provider-specific surface (and provider-held state) you build on.
      </p>
    </section>
  );
}
