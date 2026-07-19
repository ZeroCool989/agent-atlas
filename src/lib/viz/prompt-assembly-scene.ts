/**
 * The `(input, step) => Scene` function for the prompt-engineering demo (ADR-0004, plan
 * §8). Pure and deterministic. It watches a prompt being *assembled* one part at a time —
 * system, then few-shot examples, then the task, then the format spec — and shows the
 * token cost accumulating against a context window. The lesson: prompting is context
 * construction, and every part you add is tokens spent before the model answers.
 *
 * Token counts come from the prompt build project (`src/lib/prompt/assemble.ts`) — the
 * same `budgetFor` the lesson asks you to read — so the picture can never drift from the
 * code that prices it.
 */
import { budgetFor, type PromptParts, type PromptSegment } from '../prompt/assemble';
import { clampStep } from './timeline';
import type { PromptAssemblyScene, PromptSegmentView, Timeline } from './types';

export interface PromptAssemblySceneInput {
  parts: PromptParts;
  windowTokens: number;
}

/** The reveal order — the order you actually build a prompt in. */
const KIND_ORDER: PromptSegment['kind'][] = ['system', 'examples', 'task', 'format'];

export const PROMPT_ASSEMBLY_TIMELINE: Timeline = {
  steps: [
    {
      label: 'An empty context',
      description:
        'Before you write anything, the model’s context is empty. It has no memory of you, no knowledge of your task — it will only ever see the text you place here. That is the whole game: prompt engineering is deciding what goes in this box.',
    },
    {
      label: 'System — role and rules',
      description:
        'The system part sets the role and the standing instructions ("you are a terse assistant that answers in British English"). It steers behaviour without being the task itself. Notice it already costs tokens.',
    },
    {
      label: 'Few-shot examples — show, don’t just tell',
      description:
        'Instead of describing the output, you demonstrate it: a few input→output pairs. The model imitates the pattern. Powerful, but the most expensive lever — each example is more tokens in every single call.',
    },
    {
      label: 'The task — the actual request',
      description:
        'Now the real request. Everything above exists to shape how the model answers *this*. If the task is unclear, no amount of system text or examples rescues it — clarity of the ask is the highest-leverage edit.',
    },
    {
      label: 'Output format — a contract for the answer',
      description:
        'Finally, how the answer should be shaped ("reply with a single JSON object"). This is where prompting hands off to structured outputs. The budget bar shows the whole prompt’s cost — and the reply still needs room the prompt has now spent.',
    },
  ],
};

function segmentViews(input: PromptAssemblySceneInput, revealedKinds: Set<string>): {
  segments: PromptSegmentView[];
  usedTokens: number;
} {
  const budget = budgetFor(input.parts, input.windowTokens);
  const revealed = budget.segments.filter((s) => revealedKinds.has(s.kind));
  const usedTokens = revealed.reduce((sum, s) => sum + s.tokens, 0);
  const segments: PromptSegmentView[] = budget.segments.map((s) => ({
    label: s.label,
    kind: s.kind,
    tokens: s.tokens,
    revealed: revealedKinds.has(s.kind),
  }));
  return { segments, usedTokens };
}

export function createPromptAssemblyScene(
  input: PromptAssemblySceneInput,
  step: number,
): PromptAssemblyScene {
  const totalSteps = PROMPT_ASSEMBLY_TIMELINE.steps.length;
  const current = clampStep(step, totalSteps);
  const timelineStep = PROMPT_ASSEMBLY_TIMELINE.steps[current]!;

  // Step 0 reveals nothing; step k reveals the first k kinds in build order.
  const revealedKinds = new Set(KIND_ORDER.slice(0, current));
  const { segments, usedTokens } = segmentViews(input, revealedKinds);
  const percentUsed = Math.round((usedTokens / input.windowTokens) * 1000) / 10;

  return {
    step: current,
    totalSteps,
    title: timelineStep.label,
    description: timelineStep.description ?? '',
    segments,
    usedTokens,
    windowTokens: input.windowTokens,
    percentUsed,
  };
}

/**
 * Deterministic sample prompt for the lesson: a small sentiment classifier assembled from
 * a role, two demonstrations, the task, and a format contract, budgeted against a small
 * window so the cost is legible. The text is illustrative; the token math is the real
 * `estimateTokens`/`budgetFor` from the build project.
 */
export const PROMPT_ASSEMBLY_DEMO_INPUT: PromptAssemblySceneInput = {
  windowTokens: 200,
  parts: {
    system: 'You are a sentiment classifier. Read the review and decide how the customer feels. Be concise and never explain your reasoning.',
    examples: [
      { input: 'Review: "The battery lasts forever and it arrived early."', output: 'positive' },
      { input: 'Review: "Screen cracked in a week and support ignored me."', output: 'negative' },
    ],
    task: 'Review: "It works, but the setup instructions were confusing."',
    formatSpec: 'Answer with exactly one word: positive, negative, or neutral.',
  },
};
