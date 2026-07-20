/**
 * Types for the framework-vs-hand-built comparison (ADR-0005, Phase 3
 * `framework-abstraction`). The point of this whole module is one honest claim: an
 * agent framework is a library that wraps the SAME loop you can build by hand
 * (src/lib/agent) — it does not add capability, it moves the loop inside a box.
 *
 * So there is no new engine here. `defineAgent` is a ~15-line facade that imitates the
 * SHAPE of a real framework's declarative API and compiles straight down to `runAgent`.
 * These types describe (1) that facade's config and (2) the side-by-side comparison the
 * lesson renders, where the same task is expressed two ways and proven to produce the
 * same trace.
 */
import type { AgentRunResult, AgentTool, DecidedBy, TraceEvent } from '../agent';

// --- The framework-style declaration -----------------------------------------------------

/**
 * A declarative agent spec — the kind of object a real framework asks you to hand it
 * ("here is my agent: a name, a system prompt, a set of tools"). It carries no loop and
 * no control flow: those live in the runtime the config compiles onto.
 */
export interface AgentGraphConfig {
  /** A label for the agent — the sort of ceremony a framework adds and a raw loop omits. */
  name: string;
  system?: string;
  /** The tools the agent may use. `defineAgent` builds the allowlist registry for you. */
  tools: AgentTool[];
  /** Loop-safety ceiling. Omit and the facade applies a DEFAULT you did not choose. */
  maxSteps?: number;
}

/** The compiled agent a framework hands back: a `.run(goal)` you call and nothing else. */
export interface CompiledAgent {
  readonly config: AgentGraphConfig;
  run(goal: string): Promise<AgentRunResult>;
}

// --- The side-by-side comparison the lesson renders --------------------------------------

/** Who authored the code responsible for a concern — the load-bearing distinction. */
export type Owner = 'you' | 'framework';

/** One line of the authoring surface (the code a developer actually writes/reads). */
export interface AuthoredLine {
  /** The line of code, shown verbatim in the lesson. */
  readonly code: string;
  /** Who owns (can read and change) the code that carries this concern. */
  readonly owns: Owner;
  /** What this line is responsible for — the concern, in one phrase. */
  readonly concern: string;
}

/** One side of the comparison: how the same run is expressed and who owns what. */
export interface ComparisonSide {
  readonly key: 'hand-built' | 'framework';
  readonly label: string;
  /** One-sentence summary of the approach. */
  readonly summary: string;
  /** The code the developer writes for this approach, line by line. */
  readonly authoring: readonly AuthoredLine[];
}

/** One runtime step, tagged with who OWNS the code that drove it in each approach. */
export interface RuntimeStepView {
  readonly index: number;
  /** Short human label for the trace event (e.g. "tool executed"). */
  readonly label: string;
  readonly decidedBy: DecidedBy;
  readonly detail: string;
  /**
   * Ownership of the code that produced this step. It is IDENTICAL runtime code in both
   * runs; what differs is authorship of the invocation: in the hand-built run you called
   * the loop and can step into it, in the framework run the loop ran inside `.run()`.
   */
  readonly ownerHandBuilt: Owner;
  readonly ownerFramework: Owner;
}

/**
 * The full comparison: the same task run two ways, with the proof that both produced the
 * identical trace. Built by running BOTH implementations, never hand-drawn.
 */
export interface FrameworkComparison {
  readonly goal: string;
  readonly handBuilt: ComparisonSide;
  readonly framework: ComparisonSide;
  /** The concerns the framework runs for you, out of sight — the honest §7 list. */
  readonly hidden: readonly string[];
  /** The shared runtime trace, tagged per step with who owns the driving code. */
  readonly steps: readonly RuntimeStepView[];
  /** The final answer both runs produced (identical). */
  readonly finalText?: string;
  /** The verified invariant: the two runs produced byte-for-byte the same trace. */
  readonly tracesMatch: boolean;
  /** The raw traces, kept so a test can re-assert equality independently. */
  readonly handBuiltTrace: readonly TraceEvent[];
  readonly frameworkTrace: readonly TraceEvent[];
}
