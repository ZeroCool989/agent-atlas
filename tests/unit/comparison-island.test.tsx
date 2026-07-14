/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildComparison, COMPARISON_QUESTION } from '../../src/lib/agent';
import type { ArchitectureRun } from '../../src/lib/agent';
import ArchitectureComparisonIsland from '../../src/components/viz/ArchitectureComparisonIsland';

let runs: ArchitectureRun[];
beforeAll(async () => {
  runs = await buildComparison();
});
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(cleanup);

const renderIsland = () =>
  render(<ArchitectureComparisonIsland runs={runs} question={COMPARISON_QUESTION} />);

describe('ArchitectureComparisonIsland', () => {
  it('static first frame: direct call selected, run-started active, full trace shape visible', () => {
    renderIsland();
    expect(screen.getByRole('radio', { name: 'Direct model call' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Run started' })).toBeTruthy();
    const traceRows = screen.getAllByRole('listitem');
    expect(traceRows.length).toBe(runs[0]!.trace.length); // future steps visible, dimmed
  });

  it('each architecture renders its own correct trace steps', () => {
    renderIsland();
    fireEvent.click(screen.getByRole('radio', { name: 'Deterministic workflow' }));
    expect(screen.getAllByText(/Fixed step/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Model call \d+ requested/)).toBeNull(); // no model anywhere

    fireEvent.click(screen.getByRole('radio', { name: 'Model-assisted workflow' }));
    expect(screen.getByText('Branch selected by model')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Tool-using agent' }));
    expect(screen.getByText('Model selected tool: calculator')).toBeTruthy();
    expect(screen.getByText('Observation appended to state')).toBeTruthy();
  });

  it('switching architecture resets the step to 0 (documented intentional behavior)', () => {
    renderIsland();
    const toolbar = screen.getByRole('group', { name: /trace steps/ });
    fireEvent.keyDown(toolbar, { key: 'End' });
    expect(screen.getByText(/^Step 4 of 4$/)).toBeTruthy(); // direct trace has 4 events
    fireEvent.click(screen.getByRole('radio', { name: 'Tool-using agent' }));
    expect(screen.getByText(/^Step 1 of 10$/)).toBeTruthy(); // reset, new timeline length
  });

  it('keyboard stepping walks the trace and updates the teaching description', () => {
    renderIsland();
    fireEvent.click(screen.getByRole('radio', { name: 'Tool-using agent' }));
    const toolbar = screen.getByRole('group', { name: 'Tool-using agent trace steps' });
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Model selected tool: calculator' })).toBeTruthy();
    expect(screen.getByText(/Selection is the model's only power/)).toBeTruthy();
  });

  it('shows who decided each step — the lesson’s central comparison', () => {
    renderIsland();
    fireEvent.click(screen.getByRole('radio', { name: 'Deterministic workflow' }));
    expect(screen.queryAllByText('model decided')).toHaveLength(0); // developer + runtime only
    fireEvent.click(screen.getByRole('radio', { name: 'Tool-using agent' }));
    expect(screen.getAllByText('model decided').length).toBeGreaterThan(0);
  });

  it('declared metadata appears only where the provider reported it', () => {
    renderIsland();
    const toolbar = screen.getByRole('group', { name: /trace steps/ });
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' }); // model-requested: no usage
    expect(screen.queryByText(/declared metadata/)).toBeNull();
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' }); // model-responded: declared usage
    expect(screen.getByText(/declared metadata: 350 ms · 29 tokens/)).toBeTruthy();
  });

  it('labels the direct call’s wrong answer honestly', () => {
    renderIsland();
    expect(screen.getByText(/confidently wrong/)).toBeTruthy();
  });
});
