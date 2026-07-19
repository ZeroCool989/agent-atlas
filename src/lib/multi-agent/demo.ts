/**
 * A concrete, deterministic supervisor/worker scenario for the lesson's visual and tests.
 * The task genuinely benefits from *separation of concerns*, so the mechanism is what stands
 * out: a supervisor decomposes the job, delegates to three specialists, one worker's output is
 * caught as wrong by an INDEPENDENT critic, the supervisor re-delegates a fix, and only then
 * composes the answer. It combines four orchestration patterns in one run:
 *   - supervisor/worker  — the coordinator delegates to specialists;
 *   - planner/executor    — the supervisor decomposes up front and re-plans on failure;
 *   - pipeline            — research → draft → verify is a staged hand-off;
 *   - debate/critic       — the critic checks the writer's work (independent verification).
 *
 * Nothing calls a model: the `Planner` is a fixed decomposition and each worker is a scripted
 * policy. That is what makes it replayable and the point falsifiable — swap in model-backed
 * agents and the orchestration harness is unchanged (ADR-0005).
 */
import type { SupervisorPlanner, Worker } from './orchestrate';
import type { Composer } from './orchestrate';

export const BRIEF_GOAL =
  'Write a vetted one-line brief: which EU regulation governs high-risk AI, and when do its obligations apply?';

/**
 * The supervisor's decomposition. The first plan is a clean pipeline: research → draft → verify.
 * When verification FAILS (the critic caught an unsupported claim), it re-plans the remainder to
 * a fix-then-recheck loop — routing the work to recover instead of shipping the error.
 */
export const briefPlanner: SupervisorPlanner = ({ failure }) => {
  if (!failure) {
    return [
      { id: 'research', description: 'Find the governing regulation and when its obligations apply', tool: 'researcher' },
      { id: 'draft', description: 'Draft the one-line brief from the research', tool: 'writer' },
      { id: 'verify', description: "Check the draft's claims against the research", tool: 'critic' },
    ];
  }
  // Re-plan: the critic rejected the draft. Send it back to the writer with the critique, then
  // re-verify. This is planner/executor re-planning AND debate/critic feeding back into the loop.
  return [
    { id: 'revise', description: 'Rewrite the brief to fix the flagged claim', tool: 'writer' },
    { id: 're-verify', description: 'Re-check the corrected draft against the research', tool: 'critic' },
  ];
};

/** True facts the workers operate over — a tiny scripted "world", not a model. */
const RESEARCH = 'EU AI Act (Regulation 2024/1689); high-risk obligations phase in over 2025–2027.';

/**
 * Three role-specialized workers. Each sees only its task plus forwarded context (isolation).
 * The writer's FIRST draft invents a date the research doesn't support; the critic — a separate
 * agent with a separate job — is what catches it. A single agent that both writes and checks
 * shares its own blind spot (see the reflection concept's sycophancy caveat).
 */
export const researcher: Worker = {
  role: 'researcher',
  specialty: 'gathers and cites facts',
  run: () => ({ ok: true, result: RESEARCH, modelCalls: 2 }),
};

export const writer: Worker = {
  role: 'writer',
  specialty: 'drafts clear prose',
  run: ({ context }) => {
    const hasCritique = context.some((c) => c.includes('Unsupported claim'));
    if (hasCritique) {
      // The revise pass: fix the flagged claim, staying inside the research.
      return {
        ok: true,
        result:
          'The EU AI Act (Reg. 2024/1689) governs high-risk AI; its obligations phase in over 2025–2027.',
        modelCalls: 1,
      };
    }
    // First draft: confidently states a date the research does NOT support.
    return {
      ok: true,
      result:
        'The EU AI Act governs high-risk AI; its obligations became binding in 2024.',
      modelCalls: 1,
    };
  },
};

export const critic: Worker = {
  role: 'critic',
  specialty: 'verifies claims against sources',
  run: ({ context }) => {
    const draft = context[context.length - 1] ?? '';
    if (draft.includes('2024') && !draft.includes('2025–2027')) {
      return {
        ok: false,
        result:
          'Unsupported claim: the draft says obligations "became binding in 2024", but the research says they phase in over 2025–2027.',
        modelCalls: 1,
      };
    }
    return { ok: true, result: 'Verified: every claim in the draft is supported by the research.', modelCalls: 1 };
  },
};

export const BRIEF_WORKERS: Readonly<Record<string, Worker>> = { researcher, writer, critic };

/** Stitches the collected results into the final brief — the supervisor's composition step. */
export const briefComposer: Composer = ({ results }) => {
  // The last verified draft is the answer; composition here is selection, in general it is the
  // fragile part where partial answers are merged.
  const drafts = results.filter((r) => r.role === 'writer');
  const answer = drafts.length > 0 ? drafts[drafts.length - 1]!.result : '(no draft produced)';
  return answer;
};

export const MULTI_AGENT_DEMO = {
  goal: BRIEF_GOAL,
  planner: briefPlanner,
  workers: BRIEF_WORKERS,
  compose: briefComposer,
} as const;

/**
 * The honest contrast the whole concept turns on: the SAME kind of work done by ONE
 * well-structured agent. This is a fixture, not a run of the harness, because the point is a
 * side-by-side of *cost and outcome*, not another trace. Two cases, deliberately:
 *
 *   - WIN case: on the vetted-brief task, the single agent writes AND checks itself in one
 *     pass — and ships the same wrong date, because self-review shares the writer's blind spot.
 *     The multi-agent run's INDEPENDENT critic is what earns its keep here.
 *   - HONEST case: on a trivial lookup, the single agent answers in one call. The multi-agent
 *     system spins up three agents and many more calls for no benefit — architecture-astronomy.
 *
 * Model-call counts come from the scripted policies above (researcher 2 + writer 1 + critic 1 +
 * revise 1 + re-verify 1 + supervisor plan/re-plan/compose 3 = 9); no benchmark is invented.
 */
export interface BaselineCase {
  readonly task: string;
  readonly singleAgent: { readonly modelCalls: number; readonly outcome: string; readonly verdict: string };
  readonly multiAgent: { readonly modelCalls: number; readonly outcome: string; readonly verdict: string };
  /** Which architecture actually wins this task — the load-bearing judgment. */
  readonly winner: 'single-agent' | 'multi-agent';
}

export const SINGLE_AGENT_BASELINE: readonly BaselineCase[] = [
  {
    task: 'Vetted brief needing independent fact-checking (the run above).',
    singleAgent: {
      modelCalls: 1,
      outcome: 'Writes and "self-checks" in one call — and ships the wrong date.',
      verdict: 'Cheapest, but self-review is not independent: it shares its own blind spot.',
    },
    multiAgent: {
      modelCalls: 9,
      outcome: 'A separate critic catches the wrong date; the supervisor re-delegates a fix.',
      verdict: 'Costs ~9× the calls, but separation of concerns catches the error one agent misses.',
    },
    winner: 'multi-agent',
  },
  {
    task: 'Trivial lookup: "What regulation governs high-risk AI in the EU?"',
    singleAgent: {
      modelCalls: 1,
      outcome: 'Answers "the EU AI Act" directly.',
      verdict: 'One call, correct, nothing to coordinate. Simpler and cheaper.',
    },
    multiAgent: {
      modelCalls: 6,
      outcome: 'Same answer after research → draft → verify hand-offs.',
      verdict: 'Six calls and three agents for an answer one call gives — pure overhead.',
    },
    winner: 'single-agent',
  },
];
