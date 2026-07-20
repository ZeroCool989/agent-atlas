/**
 * `defineAgent` — a deliberately tiny "framework-style" facade over the hand-built loop
 * (src/lib/agent). It is NOT a framework and it is NOT how any real framework is built;
 * it is the smallest honest imitation of one, so the lesson can show, in code the learner
 * can read end to end, exactly what a framework's convenience adds and what it hides.
 *
 * The whole facade is below. Read it and notice: it holds no loop, no control flow, no
 * new capability. It takes a declaration, builds the allowlist registry for you, applies
 * a default step limit you did not choose, and calls `runAgent`. That is the entire trick
 * every agent framework plays, scaled up: a convenient surface over a loop that already
 * existed. "Compiles down to the same loop" is not a metaphor here — it is literally one
 * `runAgent` call.
 */
import { runAgent, ToolRegistry } from '../agent';
import type { ModelProvider } from '../model';
import type { AgentGraphConfig, CompiledAgent } from './types';

export function defineAgent(provider: ModelProvider, config: AgentGraphConfig): CompiledAgent {
  // "Compile" the declaration once: turn the tool list into the runtime's allowlist.
  // In the hand-built usage YOU write this line; here the facade writes it for you.
  const registry = new ToolRegistry(config.tools);

  return {
    config,
    run(goal: string) {
      // The one call that matters. Every step the learner watches in the trace —
      // context assembly, model call, validation, dispatch, observation, stop — happens
      // inside here, in runner.ts. The facade never re-implements any of it.
      return runAgent(provider, registry, {
        goal,
        ...(config.system !== undefined ? { system: config.system } : {}),
        // maxSteps left undefined falls through to runAgent's DEFAULT_MAX_STEPS — a
        // loop-safety choice the caller of a framework typically never sees or sets.
        ...(config.maxSteps !== undefined ? { maxSteps: config.maxSteps } : {}),
      });
    },
  };
}
