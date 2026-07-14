/**
 * The model layer's shared contract (ADR-0005, plan §8/§12). Plain TypeScript — no
 * Astro, React, filesystem, UI, or SDK imports. Provider-neutral by design: vendor
 * shapes are mapped into these types inside provider adapters, never leaked through.
 *
 * Responsibility boundary (documented in docs/MODEL_PROVIDER.md):
 *   The model selects a tool. The agent runtime validates and executes it.
 * This layer represents model interaction only — no tool execution, no agent loop, no
 * retries, no memory, no RAG, no governance decisions, no trace rendering. Those belong
 * to later layers (`lib/agent/`, P1).
 */

/** JSON-serializable data — everything crossing the model boundary is visualizable. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

// --- Messages ---------------------------------------------------------------------------
// System instructions live on the request (`ModelRequest.system`), not as a message
// role — providers disagree about where system text goes, so adapters map it.

export interface UserMessage {
  role: 'user';
  text: string;
}
/** What the model said: text, tool calls, or both. */
export interface AssistantMessage {
  role: 'assistant';
  text?: string;
  toolCalls?: ToolCall[];
}
/** A tool result appended by the AGENT RUNTIME (never by this layer) after execution. */
export interface ToolResultMessage {
  role: 'tool';
  toolCallId: string;
  toolName: string;
  result: JsonValue;
  isError?: boolean;
}
export type Message = UserMessage | AssistantMessage | ToolResultMessage;
export type Role = Message['role'];

// --- Tools -------------------------------------------------------------------------------

/** What a tool IS, from the model's perspective. Execution is not represented here. */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments, as plain data (provider-neutral, serializable). */
  inputSchema: JsonObject;
}

/** The model's request to use a tool. Selecting is the model's job; running it is not. */
export interface ToolCall {
  id: string;
  toolName: string;
  arguments: JsonObject;
}

// --- Request / response --------------------------------------------------------------------

export interface ModelRequest {
  system?: string;
  /** Ordered conversation. Must be non-empty. */
  messages: Message[];
  tools?: ToolDefinition[];
  // Intentionally no generation settings yet (temperature, maxTokens, …): no approved
  // consumer needs them. Adding optional fields later is a backward-compatible,
  // evidence-driven change (see DECISIONS.md standing condition).
}

/**
 * Why the model stopped — model-level only. Agent-level outcomes ("goal achieved",
 * "needs human approval") are NOT stop reasons; they belong to the agent layer.
 * Vendor-specific reasons are mapped into this vocabulary by provider adapters.
 */
export type StopReason =
  | 'completed'
  | 'tool-call'
  | 'length'
  | 'content-filter'
  | 'error'
  | 'unknown';

export interface CostEstimate {
  amount: number;
  currency: string;
  /** 'declared' = stated by the scenario/provider; 'estimated' = derived from a price table. */
  basis: 'declared' | 'estimated';
}

/** All fields optional: providers that don't report a value leave it undefined — never fabricated. */
export interface ModelUsage {
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: CostEstimate;
}

export interface ModelResponse {
  text?: string;
  /** Zero or more tool calls the model selected (not executed). */
  toolCalls: ToolCall[];
  stopReason: StopReason;
  usage: ModelUsage;
  provider?: string;
  model?: string;
  /**
   * Observable anomalies the adapter had to work around (e.g. tool-call arguments
   * that were not valid JSON) — measurable behavior for experiments, never hidden.
   * Added for the real-provider adapters (evidence-driven optional extension).
   */
  warnings?: string[];
  /**
   * Escape hatch: the raw provider payload, for adapter debugging only. Shared code
   * must never read it — anything the application needs belongs in the typed fields.
   */
  raw?: unknown;
}

// --- The provider contract -------------------------------------------------------------------

export interface ModelProvider {
  complete(request: ModelRequest): Promise<ModelResponse>;
}
