/**
 * The laboratory's tool inventory. `calculator` is the production lesson tool;
 * `unreliable-lookup` exists to provoke tool-execution failures on purpose
 * (failure experiments) — it always fails, deterministically and honestly.
 */
import { calculatorTool, ToolRegistry, unreliableLookupTool } from '../../src/lib/agent';

const TOOLS = {
  calculator: calculatorTool,
  'unreliable-lookup': unreliableLookupTool,
} as const;

export function buildRegistry(names: Array<keyof typeof TOOLS>): ToolRegistry {
  return new ToolRegistry(names.map((name) => TOOLS[name]));
}
