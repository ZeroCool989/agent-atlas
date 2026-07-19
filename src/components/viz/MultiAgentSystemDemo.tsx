/**
 * The Multi-agent systems Tier-2 steppable visual — the flagship (plan §8, "the most ambitious
 * visual"). Watch a supervisor decompose a goal, delegate subtasks to three role-specialized
 * workers, an INDEPENDENT critic reject the writer's draft, the supervisor re-delegate a fix, and
 * the answer get composed — then a final beat sets the whole run's cost against a single good
 * agent. The org chart is a pure-trig SVG graph (no D3): the supervisor on top, workers on an arc,
 * the output at the bottom; the message flowing this step lights up exactly one edge.
 *
 * State is a single `step`; the pure `createMultiAgentScene` derives the complete truth from the
 * orchestration build project (`src/lib/multi-agent/`); this renderer only displays it — word AND
 * glyph for every state, never colour alone, aria-labels throughout, no motion that carries
 * meaning (reduced-motion safe by construction). Server-rendered at step 0.
 */
import { useState } from 'react';

import { MULTI_AGENT_DEMO_INPUT, createMultiAgentScene } from '../../lib/viz';
import type { AgentNode } from '../../lib/viz';
import type { AgentState, MessageKind } from '../../lib/multi-agent/orchestrate';
import Stepper from './Stepper';

const S = 6; // scene coords (0–100) → SVG user units
const VIEW = 100 * S;

const STATE_GLYPH: Record<AgentState, string> = {
  idle: '○',
  delegating: '⇊',
  working: '▶',
  done: '✓',
  failed: '✗',
};

const STATE_WORD: Record<AgentState, string> = {
  idle: 'idle',
  delegating: 'delegating',
  working: 'working',
  done: 'done',
  failed: 'failed',
};

// Fills/strokes are paired with the glyph+word above, so they are reinforcement, never the signal.
const STATE_FILL: Record<AgentState, string> = {
  idle: '#f8fafc',
  delegating: '#eef2ff',
  working: '#eff6ff',
  done: '#ecfdf5',
  failed: '#fef2f2',
};
const STATE_STROKE: Record<AgentState, string> = {
  idle: '#cbd5e1',
  delegating: '#6366f1',
  working: '#3b82f6',
  done: '#10b981',
  failed: '#f43f5e',
};

const MSG_LABEL: Record<MessageKind, string> = {
  delegate: 'delegate',
  result: 'result',
  failure: 'failure',
  're-delegate': 're-plan',
  compose: 'compose',
};
const MSG_STROKE: Record<MessageKind, string> = {
  delegate: '#6366f1',
  result: '#10b981',
  failure: '#f43f5e',
  're-delegate': '#f59e0b',
  compose: '#0ea5e9',
};

const SUBTASK_GLYPH = { pending: '○', 'in-progress': '▶', done: '✓', failed: '✗' } as const;
const SUBTASK_CLASS = {
  pending: 'text-slate-400',
  'in-progress': 'text-indigo-700 font-semibold',
  done: 'text-emerald-700',
  failed: 'text-rose-700 line-through',
} as const;

function Node({ node }: { node: AgentNode }) {
  const w = node.kind === 'supervisor' ? 190 : 150;
  const h = 68;
  const cx = node.x * S;
  const cy = node.y * S;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={STATE_FILL[node.state]}
        stroke={STATE_STROKE[node.state]}
        strokeWidth={node.state === 'idle' ? 1.5 : 3}
      />
      <text x={cx} y={y + 24} textAnchor="middle" fontSize={20} fontWeight={600} fill="#0f172a">
        {node.kind === 'supervisor' ? 'Supervisor' : node.label}
      </text>
      {node.specialty ? (
        <text x={cx} y={y + 42} textAnchor="middle" fontSize={12.5} fill="#64748b">
          {node.specialty}
        </text>
      ) : null}
      <text x={cx} y={y + h - 12} textAnchor="middle" fontSize={13} fill={STATE_STROKE[node.state]}>
        {STATE_GLYPH[node.state]} {STATE_WORD[node.state]}
        {node.modelCalls > 0 ? ` · ${node.modelCalls} call${node.modelCalls === 1 ? '' : 's'}` : ''}
      </text>
    </g>
  );
}

