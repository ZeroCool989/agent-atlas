import { describe, expect, it } from 'vitest';

import {
  assemblePrompt,
  budgetFor,
  CHARS_PER_TOKEN,
  estimateTokens,
  NEAR_CAPACITY_FRACTION,
  type PromptParts,
} from './assemble';

describe('estimateTokens', () => {
  it('is empty for empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });
  it('uses the ~4-chars-per-token heuristic, rounding up', () => {
    expect(estimateTokens('a'.repeat(4))).toBe(1);
    expect(estimateTokens('a'.repeat(5))).toBe(2); // ceil(5/4)
    expect(estimateTokens('a'.repeat(4 * CHARS_PER_TOKEN))).toBe(CHARS_PER_TOKEN);
  });
});

describe('assemblePrompt', () => {
  it('puts system text on the request, not in the messages', () => {
    const req = assemblePrompt({ system: 'You are terse.', task: 'Summarize.' });
    expect(req.system).toBe('You are terse.');
    // System text lives on the request, never as a message (the role union has no 'system').
    expect(req.messages.map((m) => m.role)).toEqual(['user']);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0]).toEqual({ role: 'user', text: 'Summarize.' });
  });

  it('omits the system field entirely when no system part is given', () => {
    const req = assemblePrompt({ task: 'Hi' });
    expect('system' in req).toBe(false);
  });

  it('renders each few-shot example as a user turn then an assistant turn', () => {
    const req = assemblePrompt({
      examples: [
        { input: 'cat', output: 'animal' },
        { input: 'rose', output: 'plant' },
      ],
      task: 'oak',
    });
    expect(req.messages).toEqual([
      { role: 'user', text: 'cat' },
      { role: 'assistant', text: 'animal' },
      { role: 'user', text: 'rose' },
      { role: 'assistant', text: 'plant' },
      { role: 'user', text: 'oak' },
    ]);
  });

  it('appends the format spec to the final task turn', () => {
    const req = assemblePrompt({ task: 'Classify oak', formatSpec: 'Answer with one word.' });
    const last = req.messages.at(-1)!;
    expect(last).toEqual({ role: 'user', text: 'Classify oak\n\nAnswer with one word.' });
  });

  it('is deterministic', () => {
    const parts: PromptParts = { system: 's', examples: [{ input: 'a', output: 'b' }], task: 't', formatSpec: 'f' };
    expect(assemblePrompt(parts)).toEqual(assemblePrompt(parts));
  });
});

describe('budgetFor', () => {
  it('prices every present segment and sums them', () => {
    const b = budgetFor({ system: 'a'.repeat(40), task: 'b'.repeat(40) }, 1000);
    expect(b.segments.map((s) => s.kind)).toEqual(['system', 'task']);
    expect(b.segments[0]!.tokens).toBe(10);
    expect(b.segments[1]!.tokens).toBe(10);
    expect(b.totalTokens).toBe(20);
    expect(b.percentUsed).toBe(2);
    expect(b.overBudget).toBe(false);
    expect(b.warning).toBeUndefined();
  });

  it('labels the few-shot segment with the example count', () => {
    const b = budgetFor({ examples: [{ input: 'x', output: 'y' }, { input: 'p', output: 'q' }], task: 't' }, 1000);
    const examples = b.segments.find((s) => s.kind === 'examples')!;
    expect(examples.label).toBe('Few-shot examples (2)');
  });

  it('warns near capacity and flags an over-budget prompt', () => {
    const near = budgetFor({ task: 'a'.repeat(Math.ceil(100 * NEAR_CAPACITY_FRACTION) * CHARS_PER_TOKEN) }, 100);
    expect(near.overBudget).toBe(false);
    expect(near.warning).toMatch(/of the window/);

    const over = budgetFor({ task: 'a'.repeat(120 * CHARS_PER_TOKEN) }, 100);
    expect(over.overBudget).toBe(true);
    expect(over.warning).toMatch(/no room left for the model/);
  });

  it('rejects a non-positive window', () => {
    expect(() => budgetFor({ task: 't' }, 0)).toThrow(/positive integer/);
  });
});
