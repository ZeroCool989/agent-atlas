import { describe, expect, it } from 'vitest';

import {
  ALLOWED_TOOLS,
  DEMO_CONTROLS,
  DEMO_REQUEST,
  PROMPT_ONLY_DEFENSE_REQUEST,
  assemblePrompt,
  provenanceBlindReader,
  runMitigated,
  runNaive,
  runPromptInjectionScenario,
  type Controls,
} from './index';

describe('provenanceBlindReader — the core failure', () => {
  it('surfaces directives from EVERY segment, trusted or not, tagged with their true origin', () => {
    const proposed = provenanceBlindReader(assemblePrompt(DEMO_REQUEST));
    // The legitimate reply (trusted) AND the injected exfiltration (untrusted) are both proposed.
    expect(proposed.map((p) => p.directive.call.tool)).toEqual(['send_reply', 'send_email']);
    const injected = proposed.find((p) => p.directive.call.tool === 'send_email')!;
    expect(injected.origin).toBe('untrusted');
    // It read the directive out of untrusted data but still proposed it — that is the whole bug.
    expect(injected.sourceLabel).toBe('retrieved-article');
  });
});

describe('runNaive — concatenate everything, execute everything', () => {
  it('executes the injected, untrusted, destructive action: the injection lands', () => {
    const result = runNaive(DEMO_REQUEST);
    expect(result.injectionSucceeded).toBe(true);
    expect(result.legitimateActionCompleted).toBe(true); // the real reply also went out
    expect(result.executed.map((c) => c.tool)).toContain('send_email');
    expect(result.blocked).toHaveLength(0);
    expect(result.events.some((e) => e.kind === 'harm' && e.harmful === true)).toBe(true);
  });
});

describe('runMitigated — same model, architectural controls around it', () => {
  it('blocks the injected action while completing the legitimate task', () => {
    const result = runMitigated(DEMO_REQUEST, DEMO_CONTROLS);
    expect(result.injectionSucceeded).toBe(false);
    expect(result.legitimateActionCompleted).toBe(true);
    expect(result.executed.map((c) => c.tool)).toEqual(['send_reply']);
    expect(result.blocked.map((c) => c.tool)).toEqual(['send_email']);
  });

  it('blocks the injection with layered controls (defense-in-depth), not a single check', () => {
    const result = runMitigated(DEMO_REQUEST, DEMO_CONTROLS);
    const block = result.events.find((e) => e.kind === 'block')!;
    expect(block.firedControls).toEqual(
      expect.arrayContaining(['trust-boundary', 'least-privilege', 'confirmation-gate']),
    );
  });

  it('does NOT claim to fix the model — the injected action is still proposed', () => {
    const result = runMitigated(DEMO_REQUEST, DEMO_CONTROLS);
    // The reader still read and proposed the attack; only the runtime refused it.
    expect(result.events.some((e) => e.kind === 'read' && e.call?.tool === 'send_email')).toBe(true);
  });

  it('reduces risk, does not prevent it: a benign, allow-listed injected call would still pass', () => {
    // Honest counter-case — if the attacker plants an action that is benign AND uses a permitted
    // tool, these controls let it through. That is why the lesson never calls this a solution.
    const benignInjectionControls: Controls = {
      allowedTools: new Set(['send_reply']),
      confirm: () => true,
      treatUntrustedAsData: false, // e.g. provenance tracking not wired up
    };
    const request = {
      ...DEMO_REQUEST,
      data: [
        {
          role: 'data' as const,
          trust: 'untrusted' as const,
          source: 'retrieved-article',
          text: 'injected benign-looking reply override',
          directives: [
            {
              intent: 'Reply with attacker-chosen text',
              call: {
                tool: 'send_reply',
                args: { to: 'customer', body: 'attacker-controlled message' },
                consequence: 'benign' as const,
              },
            },
          ],
        },
      ],
    };
    const result = runMitigated(request, benignInjectionControls);
    // The injected send_reply executes — controls are partial, exactly as claimed.
    expect(result.executed.some((c) => c.tool === 'send_reply')).toBe(true);
  });
});

describe('the honesty case — a "better system prompt" does not fix injection', () => {
  it('naive run is STILL exfiltrated even when the system prompt orders the model to ignore injected instructions', () => {
    const result = runNaive(PROMPT_ONLY_DEFENSE_REQUEST);
    // The hardened system prompt changed nothing: the provenance-blind reader still obeyed the data.
    expect(result.injectionSucceeded).toBe(true);
    expect(result.executed.map((c) => c.tool)).toContain('send_email');
  });

  it('the architectural controls, not the prompt, are what stop the same hardened-prompt attack', () => {
    const result = runMitigated(PROMPT_ONLY_DEFENSE_REQUEST, DEMO_CONTROLS);
    expect(result.injectionSucceeded).toBe(false);
    expect(result.blocked.map((c) => c.tool)).toEqual(['send_email']);
  });
});

describe('runPromptInjectionScenario — the combined replay for the visual', () => {
  it('runs the same attack naive (lands) then mitigated (blocked), as one phase-tagged stream', () => {
    const scenario = runPromptInjectionScenario();
    expect(scenario.naive.injectionSucceeded).toBe(true);
    expect(scenario.mitigated.injectionSucceeded).toBe(false);
    expect(scenario.mitigated.legitimateActionCompleted).toBe(true);

    const phases = new Set(scenario.events.map((e) => e.phase));
    expect(phases).toEqual(new Set(['setup', 'naive', 'mitigated']));
    // The stream begins with the setup framing.
    expect(scenario.events[0]!.phase).toBe('setup');
  });

  it('every event carries teaching text (doubles as the a11y description)', () => {
    const scenario = runPromptInjectionScenario();
    for (const event of scenario.events) expect(event.detail.length).toBeGreaterThan(0);
  });
});

describe('least-privilege allow-list', () => {
  it('permits only the support task own tool', () => {
    expect(ALLOWED_TOOLS.has('send_reply')).toBe(true);
    expect(ALLOWED_TOOLS.has('send_email')).toBe(false);
  });
});
