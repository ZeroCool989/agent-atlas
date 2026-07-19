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

/** One token's bar in the sampling distribution visual. */
export interface DistributionBar {
  token: string;
  /** Probability at the current step — after this step's reshape or truncation. */
  prob: number;
  /** The model's raw (T=1) probability, shown as the reference the step transforms. */
  basisProb: number;
  /** False when a truncation step (top-k / top-p) has cut this token from the candidate set. */
  kept: boolean;
}

/** One step of the sampling demo — the complete distribution truth at that step. */
export interface SamplingScene {
  step: number;
  totalSteps: number;
  title: string;
  /** Teaching text for the step; doubles as the accessible scene description. */
  description: string;
  /** Which decoding operation this step demonstrates. */
  method: 'raw' | 'temperature' | 'top-k' | 'top-p';
  /** The parameter in play, e.g. "T = 0.5", "k = 3", "p = 0.9", or "" for the raw step. */
  parameterLabel: string;
  bars: DistributionBar[];
  /** How many tokens survive as drawable candidates at this step. */
  keptCount: number;
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

/** One labelled part of an assembled prompt, revealed step by step in the viz. */
export interface PromptSegmentView {
  label: string;
  kind: 'system' | 'examples' | 'task' | 'format';
  tokens: number;
  /** False until this step reveals the segment. */
  revealed: boolean;
}

/** One step of the prompt-assembly demo: the prompt built so far and its window cost. */
export interface PromptAssemblyScene {
  step: number;
  totalSteps: number;
  title: string;
  /** Teaching text for the step; doubles as the accessible scene description. */
  description: string;
  segments: PromptSegmentView[];
  /** Estimated tokens used by the revealed segments so far. */
  usedTokens: number;
  windowTokens: number;
  /** Percent of the window used so far, one decimal. */
  percentUsed: number;
}

/** Render-ready view of one eval case as the run reveals it. */
export interface EvalCaseView {
  id: string;
  /** Short human label for the case (what it probes). */
  label: string;
  /** Which assertion kind judged it — exact / contains / json. */
  assertionKind: 'exact' | 'contains' | 'json';
  /** False until the run has reached and scored this case. */
  revealed: boolean;
  /** Present once revealed. */
  pass?: boolean;
  /** Present once revealed and failed (e.g. 'wrong-value'). */
  failReason?: string;
  /** Human-readable why, present once revealed. */
  detail?: string;
}

/** One step of the evaluation demo: the eval set scored case by case, then aggregated. */
export interface EvaluationScene {
  step: number;
  totalSteps: number;
  title: string;
  /** Teaching text for the step; doubles as the accessible scene description. */
  description: string;
  cases: EvalCaseView[];
  /** Cases passed among those revealed so far. */
  passed: number;
  /** Cases revealed so far. */
  revealedCount: number;
  /** Total cases in the suite. */
  total: number;
  /** Aggregate score (0–100, one decimal) over the whole suite — shown at the final step. */
  scorePercent: number;
  /** True on the final step, when the aggregate score is presented. */
  scored: boolean;
}
