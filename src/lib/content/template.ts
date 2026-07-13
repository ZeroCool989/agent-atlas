/**
 * Template lint: enforces the approved Definition of Done for `complete` concepts
 * (plan §19) — the rule that "complete" never means merely "the MDX renders".
 * Pure TypeScript: consumes normalized entries + raw MDX bodies, returns findings as
 * data. Wired into `npm run validate` after graph checks (scripts/validate-content.ts).
 *
 * Scope (exactly the plan's DoD):
 *  - all nine canonical sections, detected as validated level-2+ MDX headings
 *    (normalized for case/whitespace/trailing punctuation; code fences ignored) —
 *    heading detection is line-anchored, so prose mentioning a question never counts;
 *  - structured essential-vs-optional verdict (frontmatter, schema v2);
 *  - ≥1 visualization: an import from `components/viz` in the body;
 *  - governance hooks declared OR an explicit justified governanceNotApplicable;
 *  - the six-element interview package, enforced COLLECTIVELY across the concept's
 *    linked questions (plan §9: "a question set satisfying them"):
 *      1. 30-second answer   → every question carries answers.beginner (schema-required),
 *      2. two-minute answer  → answers.professional (schema-required),
 *         so 1–2 reduce to "≥3 linked questions" (the DoD's own count),
 *      3. follow-ups         → ≥1 linked question with non-empty followUps,
 *      4. critical thinking  → ≥1 linked question with criticalThinking: true,
 *      5. practical example  → ≥1 linked question with practicalExample,
 *      6. governance angle   → ≥1 linked question with governanceAngle.
 *
 * Status policy (documented in AUTHORING.md): the lint applies to `complete` AND
 * `needs-update` — needs-update marks previously-complete content whose freshness is
 * in question; structural completeness still applies, factual review is what the
 * status flags. Stubs and drafts are never template-linted.
 *
 * Deliberately NOT enforced (plan §19 omits them): source references on complete
 * concepts (recorded in DECISIONS.md), prerequisite status (already a graph rule).
 */
import { CANONICAL_SECTIONS } from './model';

export const TEMPLATE_CODES = [
  'TEMPLATE_MISSING_REQUIRED_SECTION',
  'TEMPLATE_COMPLETE_MISSING_VERDICT',
  'TEMPLATE_COMPLETE_MISSING_VISUALIZATION',
  'TEMPLATE_COMPLETE_MISSING_GOVERNANCE_HOOK',
  'TEMPLATE_COMPLETE_MISSING_INTERVIEW_PACKAGE',
  'TEMPLATE_COMPLETE_MISSING_PRACTICAL_EXAMPLE',
] as const;
export type TemplateCode = (typeof TEMPLATE_CODES)[number];

/** Same reporting shape as graph findings — shared interface, separate code domain. */
export interface TemplateFinding {
  severity: 'error';
  code: TemplateCode;
  collection: 'concepts';
  entryId: string;
  field?: string;
  targetId?: string;
  message: string;
  remediation: string;
}

export interface TemplateConcept {
  id: string;
  status: string;
  body: string;
  governance: string[];
  hasVerdict: boolean;
  governanceNotApplicable?: string;
}

export interface TemplateQuestion {
  id: string;
  concepts: string[];
  followUps: string[];
  criticalThinking: boolean;
  practicalExample?: string;
  governanceAngle?: string;
}

const byCodepoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const normalizeHeading = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?.!:\s]+$/u, '')
    .trim();

const CANONICAL_NORMALIZED = CANONICAL_SECTIONS.map(normalizeHeading);

/** Strip fenced code blocks so headings/imports inside examples never count. */
function withoutCodeFences(body: string): string {
  return body.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');
}

/** All level-2+ markdown headings in the body, normalized. */
export function extractHeadings(body: string): string[] {
  const headings: string[] = [];
  for (const line of withoutCodeFences(body).split('\n')) {
    const match = /^#{2,6}\s+(.+)$/.exec(line);
    if (match) headings.push(normalizeHeading(match[1]!));
  }
  return headings;
}

/** A visualization is an import from the viz component library (docs/AUTHORING.md). */
export function hasVisualization(body: string): boolean {
  return /^import\s+[^\n]*from\s+['"][^'"\n]*components\/viz\/[^'"\n]*['"]/m.test(
    withoutCodeFences(body),
  );
}

