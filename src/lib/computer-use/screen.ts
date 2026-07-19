/**
 * The virtual screen — a MOCK graphical UI, modelled in memory (plan §3 L4, ADR-0005).
 *
 * Computer use is a tool-using agent (see `src/lib/agent/runner.ts`) whose tools are
 * *perceive the screen* and *act on it* — click a coordinate, type, scroll, press a key.
 * A real one takes a PNG screenshot of a live OS and drives a real mouse/keyboard. That
 * is dangerous and non-deterministic, so it belongs in production, not a lesson. Here the
 * "screen" is a tiny list of elements with pixel bounds and labels, the "screenshot" is a
 * serializable snapshot of it, and every action is applied to an in-memory copy. No OS,
 * no Playwright, no real pixels — the LOOP SHAPE is the teachable thing, and it is exactly
 * the same shape a real computer-use agent runs.
 *
 * The load-bearing honesty this file encodes:
 *  - Perception is by *appearance*: a screenshot carries what a thing looks like (label,
 *    bounds, kind, value) — never what it *does*. Consequence (`risk`) is a property of the
 *    real element the runtime resolves, NOT something the perceiver can read off the pixels.
 *  - Grounding is intent → coordinate → element: the policy names a target and computes a
 *    point; the runtime resolves which element is actually AT that point. That indirection
 *    is where misclicks live (see `elementAt`).
 */

/** A pixel rectangle on the virtual screen. */
export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A screen coordinate — what a click/type action ultimately targets. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * How consequential acting on an element is — the RUNTIME's classification, used only by
 * the confirmation gate. It is deliberately NOT part of what a screenshot exposes: an agent
 * cannot tell from pixels that a red button deletes an account. Knowing consequence, and
 * gating on it, is the runtime's job, never the model's.
 */
export type ElementRisk = 'benign' | 'consequential' | 'destructive';

/** The visual kind of an element — part of appearance, so it IS perceivable. */
export type ElementKind = 'button' | 'textfield' | 'text' | 'link';

/** One interactive or static element on the virtual screen. */
export interface Element {
  readonly id: string;
  /** The visible label/text — appearance, perceivable. */
  readonly label: string;
  readonly kind: ElementKind;
  readonly bounds: Bounds;
  /** Consequence of acting on it — runtime-only, never perceived (see ElementRisk). */
  readonly risk: ElementRisk;
  /** Current text value, for text fields. */
  readonly value?: string;
  /**
   * True when this element is on-screen text that reads like an instruction — a banner,
   * a fake system dialog, a message body. It is visually indistinguishable from a real
   * task, which is exactly the prompt-injection surface: the perceiver cannot tell the
   * user's goal from words that merely appear on the screen.
   */
  readonly looksLikeInstruction?: boolean;
}

/** The whole virtual screen at a moment in time. `view` names which screen is showing. */
export interface Screen {
  readonly view: string;
  readonly elements: readonly Element[];
}

/** The centre point of an element — the coordinate a policy grounds a click/type to. */
export function centerOf(bounds: Bounds): Point {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

/** Is a point inside a rectangle? (Half-open on the far edges, so tiling never double-hits.) */
export function contains(bounds: Bounds, point: Point): boolean {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}

/**
 * Resolve which element is AT a coordinate — the runtime's grounding step. Returns the
 * topmost (last-declared) element containing the point, or `undefined` for a click that
 * lands on empty space (a misclick that hits nothing). This indirection is the honest core
 * of computer-use brittleness: the policy aims at a coordinate; if the UI has shifted, or
 * the coordinate is a pixel off, the runtime resolves a *different* element — or none — and
 * the action does the wrong thing. There is no name-based safety net on a real screen.
 */
export function elementAt(screen: Screen, point: Point): Element | undefined {
  let hit: Element | undefined;
  for (const element of screen.elements) {
    if (contains(element.bounds, point)) hit = element;
  }
  return hit;
}

/** Look up an element by id — a convenience for the world/executor, not a perception path. */
export function elementById(screen: Screen, id: string): Element | undefined {
  return screen.elements.find((element) => element.id === id);
}

// --- Perception -------------------------------------------------------------------------

/** One element as it APPEARS in a screenshot — appearance only, never consequence. */
export interface PerceivedElement {
  readonly id: string;
  readonly label: string;
  readonly kind: ElementKind;
  readonly bounds: Bounds;
  readonly value?: string;
  readonly looksLikeInstruction?: boolean;
}

/**
 * A screenshot: the serializable snapshot the agent perceives each turn — the stand-in for
 * a PNG. It carries appearance (`label`, `kind`, `bounds`, `value`) but drops `risk`,
 * because consequence is not visible in pixels. The agent decides from this and nothing
 * else — the same input a real vision model gets.
 */
export interface Screenshot {
  readonly view: string;
  readonly elements: readonly PerceivedElement[];
}

export function screenshot(screen: Screen): Screenshot {
  return {
    view: screen.view,
    elements: screen.elements.map((element) => ({
      id: element.id,
      label: element.label,
      kind: element.kind,
      bounds: element.bounds,
      ...(element.value !== undefined ? { value: element.value } : {}),
      ...(element.looksLikeInstruction ? { looksLikeInstruction: true } : {}),
    })),
  };
}
