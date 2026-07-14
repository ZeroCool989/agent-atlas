/**
 * The three NON-agent architectures of the flagship lesson, implemented for real so
 * their traces are computed, not drawn. Same task as the agent (an arithmetic
 * question), same TraceEvent vocabulary — what changes across them is exactly one
 * thing: WHO decides the next step (`decidedBy`).
 *
 *  - Direct model call:      one model call; no tools exist; the model answers from weights.
 *  - Deterministic workflow: developer-defined steps, no model anywhere in the loop.
 *  - Model-assisted workflow: the model classifies once; the application follows one
 *    of two developer-written branches; no open loop exists.
 */
import type { ModelProvider } from '../model';
import { evaluateExpression } from './calculator';
import type { TraceEvent } from './types';

export interface WorkflowResult {
  finalText?: string;
  trace: TraceEvent[];
}

/** Fixed parsing step shared by the two workflow variants (developer-written). */
export function extractExpression(question: string): string | undefined {
  const match = /\d[\d\s+\-*/().]*/.exec(question);
  const expression = match?.[0]?.trim();
  return expression && /\d/.test(expression) ? expression : undefined;
}

const formatResult = (expression: string, value: number) =>
  `${expression.replace(/\*/g, '×')} = ${value.toLocaleString('en-US')}`;

// --- 1. Direct model call ------------------------------------------------------------------

export async function runDirectCall(provider: ModelProvider, question: string): Promise<WorkflowResult> {
  const trace: TraceEvent[] = [
    {
      step: 0,
      type: 'run-started',
      decidedBy: 'runtime',
      detail: 'The question goes straight to the model. No tools exist, no steps, no loop.',
    },
    {
      step: 1,
      type: 'model-requested',
      decidedBy: 'developer',
      detail: 'One model call — the developer decided this is the only step there will ever be.',
    },
  ];
  const response = await provider.complete({ messages: [{ role: 'user', text: question }] });
  trace.push(
    {
      step: 1,
      type: 'model-responded',
      decidedBy: 'model',
      stopReason: response.stopReason,
      ...(Object.keys(response.usage).length > 0 ? { usage: response.usage } : {}),
      detail:
        'The model answers from its weights. It cannot execute a calculator — arithmetic beyond a few digits is exactly where weights-only answers go wrong.',
    },
    {
      step: 1,
      type: 'run-completed',
      decidedBy: 'runtime',
      outcome: 'completed',
      detail: 'Whatever the model said IS the output. Nothing checked it.',
    },
  );
  return { ...(response.text !== undefined ? { finalText: response.text } : {}), trace };
}

// --- 2. Deterministic workflow ------------------------------------------------------------------

export function runDeterministicWorkflow(question: string): WorkflowResult {
  const trace: TraceEvent[] = [
    {
      step: 0,
      type: 'run-started',
      decidedBy: 'runtime',
      detail: 'A fixed pipeline the developer wrote: parse → calculate → format. No model is involved at any point.',
    },
    {
      step: 1,
      type: 'fixed-step',
      decidedBy: 'developer',
      detail: 'Step 1 (always runs): extract the arithmetic expression with a parser the developer wrote.',
    },
  ];
  const expression = extractExpression(question);
  if (!expression) {
    trace.push({
      step: 1,
      type: 'run-failed',
      decidedBy: 'runtime',
      outcome: 'tool-error',
      detail: 'No expression found. Deterministic workflows fail loudly and predictably on inputs outside their design — that predictability is the point.',
    });
    return { trace };
  }
  trace.push({
    step: 2,
    type: 'fixed-step',
    decidedBy: 'developer',
    toolName: 'calculator',
    detail: `Step 2 (always runs): evaluate "${expression}" with the calculator. The same calculator the agent will use — but here the DEVELOPER decided it runs.`,
  });
  const result = evaluateExpression(expression);
  if (!result.ok) {
    trace.push({
      step: 2,
      type: 'run-failed',
      decidedBy: 'runtime',
      outcome: 'tool-error',
      detail: `Calculation failed: ${result.error}.`,
    });
    return { trace };
  }
  const finalText = formatResult(expression, result.value as number);
  trace.push(
    {
      step: 3,
      type: 'fixed-step',
      decidedBy: 'developer',
      detail: 'Step 3 (always runs): format the result with a fixed template.',
    },
    {
      step: 3,
      type: 'run-completed',
      decidedBy: 'runtime',
      outcome: 'completed',
      detail: 'Every run of this workflow takes exactly these steps, in this order, forever. Fully testable, fully predictable, zero model cost.',
    },
  );
  return { finalText, trace };
}

// --- 3. Model-assisted workflow ---------------------------------------------------------------------

export async function runModelAssistedWorkflow(
  provider: ModelProvider,
  question: string,
): Promise<WorkflowResult> {
  const trace: TraceEvent[] = [
    {
      step: 0,
      type: 'run-started',
      decidedBy: 'runtime',
      detail: 'The developer wrote two branches (calculation / general). The model gets exactly one decision: which branch.',
    },
    {
      step: 1,
      type: 'model-requested',
      decidedBy: 'developer',
      detail: 'Model call 1 (always runs): classify the request. The developer decided this call happens; the model only fills in the label.',
    },
  ];
  const classification = await provider.complete({
    system: 'Classify the user request. Answer with exactly one word: "calculation" or "general".',
    messages: [{ role: 'user', text: question }],
  });
  const branch = classification.text?.trim().toLowerCase() === 'calculation' ? 'calculation' : 'general';
  trace.push(
    {
      step: 1,
      type: 'model-responded',
      decidedBy: 'model',
      stopReason: classification.stopReason,
      ...(Object.keys(classification.usage).length > 0 ? { usage: classification.usage } : {}),
      detail: `The model classified the request as "${branch}".`,
    },
    {
      step: 1,
      type: 'branch-selected',
      decidedBy: 'model',
      detail: `Branch "${branch}" selected — model discretion begins and ends here. Both branches were written by the developer; there is no loop, and the model cannot invent a third path.`,
    },
  );

  if (branch === 'calculation') {
    const expression = extractExpression(question);
    const result = expression ? evaluateExpression(expression) : ({ ok: false, error: 'no expression found' } as const);
    trace.push({
      step: 2,
      type: 'fixed-step',
      decidedBy: 'developer',
      toolName: 'calculator',
      detail: 'The calculation branch runs the developer’s fixed parse → calculate → format steps.',
    });
    if (!result.ok) {
      trace.push({
        step: 2,
        type: 'run-failed',
        decidedBy: 'runtime',
        outcome: 'tool-error',
        detail: `Calculation failed: ${result.error}.`,
      });
      return { trace };
    }
    const finalText = formatResult(expression!, result.value as number);
    trace.push({
      step: 2,
      type: 'run-completed',
      decidedBy: 'runtime',
      outcome: 'completed',
      detail: 'Output produced by deterministic code. The model routed; it never touched the calculation.',
    });
    return { finalText, trace };
  }

  trace.push({
    step: 2,
    type: 'fixed-step',
    decidedBy: 'developer',
    detail: 'The general branch would answer directly (not exercised in this lesson’s run).',
  });
  trace.push({
    step: 2,
    type: 'run-completed',
    decidedBy: 'runtime',
    outcome: 'completed',
    detail: 'Output produced by the developer-defined general branch.',
  });
  return { ...(classification.text !== undefined ? { finalText: classification.text } : {}), trace };
}
