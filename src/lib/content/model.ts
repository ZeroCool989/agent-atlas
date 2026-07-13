/**
 * The content model's shared vocabulary: enums, identifier rules, and the schema
 * version. Pure TypeScript with no Astro imports so the P0.3 graph validator and any
 * script can consume it directly. The Zod schemas in `src/content.schemas.ts` are built
 * from these constants — this file is the single source of truth for the values.
 *
 * Schema evolution rule: any change to this file or to `src/content.schemas.ts` bumps
 * CONTENT_SCHEMA_VERSION and gets an entry in DECISIONS.md (or an ADR if it changes the
 * approved content model in docs/IMPLEMENTATION_PLAN.md §6).
 */

export const CONTENT_SCHEMA_VERSION = 1;

/** Essentiality layers, ordered center → rim (plan §2). */
export const LAYERS = [
  'foundation',
  'core-mechanism',
  'useful-addition',
  'advanced-system',
  'framework-abstraction',
  'vendor-specific',
] as const;
export type Layer = (typeof LAYERS)[number];

export const CONCEPT_STATUSES = ['stub', 'draft', 'complete', 'needs-update'] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];

export const INTERVIEW_ROLES = [
  'engineer',
  'architect',
  'consultant',
  'governance',
  'product',
] as const;
export type InterviewRole = (typeof INTERVIEW_ROLES)[number];

export const INTERVIEW_DIFFICULTIES = ['screen', 'standard', 'deep'] as const;
export type InterviewDifficulty = (typeof INTERVIEW_DIFFICULTIES)[number];

export const SOURCE_TYPES = ['video', 'paper', 'repo', 'article', 'note', 'talk'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Every cross-entry reference (concept slugs, governance slugs, source ids) is a
 * kebab-case identifier derived from the entry's filename. Referential *existence* is
 * validated by the P0.3 graph validator; this pattern validates *format* at the schema
 * level so malformed references fail in the offending file.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MESSAGE =
  'must be a kebab-case identifier (lowercase letters/digits separated by hyphens), matching the referenced entry’s filename';
