import { describe, expect, it } from 'vitest';

import {
  checkTemplates,
  extractHeadings,
  hasVisualization,
} from '../../src/lib/content/template';
import type { TemplateConcept, TemplateQuestion } from '../../src/lib/content/template';
import { CANONICAL_SECTIONS } from '../../src/lib/content/model';

/** A body containing all nine canonical sections + a viz import. */
const completeBody = [
  "import ContextWindowBar from '../../components/viz/ContextWindowBar';",
  '',
  ...CANONICAL_SECTIONS.map((section) => `## ${section}\n\nAn answer.\n`),
].join('\n');

function concept(overrides: Partial<TemplateConcept> = {}): TemplateConcept {
  return {
    id: 'context-windows',
    status: 'complete',
    body: completeBody,
    governance: ['eu-ai-act'],
    hasVerdict: true,
    ...overrides,
  };
}

function question(id: string, overrides: Partial<TemplateQuestion> = {}): TemplateQuestion {
  return {
    id,
    concepts: ['context-windows'],
    followUps: [],
    criticalThinking: false,
    ...overrides,
  };
}

/** A question set that collectively satisfies the six-element package. */
const fullPackage: TemplateQuestion[] = [
  question('q-basics', { followUps: ['How is it billed?'] }),
  question('q-tradeoffs', { criticalThinking: true }),
  question('q-practice', {
    practicalExample: 'src/lib/viz/context-window.ts',
    governanceAngle: 'Context contents are data processing.',
  }),
];

const codes = (findings: { code: string }[]) => findings.map((f) => f.code);

describe('heading and visualization detection', () => {
  it('extracts normalized level-2+ headings, ignoring code fences and prose mentions', () => {
    const body = [
      'The question "How does it work?" is answered below.', // prose mention — not a heading
      '## How does it work?',
      '```md',
      '## When should I use it?', // inside a fence — must not count
      '```',
      '### What are the trade-offs?  ', // deeper level + trailing space is fine
    ].join('\n');
    const headings = extractHeadings(body);
    expect(headings).toEqual(['how does it work', 'what are the trade-offs']);
  });

  it('heading matching tolerates case and trailing punctuation only', () => {
    expect(extractHeadings('## WHAT ARE THE TRADE-OFFS')).toEqual(['what are the trade-offs']);
    expect(extractHeadings('## What are the tradeoffs?')).toEqual(['what are the tradeoffs']); // different words ≠ match
  });

  it('detects viz imports outside code fences only', () => {
    expect(hasVisualization(completeBody)).toBe(true);
    expect(hasVisualization('```js\nimport X from "../components/viz/X";\n```')).toBe(false);
    expect(hasVisualization('no imports here')).toBe(false);
  });
});

describe('template lint — status policy', () => {
  it('a complete concept with every requirement passes', () => {
    expect(checkTemplates([concept()], fullPackage)).toEqual([]);
  });

  it('stubs and drafts are never template-linted', () => {
    expect(
      checkTemplates(
        [
          concept({ id: 'a-stub', status: 'stub', body: '', hasVerdict: false, governance: [] }),
          concept({ id: 'a-draft', status: 'draft', body: '## How does it work?', hasVerdict: false, governance: [] }),
        ],
        [],
      ),
    ).toEqual([]);
  });

  it('needs-update keeps the structural rules (freshness is what the status flags)', () => {
    const flagged = concept({ status: 'needs-update', body: '' });
    const findings = checkTemplates([flagged], fullPackage);
    expect(findings.length).toBeGreaterThan(0);
    expect(codes(findings)).toContain('TEMPLATE_MISSING_REQUIRED_SECTION');
    // But a structurally complete needs-update concept passes:
    expect(checkTemplates([concept({ status: 'needs-update' })], fullPackage)).toEqual([]);
  });
});

describe('template lint — canonical sections', () => {
  it.each(CANONICAL_SECTIONS)('missing "%s" fails independently with the section named', (section) => {
    const body = completeBody.replace(`## ${section}`, '## Something else');
    const findings = checkTemplates([concept({ body })], fullPackage);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: 'TEMPLATE_MISSING_REQUIRED_SECTION',
      entryId: 'context-windows',
      targetId: section,
    });
    expect(findings[0]!.remediation).toContain(section);
  });
});

