/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildToolCallingCases } from '../../src/lib/agent';
import type { ToolCallingCase } from '../../src/lib/agent';
import ToolCallingPlaygroundIsland from '../../src/components/viz/ToolCallingPlaygroundIsland';

let cases: ToolCallingCase[];
beforeAll(async () => {
  cases = await buildToolCallingCases();
});
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(cleanup);

const renderPlayground = () => render(<ToolCallingPlaygroundIsland cases={cases} />);

describe('ToolCallingPlaygroundIsland', () => {
  it('first frame shows the success case, its outcome, and the full trace', () => {
    renderPlayground();
    expect(screen.getByRole('radio', { name: 'Successful tool call' })).toBeTruthy();
    expect(screen.getAllByText('completed').length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: 'Execution trace' })).toBeTruthy();
  });

  it('each outcome class renders its own trace and outcome', () => {
    renderPlayground();
    fireEvent.click(screen.getByRole('radio', { name: 'Schema failure' }));
    expect(screen.getAllByText('invalid-tool-request').length).toBeGreaterThan(0);
    expect(screen.getByText(/Runtime REJECTED tool request/)).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Semantic failure' }));
    expect(screen.getAllByText('tool-error').length).toBeGreaterThan(0);
    expect(screen.getByText(/Runtime validated arguments/)).toBeTruthy(); // schema passed first

    fireEvent.click(screen.getByRole('radio', { name: 'Unknown tool' }));
    expect(screen.getByText(/Runtime REJECTED tool request/)).toBeTruthy();
  });

  it('switching case resets the step to 0', () => {
    renderPlayground();
    const toolbar = screen.getByRole('group', { name: /trace steps/ });
    fireEvent.keyDown(toolbar, { key: 'End' });
    fireEvent.click(screen.getByRole('radio', { name: 'Semantic failure' }));
    expect(screen.getByText(/^Step 1 of \d+$/)).toBeTruthy();
  });

  it('keyboard stepping walks the trace and updates the teaching description', () => {
    renderPlayground();
    fireEvent.click(screen.getByRole('radio', { name: 'Semantic failure' }));
    const toolbar = screen.getByRole('group', { name: 'Semantic failure trace steps' });
    for (let i = 0; i < 5; i++) fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: /Tool execution failed|Runtime executed/ })).toBeTruthy();
  });

  it('labels provenance (scripted vs measured) for each case', () => {
    renderPlayground();
    // Built cases are all scripted here (no experiment override in unit context);
    // provenance labels render.
    expect(screen.getAllByText(/scripted|measured/).length).toBeGreaterThan(0);
  });
});
