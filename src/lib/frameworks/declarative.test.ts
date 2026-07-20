import { describe, expect, it } from 'vitest';

import { calculatorTool, runAgent, ToolRegistry } from '../agent';
import { parseScenario, ScriptedProvider } from '../model';
import calculatorScenario from '../model/scenarios/calculator-tool-use.scenario.json';
import { defineAgent } from './declarative';

const GOAL = 'What is 127 * 49?';
const SYSTEM = 'You are a careful assistant. Use tools for arithmetic.';

describe('defineAgent (the framework-style facade)', () => {
  it('compiles down to the exact same loop: identical trace as a direct runAgent call', async () => {
    const handProvider = new ScriptedProvider(parseScenario(calculatorScenario));
    const handBuilt = await runAgent(handProvider, new ToolRegistry([calculatorTool]), {
      system: SYSTEM,
      goal: GOAL,
    });

    const fwProvider = new ScriptedProvider(parseScenario(calculatorScenario));
    const agent = defineAgent(fwProvider, {
      name: 'calculator-agent',
      system: SYSTEM,
      tools: [calculatorTool],
    });
    const viaFacade = await agent.run(GOAL);

    // The whole lesson rests on this: the facade adds no behaviour, so the trace matches.
    expect(viaFacade.trace).toEqual(handBuilt.trace);
    expect(viaFacade.outcome).toBe(handBuilt.outcome);
    expect(viaFacade.finalText).toBe(handBuilt.finalText);
    expect(viaFacade.outcome).toBe('completed');
  });

  it('keeps the declaration accessible on the compiled agent', () => {
    const provider = new ScriptedProvider(parseScenario(calculatorScenario));
    const agent = defineAgent(provider, {
      name: 'calculator-agent',
      system: SYSTEM,
      tools: [calculatorTool],
    });
    expect(agent.config.name).toBe('calculator-agent');
    expect(agent.config.tools).toHaveLength(1);
  });

  it('adds no capability: declaring no tools does not make the run succeed', async () => {
    // The facade builds the registry, but it is the SAME runtime underneath — it cannot
    // conjure a tool the developer did not declare. A toolless declaration cannot complete
    // the tool-use task; the facade's convenience is not a capability.
    const provider = new ScriptedProvider(parseScenario(calculatorScenario));
    const agent = defineAgent(provider, { name: 'toolless', tools: [] });
    const result = await agent.run(GOAL);
    expect(result.outcome).not.toBe('completed');
  });
});
