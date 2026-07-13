/**
 * The five approved content collections (plan §6): concepts, interview, governance,
 * sources, glossary. Schemas live in `src/content.schemas.ts`; shared vocabulary in
 * `src/lib/content/model.ts`.
 *
 * Identifier convention: an entry's id IS its filename (kebab-case, no extension) and
 * is what every cross-reference points at. Concepts may be organized into layer
 * subfolders (plan §12) — `flatId` strips the folder so `foundation/tokens.mdx` is
 * still referenced as `tokens`. Duplicate basenames across folders therefore collide,
 * which Astro reports as a duplicate-id error — intended, since references are flat.
 */
import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';

import {
  conceptSchema,
  glossarySchema,
  governanceSchema,
  interviewSchema,
  sourceSchema,
} from './content.schemas';
import { flatEntryId } from './lib/content/model';

const flatId = ({ entry }: { entry: string }) => flatEntryId(entry);

const concepts = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/concepts', generateId: flatId }),
  schema: conceptSchema,
});

const interview = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/interview', generateId: flatId }),
  schema: interviewSchema,
});

const governance = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/governance', generateId: flatId }),
  schema: governanceSchema,
});

const sources = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/sources', generateId: flatId }),
  schema: sourceSchema,
});

const glossary = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/glossary', generateId: flatId }),
  schema: glossarySchema,
});

export const collections = { concepts, interview, governance, sources, glossary };
