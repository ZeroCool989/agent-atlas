/**
 * Universal step control for scene-driven visuals (ADR-0004). Controlled component:
 * the host owns `step`; the Stepper owns only its transient playing state — no global
 * or module state, so multiple instances are independent.
 *
 * Behavior: never autoplays by default; stops at the final step; any manual
 * navigation (buttons, keys, scrub) pauses playback; the auto-advance timer is a
 * per-render effect with cleanup, deterministic under fake timers. Keyboard on the
 * toolbar: ←/→ previous/next, Home/End first/last; Space/Enter activate the focused
 * button natively. `autoAdvanceMs` is presentation metadata, not educational truth.
 */
import { useEffect, useState } from 'react';

export interface StepperProps {
  step: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  /** Accessible name of this control group, e.g. "Tokenization steps". */
  label: string;
  /** Short label of the current step, used in the polite announcement. */
  stepLabel?: string;
  autoAdvanceMs?: number;
}

export default function Stepper({
  step,
  totalSteps,
  onStepChange,
  label,
  stepLabel,
  autoAdvanceMs = 1800,
}: StepperProps) {
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const atStart = step <= 0;
  const atEnd = step >= totalSteps - 1;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => onStepChange(step + 1), autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [playing, step, atEnd, autoAdvanceMs, onStepChange]);

  const goTo = (next: number) => {
    setPlaying(false);
    onStepChange(Math.min(Math.max(next, 0), totalSteps - 1));
  };

  const onToolbarKeyDown = (event: React.KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return; // the range input owns its keys
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        goTo(step - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        goTo(step + 1);
        break;
      case 'Home':
        event.preventDefault();
        goTo(0);
        break;
      case 'End':
        event.preventDefault();
        goTo(totalSteps - 1);
        break;
    }
  };

  const button =
    'rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      role="group"
      aria-label={label}
      data-reduced-motion={reducedMotion || undefined}
      onKeyDown={onToolbarKeyDown}
      className="flex flex-wrap items-center gap-2"
    >
      <button type="button" className={button} onClick={() => goTo(0)} disabled={atStart}>
        Restart
      </button>
      <button type="button" className={button} onClick={() => goTo(step - 1)} disabled={atStart}>
        Previous
      </button>
      <button
        type="button"
        className={button}
        aria-pressed={playing}
        onClick={() => setPlaying((value) => !value)}
        disabled={atEnd}
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <button type="button" className={button} onClick={() => goTo(step + 1)} disabled={atEnd}>
        Next
      </button>
      <input
        type="range"
        min={1}
        max={totalSteps}
        value={step + 1}
        aria-label={`${label}: go to step`}
        onChange={(event) => goTo(Number(event.target.value) - 1)}
        className="max-w-40"
      />
      <span className="text-sm tabular-nums text-slate-600">
        Step {step + 1} of {totalSteps}
      </span>
      <span aria-live="polite" className="sr-only">
        {`Step ${step + 1} of ${totalSteps}${stepLabel ? `: ${stepLabel}` : ''}`}
      </span>
    </div>
  );
}
