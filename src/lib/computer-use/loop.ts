/**
 * The perceive → decide → act loop — the whole of computer use, and nothing more
 * (plan §3 L4, ADR-0005). It is the tool-using agent loop (`src/lib/agent/runner.ts`)
 * with two specific tools: *perceive the screen* and *act on it*. Read it top to bottom;
 * it is the whiteboard answer:
 *
 *   goal → [ screenshot the screen → policy decides an action (grounded to a coordinate)
 *            → runtime classifies the consequence → gate: destructive/consequential actions
 *              need confirmation → execute (or refuse) → append the observation ] repeat
 *        → stop (the policy says done | step limit reached)
 *
 * An Action here IS conceptually a `ToolCall` from the model layer (a tool name + typed
 * arguments): `click`/`type`/`scroll`/`key` are the act-tools, the screenshot is the
 * perceive-tool's result. We keep a self-contained `Action` union rather than importing the
 * model layer because computer use is about grounding actions to a *screen*, not the wire
 * format of any one call — the same reason `src/lib/planning` keeps its own `PlanStep`.
 *
 * The design choices are made visible because they ARE the safety story:
 *  - The POLICY (a vision model, in production) only ever *proposes*. It decides from the
 *    screenshot alone and can be wrong or fooled — including by text that merely appears on
 *    the screen (prompt injection). Proposing is its entire power.
 *  - The RUNTIME owns consequence. Before any destructive or consequential action runs, it
 *    asks `confirm` — the human-in-the-loop / allow-list gate. A denied action is REFUSED,
 *    logged, and fed back as an observation; the run continues. This gate, not the model's
 *    good sense, is what stops an irreversible mistake or an injected instruction.
 *  - `maxSteps` bounds the loop. Hitting it is an outcome, never an exception.
 * No hidden state: everything the run did is in `events`.
 */
import {
  elementAt,
  screenshot,
  type ElementRisk,
  type Point,
  type Screen,
  type Screenshot,
} from './screen';

/** What a computer-use agent can do. Each variant is conceptually a ToolCall (see header). */
export type Action =
  | { readonly kind: 'click'; readonly point: Point; readonly intent: string }
  | { readonly kind: 'type'; readonly text: string; readonly point: Point; readonly intent: string }
  | { readonly kind: 'scroll'; readonly dy: number }
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'done'; readonly answer?: string };

/** The coordinate an action targets, or `undefined` for actions that target no point. */
export function actionPoint(action: Action): Point | undefined {
  return action.kind === 'click' || action.kind === 'type' ? action.point : undefined;
}

/** A short human label for an action, for traces and the visual. */
export function actionLabel(action: Action): string {
  switch (action.kind) {
    case 'click':
      return `click “${action.intent}” at (${action.point.x}, ${action.point.y})`;
    case 'type':
      return `type “${action.text}” at (${action.point.x}, ${action.point.y})`;
    case 'scroll':
      return `scroll ${action.dy > 0 ? 'down' : 'up'} ${Math.abs(action.dy)}`;
    case 'key':
      return `press ${action.key}`;
    case 'done':
      return 'done';
  }
}

/** What the policy returns: an action, plus its stated reason (for the trace/visual). */
export interface Decision {
  readonly action: Action;
  /** Why the policy chose this — surfaced so the reasoning, not just the click, is visible. */
  readonly rationale: string;
}

/**
 * The policy is the "decide" step: goal + current screenshot + history → the next action.
 * In production this is a vision-model call; here it is an injected pure function (a fixture
 * or a rule), so the loop can be read and unit-tested without a model. Swap it for a model
 * call and the loop is unchanged — that substitution is the whole point of ADR-0005.
 *
 * It sees a `Screenshot` (appearance only) — never element `risk` — precisely because a real
 * policy decides from pixels and cannot read a thing's consequence off its looks.
 */
export type Policy = (input: {
  readonly goal: string;
  readonly screenshot: Screenshot;
  readonly history: readonly ComputerUseEvent[];
}) => Decision;

/**
 * The confirmation gate: given a proposed consequential/destructive action and the element it
 * resolved to, may it run? This is the human-in-the-loop / allow-list control. Returning
 * `false` REFUSES the action. In production this is a person clicking "approve", or a policy
 * that only permits goal-relevant, allow-listed targets. It is injected, and deny-by-default
 * is the safe default.
 */
export type Confirm = (input: {
  readonly goal: string;
  readonly action: Action;
  readonly risk: ElementRisk;
  readonly targetLabel?: string;
}) => boolean;

/**
 * The world: apply an action to the screen and report what happened. Injected, like the
 * screen itself, so the loop is world-agnostic (mirrors `StepExecutor` in `src/lib/planning`).
 * It returns the NEXT screen and a short result string that becomes the observation.
 */
export type World = (screen: Screen, action: Action) => { readonly screen: Screen; readonly result: string };

export type EventKind =
  | 'perceived'
  | 'decided'
  | 'confirmation-requested'
  | 'confirmed'
  | 'refused'
  | 'acted'
  | 'completed'
  | 'step-limit';

/**
 * One event in the run. `screen`/`screenshot` are the snapshot AT THIS MOMENT and `action`/
 * `targetLabel`/`point` describe the action in play, so a viewer can render each beat without
 * recomputing anything. Nothing happens that is not in the event stream.
 */
