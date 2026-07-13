/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContextWindowBar from '../../src/components/viz/ContextWindowBar';
import Stepper from '../../src/components/viz/Stepper';
import TokenizationDemo from '../../src/components/viz/TokenizationDemo';
import { computeContextWindow } from '../../src/lib/viz';

function mockMatchMedia(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduce,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

beforeEach(() => mockMatchMedia(false));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TokenizationDemo (composition)', () => {
  it('initial static state shows step 1 content and raw text', () => {
    render(<TokenizationDemo />);
    expect(screen.getByRole('heading', { name: /1\. Raw text/ })).toBeTruthy();
    expect(screen.getByText("Tokenization isn't lossless.")).toBeTruthy();
    expect(screen.getByText(/^Step 1 of 5$/)).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Tokens, in order' })).toBeNull();
  });

  it('Next and Previous navigate; token list and states follow the scene', () => {
    render(<TokenizationDemo />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: /2\. Token boundaries/ })).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Tokens, in order' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(7);

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('heading', { name: /1\. Raw text/ })).toBeTruthy();
  });

  it('window step renders the context bar with honest numbers', () => {
    render(<TokenizationDemo />);
    const next = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next); // step 4: entering the window
    expect(screen.getByText(/4 of 16 tokens used \(25%\)/)).toBeTruthy();
    expect(screen.getByText('token 5 of 7, " loss", entering the context window')).toBeTruthy();
  });

  it('play advances with timers, pauses on manual scrub, and stops at the end', () => {
    vi.useFakeTimers();
    render(<TokenizationDemo />);
    const play = screen.getByRole('button', { name: 'Play' });
    fireEvent.click(play);
    act(() => vi.advanceTimersByTime(1800));
    expect(screen.getByText(/^Step 2 of 5$/)).toBeTruthy();

    // Manual scrub pauses playback.
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
    expect(screen.getByText(/^Step 3 of 5$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy(); // back to "Play"
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText(/^Step 3 of 5$/)).toBeTruthy(); // paused: no drift

    // Play to the end: stops, no wraparound.
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    for (let i = 0; i < 10; i++) act(() => vi.advanceTimersByTime(1800));
    expect(screen.getByText(/^Step 5 of 5$/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keyboard: arrows step, Home/End jump', () => {
    render(<TokenizationDemo />);
    const toolbar = screen.getByRole('group', { name: 'Tokenization steps' });
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    expect(screen.getByText(/^Step 2 of 5$/)).toBeTruthy();
    fireEvent.keyDown(toolbar, { key: 'End' });
    expect(screen.getByText(/^Step 5 of 5$/)).toBeTruthy();
    fireEvent.keyDown(toolbar, { key: 'ArrowLeft' });
    expect(screen.getByText(/^Step 4 of 5$/)).toBeTruthy();
    fireEvent.keyDown(toolbar, { key: 'Home' });
    expect(screen.getByText(/^Step 1 of 5$/)).toBeTruthy();
  });

  it('two instances operate independently (no shared state)', () => {
    render(
      <>
        <TokenizationDemo />
        <TokenizationDemo />
      </>,
    );
    const [firstNext] = screen.getAllByRole('button', { name: 'Next' });
    fireEvent.click(firstNext!);
    const steps = screen.getAllByText(/^Step \d of 5$/).map((el) => el.textContent);
    expect(steps).toEqual(['Step 2 of 5', 'Step 1 of 5']);
  });
});

describe('Stepper', () => {
  it('exposes accessible names and a polite live announcement', () => {
    render(
      <Stepper step={1} totalSteps={5} onStepChange={() => {}} label="Walkthrough" stepLabel="Boundaries" />,
    );
    expect(screen.getByRole('group', { name: 'Walkthrough' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Walkthrough: go to step' })).toBeTruthy();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('Step 2 of 5: Boundaries');
  });

  it('cleans up its auto-advance timer on unmount', () => {
    vi.useFakeTimers();
    const onStepChange = vi.fn();
    const { unmount } = render(
      <Stepper step={0} totalSteps={5} onStepChange={onStepChange} label="Walkthrough" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    unmount();
    vi.advanceTimersByTime(60_000);
    expect(onStepChange).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reflects prefers-reduced-motion as a data attribute for styling hooks', () => {
    mockMatchMedia(true);
    render(<Stepper step={0} totalSteps={5} onStepChange={() => {}} label="Walkthrough" />);
    const group = screen.getByRole('group', { name: 'Walkthrough' });
    expect(group.getAttribute('data-reduced-motion')).toBe('true');
    // Stepping still works under reduced motion.
    fireEvent.keyDown(group, { key: 'ArrowRight' });
  });
});

describe('ContextWindowBar', () => {
  it('renders an error panel for invalid data instead of a misleading bar', () => {
    render(<ContextWindowBar view={computeContextWindow({ usedTokens: 4, capacityTokens: 0 })} />);
    expect(screen.getByText(/cannot display — invalid data/)).toBeTruthy();
    expect(screen.getByText(/capacityTokens must be a positive integer/)).toBeTruthy();
  });

  it('overflow states the excess in words, not color alone', () => {
    render(<ContextWindowBar view={computeContextWindow({ usedTokens: 20, capacityTokens: 16 })} />);
    expect(screen.getByText(/over capacity/)).toBeTruthy();
    expect(screen.getByText(/4 tokens over/)).toBeTruthy();
    expect(screen.getByText(/20 of 16 tokens used \(125%\)/)).toBeTruthy();
  });

  it('surfaces segment mismatch problems visibly', () => {
    const view = computeContextWindow({
      usedTokens: 10,
      capacityTokens: 20,
      segments: [{ label: 'system', tokenCount: 3, kind: 'system' }],
    });
    render(<ContextWindowBar view={view} />);
    expect(screen.getByText(/segment totals \(3\) do not match usedTokens \(10\)/)).toBeTruthy();
  });
});
