/**
 * Experiment CLI: `npm run experiment -- experiments/definitions/<file>.ts`
 * Loads and validates the definition, runs the matrix, writes
 * experiments/results/<id>/result.json + report.md, prints a summary.
 * Results land as reviewable files — committing them is the intake decision
 * (docs/INTAKE.md; see experiments/README.md).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadEnv } from './config';
import { generateReport } from './report';
import { runExperiment } from './run';
import { experimentSchema } from './types';

const definitionPath = process.argv[2];
if (!definitionPath) {
  console.error('usage: npm run experiment -- experiments/definitions/<file>.ts');
  process.exit(1);
}

loadEnv();

const module_ = await import(pathToFileURL(resolve(definitionPath)).href);
const parsed = experimentSchema.safeParse(module_.default);
if (!parsed.success) {
  console.error(`invalid experiment definition (${definitionPath}):`);
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}
const definition = parsed.data;

console.log(`Running experiment ${definition.id} v${definition.version} — ${definition.matrix.length} row(s) × ${definition.variants.length} variant(s) × ${definition.repeats} repeat(s)`);
const result = await runExperiment(definition);

const outDir = join(process.cwd(), 'experiments/results', definition.id);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(join(outDir, 'report.md'), generateReport(result));

console.log(`\n${result.runs.length} run(s) completed, ${result.skipped.length} row(s) skipped.`);
for (const skip of result.skipped) console.log(`  skipped ${skip.label}: ${skip.reason}`);
const failures = result.runs.filter((r) => !r.success);
console.log(`success: ${result.runs.length - failures.length}/${result.runs.length}`);
for (const run of failures) {
  console.log(`  FAILED ${run.provider}/${run.variant}#${run.repeat}: ${run.successChecks.filter((c) => c.startsWith('FAIL')).join('; ')}`);
}
console.log(`\nresults → ${outDir}/result.json`);
console.log(`report  → ${outDir}/report.md`);
console.log('Review the diff, then commit results + a sources entry per docs/INTAKE.md.');
