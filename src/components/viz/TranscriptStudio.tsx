/**
 * Transcript Studio island (ADR-0006). Three explicitly-labelled modes over one shared
 * study-material renderer:
 *
 *  - Demo: the real `runAgent` loop driven by a `ScriptedProvider` — keyless, no network.
 *    The learner watches the genuine think -> tool -> observe -> answer trace.
 *  - Study: the learner's pasted transcript through the deterministic engine. $0, private,
 *    honest about being extractive (no "AI summary" claim).
 *  - Lab: the learner's OWN API key, held only in this browser, sent browser -> vendor.
 *
 * The island only orchestrates and renders. Every fact it shows comes from the frozen
 * `src/lib/` foundation: the matcher, the quiz builder, the agent runtime, the providers.
 * No agent mechanics live here.
 */
import { useEffect, useMemo, useState } from 'react';

import {
  buildDemoScenario,
  buildStudyMaterial,
  DEMO_TRANSCRIPT,
} from '../../lib/transcript';
import type {
  ConceptRef,
  Flashcard,
  InterviewRef,
  QuizItem,
  StudyMaterial,
} from '../../lib/transcript';
import { runAgent } from '../../lib/agent';
import type { AgentRunResult } from '../../lib/agent';
import { createTranscriptTools, TRANSCRIPT_AGENT_SYSTEM } from '../../lib/agent/transcript-tools';
import { ScriptedProvider } from '../../lib/model';
import {
  ByokConfigError,
  createByokProvider,
  DEFAULT_MODELS,
  MODEL_SUGGESTIONS,
  redactKey,
} from '../../lib/model/browser';
import type { ByokVendor } from '../../lib/model/browser';
import { createTraceScene } from '../../lib/viz';
import Stepper from './Stepper';
import TraceStepList from './TraceStepList';

// --- props -------------------------------------------------------------------------------

export interface TranscriptStudioProps {
  corpus: ConceptRef[];
  interview: InterviewRef[];
}

type Mode = 'demo' | 'study' | 'lab';

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: 'demo', label: 'Demo', blurb: 'Watch the agent work. No key, no network.' },
  { id: 'study', label: 'Study', blurb: 'Paste a transcript. Get a study scaffold. No AI.' },
  { id: 'lab', label: 'Lab', blurb: 'Bring your own key for a real AI summary.' },
];

// --- small helpers -----------------------------------------------------------------------

/** Normalize a cloze answer for comparison: trim, lowercase, drop punctuation. */
function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const SAMPLE_TRANSCRIPT =
  'This talk is about retrieval augmented generation. We turn documents into embeddings, ' +
  'store the vectors, and retrieve the nearest neighbours for a query so the model answers ' +
  'from grounded context instead of memory. Then we let the model call tools, which turns it ' +
  'from a chatbot into an agent that takes actions — and that is where evaluation and reliability start to matter.';

// --- quiz (shared by all modes) ----------------------------------------------------------

type ItemStatus = 'unanswered' | 'correct' | 'incorrect';

