/**
 * Zod schemas for the five approved content collections (plan §6). Kept separate from
 * `content.config.ts` (which wires loaders) so Vitest can import and exercise them
 * without Astro's virtual modules.
 *
 * Scope note: these schemas validate one entry at a time. Rules that span entries —
 * dangling references, prerequisite cycles, `complete`-with-`stub`-prerequisites, the
 * six-element interview package on complete concepts, orphan warnings — belong to the
 * P0.3 graph validator (fail/warn scope in plan §7) and the P0.6 template lint, not
 * here. Entry-local rules (identifier format, enums, dates, undispositioned intake)
 * live here so they fail in the offending file with a readable message.
 *
 * Evolution: versioned via CONTENT_SCHEMA_VERSION in `src/lib/content/model.ts` —
 * bump it and log the change in DECISIONS.md.
 */
import { z } from 'astro/zod';

import {
  CONCEPT_STATUSES,
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_ROLES,
  LAYERS,
  SLUG_MESSAGE,
  SLUG_PATTERN,
  SOURCE_TYPES,
} from './lib/content/model';

/** A kebab-case reference to another entry (existence checked in P0.3). */
const slugRef = z.string().regex(SLUG_PATTERN, { message: SLUG_MESSAGE });

const nonEmpty = z.string().trim().min(1, { message: 'must not be empty' });

/**
 * `concepts` — the core entity. One MDX file per concept; the entry id (from the
 * filename) is the concept's slug used by all cross-references.
 */
export const conceptSchema = z
  .object({
    title: nonEmpty,
    layer: z.enum(LAYERS, {
      error: `layer is required and must be one of: ${LAYERS.join(', ')} (plan §2 essentiality taxonomy)`,
    }),
    oneLiner: nonEmpty.describe('the concept in one sentence'),
    prerequisites: z.array(slugRef).default([]),
    related: z.array(slugRef).default([]),
    governance: z.array(slugRef).default([]),
    interviewTags: z.array(nonEmpty).default([]),
    status: z.enum(CONCEPT_STATUSES),
    needsUpdateReason: nonEmpty.optional(),
    sources: z.array(slugRef).default([]),
    updated: z.coerce.date({ error: 'updated must be a valid date (YYYY-MM-DD)' }),
  })
  .strict()
  .superRefine((concept, ctx) => {
    if (concept.status === 'needs-update' && !concept.needsUpdateReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['needsUpdateReason'],
        message:
          'status "needs-update" requires needsUpdateReason — the visible debt marker set by intake (plan §11)',
      });
    }
  });

/** `interview` — one YAML file per question; entry id (filename) is the question id. */
export const interviewSchema = z
  .object({
    question: nonEmpty,
    concepts: z.array(slugRef).min(1, { message: 'every question must link ≥1 concept' }),
    roles: z.array(z.enum(INTERVIEW_ROLES)).min(1),
    difficulty: z.enum(INTERVIEW_DIFFICULTIES),
    answers: z
      .object({
        beginner: nonEmpty.describe('the 30-second answer'),
        professional: nonEmpty.describe('the two-minute professional answer'),
        deep: nonEmpty,
      })
      .strict(),
    followUps: z.array(nonEmpty),
    practicalExample: nonEmpty.optional(),
    governanceAngle: nonEmpty.optional(),
  })
  .strict();

/** `governance` — framework pages (MDX) mapping regulation onto technical concepts. */
export const governanceSchema = z
  .object({
    title: nonEmpty,
    appliesTo: z.array(slugRef).default([]),
  })
  .strict();

/** `sources` — the intake ledger (YAML). Entry id (filename) is the source id. */
export const sourceSchema = z
  .object({
    type: z.enum(SOURCE_TYPES),
    title: nonEmpty,
    url: z.url({ error: 'url must be a valid absolute URL' }).optional(),
    ingestedAt: z.coerce.date({ error: 'ingestedAt must be a valid date (YYYY-MM-DD)' }),
    routedTo: z.array(slugRef).default([]),
    decisions: z.string().default(''),
  })
  .strict()
  .superRefine((source, ctx) => {
    if (source.routedTo.length === 0 && source.decisions.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['decisions'],
        message:
          'unfinished intake: a source must record where it was routed (routedTo) and/or an explicit decisions note (plan §11 — no loose ends)',
      });
    }
  });

/** `glossary` — short auto-linkable definitions (YAML). */
export const glossarySchema = z
  .object({
    term: nonEmpty,
    definition: nonEmpty,
  })
  .strict();
