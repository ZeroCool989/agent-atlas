/**
 * Typed model-layer errors. Failures are never swallowed or converted into text
 * responses; each error carries enough structured context for tests, later traces, and
 * interview explanations. By default, context holds identifiers and summaries — not
 * full prompts or secrets.
 */
import type { JsonValue } from './types';

export type ModelErrorCode =
  | 'invalid-request'
  | 'invalid-scenario'
  | 'scenario-mismatch'
  | 'scenario-exhausted'
  | 'provider-failure'
  | 'timeout'
  | 'malformed-response'
  | 'unsupported-capability';

export class ModelError extends Error {
  readonly code: ModelErrorCode;
  /** Structured, JSON-serializable context — safe for traces by default. */
  readonly context: Record<string, JsonValue>;

  constructor(code: ModelErrorCode, message: string, context: Record<string, JsonValue> = {}) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    this.context = context;
  }
}

/** Everything needed to understand and fix a scripted-replay divergence. */
export interface MismatchDetail {
  scenarioId: string;
  /** 0-based index of the scripted turn that was being matched. */
  turnIndex: number;
  /** Which expectation failed: 'roleSequence' | 'lastMessageContains' | 'toolResultForCallId' | 'toolsInclude'. */
  condition: string;
  expected: JsonValue;
  actual: JsonValue;
  remediation: string;
}

export class ScenarioMismatchError extends ModelError {
  readonly detail: MismatchDetail;

  constructor(detail: MismatchDetail) {
    super(
      'scenario-mismatch',
      `scenario "${detail.scenarioId}", turn ${detail.turnIndex}: ${detail.condition} diverged — ` +
        `expected ${JSON.stringify(detail.expected)}, got ${JSON.stringify(detail.actual)}. ${detail.remediation}`,
      { ...detail },
    );
    this.name = 'ScenarioMismatchError';
    this.detail = detail;
  }
}
