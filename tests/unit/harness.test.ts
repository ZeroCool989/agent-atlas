import { describe, expect, it } from 'vitest';

// Harness smoke test only: proves the Vitest pipeline runs in CI.
// Real unit tests arrive with `src/lib/` in P0.3 (graph) and P0.4 (model provider).
describe('test harness', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });
});
