/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { runExperiment } from '../../experiments/lib/run';
import type { ExperimentDefinition, ExperimentResult } from '../../experiments/lib/types';
import ExperimentTraceViewer from '../../src/components/viz/ExperimentTraceViewer';

const failureDef = require('../../experiments/definitions/004-failure-modes.ts').default as ExperimentDefinition;

let result: ExperimentResult;
beforeAll(async () => {
  result = await runExperiment(failureDef, { now: () => '2026-07-14T00:00:00.000Z' });
});
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(cleanup);

const renderViewer = () =>
  render(<ExperimentTraceViewer runs={result.runs} question="Trigger the scripted failure." />);

describe('ExperimentTraceViewer', () => {
  it('static first frame shows the first run, its metrics, and the full trace shape', () => {
    renderViewer();
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByText('Outcome')).toBeTruthy();
    // First failure run is unknown-tool → invalid-tool-request
    expect(screen.getAllByText('invalid-tool-request').length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: 'Execution trace' })).toBeTruthy();
  });

  it('selecting a different run shows its trace and resets the step', () => {
    renderViewer();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    // Step to the end of the first run, then switch runs.
    const toolbar = screen.getByRole('group', { name: /trace steps/ });
    fireEvent.keyDown(toolbar, { key: 'End' });
    // Switch to the tool-exception run (index 2).
    const options = Array.from(select.options).map((o) => o.textContent);
    const exceptionIndex = options.findIndex((t) => t?.includes('tool-error'));
    fireEvent.change(select, { target: { value: String(exceptionIndex) } });
    expect(screen.getByText(/^Step 1 of \d+$/)).toBeTruthy(); // reset
    expect(screen.getAllByText('tool-error').length).toBeGreaterThan(0);
  });

  it('keyboard stepping walks the recorded trace', () => {
    renderViewer();
    const toolbar = screen.getByRole('group', { name: /trace steps/ });
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    // Second event of unknown-tool run is the model-requested / responded / tool-selected chain.
    expect(screen.getByText(/^Step 2 of \d+$/)).toBeTruthy();
  });

  it('shows success-criteria checks and never fabricates missing metadata', () => {
    renderViewer();
    fireEvent.click(screen.getByText('Success criteria checks'));
    expect(screen.getAllByText(/PASS:|FAIL:/).length).toBeGreaterThan(0);
    // Scripted failure runs have no token metadata → dashes, not invented numbers.
    const totalTokens = screen.getByText('Total tokens').closest('div')!;
    expect(totalTokens.textContent).toContain('—');
  });

  it('surfaces adapter warnings when a run has them (none here → no warning box)', () => {
    renderViewer();
    expect(screen.queryByText(/⚠/)).toBeNull(); // failure runs carry no malformed-JSON warnings
  });
});