describe('template lint — verdict, visualization, governance', () => {
  it('missing verdict fails', () => {
    const findings = checkTemplates([concept({ hasVerdict: false })], fullPackage);
    expect(codes(findings)).toEqual(['TEMPLATE_COMPLETE_MISSING_VERDICT']);
  });

  it('missing visualization fails', () => {
    const body = completeBody.replace(/^import[^\n]*\n/, '');
    const findings = checkTemplates([concept({ body })], fullPackage);
    expect(codes(findings)).toEqual(['TEMPLATE_COMPLETE_MISSING_VISUALIZATION']);
  });

  it('no governance hooks and no justification fails', () => {
    const findings = checkTemplates([concept({ governance: [] })], fullPackage);
    expect(codes(findings)).toEqual(['TEMPLATE_COMPLETE_MISSING_GOVERNANCE_HOOK']);
  });

  it('explicit governanceNotApplicable satisfies the governance rule', () => {
    const findings = checkTemplates(
      [concept({ governance: [], governanceNotApplicable: 'No regulation addresses this mechanism directly.' })],
      fullPackage,
    );
    expect(findings).toEqual([]);
  });
});

describe('template lint — six-element interview package (collective)', () => {
  it('no linked interview entries fails with the count element', () => {
    const findings = checkTemplates([concept()], []);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: 'TEMPLATE_COMPLETE_MISSING_INTERVIEW_PACKAGE',
      entryId: 'context-windows',
    });
    expect(findings[0]!.message).toContain('at least 3 linked questions (found 0)');
    expect(findings[0]!.message).toContain('no linked interview questions found');
  });

  it('package distributed across multiple linked entries passes (collective enforcement)', () => {
    expect(checkTemplates([concept()], fullPackage)).toEqual([]);
  });

  it('questions linked to ANOTHER concept do not count', () => {
    const foreign = fullPackage.map((q) => ({ ...q, concepts: ['embeddings'] }));
    const findings = checkTemplates([concept()], foreign);
    expect(findings[0]!.message).toContain('found 0');
  });

  it('missing follow-ups fails and lists the inspected entries', () => {
    const noFollowUps = fullPackage.map((q) => ({ ...q, followUps: [] }));
    const findings = checkTemplates([concept()], noFollowUps);
    expect(codes(findings)).toEqual(['TEMPLATE_COMPLETE_MISSING_INTERVIEW_PACKAGE']);
    expect(findings[0]!.message).toContain('technical follow-up questions');
    expect(findings[0]!.message).toContain('q-basics, q-practice, q-tradeoffs');
  });

  it('missing critical-thinking question fails', () => {
    const none = fullPackage.map((q) => ({ ...q, criticalThinking: false }));
    const findings = checkTemplates([concept()], none);
    expect(findings[0]!.message).toContain('critical-thinking');
  });

  it('missing governance perspective fails', () => {
    const none = fullPackage.map(({ governanceAngle: _drop, ...q }) => q as TemplateQuestion);
    const findings = checkTemplates([concept()], none);
    expect(findings[0]!.message).toContain('governance perspective');
  });

  it('missing practical example fails with its own code', () => {
    const none = fullPackage.map(({ practicalExample: _drop, ...q }) => q as TemplateQuestion);
    const findings = checkTemplates([concept()], none);
    expect(codes(findings)).toEqual(['TEMPLATE_COMPLETE_MISSING_PRACTICAL_EXAMPLE']);
    expect(findings[0]!.remediation).toContain('practicalExample');
  });
});

describe('template lint — determinism', () => {
  it('finding order is stable regardless of input order', () => {
    const broken = [
      concept({ id: 'zzz', hasVerdict: false, governance: [] }),
      concept({ id: 'aaa', hasVerdict: false, governance: [] }),
    ];
    const first = checkTemplates(broken, fullPackage.flatMap((q) => [
      { ...q, concepts: ['zzz'] },
      { ...q, concepts: ['aaa'] },
    ]));
    const second = checkTemplates([...broken].reverse(), fullPackage.flatMap((q) => [
      { ...q, concepts: ['aaa'] },
      { ...q, concepts: ['zzz'] },
    ]));
    expect(first).toEqual(second);
    expect(first.map((f) => f.entryId)).toEqual(['aaa', 'aaa', 'zzz', 'zzz']);
  });
});
