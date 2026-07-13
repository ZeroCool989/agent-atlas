import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * CLI-boundary tests: exit codes, warning semantics, and artifact determinism of
 * `npm run validate` (scripts/validate-content.ts), run against throwaway content
 * trees. Slower than the core tests by design — this is the CI contract.
 */
const CLI = join(process.cwd(), 'scripts', 'validate-content.ts');
const TSX = join(process.cwd(), 'node_modules', '.bin', 'tsx');

const tempRoots: string[] = [];
afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

function contentTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'atlas-validate-'));
  tempRoots.push(root);
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, 'content', path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

function runCli(root: string): { status: number | null; stdout: string } {
  const { status, stdout, stderr } = spawnSync(
    TSX,
    [CLI, '--content-dir', join(root, 'content'), '--out', join(root, 'graph.json')],
    { encoding: 'utf8' },
  );
  return { status, stdout: stdout + stderr };
}

const conceptMdx = (id: string, extra = '') => `---
title: "${id}"
layer: foundation
oneLiner: "Fixture."
status: draft
updated: 2026-07-13
${extra}---
Body.
`;

describe('validate-content CLI', () => {
  it('valid tree with an orphan: exits 0 AND visibly reports the warning', () => {
    const root = contentTree({ 'concepts/lonely.mdx': conceptMdx('lonely') });
    const { status, stdout } = runCli(root);
    expect(status).toBe(0);
    expect(stdout).toContain('GRAPH_ORPHAN_CONCEPT');
    expect(stdout).toContain('validation passed (1 warning(s))');
  });

  it('dangling prerequisite: exits non-zero with a grouped, readable report', () => {
    const root = contentTree({
      'concepts/rag.mdx': conceptMdx('rag', 'prerequisites:\n  - embeddings\n'),
    });
    const { status, stdout } = runCli(root);
    expect(status).toBe(1);
    expect(stdout).toContain('FAILURES (1)');
    expect(stdout).toContain('concepts/rag');
    expect(stdout).toContain('GRAPH_DANGLING_REFERENCE');
    expect(stdout).toContain('fix:');
  });

  it('does not write graph.json when validation fails', () => {
    const root = contentTree({
      'concepts/rag.mdx': conceptMdx('rag', 'prerequisites:\n  - embeddings\n'),
    });
    runCli(root);
    expect(() => readFileSync(join(root, 'graph.json'))).toThrow();
  });

  it('schema-invalid entry: exits non-zero naming the file and field', () => {
    const root = contentTree({
      'concepts/bad.mdx': `---\ntitle: "Bad"\nlayer: buzzword\noneLiner: "x"\nstatus: draft\nupdated: 2026-07-13\n---\nBody.\n`,
    });
    const { status, stdout } = runCli(root);
    expect(status).toBe(1);
    expect(stdout).toContain('SCHEMA FAILURES');
    expect(stdout).toContain('bad.mdx');
    expect(stdout).toContain('layer');
  });

  it('running twice on unchanged content produces byte-identical graph.json', () => {
    const root = contentTree({
      'concepts/tokens.mdx': conceptMdx('tokens'),
      'interview/q-tokens.yaml': `question: "What is a token?"\nconcepts: [tokens]\nroles: [engineer]\ndifficulty: screen\nanswers:\n  beginner: "a"\n  professional: "b"\n  deep: "c"\nfollowUps: []\n`,
    });
    expect(runCli(root).status).toBe(0);
    const first = readFileSync(join(root, 'graph.json'), 'utf8');
    expect(runCli(root).status).toBe(0);
    const second = readFileSync(join(root, 'graph.json'), 'utf8');
    expect(second).toBe(first);
  });
});
