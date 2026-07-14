/**
 * Experiment definitions and results — the laboratory's data model. Definitions are
 * versioned TypeScript modules validated by this schema at load; results are
 * structured JSON that the /experiments viewer and the intake pipeline consume.
 * Only observable behavior is recorded — no field exists for "what the model thought".
 */
import { z } from 'zod';

import type { RunOutcome, TraceEvent } from '../../src/lib/agent';
import type { StopReason } from '../../src/lib/model';

const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be kebab-case');

const pricingSchema = z
  .object({
    inputPerMTok: z.number().nonnegative(),
    outputPerMTok: z.number().nonnegative(),
    currency: z.string().min(1),
  })
  .strict();

const scriptedRowSchema = z
  .object({
    kind: z.literal('scripted'),
    label: kebab,
    /** Scenario id in src/lib/model/scenarios/<id>.scenario.json */
    scenario: kebab,
    /** Override the experiment-level expected outcome for this row. */
    expectedOutcome: z.string().optional(),
  })
  .strict();

const realRowSchema = z
  .object({
    kind: z.literal('real'),
    label: kebab,
    provider: z.enum(['claude', 'openai', 'gemini', 'openai-compatible']),
    /** Display/protocol name for openai-compatible servers (qwen, llama, deepseek…). */
    providerName: kebab.optional(),
    model: z.string().min(1),
    temperature: z.number().min(0).max(2).optional(),
    seed: z.number().int().optional(),
    maxOutputTokens: z.number().int().positive().optional(),
    /** Env var holding the base URL for openai-compatible servers. */
    baseUrlEnv: z.string().optional(),
    /** Optional, per-run pricing — costs are 'estimated' and only computed when given. */
    pricing: pricingSchema.optional(),
    expectedOutcome: z.string().optional(),
  })
  .strict();

export const experimentSchema = z
  .object({
    id: kebab,
    version: z.number().int().positive(),
    goal: z.string().min(1),
    question: z.string().min(1),
    expectedObservation: z.string().min(1),
    notes: z.string().optional(),
    /** Tool names resolved by experiments/lib/tools.ts — the runtime allowlist. */
    tools: z.array(z.enum(['calculator', 'unreliable-lookup'])),
    maxSteps: z.number().int().positive().max(20),
    repeats: z.number().int().positive().max(20),
    variants: z
      .array(z.object({ key: kebab, system: z.string().optional(), prompt: z.string().min(1) }).strict())
      .min(1),
    matrix: z.array(z.discriminatedUnion('kind', [scriptedRowSchema, realRowSchema])).min(1),
    successCriteria: z
      .object({
        mustIncludeText: z.string().optional(),
        mustUseTool: z.string().optional(),
        mustNotUseTools: z.boolean().optional(),
        expectedOutcome: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export type ExperimentDefinition = z.output<typeof experimentSchema>;
export type MatrixRow = ExperimentDefinition['matrix'][number];
export type Variant = ExperimentDefinition['variants'][number];

/** Everything measured for one run — the user-facing record of observable behavior. */
export interface RunRecord {
  rowLabel: string;
  provider: string;
  model: string;
  variant: string;
  repeat: number;
  outcome: RunOutcome;
  success: boolean;
  /** Human-readable PASS/FAIL lines for each success criterion. */
  successChecks: string[];
  finalText?: string;
  modelCalls: number;
  stopReasons: StopReason[];
  toolSelectionOrder: string[];
  toolCallCount: number;
  validationFailures: number;
  malformedToolCalls: number;
  warnings: string[];
  latencyMsTotal?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: { amount: number; currency: string; basis: 'estimated' };
  trace: TraceEvent[];
}

export interface ExperimentResult {
  frameworkVersion: 1;
  experiment: {
    id: string;
    version: number;
    goal: string;
    question: string;
    expectedObservation: string;
    notes?: string;
    maxSteps: number;
    repeats: number;
  };
  generatedAt: string;
  runs: RunRecord[];
  /** Rows that could not run (e.g. missing API key) — visible, never silent. */
  skipped: Array<{ label: string; reason: string }>;
}
