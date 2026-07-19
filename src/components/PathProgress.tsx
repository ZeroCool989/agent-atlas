/**
 * Path progress panel + progressive enhancement for /learn. The ordered curriculum is
 * server-rendered as a plain, zero-JS list; this island (mounted once) reads the
 * local-first progress store and (a) shows a summary with export / import / reset, and
 * (b) annotates each server-rendered concept item — a "read ✓" marker and a
 * "read these first" hint for prerequisites not yet marked read (plan §4 / ADR-0003).
 *
 * Enhancement targets are static `[data-concept-item]` elements carrying `data-slug` and
 * a comma-separated `data-prereqs`; the island never owns that list, only decorates it.
 */
import { useEffect, useRef, useState } from 'react';

import {
  emptyProgress,
  exportProgress,
  importProgress,
  loadProgress,
  readCount,
  saveProgress,
  type ProgressState,
} from '../lib/storage/progress';

function titleFromItem(el: Element): string {
  return el.getAttribute('data-title') ?? el.getAttribute('data-slug') ?? '';
}

export default function PathProgress({ total }: { total: number }) {
  const [state, setState] = useState<ProgressState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = (next: ProgressState) => {
    saveProgress(next);
    setState(next);
    decorate(next);
  };

  const decorate = (s: ProgressState) => {
    const readSet = new Set(Object.entries(s.concepts).filter(([, v]) => v === 'read').map(([k]) => k));
    document.querySelectorAll<HTMLElement>('[data-concept-item]').forEach((el) => {
      const slug = el.getAttribute('data-slug')!;
      el.querySelectorAll('[data-progress-annotation]').forEach((n) => n.remove());
      const prereqs = (el.getAttribute('data-prereqs') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
      const unread = prereqs.filter((p) => !readSet.has(p));
      const marker = document.createElement('span');
      marker.setAttribute('data-progress-annotation', '');
      if (readSet.has(slug)) {
        marker.textContent = ' ✓ read';
        marker.className = 'ml-2 text-xs font-medium text-emerald-700';
      } else if (unread.length) {
        marker.textContent = ` · read ${unread.length} prerequisite${unread.length > 1 ? 's' : ''} first`;
        marker.className = 'ml-2 text-xs text-amber-700';
      }
      if (marker.textContent) el.appendChild(marker);
    });
  };

  useEffect(() => {
    const s = loadProgress();
    setState(s);
    decorate(s);
  }, []);

  if (!state) {
    return (
      <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
        Progress is stored locally in your browser.
      </p>
    );
  }

  const done = readCount(state);
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="font-medium text-slate-800">
        {done} of {total} concepts marked read
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:border-slate-400"
          onClick={() => {
            const blob = new Blob([exportProgress(state)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'agent-atlas-progress.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export progress
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:border-slate-400"
          onClick={() => fileRef.current?.click()}
        >
          Import progress
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-500 hover:border-slate-400"
          onClick={() => apply(emptyProgress(new Date().toISOString()))}
        >
          Reset
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          aria-label="Import progress file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            file.text().then((text) => apply(importProgress(text)));
          }}
        />
      </div>
    </div>
  );
}
