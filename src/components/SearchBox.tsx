import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Client-side search over the Pagefind index (built into /pagefind/ at `npm run build`).
 * Zero-server: Pagefind ships a static index the browser queries directly. The index does
 * not exist under `astro dev` (only after a production build), so we degrade gracefully.
 * Results are rendered with our own markup (no third-party UI, no inline styles) to stay
 * within the strict CSP.
 */

interface PagefindResultData {
  url: string;
  excerpt: string;
  meta?: { title?: string };
}
interface PagefindResult {
  id: string;
  data: () => Promise<PagefindResultData>;
}
interface PagefindApi {
  search: (q: string) => Promise<{ results: PagefindResult[] }>;
  options?: (o: Record<string, unknown>) => Promise<void>;
}

type Status = 'idle' | 'loading' | 'ready' | 'unavailable';

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PagefindResultData[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [searched, setSearched] = useState(false);
  const apiRef = useRef<PagefindApi | null>(null);

  const loadApi = useCallback(async (): Promise<PagefindApi | null> => {
    if (apiRef.current) return apiRef.current;
    try {
      // Runtime path; Pagefind emits this into the built site. Vite must not resolve it.
      // Non-literal specifier so TS/Vite don't resolve it at build; Pagefind emits it at runtime.
      const pagefindPath = '/pagefind/pagefind.js';
      const mod = (await import(/* @vite-ignore */ pagefindPath)) as unknown as PagefindApi;
      await mod.options?.({ excerptLength: 25 });
      apiRef.current = mod;
      return mod;
    } catch {
      setStatus('unavailable');
      return null;
    }
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setStatus((s) => (s === 'unavailable' ? s : 'loading'));
      const api = await loadApi();
      if (!api || cancelled) return;
      const res = await api.search(q);
      const data = await Promise.all(res.results.slice(0, 12).map((r) => r.data()));
      if (cancelled) return;
      setResults(data);
      setSearched(true);
      setStatus('ready');
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, loadApi]);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Search the atlas</span>
        <input
          type="search"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Search concepts, playgrounds, governance…"
          autoComplete="off"
          className="w-full rounded border border-slate-300 px-4 py-2 text-base outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          aria-describedby="search-status"
        />
      </label>

      <p id="search-status" className="text-sm text-slate-500" aria-live="polite">
        {status === 'unavailable'
          ? 'Search runs on the built site — run the production build (npm run build) to try it locally.'
          : query.trim().length >= 2 && searched
            ? `${results.length} result${results.length === 1 ? '' : 's'}`
            : 'Type at least two characters.'}
      </p>

      {results.length > 0 && (
        <ul className="space-y-3" aria-label="Search results">
          {results.map((r) => (
            <li className="rounded border border-slate-200 p-4" key={r.url}>
              <a href={r.url} className="font-semibold underline">
                {r.meta?.title ?? r.url}
              </a>
              <p
                className="mt-1 text-sm text-slate-600"
                // Pagefind returns a sanitized excerpt with <mark> highlights.
                dangerouslySetInnerHTML={{ __html: r.excerpt }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
