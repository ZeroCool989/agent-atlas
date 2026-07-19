/**
 * "Mark as read" progress control (opt-in island). Reads and writes the local-first
 * progress store (src/lib/storage/progress.ts) — the graph home and the Path view read
 * the same state. SSR-safe: renders a stable label on the server, resolves the real state
 * after mount. This is the only place the learner *writes* progress from a concept page.
 */
import { useEffect, useState } from 'react';

import {
  conceptProgress,
  loadProgress,
  saveProgress,
  setConceptProgress,
} from '../lib/storage/progress';

export default function MarkAsRead({ slug }: { slug: string }) {
  const [read, setRead] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRead(conceptProgress(loadProgress(), slug) === 'read');
    setReady(true);
  }, [slug]);

  const toggle = () => {
    const next = !read;
    setRead(next);
    saveProgress(setConceptProgress(loadProgress(), slug, next ? 'read' : null, new Date().toISOString()));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={read}
      disabled={!ready}
      className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition ${
        read
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
      }`}
    >
      <span aria-hidden="true">{read ? '✓' : '○'}</span>
      {read ? 'Read — marked done' : 'Mark as read'}
    </button>
  );
}
