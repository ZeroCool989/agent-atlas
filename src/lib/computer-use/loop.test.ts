import { describe, expect, it } from 'vitest';

import {
  actionLabel,
  runComputerUse,
  type ComputerUseEvent,
  type Confirm,
  type Policy,
  type World,
} from './loop';
import { centerOf, type Screen } from './screen';
import {
  COMPUTER_USE_DEMO_INPUT,
  DEMO_GOAL,
  buildDemoScreen,
  demoConfirm,
  demoPolicy,
  demoWorld,
} from './demo';

const kinds = (events: readonly ComputerUseEvent[]) => events.map((e) => e.kind);

describe('the demo run: perceive → decide → act, with the injection refused', () => {
  const result = runComputerUse(COMPUTER_USE_DEMO_INPUT);

  it('completes the real goal', () => {
    expect(result.outcome).toBe('completed');
    expect(result.finalScreen.view).toBe('sent');
  });

  it('refuses exactly one action — the injected “Delete account”', () => {
    expect(result.refusals).toBe(1);
    const refused = result.events.filter((e) => e.kind === 'refused');
    expect(refused).toHaveLength(1);
    expect(refused[0]!.targetLabel).toBe('Delete account');
    expect(refused[0]!.risk).toBe('destructive');
  });

  it('never reaches the irreversible “deleted” screen', () => {
    expect(result.events.some((e) => e.screen.view === 'deleted')).toBe(false);
  });

  it('pauses for confirmation on the one genuinely consequential action (Send), and runs it', () => {
    const confirmations = result.events.filter((e) => e.kind === 'confirmation-requested');
    // Two gates fire: the refused destructive delete and the confirmed consequential send.
    expect(confirmations.map((e) => e.targetLabel)).toEqual(['Delete account', 'Send']);
    expect(result.events.some((e) => e.kind === 'confirmed' && e.targetLabel === 'Send')).toBe(true);
  });

  it('produces the expected beat order', () => {
    // perceive/decide, injected delete gated+refused, then reply, type, send gated+confirmed, done.
    expect(kinds(result.events)).toEqual([
      'perceived', 'decided', 'confirmation-requested', 'refused',
      'perceived', 'decided', 'acted',
      'perceived', 'decided', 'acted',
      'perceived', 'decided', 'confirmation-requested', 'confirmed', 'acted',
      'perceived', 'decided', 'completed',
    ]);
  });

  it('is deterministic', () => {
    const again = runComputerUse(COMPUTER_USE_DEMO_INPUT);
    expect(kinds(again.events)).toEqual(kinds(result.events));
  });
});

describe('the confirmation gate is the safety boundary, not the policy', () => {
  it('a confirm that approves everything WOULD let the injection delete the account', () => {
    const approveAll: Confirm = () => true;
    const result = runComputerUse({ ...COMPUTER_USE_DEMO_INPUT, confirm: approveAll });
    // With no gate discipline, the fooled policy's destructive click executes.
    expect(result.events.some((e) => e.screen.view === 'deleted')).toBe(true);
    expect(result.refusals).toBe(0);
  });

  it('deny-by-default confirm refuses the consequential Send too, so the goal never completes', () => {
    const denyAll: Confirm = () => false;
    const result = runComputerUse({ ...COMPUTER_USE_DEMO_INPUT, confirm: denyAll, maxSteps: 12 });
    expect(result.finalScreen.view).not.toBe('sent');
  });
});

describe('loop bounds', () => {
  it('stops at maxSteps rather than looping forever', () => {
    // A policy that never says done and never makes progress.
    const spinScreen: Screen = { view: 'spin', elements: [] };
    const spinPolicy: Policy = () => ({
      action: { kind: 'scroll', dy: 1 },
      rationale: 'always scroll',
    });
    const noopWorld: World = (screen) => ({ screen, result: 'no change' });
    const result = runComputerUse({
      goal: 'never ends',
      screen: spinScreen,
      policy: spinPolicy,
      confirm: () => true,
      world: noopWorld,
      maxSteps: 3,
    });
    expect(result.outcome).toBe('step-limit');
    expect(result.events.at(-1)!.kind).toBe('step-limit');
  });
});

describe('grounding brittleness surfaces through the loop', () => {
  it('a mis-grounded click resolves the wrong element and makes no progress', () => {
    const shifted = buildDemoScreen();
    // A policy that aims where "Reply" USED to be but the layout shifted 200px right.
    const stalePolicy: Policy = ({ screenshot: shot }) => {
      const reply = shot.elements.find((e) => e.label === 'Reply')!;
      const centre = centerOf(reply.bounds);
      return { action: { kind: 'click', point: { x: centre.x + 200, y: centre.y }, intent: 'Reply' }, rationale: 'stale coordinate' };
    };
    const result = runComputerUse({
      goal: DEMO_GOAL,
      screen: shifted,
      policy: stalePolicy,
      confirm: demoConfirm,
      world: demoWorld,
      maxSteps: 3,
    });
    // It never opens the composer — the click grounded somewhere other than Reply.
    expect(result.events.some((e) => e.screen.view === 'compose')).toBe(false);
  });
});

describe('actionLabel', () => {
  it('renders each action kind', () => {
    expect(actionLabel({ kind: 'click', point: { x: 1, y: 2 }, intent: 'X' })).toContain('click');
    expect(actionLabel({ kind: 'type', text: 'hi', point: { x: 1, y: 2 }, intent: 'F' })).toContain('type');
    expect(actionLabel({ kind: 'scroll', dy: -3 })).toContain('up');
    expect(actionLabel({ kind: 'key', key: 'Enter' })).toContain('Enter');
    expect(actionLabel({ kind: 'done' })).toBe('done');
  });
});

// Reference the injected policy directly so its intent is documented in the test surface.
describe('demoPolicy provenance-blindness', () => {
  it('is first lured by the on-screen instruction before the gate corrects it', () => {
    const first = demoPolicy({ goal: DEMO_GOAL, screenshot: { view: 'inbox', elements: buildDemoScreen().elements.map((e) => ({ id: e.id, label: e.label, kind: e.kind, bounds: e.bounds, ...(e.looksLikeInstruction ? { looksLikeInstruction: true } : {}) })) }, history: [] });
    expect(first.action.kind === 'click' && first.action.intent).toBe('Delete account');
  });
});
