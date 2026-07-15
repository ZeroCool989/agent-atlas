/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildStructuredCases } from '../../src/lib/structured';
import type { StructuredCase } from '../../src/lib/structured';
import StructuredExtractionIsland from '../../src/components/viz/StructuredExtractionIsland';

let cases: StructuredCase[];
beforeAll(async () => {
  cases = await buildStructuredCases();
});
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(cleanup);

const renderViz = () => render(<StructuredExtractionIsland cases={cases} />);

describe('StructuredExtractionIsland', () => {
  it('first frame shows the clean case, its outcome, and the pipeline stages', () => {
    renderViz();
    expect(screen.getByRole('radio', { name: 'Clean JSON' })).toBeTruthy();
    expect(screen.getByText('validated value returned')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Pipeline stages' })).toBeTruthy();
  });

  it('the fenced case shows an "Isolate JSON" stage', () => {
    renderViz();
    fireEvent.click(screen.getByRole('radio', { name: 'Markdown-fenced JSON' }));
    expect(screen.getByText('Isolate JSON')).toBeTruthy();
  });

  it('the schema-mismatch case reports two attempts and shows the retry', () => {
    renderViz();
    fireEvent.click(screen.getByRole('radio', { name: 'Schema mismatch → retry' }));
    expect(screen.getByText(/scripted · 2 attempt/)).toBeTruthy();
    expect(screen.getAllByText('Validate schema').length).toBeGreaterThan(1); // fail then ok
  });

  it('the unrecoverable case ends in a typed failure', () => {
    renderViz();
    fireEvent.click(screen.getByRole('radio', { name: 'Never valid → typed failure' }));
    expect(screen.getByText('typed failure')).toBeTruthy();
    expect(screen.getByText('Give up')).toBeTruthy();
  });

  it('switching case resets the step; keyboard stepping walks the pipeline', () => {
    renderViz();
    const toolbar = screen.getByRole('group', { name: /pipeline steps/ });
    fireEvent.keyDown(toolbar, { key: 'End' });
    fireEvent.click(screen.getByRole('radio', { name: 'Markdown-fenced JSON' }));
    expect(screen.getByText(/^Step 1 of \d+$/)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('group', { name: /pipeline steps/ }), { key: 'ArrowRight' });
    expect(screen.getByText(/^Step 2 of \d+$/)).toBeTruthy();
  });
});