export interface ComputerUseEvent {
  readonly kind: EventKind;
  readonly step: number;
  readonly detail: string;
  readonly screen: Screen;
  readonly action?: Action;
  /** The element the action grounded to (undefined = the click hit empty space). */
  readonly targetLabel?: string;
  readonly risk?: ElementRisk;
  /** The coordinate in play, for drawing the click point. */
  readonly point?: Point;
}

export type Outcome = 'completed' | 'step-limit';

export interface ComputerUseResult {
  readonly outcome: Outcome;
  readonly events: readonly ComputerUseEvent[];
  readonly finalScreen: Screen;
  /** How many consequential/destructive actions the gate refused (e.g. injected instructions). */
  readonly refusals: number;
}

export interface ComputerUseOptions {
  readonly goal: string;
  readonly screen: Screen;
  readonly policy: Policy;
  readonly confirm: Confirm;
  readonly world: World;
  /** Hard cap on loop turns — the defense against a run that never stops. */
  readonly maxSteps?: number;
}

export const DEFAULT_MAX_STEPS = 8;

/** A click or type resolves to a screen element; scroll/key/done have no consequence here. */
function resolveTarget(screen: Screen, action: Action): { risk: ElementRisk; label?: string } {
  const point = actionPoint(action);
  if (!point) return { risk: 'benign' };
  const element = elementAt(screen, point);
  // A click that hits nothing is a benign miss — no element, no consequence (but no progress).
  return element ? { risk: element.risk, label: element.label } : { risk: 'benign' };
}

/**
 * Run the perceive → decide → act loop. Deterministic given a deterministic policy, confirm,
 * and world. The returned `events` are the full, replayable trace.
 */
export function runComputerUse(options: ComputerUseOptions): ComputerUseResult {
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const events: ComputerUseEvent[] = [];
  let screen = options.screen;
  let refusals = 0;

  const push = (event: Omit<ComputerUseEvent, 'screen'> & { screen?: Screen }) =>
    events.push({ ...event, screen: event.screen ?? screen });

  for (let step = 0; step < maxSteps; step += 1) {
    // 1. PERCEIVE — take a screenshot. This is the only thing the policy will see.
    const shot = screenshot(screen);
    push({
      kind: 'perceived',
      step,
      detail: `Screenshot of “${screen.view}”: ${shot.elements.length} element(s) visible. The agent decides from this alone.`,
    });

    // 2. DECIDE — the policy proposes one action, grounded to a coordinate.
    const decision = options.policy({ goal: options.goal, screenshot: shot, history: events });
    const { action, rationale } = decision;
    const { risk, label } = resolveTarget(screen, action);
    push({
      kind: 'decided',
      step,
      detail: `Policy proposes: ${actionLabel(action)}. ${rationale}`,
      action,
      targetLabel: label,
      risk,
      ...(actionPoint(action) ? { point: actionPoint(action) } : {}),
    });

    if (action.kind === 'done') {
      push({ kind: 'completed', step, detail: `The policy stopped: ${action.answer ?? 'goal reached'}.` });
      return { outcome: 'completed', events, finalScreen: screen, refusals };
    }

    // 3. GATE — the runtime, not the model, owns consequence. Destructive and consequential
    //    actions must be confirmed before they run. This is the backstop for both an
    //    irreversible mistake AND an injected instruction the policy was fooled into proposing.
    if (risk === 'destructive' || risk === 'consequential') {
      push({
        kind: 'confirmation-requested',
        step,
        detail: `“${label}” is a ${risk} action. The runtime pauses and asks for confirmation before it can run — the model never gets to skip this.`,
        action,
        targetLabel: label,
        risk,
        ...(actionPoint(action) ? { point: actionPoint(action) } : {}),
      });
      const approved = options.confirm({ goal: options.goal, action, risk, targetLabel: label });
      if (!approved) {
        refusals += 1;
        push({
          kind: 'refused',
          step,
          detail: `REFUSED: “${label}” was not confirmed (it is not part of the goal). The action never touches the screen; the refusal is fed back so the loop can carry on safely.`,
          action,
          targetLabel: label,
          risk,
          ...(actionPoint(action) ? { point: actionPoint(action) } : {}),
        });
        continue; // observation = "refused"; perceive again next turn.
      }
      push({
        kind: 'confirmed',
        step,
        detail: `Confirmed: “${label}” is part of the goal, so a human (or an allow-list standing in for one) approves it. Only now may it run.`,
        action,
        targetLabel: label,
        risk,
      });
    }

    // 4. ACT — the world applies the action and returns the next screen + an observation.
    const applied = options.world(screen, action);
    screen = applied.screen;
    push({
      kind: 'acted',
      step,
      detail: `${actionLabel(action)} → ${applied.result}. The new screenshot next turn is how the loop closes.`,
      action,
      targetLabel: label,
      risk,
      ...(actionPoint(action) ? { point: actionPoint(action) } : {}),
    });
  }

  push({
    kind: 'step-limit',
    step: maxSteps,
    detail: `Step limit (${maxSteps} turns) reached. The bound is the runtime's guarantee the loop can't run forever — hitting it is an outcome to handle, not a crash.`,
  });
  return { outcome: 'step-limit', events, finalScreen: screen, refusals };
}