export default function MultiAgentSystemDemo() {
  const [step, setStep] = useState(0);
  const scene = createMultiAgentScene(MULTI_AGENT_DEMO_INPUT, step);
  const byId = new Map(scene.nodes.map((n) => [n.id, n]));

  const a11y =
    `${scene.title}. ${scene.description} ` +
    `Agents: ${scene.nodes.map((n) => `${n.label} is ${STATE_WORD[n.state]}`).join(', ')}. ` +
    `${scene.totalModelCalls} model calls so far.`;

  return (
    <section aria-label="Multi-agent orchestration walkthrough" className="space-y-4">
      <p className="text-sm text-slate-600">
        Goal: <em>“{MULTI_AGENT_DEMO_INPUT.goal}”</em>
      </p>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
            {scene.kind}
          </span>
          <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs tabular-nums text-slate-600">
            cost: {scene.totalModelCalls} model call{scene.totalModelCalls === 1 ? '' : 's'}
          </span>
          {scene.outcome ? (
            <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
              outcome: {scene.outcome}
            </span>
          ) : null}
        </div>
        <h2 className="mt-2 text-xl font-semibold">
          {scene.step + 1}. {scene.title}
        </h2>
        <p className="mt-1 text-slate-600">{scene.description}</p>
      </div>

      {/* The org-chart graph. Edges drawn first (behind), nodes on top; the active edge is thicker,
          coloured, and labelled with the message kind — the one hand-off happening this step. */}
      <figure className="space-y-1">
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          role="img"
          aria-label={a11y}
          className="w-full rounded border border-slate-300 bg-white"
        >
          {scene.edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            const stroke = edge.active && edge.kind ? MSG_STROKE[edge.kind] : '#e2e8f0';
            const mx = ((from.x + to.x) / 2) * S;
            const my = ((from.y + to.y) / 2) * S;
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={from.x * S}
                  y1={from.y * S}
                  x2={to.x * S}
                  y2={to.y * S}
                  stroke={stroke}
                  strokeWidth={edge.active ? 4 : 1.5}
                  strokeDasharray={edge.active ? '8 5' : undefined}
                />
                {edge.active && edge.kind ? (
                  <g>
                    <rect x={mx - 44} y={my - 14} width={88} height={22} rx={6} fill="#ffffff" stroke={MSG_STROKE[edge.kind]} strokeWidth={1.5} />
                    <text x={mx} y={my + 1.5} textAnchor="middle" fontSize={13} fill={MSG_STROKE[edge.kind]}>
                      {MSG_LABEL[edge.kind]}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
          {scene.nodes.map((node) => (
            <Node key={node.id} node={node} />
          ))}
        </svg>
        <figcaption className="text-xs text-slate-500">
          The supervisor delegates to specialists and composes their results. Each arrow is a real
          message; each node shows its state and the model calls it has spent.
        </figcaption>
      </figure>

      {/* The subtask board — the timeline of the run, word+glyph statuses. */}
      <div>
        <p className="text-sm font-medium text-slate-700">Subtasks</p>
        <ol aria-label="Subtask board" className="mt-1 space-y-1">
          {scene.subtasks.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <span className={`w-4 shrink-0 tabular-nums ${SUBTASK_CLASS[s.state]}`} aria-hidden="true">
                {SUBTASK_GLYPH[s.state]}
              </span>
              <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-slate-400">
                {s.role} · {s.state}
              </span>
              <span>
                <span className={SUBTASK_CLASS[s.state]}>{s.description}</span>
                {s.result ? <span className="text-slate-500"> — {s.result}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {scene.finalAnswer ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          <span className="font-medium">Composed answer:</span> {scene.finalAnswer}
        </div>
      ) : null}

      {/* The honest contrast: multi-agent vs a single good agent, on two tasks. */}
      {scene.baseline ? (
        <div className="rounded border border-slate-300 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-800">Multi-agent vs. one well-structured agent</p>
          <div className="mt-2 space-y-3">
            {scene.baseline.map((c, i) => (
              <div key={i} className="rounded border border-slate-200 bg-white p-2 text-sm">
                <p className="font-medium text-slate-700">{c.task}</p>
                <ul className="mt-1 space-y-1">
                  <li>
                    <span className="inline-block w-28 text-xs uppercase tracking-wide text-slate-400">
                      single agent
                    </span>
                    <span className="tabular-nums text-slate-600">{c.singleAgent.modelCalls} call{c.singleAgent.modelCalls === 1 ? '' : 's'}</span>
                    <span className="text-slate-600"> — {c.singleAgent.verdict}</span>
                  </li>
                  <li>
                    <span className="inline-block w-28 text-xs uppercase tracking-wide text-slate-400">
                      multi-agent
                    </span>
                    <span className="tabular-nums text-slate-600">{c.multiAgent.modelCalls} call{c.multiAgent.modelCalls === 1 ? '' : 's'}</span>
                    <span className="text-slate-600"> — {c.multiAgent.verdict}</span>
                  </li>
                </ul>
                <p className="mt-1 text-xs font-medium text-slate-800">
                  Better here: {c.winner === 'multi-agent' ? 'the multi-agent system' : 'a single agent'}.
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Multi-agent steps"
        stepLabel={scene.title}
      />

      <p className="text-xs text-slate-500">
        The org chart, every message, each agent’s state, and the model-call count are produced by
        the deterministic orchestrator in this repo (<code>src/lib/multi-agent/</code>). Swap its
        scripted supervisor and workers for model calls and the message-passing shape is unchanged.
      </p>
    </section>
  );
}