export function checkTemplates(
  concepts: TemplateConcept[],
  questions: TemplateQuestion[],
): TemplateFinding[] {
  const findings: TemplateFinding[] = [];

  for (const concept of concepts) {
    if (concept.status !== 'complete' && concept.status !== 'needs-update') continue;

    const fail = (
      code: TemplateCode,
      message: string,
      remediation: string,
      field?: string,
      targetId?: string,
    ) =>
      findings.push({
        severity: 'error',
        code,
        collection: 'concepts',
        entryId: concept.id,
        ...(field ? { field } : {}),
        ...(targetId ? { targetId } : {}),
        message,
        remediation,
      });

    // 1. Nine canonical sections as headings.
    const headings = new Set(extractHeadings(concept.body));
    for (let i = 0; i < CANONICAL_SECTIONS.length; i++) {
      if (!headings.has(CANONICAL_NORMALIZED[i]!)) {
        fail(
          'TEMPLATE_MISSING_REQUIRED_SECTION',
          `concepts/${concept.id} is "${concept.status}" but lacks the canonical section "## ${CANONICAL_SECTIONS[i]}".`,
          `Add the heading "## ${CANONICAL_SECTIONS[i]}" (exact wording, any level-2+ heading) with its answer, or downgrade the concept to draft.`,
          'body',
          CANONICAL_SECTIONS[i],
        );
      }
    }

    // 2. Structured verdict.
    if (!concept.hasVerdict) {
      fail(
        'TEMPLATE_COMPLETE_MISSING_VERDICT',
        `concepts/${concept.id} lacks the essential-vs-optional verdict.`,
        'Add the `verdict:` frontmatter block (classification, problem, simplerBaseline, mainCost) — see docs/AUTHORING.md.',
        'verdict',
      );
    }

    // 3. At least one visualization.
    if (!hasVisualization(concept.body)) {
      fail(
        'TEMPLATE_COMPLETE_MISSING_VISUALIZATION',
        `concepts/${concept.id} has no visualization (no import from components/viz).`,
        'Import and use at least one viz component in the body (static server-rendered is fine) — plan §19 requires ≥1 visualization per complete concept.',
        'body',
      );
    }

    // 4. Governance hooks declared, or explicitly and justifiably absent.
    if (concept.governance.length === 0 && !concept.governanceNotApplicable) {
      fail(
        'TEMPLATE_COMPLETE_MISSING_GOVERNANCE_HOOK',
        `concepts/${concept.id} declares no governance hooks and no explicit governanceNotApplicable justification.`,
        'Link the relevant governance entries in `governance:`, or state why none materially apply in `governanceNotApplicable:` (plan §19: hooks declared even if "none").',
        'governance',
      );
    }

    // 5–6. The six-element interview package, collectively across linked questions.
    const linked = questions
      .filter((q) => q.concepts.includes(concept.id))
      .sort((a, b) => byCodepoint(a.id, b.id));
    const inspected =
      linked.length > 0 ? `linked questions inspected: ${linked.map((q) => q.id).join(', ')}` : 'no linked interview questions found';

    const packageFail = (element: string, remediation: string) =>
      fail(
        'TEMPLATE_COMPLETE_MISSING_INTERVIEW_PACKAGE',
        `concepts/${concept.id} interview package lacks: ${element} (${inspected}).`,
        remediation,
        'interview',
        element,
      );

    if (linked.length < 3) {
      packageFail(
        `at least 3 linked questions (found ${linked.length})`,
        `Add interview entries whose \`concepts:\` include "${concept.id}" until at least 3 exist — every question already carries the 30-second and two-minute answers (plan §19).`,
      );
    }
    if (linked.length > 0) {
      if (!linked.some((q) => q.followUps.length > 0)) {
        packageFail(
          'technical follow-up questions',
          'Give at least one linked question a non-empty followUps list.',
        );
      }
      if (!linked.some((q) => q.criticalThinking)) {
        packageFail(
          'a critical-thinking question',
          'Mark at least one linked trade-off/judgment question with criticalThinking: true (typically "when would you NOT use this?").',
        );
      }
      if (!linked.some((q) => q.governanceAngle)) {
        packageFail(
          'a governance perspective',
          'Give at least one linked question a governanceAngle.',
        );
      }
      if (!linked.some((q) => q.practicalExample)) {
        fail(
          'TEMPLATE_COMPLETE_MISSING_PRACTICAL_EXAMPLE',
          `concepts/${concept.id} interview package lacks a practical repository example (${inspected}).`,
          'Give at least one linked question a practicalExample pointing at working code in this repo.',
          'interview',
          'practical-example',
        );
      }
    }
  }

  findings.sort(
    (a, b) =>
      byCodepoint(a.entryId, b.entryId) ||
      byCodepoint(a.code, b.code) ||
      byCodepoint(a.targetId ?? '', b.targetId ?? ''),
  );
  return findings;
}
