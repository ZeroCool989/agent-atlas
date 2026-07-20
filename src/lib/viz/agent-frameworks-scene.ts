/**
 * Scene builder for the agent-frameworks visual (ADR-0004, plan §8 Tier 2). Pure data:
 * `() => Promise<Scene[]>`, no React/Astro/timers. Every step is computed from the REAL
 * comparison in `src/lib/frameworks` — the same arithmetic task run two ways (a hand-built
 * loop and the `defineAgent` facade), whose traces are proven identical at build time.
 *
 * The story the visual tells: the same task, expressed two ways. Step through the runtime
 * trace and watch each step light up — in the hand-built column it is code you own and can
 * read; in the framework column the identical step ran inside `.run()`, out of your sight.
 * The reveal at the end: both produced the same trace and the same answer, so the framework
 * added no capability — it only moved the loop inside a box. That is the load-bearing point
 * of the whole `framework-abstraction` layer.
 */
import { buildFrameworkComparison } from '../frameworks';
import type { ComparisonSide, RuntimeStepView } from '../frameworks';
import type { DecidedBy } from '../agent';
import type { TokenState } from './types';

export interface FrameworkRow {
  readonly index: number;
  readonly label: string;
  readonly decidedBy: DecidedBy;
  readonly detail: string;
  readonly state: TokenState;
}

export interface AgentFrameworksScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  readonly description: string;
  readonly goal: string;
  /** The two authoring surfaces, shown side by side throughout. */
  readonly handBuilt: ComparisonSide;
  readonly framework: ComparisonSide;
  /** The concerns the framework runs for you, out of sight — revealed at the final step. */
  readonly hidden: readonly string[];
  /** The shared runtime trace, revealed step by step. */
  readonly rows: readonly FrameworkRow[];
  /** Runtime steps visible in your own code so far (hand-built). */
  readonly visibleInHandBuilt: number;
  /** The same steps, run inside .run() and hidden from you (framework). */
  readonly hiddenInFramework: number;
  readonly totalRuntimeSteps: number;
  /** True on the final step, when the equivalence and the hidden list are surfaced. */
  readonly revealed: boolean;
  readonly tracesMatch: boolean;
  readonly finalText?: string;
}

function rowsAt(steps: readonly RuntimeStepView[], revealedCount: number): FrameworkRow[] {
  return steps.map((s) => ({
    index: s.index,
    label: s.label,
    decidedBy: s.decidedBy,
    detail: s.detail,
    state:
      s.index < revealedCount - 1
        ? 'completed'
        : s.index === revealedCount - 1
          ? 'active'
          : 'inactive',
  }));
}

export async function buildAgentFrameworksScenes(): Promise<AgentFrameworksScene[]> {
  const comparison = await buildFrameworkComparison();
  const { steps } = comparison;
  const totalRuntimeSteps = steps.length;
  // One intro scene (step 0), then one scene per runtime step revealed.
  const totalSteps = totalRuntimeSteps + 1;

  const base = {
    goal: comparison.goal,
    handBuilt: comparison.handBuilt,
    framework: comparison.framework,
    hidden: comparison.hidden,
    totalRuntimeSteps,
    tracesMatch: comparison.tracesMatch,
    ...(comparison.finalText !== undefined ? { finalText: comparison.finalText } : {}),
  };

  const scenes: AgentFrameworksScene[] = [];

  // Step 0 — the two surfaces, nothing run yet.
  scenes.push({
    ...base,
    step: 0,
    totalSteps,
    title: 'Same task, two ways',
    description:
      'The same goal, written two ways. On the left, the hand-built loop with every wire in the open. On the right, a framework-style declaration: name it, hand it tools, call .run(). Nothing has run yet — press Next to run the identical task through both and watch who can see each step.',
    rows: rowsAt(steps, 0),
    visibleInHandBuilt: 0,
    hiddenInFramework: 0,
    revealed: false,
  });

  // Steps 1..N — reveal the shared trace one runtime step at a time.
  for (let i = 1; i <= totalRuntimeSteps; i++) {
    const current = steps[i - 1]!;
    const isFinal = i === totalRuntimeSteps;
    const deciderNote =
      current.decidedBy === 'model'
        ? 'The model decided this.'
        : current.decidedBy === 'runtime'
          ? 'The runtime (the loop) decided this.'
          : 'The developer decided this.';
    scenes.push({
      ...base,
      step: i,
      totalSteps,
      title: `Runtime step ${i}: ${current.label}`,
      description: `${current.detail} ${deciderNote} In the hand-built column this is a line of runner.ts you can read and change; in the framework column the identical step just ran inside .run(), where you cannot see it.${
        isFinal
          ? ` Both runs produced the same trace and the same answer${
              comparison.finalText ? ` (${comparison.finalText})` : ''
            } — the framework added no capability. It moved the loop inside a box: convenient, and one more layer between you and the mechanism.`
          : ''
      }`,
      rows: rowsAt(steps, i),
      visibleInHandBuilt: i,
      hiddenInFramework: i,
      revealed: isFinal,
    });
  }

  return scenes;
}