function QuizView({ items }: { items: readonly QuizItem[] }) {
  const [status, setStatus] = useState<Record<number, ItemStatus>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});

  const score = Object.values(status).filter((s) => s === 'correct').length;

  const checkCloze = (i: number, item: QuizItem) => {
    const ok = normalizeAnswer(inputs[i] ?? '') === normalizeAnswer(item.answer);
    setStatus((prev) => ({ ...prev, [i]: ok ? 'correct' : 'incorrect' }));
  };

  const grade = (i: number, correct: boolean) => {
    setRevealed((prev) => ({ ...prev, [i]: true }));
    setStatus((prev) => ({ ...prev, [i]: correct ? 'correct' : 'incorrect' }));
  };

  if (items.length === 0) return null;

  return (
    <section aria-label="Quiz" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">Quiz</h3>
        <p className="text-sm tabular-nums text-slate-600" role="status" aria-live="polite">
          Score: <span data-testid="quiz-score">{score}</span> / {items.length}
        </p>
      </div>
      <ol className="space-y-3">
        {items.map((item, i) => {
          const s = status[i] ?? 'unanswered';
          return (
            <li
              key={`${item.conceptId}-${i}`}
              className="rounded-md border border-slate-200 bg-white p-4"
              data-quiz-item
              data-status={s}
            >
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                {item.kind === 'interview' ? 'Interview question' : 'Fill in the blank'} ·{' '}
                <a className="underline" href={`/concepts/${item.conceptId}`}>
                  {item.conceptTitle}
                </a>
              </p>
              <p className="mt-1 font-medium text-slate-800">{item.prompt}</p>

              {item.kind === 'cloze' ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`cloze-${i}`}>
                    Your answer for {item.conceptTitle}
                  </label>
                  <input
                    id={`cloze-${i}`}
                    type="text"
                    autoComplete="off"
                    value={inputs[i] ?? ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [i]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        checkCloze(i, item);
                      }
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="type the missing term"
                  />
                  <button
                    type="button"
                    onClick={() => checkCloze(i, item)}
                    className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                  >
                    Check
                  </button>
                  {s !== 'unanswered' && (
                    <span
                      className="text-sm font-medium"
                      style={{ color: s === 'correct' ? 'var(--viz-complete, #047857)' : 'var(--viz-error, #b91c1c)' }}
                    >
                      {s === 'correct' ? '✓ correct' : `✗ answer: ${item.answer}`}
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {!revealed[i] ? (
                    <button
                      type="button"
                      onClick={() => setRevealed((prev) => ({ ...prev, [i]: true }))}
                      className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                    >
                      Reveal answer
                    </button>
                  ) : (
                    <>
                      <p className="rounded bg-slate-50 p-2 text-sm text-slate-700">{item.answer}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">How did you do?</span>
                        <button
                          type="button"
                          onClick={() => grade(i, true)}
                          aria-pressed={s === 'correct'}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                          style={s === 'correct' ? { borderColor: 'var(--viz-complete)', color: 'var(--viz-complete)' } : undefined}
                        >
                          I got it
                        </button>
                        <button
                          type="button"
                          onClick={() => grade(i, false)}
                          aria-pressed={s === 'incorrect'}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                          style={s === 'incorrect' ? { borderColor: 'var(--viz-error)', color: 'var(--viz-error)' } : undefined}
                        >
                          I missed it
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// --- flashcards --------------------------------------------------------------------------

function FlashcardsView({ cards }: { cards: readonly Flashcard[] }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  if (cards.length === 0) return null;
  return (
    <section aria-label="Flashcards" className="space-y-3">
      <h3 className="text-lg font-semibold">Flashcards</h3>
      <p className="text-sm text-slate-500">Click a card to flip it.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((card, i) => {
          const isBack = flipped[i] ?? false;
          return (
            <li key={`${card.conceptId}-${i}`}>
              <button
                type="button"
                onClick={() => setFlipped((prev) => ({ ...prev, [i]: !prev[i] }))}
                aria-pressed={isBack}
                className="viz-transition min-h-24 w-full rounded-md border border-slate-200 bg-white p-4 text-left hover:border-slate-300 motion-reduce:transition-none"
              >
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  {isBack ? 'Answer' : 'Prompt'}
                </span>
                <span className="mt-1 block text-sm text-slate-800">{isBack ? card.back : card.front}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- study-material renderer (shared) ----------------------------------------------------

function StudyMaterialView({ material }: { material: StudyMaterial }) {
  if (material.matches.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="font-medium text-slate-700">No Atlas concepts matched this transcript.</p>
        <p className="mt-1 text-sm text-slate-500">
          Try a talk about AI systems — retrieval, embeddings, tool-calling, agents, evaluation.
          The engine maps text onto the Atlas's own concept corpus, so off-topic text finds nothing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-label="Key sentences">
        <h3 className="text-lg font-semibold">Key sentences from your transcript</h3>
        <p className="text-xs text-slate-500">
          The transcript's own highest-signal sentences, verbatim. This is extractive, not an AI summary.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {material.extractiveSummary.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </section>

      {material.keyTerms.length > 0 && (
        <section aria-label="Key terms">
          <h3 className="text-lg font-semibold">Key terms</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {material.keyTerms.map((t) => (
              <li
                key={t}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600"
              >
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Matched concepts">
        <h3 className="text-lg font-semibold">Concepts this covers</h3>
        <p className="text-xs text-slate-500">
          Matched against the Atlas by shared vocabulary. Each score and its matched terms are shown, so
          the match is inspectable rather than a black box.
        </p>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {material.matches.map((m) => (
            <li key={m.concept.id} className="rounded-md border border-slate-200 bg-white p-4">
              <a href={`/concepts/${m.concept.id}`} className="font-semibold underline" data-concept-link>
                {m.concept.title}
              </a>
              <p className="mt-1 text-sm text-slate-600">{m.concept.oneLiner}</p>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">
                {m.concept.layer} · score {m.score.toFixed(2)}
              </p>
              {m.matchedTerms.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  matched: {m.matchedTerms.slice(0, 6).join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {material.learningPath.length > 0 && (
        <section aria-label="Learning path">
          <h3 className="text-lg font-semibold">Suggested learning path</h3>
          <p className="text-xs text-slate-500">Ordered by essentiality layer, so you build foundations first.</p>
          <ol className="mt-2 space-y-1">
            {material.learningPath.map((step, i) => (
              <li key={step.concept.id} className="flex items-baseline gap-2 text-sm">
                <span className="tabular-nums text-slate-400">{i + 1}.</span>
                <a href={`/concepts/${step.concept.id}`} className="underline">
                  {step.concept.title}
                </a>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{step.concept.layer}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <QuizView items={material.quiz} />
      <FlashcardsView cards={material.flashcards} />
    </div>
  );
}

// --- agent trace (Demo + Lab) ------------------------------------------------------------

function TraceView({ result }: { result: AgentRunResult }) {
  const [step, setStep] = useState(Math.max(result.trace.length - 1, 0));
  const scene = createTraceScene(result.trace, step);
  return (
    <section aria-label="Agent execution trace" className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">Live agent trace</h3>
        <p className="text-sm text-slate-500">
          The real runtime's own events: the model selects a tool, the runtime validates and executes it,
          the observation is appended, and the loop continues. Step through it below.
        </p>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <TraceStepList scene={scene} ariaLabel="Agent execution trace steps" />
      </div>
      <p className="text-sm text-slate-600">{scene.description}</p>
      <Stepper
        step={scene.step}
        totalSteps={scene.totalSteps}
        onStepChange={setStep}
        label="Trace steps"
        stepLabel={scene.title}
      />
      <p className="text-xs text-slate-400 tabular-nums">
        outcome: {result.outcome} · {result.modelCalls} model call(s) · {result.trace.length} trace events
      </p>
    </section>
  );
}

function FinalAnswer({ text }: { text: string }) {
  return (
    <section aria-label="Agent answer">
      <h3 className="text-lg font-semibold">The agent's answer</h3>
      <pre className="mt-2 whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-4 font-sans text-sm text-slate-800">
        {text}
      </pre>
    </section>
  );
}

// --- Demo mode ---------------------------------------------------------------------------

function DemoMode({ corpus, interview }: TranscriptStudioProps) {
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const material = useMemo(
    () => buildStudyMaterial(DEMO_TRANSCRIPT, corpus, interview),
    [corpus, interview],
  );

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const provider = new ScriptedProvider(buildDemoScenario(corpus, interview));
      const tools = createTranscriptTools(corpus, interview);
      const res = await runAgent(provider, tools, {
        system: TRANSCRIPT_AGENT_SYSTEM,
        goal: DEMO_TRANSCRIPT,
        maxSteps: 6,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The demo run failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">
          A bundled lecture excerpt is run through the real agent loop with a scripted provider, so there is
          no key and no network call. The model's decisions are scripted; the tools and the runtime are real.
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-slate-500">Read the demo transcript</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-3 text-xs text-slate-600">{DEMO_TRANSCRIPT}</pre>
        </details>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {running ? 'Running…' : 'Run the demo agent'}
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--viz-error, #b91c1c)' }}>{error}</p>}

      {result && (
        <>
          <TraceView result={result} />
          {result.finalText && <FinalAnswer text={result.finalText} />}
        </>
      )}

      <div>
        <h3 className="text-lg font-semibold">The deterministic study material</h3>
        <p className="text-xs text-slate-500">
          Built by the same engine the agent's <code>match_concepts</code> tool uses, so what you see below is
          exactly what grounds the agent's answer.
        </p>
        <div className="mt-3">
          <StudyMaterialView material={material} />
        </div>
      </div>
    </div>
  );
}

// --- Study mode --------------------------------------------------------------------------

function StudyMode({ corpus, interview }: TranscriptStudioProps) {
  const [text, setText] = useState('');
  const [material, setMaterial] = useState<StudyMaterial | null>(null);

  const analyze = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setMaterial(null);
      return;
    }
    setMaterial(buildStudyMaterial(trimmed, corpus, interview));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="study-transcript" className="block text-sm font-medium text-slate-700">
          Paste a transcript
        </label>
        <textarea
          id="study-transcript"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Paste a lecture or talk transcript here. Everything is processed in your browser — nothing is sent anywhere."
          className="w-full rounded-md border border-slate-300 p-3 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={analyze}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Analyze
          </button>
          <button
            type="button"
            onClick={() => setText(SAMPLE_TRANSCRIPT)}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Use a sample
          </button>
          <span className="text-xs text-slate-400">No AI, no key, no network. $0 and private.</span>
        </div>
      </div>

      {material && <StudyMaterialView material={material} />}
    </div>
  );
}

// --- Lab mode ----------------------------------------------------------------------------

const STORAGE_KEY = 'atlas.studio.byok';

interface ByokState {
  vendor: ByokVendor;
  apiKey: string;
  model: string;
  baseUrl: string;
}

const EMPTY_BYOK: ByokState = { vendor: 'anthropic', apiKey: '', model: '', baseUrl: '' };

function LabMode({ corpus, interview }: TranscriptStudioProps) {
  const [cfg, setCfg] = useState<ByokState>(EMPTY_BYOK);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the persisted key only in the browser, after mount (SSR-safe).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setCfg({ ...EMPTY_BYOK, ...(JSON.parse(raw) as Partial<ByokState>) });
    } catch {
      /* corrupt or unavailable storage: start clean */
    }
    setLoaded(true);
  }, []);

  const persist = (next: ByokState) => {
    setCfg(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage may be full or blocked; the in-memory key still works this session */
    }
  };

  const clearKey = () => {
    setCfg((prev) => ({ ...prev, apiKey: '' }));
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const material = useMemo(() => {
    const trimmed = text.trim();
    return trimmed ? buildStudyMaterial(trimmed, corpus, interview) : null;
  }, [text, corpus, interview]);

  const analyze = async () => {
    const transcript = text.trim();
    setError(null);
    setResult(null);
    if (!transcript) {
      setError('Paste a transcript first.');
      return;
    }
    setRunning(true);
    try {
      const provider = createByokProvider({
        vendor: cfg.vendor,
        apiKey: cfg.apiKey,
        model: cfg.model || undefined,
        baseUrl: cfg.baseUrl || undefined,
      });
      const tools = createTranscriptTools(corpus, interview);
      const res = await runAgent(provider, tools, {
        system: TRANSCRIPT_AGENT_SYSTEM,
        goal: transcript,
        maxSteps: 6,
      });
      setResult(res);
    } catch (e) {
      // Never surface the raw key. ByokConfigError carries a clean, safe message.
      if (e instanceof ByokConfigError) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(`The provider call failed: ${e.message}`);
      } else {
        setError('The provider call failed.');
      }
    } finally {
      setRunning(false);
    }
  };

  const suggestions = MODEL_SUGGESTIONS[cfg.vendor];

  return (
    <div className="space-y-6">
      <div
        className="rounded-md border p-4"
        style={{ borderColor: 'var(--viz-warning, #b45309)', background: 'var(--viz-warning-surface, #fef3c7)' }}
      >
        <p className="text-sm font-semibold text-slate-800">Security note</p>
        <p className="mt-1 text-sm text-slate-700" data-testid="lab-security-note">
          Your key is stored only in this browser (localStorage) and sent directly to the provider. It never
          reaches our servers. There is no server. Usage bills your own account. Clear the key any time.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="byok-vendor" className="block text-sm font-medium text-slate-700">
            Provider
          </label>
          <select
            id="byok-vendor"
            value={cfg.vendor}
            onChange={(e) => persist({ ...cfg, vendor: e.target.value as ByokVendor, model: '' })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai-compatible">OpenAI-compatible</option>
          </select>
        </div>

        <div>
          <label htmlFor="byok-key" className="block text-sm font-medium text-slate-700">
            API key
          </label>
          <input
            id="byok-key"
            type="password"
            autoComplete="off"
            value={cfg.apiKey}
            onChange={(e) => persist({ ...cfg, apiKey: e.target.value })}
            placeholder={cfg.vendor === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
          />
          {loaded && cfg.apiKey && (
            <p className="mt-1 text-xs text-slate-500">
              Stored key: <span className="font-mono">{redactKey(cfg.apiKey)}</span>{' '}
              <button type="button" onClick={clearKey} className="underline">
                Clear key
              </button>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="byok-model" className="block text-sm font-medium text-slate-700">
            Model <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="byok-model"
            type="text"
            list="byok-model-suggestions"
            value={cfg.model}
            onChange={(e) => persist({ ...cfg, model: e.target.value })}
            placeholder={DEFAULT_MODELS[cfg.vendor]}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
          />
          <datalist id="byok-model-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        {cfg.vendor === 'openai-compatible' && (
          <div>
            <label htmlFor="byok-baseurl" className="block text-sm font-medium text-slate-700">
              Base URL <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="byok-baseurl"
              type="text"
              value={cfg.baseUrl}
              onChange={(e) => persist({ ...cfg, baseUrl: e.target.value })}
              placeholder="https://api.openai.com"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="lab-transcript" className="block text-sm font-medium text-slate-700">
          Transcript
        </label>
        <textarea
          id="lab-transcript"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Paste the transcript you want a real AI summary of."
          className="w-full rounded-md border border-slate-300 p-3 text-sm"
        />
        <button
          type="button"
          onClick={analyze}
          disabled={running}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {running ? 'Calling the model…' : 'Analyze with AI'}
        </button>
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--viz-error, #b91c1c)' }} role="alert">
          {error}
        </p>
      )}

      {result && (
        <>
          <TraceView result={result} />
          {result.finalText && <FinalAnswer text={result.finalText} />}
        </>
      )}

      {material && (
        <div>
          <h3 className="text-lg font-semibold">Grounded study material</h3>
          <p className="text-xs text-slate-500">
            The deterministic engine's read of the same transcript, shown alongside the AI answer so you can
            check the model against the Atlas's real corpus.
          </p>
          <div className="mt-3">
            <StudyMaterialView material={material} />
          </div>
        </div>
      )}
    </div>
  );
}

// --- shell -------------------------------------------------------------------------------

export default function TranscriptStudio({ corpus, interview }: TranscriptStudioProps) {
  const [mode, setMode] = useState<Mode>('demo');

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Studio mode" className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              id={`studio-tab-${m.id}`}
              aria-selected={active}
              aria-controls={`studio-panel-${m.id}`}
              onClick={() => setMode(m.id)}
              className="rounded-md border px-4 py-2 text-left text-sm"
              style={
                active
                  ? { borderColor: 'var(--viz-active)', background: 'var(--viz-active-surface)' }
                  : { borderColor: 'var(--viz-boundary)' }
              }
            >
              <span className="block font-semibold text-slate-800">{m.label}</span>
              <span className="block text-xs text-slate-500">{m.blurb}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`studio-panel-${mode}`}
        aria-labelledby={`studio-tab-${mode}`}
        data-mode={mode}
      >
        {mode === 'demo' && <DemoMode corpus={corpus} interview={interview} />}
        {mode === 'study' && <StudyMode corpus={corpus} interview={interview} />}
        {mode === 'lab' && <LabMode corpus={corpus} interview={interview} />}
      </div>
    </div>
  );
}
