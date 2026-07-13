import { describe, expect, it } from 'vitest';

import { buildGraph, checkIntegrity, serializeGraph } from '../../src/lib/graph';
import type {
  ConceptEntry,
  Finding,
  GraphEntry,
  IntegrityReport,
} from '../../src/lib/graph';

/** Compact fixture builders — every field explicit-able, sensible defaults. */
function concept(id: string, overrides: Partial<ConceptEntry> = {}): ConceptEntry {
  return {
    collection: 'concepts',
    id,
    title: id,
    layer: 'foundation',
    status: 'draft',
    prerequisites: [],
    related: [],
    governance: [],
    sources: [],
    ...overrides,
  };
}
const interview = (id: string, concepts: string[]): GraphEntry => ({
  collection: 'interview',
  id,
  question: `${id}?`,
  concepts,
});
const governance = (id: string, appliesTo: string[]): GraphEntry => ({
  collection: 'governance',
  id,
  title: id,
  appliesTo,
});
const source = (id: string, routedTo: string[]): GraphEntry => ({
  collection: 'sources',
  id,
  title: id,
  routedTo,
});
const glossary = (id: string): GraphEntry => ({ collection: 'glossary', id, term: id });

const run = (entries: GraphEntry[]): IntegrityReport => checkIntegrity(buildGraph(entries));
const codes = (findings: Finding[]) => findings.map((f) => f.code);

describe('buildGraph', () => {
  it('creates typed edges with full provenance for every reference field', () => {
    const { edges } = buildGraph([
      concept('rag', {
        prerequisites: ['embeddings'],
        related: ['fine-tuning'],
        governance: ['gdpr'],
        sources: ['some-paper'],
      }),
      interview('q1', ['rag']),
      governance('gdpr', ['rag']),
      source('some-paper', ['rag']),
      glossary('chunk'),
    ]);
    const byType = Object.fromEntries(edges.map((e) => [e.type, e]));
    expect(edges).toHaveLength(7);
    expect(byType['prerequisite']).toMatchObject({
      from: { collection: 'concepts', id: 'rag' },
      field: 'prerequisites',
      to: { collection: 'concepts', id: 'embeddings' },
    });
    expect(byType['governed-by']!.to.collection).toBe('governance');
    expect(byType['cites-source']!.to.collection).toBe('sources');
    expect(byType['assesses']!.from.collection).toBe('interview');
    expect(byType['applies-to']!.from.collection).toBe('governance');
    expect(byType['routed-to']!.from.collection).toBe('sources');
  });

  it('glossary entries produce nodes but no edges (schema has no reference fields)', () => {
    const graph = buildGraph([glossary('token')]);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });
});

