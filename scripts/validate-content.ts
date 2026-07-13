/**
 * Content validation CLI (plan §7, §14): loads the content tree, re-validates entries
 * with the SAME Zod schemas Astro uses, builds the knowledge graph, runs corpus-wide
 * integrity checks, prints a grouped report, and writes deterministic `graph.json`
 * when no failures exist. Exits non-zero only on failures — warnings (orphans,
 * duplicate references) are reported but pass.
 *
 * Usage: tsx scripts/validate-content.ts [--content-dir <dir>] [--out <file>] [--quiet]
 *
 * Adapter note (documented trade-off): Astro's content layer cannot be invoked cleanly
 * from a standalone script (its loaders run inside the build's virtual-module context),
 * so this file contains the ONE narrow adapter that reads content from disk. It does
 * not re-implement validation — frontmatter/YAML parsing feeds `src/content.schemas.ts`
 * unchanged, and ids come from the same `flatEntryId` the Astro config uses. The graph
 * core (`src/lib/graph/`) stays filesystem-free.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { z } from 'astro/zod';
import { parse as parseYaml } from 'yaml';

import {
  conceptSchema,
  glossarySchema,
  governanceSchema,
  interviewSchema,
  sourceSchema,
} from '../src/content.schemas';
import { flatEntryId } from '../src/lib/content/model';
import { buildGraph, checkIntegrity, serializeGraph } from '../src/lib/graph';
import type { Finding, GraphEntry } from '../src/lib/graph';

// --- argument parsing ----------------------------------------------------------------
function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}
const contentDir = argValue('--content-dir') ?? 'src/content';
const outFile = argValue('--out') ?? 'src/generated/graph.json';
const quiet = process.argv.includes('--quiet');

// --- adapter: disk → validated, normalized entries ------------------------------------
interface SchemaProblem {
  file: string;
  detail: string;
}

function listFiles(dir: string, extension: string): string[] {
  try {
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith(extension))
      .map((f) => join(dir, f))
      .sort();
  } catch {
    return []; // collection directory may not exist yet
  }
}

function frontmatterOf(file: string): unknown {
  const raw = readFileSync(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) throw new Error('no frontmatter block found (expected a leading --- ... --- block)');
  return parseYaml(match[1]!);
}

function loadEntries(): { entries: GraphEntry[]; problems: SchemaProblem[] } {
  const entries: GraphEntry[] = [];
  const problems: SchemaProblem[] = [];
  const ids = new Map<string, string>(); // collection/id → file (defensive; Astro also rejects duplicates)

  function ingest<S extends z.ZodType>(
    collection: GraphEntry['collection'],
    file: string,
    read: () => unknown,
    schema: S,
    normalize: (id: string, data: z.output<S>) => GraphEntry,
  ): void {
    let raw: unknown;
    try {
      raw = read();
    } catch (cause) {
      problems.push({ file, detail: (cause as Error).message });
      return;
    }
    const result = schema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        problems.push({
          file,
          detail: `${issue.path.map(String).join('.') || '(entry)'}: ${issue.message}`,
        });
      }
      return;
    }
    const id = flatEntryId(relative(join(contentDir, collection), file));
    const key = `${collection}/${id}`;
    const existing = ids.get(key);
    if (existing) throw new Error(`duplicate entry id ${key}: ${existing} and ${file}`);
    ids.set(key, file);
    entries.push(normalize(id, result.data));
  }

  for (const file of listFiles(join(contentDir, 'concepts'), '.mdx'))
    ingest('concepts', file, () => frontmatterOf(file), conceptSchema, (id, d) => ({
      collection: 'concepts',
      id,
      title: d.title,
      layer: d.layer,
      status: d.status,
      prerequisites: d.prerequisites,
      related: d.related,
      governance: d.governance,
      sources: d.sources,
    }));

  for (const file of listFiles(join(contentDir, 'governance'), '.mdx'))
    ingest('governance', file, () => frontmatterOf(file), governanceSchema, (id, d) => ({
      collection: 'governance',
      id,
      title: d.title,
      appliesTo: d.appliesTo,
    }));

  for (const file of listFiles(join(contentDir, 'interview'), '.yaml'))
    ingest('interview', file, () => parseYaml(readFileSync(file, 'utf8')), interviewSchema, (id, d) => ({
      collection: 'interview',
      id,
      question: d.question,
      concepts: d.concepts,
    }));

  for (const file of listFiles(join(contentDir, 'sources'), '.yaml'))
    ingest('sources', file, () => parseYaml(readFileSync(file, 'utf8')), sourceSchema, (id, d) => ({
      collection: 'sources',
      id,
      title: d.title,
      routedTo: d.routedTo,
    }));

  for (const file of listFiles(join(contentDir, 'glossary'), '.yaml'))
    ingest('glossary', file, () => parseYaml(readFileSync(file, 'utf8')), glossarySchema, (id, d) => ({
      collection: 'glossary',
      id,
      term: d.term,
    }));

  return { entries, problems };
}

// --- report printing -------------------------------------------------------------------
function print(line = ''): void {
  if (!quiet) console.log(line);
}

function printFindings(header: string, findings: Finding[]): void {
  print(`${header} (${findings.length})`);
  let currentEntry = '';
  for (const f of findings) {
    const entry = `${f.collection}/${f.entryId}`;
    if (entry !== currentEntry) {
      print(`  ${entry}`);
      currentEntry = entry;
    }
    const where = f.field ? `${f.field}${f.targetId ? ` → "${f.targetId}"` : ''}: ` : '';
    print(`    [${f.code}] ${where}${f.message}`);
    print(`      fix: ${f.remediation}`);
  }
  print();
}

// --- main -------------------------------------------------------------------------------
const { entries, problems } = loadEntries();

if (problems.length > 0) {
  print('Agent Atlas content validation');
  print();
  print(`SCHEMA FAILURES (${problems.length}) — fix these before graph checks can run:`);
  for (const p of problems) print(`  ${p.file}\n    ${p.detail}`);
  process.exit(1);
}

const graph = buildGraph(entries);
const report = checkIntegrity(graph);
const counts = entries.reduce<Record<string, number>>((acc, e) => {
  acc[e.collection] = (acc[e.collection] ?? 0) + 1;
  return acc;
}, {});

print('Agent Atlas content validation');
print(
  `  entries: ${Object.entries(counts)
    .sort()
    .map(([c, n]) => `${n} ${c}`)
    .join(', ')}`,
);
print(`  graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
print();

if (report.failures.length > 0) printFindings('FAILURES', report.failures);
if (report.warnings.length > 0) printFindings('WARNINGS', report.warnings);

if (report.failures.length > 0) {
  print(`✖ validation failed: ${report.failures.length} failure(s), ${report.warnings.length} warning(s). graph.json not written.`);
  process.exit(1);
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, serializeGraph(graph));
print(`✓ validation passed (${report.warnings.length} warning(s)). graph.json → ${outFile}`);
