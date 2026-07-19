/**
 * Interview drill mode (plan §9). The question list is server-rendered (static-first: the
 * questions and their tiered answers are readable without JavaScript, answers revealed by
 * native <details>). On hydration it adds self-grading persisted to IndexedDB — no SRS
 * scheduling yet (out of MVP), just a recorded grade + attempt count.
 */
import { useEffect, useState } from 'react';
import { filterQuestions } from '../lib/interview/filter';
import {
  applyGrade,
  emptyHistory,
  idbBackend,
  GRADES,
  type Grade,
  type HistoryState,
  type HistoryBackend,
} from '../lib/interview/history';

export interface DrillQuestion {
  id: string;
  question: string;
  difficulty: string;
  roles: string[];
  criticalThinking?: boolean;
  answers: { beginner: string; professional: string; deep: string };
}

const GRADE_LABELS: Record<Grade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

export default function InterviewDrill({ questions }: { questions: DrillQuestion[] }) {
  const [history, setHistory] = useState<HistoryState>(emptyHistory());
  const [backend, setBackend] = useState<HistoryBackend | null>(null);
  // Grading is disabled until the prior history has loaded, so a slow async load can
  // never clobber a grade the learner just made (and Playwright waits for enablement).
  const [loaded, setLoaded] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const [role, setRole] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);

  useEffect(() => {
    const b = idbBackend();
    setBackend(b);
    b.load().then((h) => {
      setHistory(h);
      setLoaded(true);
    });
    // Static site: query params are inert server-side, so the filter is applied here
    // on the client (mirrors the concepts index). Without JS the full list renders.
    const p = new URLSearchParams(window.location.search);
    setRole(p.get('role'));
    setDifficulty(p.get('difficulty'));
  }, []);

  const shown = filterQuestions(questions, { role, difficulty });

  async function grade(id: string, g: Grade) {
    if (!loaded) return;
    const next = applyGrade(history, id, g, new Date().toISOString());
    setHistory(next); // optimistic
    await backend?.save(next);
    setSavedCount((c) => c + 1); // durable signal (a completed IndexedDB write)
  }

  if (shown.length === 0) {
    return (
      <p id="interview-empty" className="rounded border border-slate-200 p-4 text-slate-600">
        No questions match this filter. <a className="underline" href="/interview">Clear the filter</a>.
      </p>
    );
  }

  return (
    <ol className="space-y-6" aria-label="Interview questions" data-shown={shown.length} data-saved={savedCount}>
      {shown.map((q) => {
        const record = history.grades[q.id];
        return (
          <li key={q.id} className="rounded border border-slate-200 p-4" data-question={q.id}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded bg-slate-100 px-2 py-0.5">{q.difficulty}</span>
              {q.criticalThinking && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">critical thinking</span>
              )}
              {q.roles.map((r) => (
                <span key={r} className="rounded bg-slate-50 px-2 py-0.5">{r}</span>
              ))}
            </div>
            <h3 className="font-medium">{q.question}</h3>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-slate-700">30-second answer</summary>
              <p className="mt-1 text-sm text-slate-700">{q.answers.beginner}</p>
            </details>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-slate-700">Two-minute professional answer</summary>
              <p className="mt-1 text-sm text-slate-700">{q.answers.professional}</p>
            </details>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-slate-700">Deep dive</summary>
              <p className="mt-1 text-sm text-slate-700">{q.answers.deep}</p>
            </details>
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`Self-grade this question`}>
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  disabled={!loaded}
                  onClick={() => void grade(q.id, g)}
                  aria-pressed={record?.grade === g}
                  className={
                    'rounded border px-2 py-1 text-sm ' +
                    (record?.grade === g
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-300 hover:bg-slate-50')
                  }
                >
                  {GRADE_LABELS[g]}
                </button>
              ))}
              <span className="text-xs text-slate-500" aria-live="polite" data-graded={q.id}>
                {record ? `graded ${record.grade} · ${record.count}×` : ''}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
