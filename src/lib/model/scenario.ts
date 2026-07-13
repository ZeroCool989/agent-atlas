/**
 * The scripted-scenario format: deterministic, reviewable model behavior as data.
 * Scenarios are JSON files (human-readable, git-diffable, schema-validated here, and
 * importable by future playground islands for visual playback — see DECISIONS.md for
 * the format choice). `parseScenario` is the only entry point: unknown data in,
 * validated `Scenario` out, or a typed `invalid-scenario` error.
 *
 * A scenario is an ordered list of turns. Each turn states (a) what the incoming
 * request is EXPECTED to look like — only stable, educationally relevant properties,
 * via a deliberately small set of matchers — and (b) the exact response to return,
 * including stop reason and declared usage metadata. Optional `teaching` annotations
 * ride along for lesson UIs; the provider never reads them.
 */
import { z } from 'zod';

import type { JsonValue, Role } from './types';
import { ModelError } from './errors';

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const roleSchema: z.ZodType<Role> = z.enum(['user', 'assistant', 'tool']);

const toolCallSchema = z
  .object({
    id: z.string().min(1),
    toolName: z.string().min(1),
    arguments: z.record(z.string(), jsonValueSchema),
  })
  .strict();

const costSchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: z.string().min(1),
    basis: z.enum(['declared', 'estimated']),
  })
  .strict();

const usageSchema = z
  .object({
    latencyMs: z.number().nonnegative().optional(),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
    cost: costSchema.optional(),
  })
  .strict();

/**
 * The full matcher vocabulary — intentionally four matchers, no matching language.
 * All optional; an omitted `expect` accepts any request at that position.
 */
const expectationSchema = z
  .object({
    /** Roles of ALL request messages, in order (turn-order and shape check). */
    roleSequence: z.array(roleSchema).optional(),
    /** Substring that must appear in the last message's text / serialized tool result. */
    lastMessageContains: z.string().min(1).optional(),
    /** A tool-result message for this call id must be present in the request. */
    toolResultForCallId: z.string().min(1).optional(),
    /** These tool names must all be offered in `request.tools`. */
    toolsInclude: z.array(z.string().min(1)).optional(),
  })
  .strict();

const turnSchema = z
  .object({
    expect: expectationSchema.optional(),
    respond: z
      .object({
        text: z.string().optional(),
        toolCalls: z.array(toolCallSchema).optional(),
        stopReason: z.enum(['completed', 'tool-call', 'length', 'content-filter', 'error', 'unknown']),
        usage: usageSchema.optional(),
      })
      .strict(),
    /** Lesson annotation for visual playback; ignored by the provider. */
    teaching: z.string().optional(),
  })
  .strict();

export const scenarioSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'scenario id must be kebab-case'),
    description: z.string().min(1),
    /** Optional label the responses will carry as `model`; omitted stays undefined. */
    model: z.string().min(1).optional(),
    turns: z.array(turnSchema).min(1),
  })
  .strict();

export type Scenario = z.output<typeof scenarioSchema>;
export type ScenarioTurn = Scenario['turns'][number];
export type TurnExpectation = NonNullable<ScenarioTurn['expect']>;

/** Validate unknown data (e.g. an imported JSON file) into a Scenario, or throw typed. */
export function parseScenario(data: unknown): Scenario {
  const result = scenarioSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`,
    );
    throw new ModelError('invalid-scenario', `invalid scenario: ${issues.join('; ')}`, {
      issues,
    });
  }
  return result.data;
}
