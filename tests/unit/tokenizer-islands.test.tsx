/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BpeTrainingExplorer from '../../src/components/viz/BpeTrainingExplorer';
import TokenizerPlayground from '../../src/components/viz/TokenizerPlayground';

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(cleanup);

describe('BpeTrainingExplorer', () => {
  it('starts at "before any merges" with pure characters', () => {
    render(<BpeTrainingExplorer />);
    expect(screen.getByRole('heading', { name: 'Before any merges' })).toBeTruthy();
    expect(screen.getByText(/single-character/)).toBeTruthy();
  });

  it('stepping shows the real learned merge with its corpus frequency', () => {
    render(<BpeTrainingExplorer />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: /Merge 1 of/ })).toBeTruthy();
    // First merge on the teaching corpus is "␣"+"t" seen 18× — computed, not scripted.
    // (Appears in both the step description and the merge table.)
    expect(screen.getAllByText(/seen 18×/).length).toBeGreaterThan(0);
  });

  it('token count falls as merges accumulate (compression is visible)', () => {
    render(<BpeTrainingExplorer />);
    const countAt = () => Number(/(\d+) tokens/.exec(document.body.textContent!)![1]);
    const before = countAt();
    const toolbar = screen.getByRole('group', { name: 'BPE training steps' });
    fireEvent.keyDown(toolbar, { key: 'End' });
    expect(countAt()).toBeLessThan(before);
  });

  it('exposes the merge table and the corpus for inspection', () => {
    render(<BpeTrainingExplorer />);
    expect(screen.getByText(/Merge table so far/)).toBeTruthy();
    expect(screen.getByText(/The training corpus/)).toBeTruthy();
  });
});

describe('TokenizerPlayground', () => {
  it('tokenizes typed input live with ids and counts', () => {
    render(<TokenizerPlayground />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'the tokens' } });
    expect(screen.getByRole('list', { name: 'Playground tokens, in order' })).toBeTruthy();
    expect(document.body.textContent).toMatch(/2 words → \d+ tokens/);
  });

  it('flags characters outside the vocabulary honestly', () => {
    render(<TokenizerPlayground />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tokens 🚀' } });
    expect(screen.getAllByText('not in vocabulary').length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('outside the tiny');
  });

  it('experiment buttons steer toward instructive cases', () => {
    render(<TokenizerPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Try: Unseen word' }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('transformer');
  });
});
