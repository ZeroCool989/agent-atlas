/**
 * The wire shapes of the Model Context Protocol, modelled in memory (ADR-0005: plain
 * TypeScript, written to be read — no SDK, no sockets). MCP is an OPEN PROTOCOL that
 * lets a client (inside a host application) talk to a server that exposes tools,
 * resources, and prompts. Underneath, the model still just does tool-calling; MCP only
 * standardizes HOW a client discovers and invokes those capabilities so one server works
 * across any MCP-capable client.
 *
 * Accuracy note: real MCP is JSON-RPC 2.0 carried over a transport (stdio or HTTP). The
 * method names below (`initialize`, `tools/list`, `tools/call`, `resources/list`,
 * `resources/read`, `prompts/list`, `prompts/get`) match the real protocol's shape. The
 * exact params/results are SIMPLIFIED here to what teaches the idea — we model the
 * envelope, not every field of the spec. Where the toy simplifies, the comment says so.
 */
import type { JsonObject, JsonValue } from '../model';

/** The protocol version this toy speaks. Real MCP negotiates this in `initialize`. */
export const PROTOCOL_VERSION = '2025-06-18-toy';

// --- JSON-RPC 2.0 envelope ----------------------------------------------------------------
// Every message crossing the transport is one of these three shapes. This envelope IS the
// standardization: any MCP client and any MCP server agree on it, which is what collapses
// the N×M integration problem to N+M.

export interface RpcRequest {
  jsonrpc: '2.0';
  /** Correlates a response to its request; the client assigns it monotonically. */
  id: number;
  method: string;
  params?: JsonObject;
}

export interface RpcSuccess {
  jsonrpc: '2.0';
  id: number;
  result: JsonValue;
}

/** A PROTOCOL-level failure: unknown method, unknown tool, malformed params. Distinct
 * from a tool that ran and failed (that is a normal `result` with `isError: true`). */
export interface RpcError {
  jsonrpc: '2.0';
  id: number;
  error: { code: number; message: string; data?: JsonValue };
}

export type RpcResponse = RpcSuccess | RpcError;

export function isRpcError(response: RpcResponse): response is RpcError {
  return 'error' in response;
}

/** Standard JSON-RPC 2.0 error codes (the ones this toy can raise). */
export const RPC_ERROR = {
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
} as const;

// --- Capability declarations (what a server advertises) -----------------------------------
// MCP servers expose three kinds of capability. Only tools are executable; resources are
// readable data and prompts are reusable templates. The toy carries all three in the
// manifest to stay conceptually honest, but exercises tools end to end.

/** A callable tool. `inputSchema` is JSON Schema — the SAME shape the model already reads
 * for native tool-calling, which is exactly why a discovered MCP tool is indistinguishable
 * from a hardcoded one to the model. */
export interface McpToolSpec {
  name: string;
  description: string;
  inputSchema: JsonObject;
}

/** A readable resource (a document, a row, a file). Addressed by URI. */
export interface McpResourceSpec {
  uri: string;
  name: string;
  description: string;
}

/** A reusable prompt template the server offers to clients. */
export interface McpPromptSpec {
  name: string;
  description: string;
}

/** Everything a client learns from discovery — the server's whole surface. */
export interface McpManifest {
  serverName: string;
  protocolVersion: string;
  tools: McpToolSpec[];
  resources: McpResourceSpec[];
  prompts: McpPromptSpec[];
}

// --- tools/call result -------------------------------------------------------------------
// Real MCP returns tool output as a list of content blocks with an `isError` flag; a tool
// that fails is a SUCCESSFUL RPC response whose result carries isError: true. We model a
// single text block, which is enough to show the protocol/tool error distinction.

export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
  /** true when the tool ran but the operation failed — NOT a protocol error. */
  isError: boolean;
}
