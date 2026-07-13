/**
 * Scene types for the visualization foundation (ADR-0004, plan §8). Pure data — no
 * React, Astro, browser APIs, timers, or animation concepts.
 *
 * The load-bearing separation (docs/VISUAL_LANGUAGE.md): scene data describes what is
 * TRUE at a step ("token 3 is active"); the renderer decides how truth is displayed
 * (border, highlight). No CSS classes, colors, or durations in here — only semantic
 * state. Every scene is complete and independently renderable: users scrub directly to
 * a step, reduced-motion users skip transitions, tests need stable state, and the
 * static first frame is just the step-0 scene rendered to HTML.
 *
 * Deliberately NOT a universal graphics language: these types cover exactly what the
 * P0.5 primitives need. Future visuals (agent traces, RAG pipelines) will add their own
 * scene types beside these rather than generalizing prematurely.
 */

/** Semantic display state of one token in the stream. */
export type TokenState = 'inactive' | 'active' | 'completed';

export interface TokenView {
  /** 0-based position in the token sequence. */
  index: number;
  /** The token's exact text, including any leading space — tokens are not words. */
  text: string;
  /** Illustrative vocabulary id (shown when the scene reveals ids). */
  id?: number;
  state: TokenState;
}

export type ContextWindowStatus = 'ok' | 'near-capacity' | 'full' | 'overflow' | 'invalid';

export interface ContextWindowSegment {
  label: string;
  tokenCount: number;
  /** Semantic kind (e.g. 'system', 'conversation', 'tool-results') — not a color. */
  kind: string;
  /** Share of total capacity, 0–100, derived deterministically. */
  percent: number;
}

/** Normalized, render-ready view of finite context capacity. */
export interface ContextWindowView {
  usedTokens: number;
  capacityTokens: number;
  /** Never negative; 0 when at or over capacity. */
  remainingTokens: number;
  /** 0–100+ (overflow exceeds 100), rounded to one decimal. */
  percentUsed: number;
  status: ContextWindowStatus;
  /** Human-readable explanations for 'invalid' status or data inconsistencies. */
  problems: string[];
  segments: ContextWindowSegment[];
}

/** One step of the tokenization demo — the complete visual truth at that step. */
export interface TokenScene {
  step: number;
  totalSteps: number;
  title: string;
  /** Teaching text for the step; doubles as the accessible scene description. */
  description: string;
  sourceText: string;
  /** When false the renderer shows plain text — the "before tokenization" view. */
  showBoundaries: boolean;
  showIds: boolean;
  tokens: TokenView[];
  /** Present once the scene involves context-window capacity. */
  window?: ContextWindowView;
}

/** Timeline metadata for a stepped visual. Durations are presentation metadata and
 * deliberately absent — animation timing is never part of the educational truth. */
export interface TimelineStep {
  label: string;
  description?: string;
}
export interface Timeline {
  steps: TimelineStep[];
}
