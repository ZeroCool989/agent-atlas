/**
 * The lesson's one deterministic tool: an arithmetic evaluator implemented as a tiny
 * recursive-descent parser. Deliberately NOT eval()/Function() — the model must never
 * be able to run arbitrary code through a tool, and the ~60 lines below are the
 * teachable proof that "calculator" can mean exactly calculator.
 *
 * Grammar: expr := term (('+'|'-') term)* · term := factor (('*'|'/') factor)* ·
 * factor := number | '(' expr ')' | '-' factor
 */
import { z } from 'zod';

import type { AgentTool, ToolExecutionResult } from './types';

export function evaluateExpression(expression: string): ToolExecutionResult {
  let pos = 0;
  const input = expression;

  const peek = () => {
    while (pos < input.length && input[pos] === ' ') pos++;
    return input[pos];
  };

  function parseExpr(): number {
    let value = parseTerm();
    for (;;) {
      const ch = peek();
      if (ch === '+') (pos++, (value += parseTerm()));
      else if (ch === '-') (pos++, (value -= parseTerm()));
      else return value;
    }
  }

  function parseTerm(): number {
    let value = parseFactor();
    for (;;) {
      const ch = peek();
      if (ch === '*') (pos++, (value *= parseFactor()));
      else if (ch === '/') {
        pos++;
        const divisor = parseFactor();
        if (divisor === 0) throw new Error('division by zero');
        value /= divisor;
      } else return value;
    }
  }

  function parseFactor(): number {
    const ch = peek();
    if (ch === '-') {
      pos++;
      return -parseFactor();
    }
    if (ch === '(') {
      pos++;
      const value = parseExpr();
      if (peek() !== ')') throw new Error(`expected ")" at position ${pos}`);
      pos++;
      return value;
    }
    const start = pos;
    while (pos < input.length && /[0-9.]/.test(input[pos]!)) pos++;
    if (pos === start) throw new Error(`unexpected character "${input[pos] ?? 'end of input'}" at position ${pos}`);
    const value = Number(input.slice(start, pos));
    if (Number.isNaN(value)) throw new Error(`invalid number "${input.slice(start, pos)}"`);
    return value;
  }

  try {
    const value = parseExpr();
    if (peek() !== undefined) throw new Error(`unexpected trailing input at position ${pos}`);
    if (!Number.isFinite(value)) throw new Error('result is not a finite number');
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

const argsSchema = z.object({ expression: z.string().trim().min(1) }).strict();

export const calculatorTool: AgentTool<{ expression: string }> = {
  definition: {
    name: 'calculator',
    description:
      'Evaluates an arithmetic expression exactly (numbers, + - * /, parentheses). Use it for any calculation instead of computing in your head.',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'The arithmetic expression, e.g. "127 * 49"' },
      },
      required: ['expression'],
      additionalProperties: false,
    },
  },
  parseArgs(args) {
    const result = argsSchema.safeParse(args);
    return result.success
      ? { ok: true, value: result.data }
      : { ok: false, error: result.error.issues.map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`).join('; ') };
  },
  execute({ expression }) {
    return evaluateExpression(expression);
  },
};