describe('referential integrity', () => {
  it('a fully valid graph has no findings', () => {
    const report = run([
      concept('tokens', { sources: ['a-video'] }),
      concept('embeddings', { prerequisites: ['tokens'] }),
      interview('q1', ['tokens']),
      source('a-video', ['tokens']),
    ]);
    expect(report.failures).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it.each([
    ['prerequisites', concept('a', { prerequisites: ['ghost'] })],
    ['related', concept('a', { related: ['ghost'] })],
    ['governance', concept('a', { governance: ['ghost'] })],
    ['sources', concept('a', { sources: ['ghost'] })],
    ['interview concepts', interview('q1', ['ghost'])],
    ['governance appliesTo', governance('g1', ['ghost'])],
    ['source routedTo', source('s1', ['ghost'])],
  ])('dangling reference in %s fails with GRAPH_DANGLING_REFERENCE', (_field, entry) => {
    const report = run([entry]);
    expect(codes(report.failures)).toContain('GRAPH_DANGLING_REFERENCE');
    expect(report.failures[0]!.targetId).toBe('ghost');
    expect(report.failures[0]!.remediation).toBeTruthy();
  });

  it('a reference resolving only in the WRONG collection fails with GRAPH_WRONG_TARGET_TYPE', () => {
    // "token" exists — but as a glossary entry, not a concept.
    const report = run([concept('a', { prerequisites: ['token'] }), glossary('token')]);
    expect(codes(report.failures)).toEqual(['GRAPH_WRONG_TARGET_TYPE']);
    expect(report.failures[0]!.message).toContain('glossary');
  });

  it('same id in the right AND another collection is valid (collection-aware resolution)', () => {
    const report = run([
      concept('a', { prerequisites: ['token'] }),
      concept('token'),
      glossary('token'),
    ]);
    expect(report.failures).toEqual([]);
  });

  it('self-reference in prerequisites and related fails with GRAPH_SELF_REFERENCE', () => {
    const report = run([concept('a', { prerequisites: ['a'], related: ['a'] })]);
    expect(codes(report.failures)).toEqual(['GRAPH_SELF_REFERENCE', 'GRAPH_SELF_REFERENCE']);
  });

  it('duplicate reference in one field warns with GRAPH_DUPLICATE_REFERENCE', () => {
    const report = run([concept('a', { related: ['b', 'b'] }), concept('b')]);
    expect(report.failures).toEqual([]);
    expect(codes(report.warnings)).toContain('GRAPH_DUPLICATE_REFERENCE');
  });
});

describe('prerequisite cycles', () => {
  it('direct self-cycle is handled defensively (self-reference finding, no crash/loop)', () => {
    const report = run([concept('a', { prerequisites: ['a'] })]);
    expect(codes(report.failures)).toEqual(['GRAPH_SELF_REFERENCE']);
  });

  it('two-node cycle reports the actual path', () => {
    const report = run([
      concept('a', { prerequisites: ['b'] }),
      concept('b', { prerequisites: ['a'] }),
    ]);
    const cycle = report.failures.find((f) => f.code === 'GRAPH_PREREQUISITE_CYCLE')!;
    expect(cycle.cyclePath).toEqual(['a', 'b', 'a']);
    expect(cycle.message).toContain('a → b → a');
  });

  it('longer cycle reports the full path exactly once', () => {
    const report = run([
      concept('tool-calling', { prerequisites: ['agent-loop'] }),
      concept('agent-loop', { prerequisites: ['state'] }),
      concept('state', { prerequisites: ['tool-calling'] }),
    ]);
    const cycles = report.failures.filter((f) => f.code === 'GRAPH_PREREQUISITE_CYCLE');
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.message).toContain('agent-loop → state → tool-calling → agent-loop');
  });

  it('a diamond prerequisite graph is NOT a cycle', () => {
    const report = run([
      concept('top'),
      concept('left', { prerequisites: ['top'] }),
      concept('right', { prerequisites: ['top'] }),
      concept('bottom', { prerequisites: ['left', 'right'] }),
    ]);
    expect(codes(report.failures)).not.toContain('GRAPH_PREREQUISITE_CYCLE');
    expect(report.failures).toEqual([]);
  });

  it('branching DAGs with shared prerequisites are valid', () => {
    const report = run([
      concept('tokens'),
      concept('embeddings', { prerequisites: ['tokens'] }),
      concept('rag', { prerequisites: ['embeddings', 'tokens'] }),
      concept('agents', { prerequisites: ['tokens'] }),
    ]);
    expect(report.failures).toEqual([]);
  });
});

describe('complete-with-incomplete-prerequisite (plan §19: prerequisites at least draft)', () => {
  it('complete concept with a stub prerequisite fails, naming both concepts', () => {
    const report = run([
      concept('rag', { status: 'complete', prerequisites: ['embeddings'] }),
      concept('embeddings', { status: 'stub' }),
    ]);
    const finding = report.failures.find(
      (f) => f.code === 'GRAPH_COMPLETE_REQUIRES_INCOMPLETE_PREREQUISITE',
    )!;
    expect(finding.entryId).toBe('rag');
    expect(finding.targetId).toBe('embeddings');
    expect(finding.message).toContain('rag');
    expect(finding.message).toContain('embeddings');
  });

  it.each(['draft', 'complete', 'needs-update'] as const)(
    'complete concept with a %s prerequisite is valid',
    (status) => {
      const report = run([
        concept('rag', { status: 'complete', prerequisites: ['embeddings'] }),
        concept('embeddings', { status }),
      ]);
      expect(report.failures).toEqual([]);
    },
  );

  it('a draft concept may have stub prerequisites', () => {
    const report = run([
      concept('rag', { status: 'draft', prerequisites: ['embeddings'] }),
      concept('embeddings', { status: 'stub' }),
    ]);
    expect(report.failures).toEqual([]);
  });
});

describe('orphan warnings (report-only, plan §7)', () => {
  it('a concept with no relationships of any kind warns GRAPH_ORPHAN_CONCEPT', () => {
    const report = run([concept('island'), concept('tokens', { sources: [] })]);
    expect(report.failures).toEqual([]);
    expect(codes(report.warnings)).toEqual(['GRAPH_ORPHAN_CONCEPT', 'GRAPH_ORPHAN_CONCEPT']);
  });

  it('a foundational concept with NO prerequisites but other linkage is NOT an orphan', () => {
    const report = run([
      concept('tokens'), // no prerequisites — foundational
      interview('q1', ['tokens']),
    ]);
    expect(report.warnings).toEqual([]);
  });

  it('incoming edges alone (being someone\'s prerequisite) prevent orphanhood', () => {
    const report = run([concept('tokens'), concept('embeddings', { prerequisites: ['tokens'] })]);
    expect(report.warnings).toEqual([]);
  });

  it('non-concept entries are never orphan-warned', () => {
    const report = run([glossary('token'), source('s1', []), concept('c', { sources: ['s1'] })]);
    expect(codes(report.warnings)).not.toContain('GRAPH_ORPHAN_CONCEPT');
  });
});

describe('deterministic serialization', () => {
  const entries: GraphEntry[] = [
    concept('tokens', { sources: ['vid'] }),
    concept('embeddings', { prerequisites: ['tokens'], related: ['rag'] }),
    concept('rag', { prerequisites: ['embeddings', 'tokens'] }),
    interview('q1', ['rag', 'tokens']),
    governance('gdpr', ['rag']),
    source('vid', ['tokens']),
    glossary('chunk'),
  ];

  it('shuffled input order produces byte-identical graph.json', () => {
    const reversed = [...entries].reverse();
    const interleaved = [entries[3]!, entries[6]!, entries[0]!, entries[5]!, entries[2]!, entries[1]!, entries[4]!];
    const canonical = serializeGraph(buildGraph(entries));
    expect(serializeGraph(buildGraph(reversed))).toBe(canonical);
    expect(serializeGraph(buildGraph(interleaved))).toBe(canonical);
  });

  it('output contains no timestamps and ends with a newline', () => {
    const json = serializeGraph(buildGraph(entries));
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T/); // no ISO timestamps
    expect(json.endsWith('}\n')).toBe(true);
    const parsed = JSON.parse(json);
    expect(parsed.contentSchemaVersion).toBe(1);
    expect(parsed.nodes.map((n: { id: string }) => n.id)).toEqual(
      [...parsed.nodes.map((n: { id: string }) => n.id)], // parse round-trip sanity
    );
  });

  it('findings are deterministically ordered', () => {
    const bad: GraphEntry[] = [
      concept('z', { prerequisites: ['ghost-2'] }),
      concept('a', { prerequisites: ['ghost-1'] }),
    ];
    const first = run(bad).failures.map((f) => f.entryId + f.targetId);
    const second = run([...bad].reverse()).failures.map((f) => f.entryId + f.targetId);
    expect(first).toEqual(second);
  });
});
