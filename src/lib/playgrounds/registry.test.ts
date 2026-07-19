import { describe, expect, it } from 'vitest';

import { PLAYGROUNDS, playgroundConceptSlugs } from './registry';

describe('playground registry', () => {
  it('has unique ids', () => {
    const ids = PLAYGROUNDS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry names a host concept and a non-empty summary', () => {
    for (const p of PLAYGROUNDS) {
      expect(p.concept.length).toBeGreaterThan(0);
      expect(p.summary.trim().length).toBeGreaterThan(20);
      expect(p.title.trim().length).toBeGreaterThan(0);
    }
  });

  it('exposes the distinct set of host concept slugs', () => {
    const slugs = playgroundConceptSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('tokens');
    expect(slugs).toContain('rag');
  });
});
