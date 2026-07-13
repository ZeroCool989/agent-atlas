/**
 * Canonical types for the knowledge graph (plan §7). Pure TypeScript: no Astro, React,
 * filesystem, YAML, or MDX imports. The graph core consumes normalized entries
 * (`GraphEntry`) produced by an adapter (see `scripts/validate-content.ts`) and returns
 * findings as data — it never prints or exits.
 */
import type { ConceptStatus, Layer } from '../content/model';

export type Collection = 'concepts' | 'interview' | 'governance' | 'sources' | 'glossary';

/** Normalized entries — the graph core's only knowledge of the content model. */
export interface ConceptEntry {
  collection: 'concepts';
  id: string;
  title: string;
  layer: Layer;
  status: ConceptStatus;
  prerequisites: string[];
  related: string[];
  governance: string[];
  sources: string[];
}
export interface InterviewEntry {
  collection: 'interview';
  id: string;
  question: string;
  concepts: string[];
}
export interface GovernanceEntry {
  collection: 'governance';
  id: string;
  title: string;
  appliesTo: string[];
}
export interface SourceEntry {
  collection: 'sources';
  id: string;
  title: string;
  routedTo: string[];
}
export interface GlossaryEntry {
  collection: 'glossary';
  id: string;
  term: string;
}
export type GraphEntry =
  | ConceptEntry
  | InterviewEntry
  | GovernanceEntry
  | SourceEntry
  | GlossaryEntry;

/**
 * Edge types — exactly the relationships present in the approved schemas (plan §6),
 * named from the declaring entry's perspective. The plan §7 vocabulary maps as:
 * `prerequisite`/`related` are themselves; `governs` is the governed-by/applies-to pair.
 */
export type EdgeType =
  | 'prerequisite' // concepts.prerequisites → concepts
  | 'related' // concepts.related → concepts
  | 'governed-by' // concepts.governance → governance
  | 'cites-source' // concepts.sources → sources
  | 'assesses' // interview.concepts → concepts
  | 'applies-to' // governance.appliesTo → concepts
  | 'routed-to'; // sources.routedTo → concepts

export interface NodeRef {
  collection: Collection;
  id: string;
}

export interface GraphNode extends NodeRef {
  /** Human-readable label: title, question, or term. */
  label: string;
  layer?: Layer;
  status?: ConceptStatus;
}

/**
 * One declared reference. `from` + `field` is full provenance (which entry, which
 * frontmatter field); `to.collection` is the collection the reference is REQUIRED to
 * resolve into. Edges are recorded even when the target does not exist — integrity
 * checking, not construction, decides validity.
 */
export interface GraphEdge {
  type: EdgeType;
  from: NodeRef;
  field: string;
  to: NodeRef;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Stable machine-readable diagnostic codes — documented in docs/GRAPH.md. */
export const DIAGNOSTIC_CODES = [
  'GRAPH_DANGLING_REFERENCE',
  'GRAPH_WRONG_TARGET_TYPE',
  'GRAPH_SELF_REFERENCE',
  'GRAPH_PREREQUISITE_CYCLE',
  'GRAPH_COMPLETE_REQUIRES_INCOMPLETE_PREREQUISITE',
  'GRAPH_DUPLICATE_REFERENCE',
  'GRAPH_ORPHAN_CONCEPT',
] as const;
export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];

export type Severity = 'error' | 'warning';

export interface Finding {
  severity: Severity;
  code: DiagnosticCode;
  /** Collection + id of the entry the author must edit to fix this. */
  collection: Collection;
  entryId: string;
  /** The frontmatter/data field the finding is about, where applicable. */
  field?: string;
  /** The referenced id, where applicable. */
  targetId?: string;
  message: string;
  remediation: string;
  /** For GRAPH_PREREQUISITE_CYCLE: the full cycle, first node repeated at the end. */
  cyclePath?: string[];
}

export interface IntegrityReport {
  failures: Finding[];
  warnings: Finding[];
}
