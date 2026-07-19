/**
 * Renderer for the MCP handshake scenes (ADR-0004). Controlled step state; one instance
 * owns its own step (no module state). Scenes are built at build time from the real toy
 * MCP client/server and passed in; this component only displays them. The step-0 scene
 * renders server-side as the static first frame, then the island hydrates on scroll.
 */
import { useState } from 'react';

import type { McpHandshakeScene } from '../../lib/viz/mcp-handshake-scene';
import Stepper from './Stepper';

const DIRECTION_LABEL: Record<string, string> = {
  'client-to-server': 'client → server',
  'server-to-client': 'server → client',
  internal: 'in host',
};

export default function McpHandshakeIsland({ scenes }: { scenes: McpHandshakeScene[] }) {
  const [step, setStep] = useState(0);
  const scene = scenes[Math.min(step, scenes.length - 1)]!;

  return (
    <figure className="not-prose my-6 rounded-lg border border-slate-300 p-4">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium text-slate-700">
        <span data-testid="mcp-title">{scene.title}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-600">
          {scene.actor}
        </span>
      </figcaption>

      {/* The handshake timeline: the whole shape, current step active, rest dimmed. */}
      <ol className="mb-3 space-y-1">
        {scene.rows.map((row) => (
          <li
            key={row.index}
            data-state={row.state}
            className={
              row.state === 'active'
                ? 'text-sm font-semibold text-slate-900'
                : row.state === 'completed'
                  ? 'text-sm text-slate-500'
                  : 'text-sm text-slate-300'
            }
          >
            {row.state === 'completed' ? '✓ ' : row.state === 'active' ? '→ ' : '· '}
            {row.label}
          </li>
        ))}
      </ol>

      {scene.discoveredTools.length > 0 && (
        <p className="mb-2 text-sm text-slate-600" data-testid="mcp-discovered">
          Discovered tools:{' '}
          {scene.discoveredTools.map((name) => (
            <span
              key={name}
              className="mr-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-900"
            >
              {name}
            </span>
          ))}
        </p>
      )}

      {scene.envelopes.length > 0 && (
        <div className="mb-3 space-y-2">
          {scene.envelopes.map((env) => (
            <div key={env.label} className="rounded border border-slate-200 bg-slate-50">
              <div className="flex items-baseline justify-between border-b border-slate-200 px-3 py-1 text-xs text-slate-600">
                <span className="font-medium">{env.label}</span>
                <span className="font-mono">{DIRECTION_LABEL[env.direction]}</span>
              </div>
              <pre className="overflow-x-auto px-3 py-2 text-xs leading-snug text-slate-800">
                <code>{env.json}</code>
              </pre>
            </div>
          ))}
        </div>
      )}

      <p className="mb-3 min-h-[3.5rem] text-sm text-slate-700">{scene.description}</p>

      <Stepper
        step={step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="MCP handshake steps"
        stepLabel={scene.title}
      />
    </figure>
  );
}
