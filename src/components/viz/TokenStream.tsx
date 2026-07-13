/**
 * Renders a token sequence from scene data (`TokenView[]`). Pure renderer: all
 * educational logic (which token is active, whether ids are shown) arrives as scene
 * truth; this component only decides presentation.
 *
 * Boundaries and states are communicated by more than color: each token is a bordered
 * chip in an ordered list, the active token gets a thicker border and a "▸" marker,
 * completed tokens get a "✓" marker, and each chip carries screen-reader state text.
 * Leading spaces inside token text are made visible as "␣" — tokens are not words,
 * and hiding the space would mislead. Not coupled to any tokenizer vendor: it renders
 * whatever token data the scene provides.
 */
import type { TokenView } from '../../lib/viz';

export interface TokenStreamProps {
  sourceText: string;
  tokens: TokenView[];
  showBoundaries: boolean;
  showIds: boolean;
}

const STATE_TEXT = {
  inactive: 'not yet in the context window',
  active: 'entering the context window',
  completed: 'in the context window',
} as const;

export default function TokenStream({ sourceText, tokens, showBoundaries, showIds }: TokenStreamProps) {
  if (!showBoundaries) {
    return (
      <p
        className="rounded border border-slate-200 p-4 font-mono text-lg"
        style={{ background: 'var(--viz-surface)' }}
      >
        {sourceText}
      </p>
    );
  }

  return (
    <ol
      aria-label="Tokens, in order"
      className="flex list-none flex-wrap items-end gap-2 rounded border border-slate-200 p-4"
      style={{ background: 'var(--viz-surface)' }}
    >
      {tokens.map((token) => {
        const style =
          token.state === 'active'
            ? { borderColor: 'var(--viz-active)', background: 'var(--viz-active-surface)', borderWidth: 3 }
            : token.state === 'completed'
              ? { borderColor: 'var(--viz-complete)', background: 'var(--viz-complete-surface)' }
              : { borderColor: 'var(--viz-boundary)', background: 'white' };
        return (
          <li key={token.index} className="viz-transition rounded border-2 px-2 py-1" style={style}>
            <span aria-hidden="true" className="mr-1 text-xs">
              {token.state === 'completed' ? '✓' : token.state === 'active' ? '▸' : ''}
            </span>
            <code className="whitespace-pre font-mono text-base">
              {token.text.replace(/^ /, '␣')}
            </code>
            <span className="mt-0.5 block text-[10px] leading-tight text-slate-500">
              #{token.index}
              {showIds && token.id !== undefined ? ` · id ${token.id}` : ''}
            </span>
            <span className="sr-only">
              {`token ${token.index + 1} of ${tokens.length}, "${token.text}", ${STATE_TEXT[token.state]}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
