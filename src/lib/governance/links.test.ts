import { describe, expect, it } from 'vitest';
import {
  conceptsForFramework,
  frameworksForConcept,
  governanceLinks,
  linkKey,
} from './links';

const concepts = [
  { id: 'embeddings', governance: ['gdpr'] },
  { id: 'rag', governance: ['gdpr'] },
  { id: 'evaluation', governance: ['eu-ai-act'] },
  { id: 'failure-modes', governance: ['eu-ai-act'] },
  { id: 'tokens', governance: [] }, // only reached from the framework side
];

const frameworks = [
  { id: 'gdpr', appliesTo: ['context-windows'] }, // context-windows not in `concepts` here → dropped
  { id: 'eu-ai-act', appliesTo: ['tokens'] }, // reaches tokens even though tokens declares nothing
  { id: 'owasp-llm-top-10', appliesTo: ['failure-modes'] },
];

describe('governanceLinks', () => {
  it('unions both directions', () => {
    const links = governanceLinks(concepts, frameworks);
    // concept-declared
    expect(links.has(linkKey('embeddings', 'gdpr'))).toBe(true);
    expect(links.has(linkKey('evaluation', 'eu-ai-act'))).toBe(true);
    // framework-declared, concept declares nothing
    expect(links.has(linkKey('tokens', 'eu-ai-act'))).toBe(true);
    // failure-modes reached from BOTH sides → one edge, not duplicated
    expect(links.has(linkKey('failure-modes', 'eu-ai-act'))).toBe(true);
    expect(links.has(linkKey('failure-modes', 'owasp-llm-top-10'))).toBe(true);
  });

  it('drops dangling refs (id not present in the opposite collection)', () => {
    const links = governanceLinks(concepts, frameworks);
    // gdpr.appliesTo points at context-windows, which is absent from this concept set
    expect(links.has(linkKey('context-windows', 'gdpr'))).toBe(false);
  });
});

describe('conceptsForFramework', () => {
  it('lists every connected concept regardless of which side declared the edge', () => {
    expect(conceptsForFramework('eu-ai-act', concepts, frameworks)).toEqual([
      'evaluation',
      'failure-modes',
      'tokens',
    ]);
    expect(conceptsForFramework('gdpr', concepts, frameworks)).toEqual(['embeddings', 'rag']);
  });
});

describe('frameworksForConcept', () => {
  it('lists every framework a concept connects to (both directions)', () => {
    expect(frameworksForConcept('failure-modes', concepts, frameworks)).toEqual([
      'eu-ai-act',
      'owasp-llm-top-10',
    ]);
    expect(frameworksForConcept('tokens', concepts, frameworks)).toEqual(['eu-ai-act']);
  });
});
