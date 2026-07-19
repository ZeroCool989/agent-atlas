/**
 * "Due today" spaced-repetition queue for the interview home (plan §9, Phase 2). This is
 * an ENHANCEMENT layered on top of the static question list and the drill island: without
 * JavaScript the page still renders and grades still work through the drill; with JS this
 * island reads the local drill history + SRS state, computes what is due via the pure
 * `src/lib/srs` module, and serves a small review flow whose grades feed back into
 * scheduling.
 *
 * It writes BOTH the shared grade history (so the drill's record/attempt count stays
 * truthful) and the SRS card state (so the schedule advances). The two stores are the
 * source of truth on reload; a review grade won't live-update the separate drill island in
 * the same session, only after a reload.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  applyGrade,
  emptyHistory,
  idbBackend,
  GRADES,
  type Grade,
  type HistoryBackend,
  type HistoryState,
} from '../lib/interview/history';
import {
  applyGradeToSrs,
  dueCards,
  emptySrs,
  reconcileWithHistory,
  srsIdbBackend,
  type SrsBackend,
  type SrsState,
} from '../lib/srs';
import type { DrillQuestion } from './InterviewDrill';

const GRADE_LABELS: Record<Grade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

export default function InterviewReview({ questions }: { questions: DrillQuestion[] }) {
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<HistoryState>(emptyHistory());
  const [srs, setSrs] = useState<SrsState>(emptySrs());
  const [historyBackend, setHistoryBackend] = useState<HistoryBackend | null>(null);
  const [srsBackend, setSrsBackend] = useState<SrsBackend | null>(null);
  // `now` is fixed for the session so the queue doesn't shift under the learner mid-review.
  const [now, setNow] = useState<string>('');
  const [reviewing, setReviewing] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const knownIds = useMemo(() => questions.map((q) => q.id), [questions]);

  useEffect(() => {
    const hb = idbBackend();
    const sb = srsIdbBackend();
    setHistoryBackend(hb);
    setSrsBackend(sb);
    const nowIso = new Date().toISOString();
    setNow(nowIso);
    Promise.all([hb.load(), sb.load()]).then(([h, s]) => {
      // Bring any pre-SRS drill history into the schedule without clobbering live cards.
      const reconciled = reconcileWithHistory(s, h);
      setHistory(h);
      setSrs(reconciled);
      setLoaded(true);
      if (reconciled !== s) void sb.save(reconciled);
    });
  }, []);

  // Only surface due cards for questions that still exist in the bank.
  const due = useMemo(
    () => (loaded && now ? dueCards(srs, now, knownIds) : []),
    [loaded, now, srs, knownIds],
  );
  const current = due.length > 0 ? byId.get(due[0].id) : undefined;

  async function grade(id: string, g: Grade) {
    if (!loaded) return;
    const at = new Date().toISOString();
    const nextHistory = applyGrade(history, id, g, at);
    const nextSrs = applyGradeToSrs(srs, id, g, at);
    setHistory(nextHistory);
    setSrs(nextSrs);
    await Promise.all([historyBackend?.save(nextHistory), srsBackend?.save(nextSrs)]);
    setSavedCount((c) => c + 1);
  }

  const dueCountValue = due.length;

  return (
    <section
      aria-label="Spaced repetition review"
      aria-busy={!loaded}
      data-srs
      data-srs-ready={loaded ? 'true' : 'false'}
      data-due-count={loaded ? dueCountValue : ''}
      data-srs-saved={savedCount}
      className="mt-6 rounded border border-slate-200 bg-slate-50 p-4"
    >
      {!loaded ? (
        <p className="text-sm text-slate-500">Loading your review schedule…</p>
      ) : reviewing && current ? (
        <div data-review-question={current.id}>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span aria-live="polite" data-srs-remaining>
              {dueCountValue} left to review
            </span>
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="underline hover:text-slate-700"
            >
              End review
            </button>
          </div>
          <h3 className="font-medium text-slate-900">{current.question}</h3>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-slate-700">30-second answer</summary>
            <p className="mt-1 text-sm text-slate-700">{current.answers.beginner}</p>
          </details>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-slate-700">
              Two-minute professional answer
            </summary>
            <p className="mt-1 text-sm text-slate-700">{current.answers.professional}</p>
          </details>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-slate-700">Deep dive</summary>
            <p className="mt-1 text-sm text-slate-700">{current.answers.deep}</p>
          </details>
          <div
            className="mt-3 flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Grade this review"
          >
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => void grade(current.id, g)}
                className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-white"
              >
                {GRADE_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
      ) : reviewing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600" data-srs-complete>
            <strong className="font-medium text-slate-800">Review complete.</strong> Nothing else
            is due right now — well done.
          </p>
          <button
            type="button"
            onClick={() => setReviewing(false)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-white"
          >
            Done
          </button>
        </div>
      ) : dueCountValue === 0 ? (
        <p className="text-sm text-slate-600" data-srs-empty>
          <strong className="font-medium text-slate-800">Nothing due for review.</strong> Grade
          questions below as you drill — spaced repetition brings each one back when it's due.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">
            <strong className="font-semibold text-slate-900" data-srs-due-label>
              {dueCountValue} due for review
            </strong>{' '}
            today. Recall each one before revealing the answer, then grade yourself.
          </p>
          <button
            type="button"
            onClick={() => setReviewing(true)}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Start review
          </button>
        </div>
      )}
    </section>
  );
}
