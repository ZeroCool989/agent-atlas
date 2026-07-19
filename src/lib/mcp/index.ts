/**
 * The Model Context Protocol, modelled in memory (ADR-0005). An open protocol that
 * standardizes how a client (inside a host) discovers and invokes a server's tools,
 * resources, and prompts. No SDK, no sockets — just the envelope shape, so the same
 * server works with any client. Read `protocol.ts` first, then `server.ts` and
 * `client.ts`; `demo.ts` wires a concrete server the tests and the lesson exercise.
 */
export {
  PROTOCOL_VERSION,
  RPC_ERROR,
  isRpcError,
} from './protocol';
export type {
  McpManifest,
  McpPromptSpec,
  McpResourceSpec,
  McpToolSpec,
  RpcError,
  RpcRequest,
  RpcResponse,
  RpcSuccess,
  ToolCallResult,
} from './protocol';
export { McpServer } from './server';
export type { McpServerConfig, McpToolHandler } from './server';
export { InProcessTransport } from './transport';
export type { ExchangeObserver, Transport } from './transport';
export { McpClient } from './client';
export type { InitializeResult } from './client';
export { validateArgs } from './schema';
export { createDemoServer, DEMO_TOOL_CALL } from './demo';
