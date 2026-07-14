/**
 * The tool registry: the runtime's allowlist. A tool the registry doesn't hold cannot
 * be executed, no matter what the model asks for — least privilege as a data
 * structure. Registries are immutable after construction; build a new one to change
 * the allowlist.
 */
import type { ToolDefinition } from '../model';
import type { AgentTool } from './types';

export class ToolRegistry {
  readonly #tools = new Map<string, AgentTool>();

  constructor(tools: AgentTool[]) {
    for (const tool of tools) {
      if (this.#tools.has(tool.definition.name)) {
        throw new Error(`duplicate tool name "${tool.definition.name}"`);
      }
      this.#tools.set(tool.definition.name, tool);
    }
  }

  get(name: string): AgentTool | undefined {
    return this.#tools.get(name);
  }

  /** What the model is told it may select from. */
  definitions(): ToolDefinition[] {
    return [...this.#tools.values()].map((tool) => tool.definition);
  }
}
