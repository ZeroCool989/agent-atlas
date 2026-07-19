import { describe, it, expect } from 'vitest';
import { filterQuestions, parseRole, parseDifficulty } from './filter';

const bank = [
  { id: 'a', roles: ['engineer', 'architect'], difficulty: 'standard' },
  { id: 'b', roles: ['product'], difficulty: 'screen' },
  { id: 'c', roles: ['governance', 'consultant'], difficulty: 'deep' },
  { id: 'd', roles: ['engineer'], difficulty: 'screen' },
];

describe('parseRole / parseDifficulty', () => {
  it('accepts valid values and rejects junk', () => {
    expect(parseRole('engineer')).toBe('engineer');
    expect(parseRole('wizard')).toBeUndefined();
    expect(parseRole(null)).toBeUndefined();
    expect(parseDifficulty('deep')).toBe('deep');
    expect(parseDifficulty('hard')).toBeUndefined();
  });
});

describe('filterQuestions', () => {
  it('returns everything when no filter is set', () => {
    expect(filterQuestions(bank)).toHaveLength(4);
  });
  it('filters by role', () => {
    expect(filterQuestions(bank, { role: 'engineer' }).map((q) => q.id)).toEqual(['a', 'd']);
  });
  it('filters by difficulty', () => {
    expect(filterQuestions(bank, { difficulty: 'screen' }).map((q) => q.id)).toEqual(['b', 'd']);
  });
  it('combines role and difficulty', () => {
    expect(filterQuestions(bank, { role: 'engineer', difficulty: 'screen' }).map((q) => q.id)).toEqual(['d']);
  });
  it('ignores invalid facets rather than returning nothing', () => {
    expect(filterQuestions(bank, { role: 'wizard' })).toHaveLength(4);
  });
  it('preserves input order', () => {
    expect(filterQuestions(bank, { difficulty: 'screen' }).map((q) => q.id)).toEqual(['b', 'd']);
  });
});
