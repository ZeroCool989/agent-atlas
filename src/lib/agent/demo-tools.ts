/**
 * Teaching tools beyond the calculator. `unreliable-lookup` always fails on execution —
 * it exists to demonstrate the difference between a tool that cannot make sense of its
 * arguments (semantic failure, e.g. the calculator on "2 ** 0.5") and a tool that
 * understood the request but whose EXECUTION failed (an external system being down).
 * Both surface as the runtime outcome `tool-error`; the distinction is pedagogical.
 */
import { z } from 'zod';

import type { AgentTool } from './types';

const lookupArgs = z.object({ query: z.string().min(1) }).strict();

export const unreliableLookupTool: AgentTool<{ query: string }> = {
  definition: {
    name: 'unreliable-lookup',
    description: 'Looks up a fact in an external knowledge service. (Teaching tool: the service is always down.)',
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
    return { ok: false, error: 'upstream service unavailable (external failure, deterministic)' };
  },
};
