/**
 * The laboratory's tool inventory. `calculator` is the production lesson tool;
 * `unreliable-lookup` exists to provoke tool-execution failures on purpose
 * (failure experiments) — it always fails, deterministically and honestly.
 */
import { z } from 'zod';

import { calculatorTool, ToolRegistry } from '../../src/lib/agent';
import type { AgentTool } from '../../src/lib/agent';

const lookupArgs = z.object({ query: z.string().min(1) }).strict();

export const unreliableLookupTool: AgentTool<{ query: string }> = {
  definition: {
    name: 'unreliable-lookup',
    description: 'Looks up a fact in an external knowledge service. (Laboratory tool: the service is always down.)',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  parseArgs(args) {
    const result = lookupArgs.safeParse(args);
    return result.success
      ? { ok: true, value: result.data }
      : { ok: false, error: result.error.issues.map((i) => i.message).join('; ') };
  },
  execute() {
    return { ok: false, error: 'upstream service unavailable (simulated, deterministic)' };
  },
};

const TOOLS = {
  calculator: calculatorTool,
  'unreliable-lookup': unreliableLookupTool,
} as const;

export function buildRegistry(names: Array<keyof typeof TOOLS>): ToolRegistry {
  return new ToolRegistry(names.map((name) => TOOLS[name]));
}
