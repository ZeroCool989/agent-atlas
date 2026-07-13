/**
 * Experiment surface for the Tokens lesson: type anything, see the teaching
 * tokenizer's real output — token boundaries, vocabulary ids, counts, and honest
 * unknown-character handling. The "try" buttons steer the learner toward the
 * instructive cases (seen words vs unseen words vs characters the vocabulary lacks).
 */
import { useMemo, useState } from 'react';

import { encode, TEACHING_MERGES, TRAINING_CORPUS, trainBpe } from '../../lib/sim/tokenizer';
import type { TokenView } from '../../lib/viz';

const EXPERIMENTS: Array<{ label: string; text: string }> = [
  { label: 'Seen words', text: 'the model learns tokens' },
  { label: 'Unseen word', text: 'the transformer learns' },
  { label: 'Unknown characters', text: 'tokens & Zürich 🚀' },
];

export default function TokenizerPlayground() {
  const model = useMemo(() => trainBpe(TRAINING_CORPUS, TEACHING_MERGES), []);
  const [text, setText] = useState('the tokenizer learns tokenization');
  const encoded = encode(text, model);
  const unknownCount = encoded.filter((t) => !t.known).length;

  const tokens: TokenView[] = encoded.map((token, index) => ({
    index,
    text: token.text,
    ...(token.id !== undefined ? { id: token.id } : {}),
    state: token.text.length > 1 ? 'completed' : 'inactive',
  }));

  return (
    <section aria-label="Tokenizer playground" className="space-y-3 rounded border border-slate-200 p-4">
      <label className="block text-sm">
        <span className="font-medium">Type anything — watch the teaching tokenizer segment it:</span>
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {EXPERIMENTS.map((experiment) => (
          <button
            key={experiment.label}
            type="button"
            onClick={() => setText(experiment.text)}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            Try: {experiment.label}
          </button>
        ))}
      </div>

      {text.trim().length > 0 ? (
        <>
          <ol
            aria-label="Playground tokens, in order"
            className="flex list-none flex-wrap items-end gap-2 rounded border border-slate-200 p-3"
            style={{ background: 'var(--viz-surface)' }}
          >
            {tokens.map((token) => (
              <li
                key={token.index}
                className="rounded border-2 px-2 py-1"
                style={
                  token.id === undefined
                    ? { borderColor: 'var(--viz-warning)', background: 'var(--viz-warning-surface)' }
                    : token.text.length > 1
                      ? { borderColor: 'var(--viz-complete)', background: 'var(--viz-complete-surface)' }
                      : { borderColor: 'var(--viz-boundary)', background: 'white' }
                }
              >
                <code className="whitespace-pre font-mono text-sm">{token.text.replace(/^ /, '␣')}</code>
                <span className="block text-[10px] leading-tight text-slate-500">
                  {token.id !== undefined ? `id ${token.id}` : 'not in vocabulary'}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-sm tabular-nums text-slate-600">
            {text.trim().split(/\s+/).length} words → <strong>{encoded.length} tokens</strong>
            {unknownCount > 0 && (
              <span>
                {' '}
                · <span aria-hidden="true">⚠</span> {unknownCount} character(s) outside the tiny
                {' '}{model.vocab.length}-entry vocabulary — a production tokenizer
                (byte-level, 50k–200k entries) never has this problem, because every possible
                byte is in its base vocabulary.
              </span>
            )}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">Type something above to tokenize it.</p>
      )}
    </section>
  );
}
