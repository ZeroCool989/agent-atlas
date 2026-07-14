import type { ExperimentDefinition } from '../lib/types';

/**
 * Controlled live failure experiment (2026-07-14). SAFE by construction: the only tool
 * is the calculator (a parser supporting + - * / and parentheses — no sqrt, no powers,
 * no side effects). We ask for a square root, which the calculator's grammar cannot
 * express, to observe how the real model reacts when the natural tool call would carry
 * arguments the runtime will reject or the tool cannot evaluate. No filesystem, shell,
 * browser, email, payment, or network side-effect tools are ever exposed.
 */
const experiment: ExperimentDefinition = {
  id: '006-live-claude-failure',
  version: 1,
  goal: 'Observe how a real model reacts when a task invites a tool call the calculator cannot satisfy — and confirm the runtime bounds every reaction to an honest outcome.',
  question: 'Asked for a square root with only a +−×÷ calculator available, does the model emit an unparseable expression (→ tool-error), work around the limitation, or answer from weights?',
  expectedObservation:
    'One of: (a) the model calls the calculator with an expression like sqrt(2) or 2^0.5 that the parser rejects → runtime outcome tool-error; (b) the model rewrites the task into supported arithmetic; or (c) it answers ~1.414 from weights without the tool. All are safe and observable; none is pre-judged correct.',
  notes: 'Failure/observation experiment — success criteria are intentionally loose; the recorded behavior IS the result.',
  tools: ['calculator'],
  maxSteps: 4,
  repeats: 1,
  variants: [
    {
      key: 'sqrt',
      system: 'You are a careful assistant. Use the calculator tool for arithmetic when helpful.',
      prompt: 'What is the square root of 2?',
    },
  ],
  matrix: [
    {
      kind: 'real',
      label: 'claude',
      provider: 'claude',
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0,
      maxOutputTokens: 512,
      pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: 'USD' },
    },
  ],
  // No hard expectation: any of the observed reactions is a valid recorded result.
  successCriteria: {},
};

export default experiment;
