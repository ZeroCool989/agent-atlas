import { describe, expect, it } from 'vitest';

import {
  conceptSchema,
  glossarySchema,
  governanceSchema,
  interviewSchema,
  sourceSchema,
} from '../../src/content.schemas';

/** Assert a parse fails and that the error names the offending field (readability). */
function expectFailureOn(schema: { safeParse: (v: unknown) => any }, value: unknown, field: string) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  const issues = result.error.issues as Array<{ path: (string | number)[]; message: string }>;
  const hit = issues.find((i) => i.path.includes(field));
  expect(hit, `expected an issue on "${field}", got: ${JSON.stringify(issues)}`).toBeDefined();
  return hit!;
}

const validConcept = {
  title: 'Tokens',
  layer: 'foundation',
  oneLiner: 'The unit a model actually reads and writes.',
  status: 'draft',
  sources: ['karpathy-lets-build-the-gpt-tokenizer'],
  updated: new Date('2026-07-13'),
};

const validInterview = {
  question: 'What is a token?',
  concepts: ['tokens'],
  roles: ['engineer'],
  difficulty: 'screen',
  answers: { beginner: 'a', professional: 'b', deep: 'c' },
  followUps: ['How does tokenization affect cost?'],
};

const validSource = {
  type: 'video',
  title: 'A talk',
  url: 'https://example.com/talk',
  ingestedAt: new Date('2026-07-13'),
  routedTo: ['tokens'],
  decisions: 'Routed to tokens.',
};

describe('valid fixtures parse', () => {
  it('concept', () => expect(conceptSchema.safeParse(validConcept).success).toBe(true));
  it('interview', () => expect(interviewSchema.safeParse(validInterview).success).toBe(true));
  it('governance', () =>
    expect(governanceSchema.safeParse({ title: 'EU AI Act', appliesTo: ['tokens'] }).success).toBe(true));
  it('source', () => expect(sourceSchema.safeParse(validSource).success).toBe(true));
  it('glossary', () =>
    expect(glossarySchema.safeParse({ term: 'token', definition: 'a unit of text' }).success).toBe(true));
  it('concept defaults arrays to empty', () => {
    const parsed = conceptSchema.parse(validConcept);
    expect(parsed.prerequisites).toEqual([]);
    expect(parsed.related).toEqual([]);
  });
});

describe('required invalid cases (P0.2 acceptance)', () => {
  it('concept missing the essentiality layer fails, naming the field and taxonomy', () => {
    const { layer: _omitted, ...noLayer } = validConcept;
    const issue = expectFailureOn(conceptSchema, noLayer, 'layer');
    expect(issue.message).toMatch(/foundation.*vendor-specific/s);
  });

  it('unsupported enum value fails (layer: "buzzword")', () => {
    const issue = expectFailureOn(conceptSchema, { ...validConcept, layer: 'buzzword' }, 'layer');
    expect(issue.message).toContain('core-mechanism');
  });

  it('unsupported enum value fails (source type)', () => {
    expectFailureOn(sourceSchema, { ...validSource, type: 'podcast' }, 'type');
  });

  it('malformed date fails readably (concept.updated)', () => {
    const issue = expectFailureOn(conceptSchema, { ...validConcept, updated: 'not-a-date' }, 'updated');
    expect(issue.message).toContain('valid date');
  });

  it('malformed date fails readably (source.ingestedAt)', () => {
    expectFailureOn(sourceSchema, { ...validSource, ingestedAt: '2026-99-99' }, 'ingestedAt');
  });

  it('malformed source reference fails (concept.sources not kebab-case)', () => {
    const issue = expectFailureOn(conceptSchema, { ...validConcept, sources: ['Not A Valid Id!'] }, 'sources');
    expect(issue.message).toContain('kebab-case');
  });

  it('malformed URL fails (source.url)', () => {
    expectFailureOn(sourceSchema, { ...validSource, url: 'youtube dot com' }, 'url');
  });

  it('incomplete interview answers fail (missing professional tier)', () => {
    expectFailureOn(
      interviewSchema,
      { ...validInterview, answers: { beginner: 'a', deep: 'c' } },
      'professional',
    );
  });
});

describe('entry-local intake and status rules', () => {
  it('undispositioned source fails (empty routedTo AND empty decisions)', () => {
    const issue = expectFailureOn(sourceSchema, { ...validSource, routedTo: [], decisions: '' }, 'decisions');
    expect(issue.message).toContain('unfinished intake');
  });

  it('source with a decisions note but no routing is a valid logged intake', () => {
    expect(
      sourceSchema.safeParse({ ...validSource, routedTo: [], decisions: 'Reviewed; nothing to route.' }).success,
    ).toBe(true);
  });

  it('status needs-update requires needsUpdateReason', () => {
    const issue = expectFailureOn(
      conceptSchema,
      { ...validConcept, status: 'needs-update' },
      'needsUpdateReason',
    );
    expect(issue.message).toContain('needs-update');
  });

  it('verdict accepts valid classifications and rejects unknown ones (schema v2)', () => {
    const verdict = {
      classification: 'essential',
      problem: 'p',
      simplerBaseline: 's',
      mainCost: 'c',
    };
    expect(conceptSchema.safeParse({ ...validConcept, verdict }).success).toBe(true);
    expectFailureOn(
      conceptSchema,
      { ...validConcept, verdict: { ...verdict, classification: 'must-have' } },
      'classification',
    );
  });

  it('governanceNotApplicable contradicting a governance list fails (schema v2)', () => {
    expectFailureOn(
      conceptSchema,
      { ...validConcept, governance: ['eu-ai-act'], governanceNotApplicable: 'none applies' },
      'governanceNotApplicable',
    );
  });

  it('interview criticalThinking defaults to false (schema v2)', () => {
    expect(interviewSchema.parse(validInterview).criticalThinking).toBe(false);
  });

  it('unknown frontmatter keys are rejected (typo protection)', () => {
    // Zod 4 reports unrecognized keys in the message, not the issue path.
    const result = conceptSchema.safeParse({ ...validConcept, layr: 'foundation' });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error!.issues)).toContain('layr');
  });
});
