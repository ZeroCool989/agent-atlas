/**
 * The MCP client: it lives inside a host application (a chat app, an IDE, an agent
 * runtime), connects to a server over a transport, discovers what the server offers, and
 * invokes it. The two methods that matter for the "why MCP" story:
 *
 *   - `listTools()` maps the server's manifest into the agent's OWN `ToolDefinition[]` —
 *     the exact type the model already consumes for native tool-calling. A discovered MCP
 *     tool is therefore indistinguishable from a hardcoded one. That is the interop payoff.
 *   - `callTool()` takes the model's `ToolCall`, wraps it in a `tools/call` envelope, sends
 *     it, and maps the response back into the agent's `ToolResultMessage`. MCP disappears
 *     into the same tool-calling loop the agent already runs.
 *
 * Reuses `ToolCall` / `ToolResultMessage` / `ToolDefinition` from the model layer — the
 * protocol adds a wire format, not a new set of agent types.
 */
import type { JsonValue, ToolCall, ToolDefinition, ToolResultMessage } from '../model';
import {
  type McpManifest,
  type RpcRequest,
  type RpcResponse,
  type ToolCallResult,
  isRpcError,
} from './protocol';
import type { Transport } from './transport';

export interface InitializeResult {
  protocolVersion: string;
  serverName: string;
  capabilities: { tools: boolean; resources: boolean; prompts: boolean };
}

export class McpClient {
  readonly #transport: Transport;
  #nextId = 1;

  constructor(transport: Transport) {
    this.#transport = transport;
  }

  /** Build the next request envelope with a fresh correlation id. */
  #request(method: string, params?: RpcRequest['params']): RpcRequest {
    return { jsonrpc: '2.0', id: this.#nextId++, method, ...(params ? { params } : {}) };
  }

  #call(method: string, params?: RpcRequest['params']): RpcResponse {
    return this.#transport.send(this.#request(method, params));
  }

  /** Handshake: agree on a protocol version and learn what the server can do. */
  initialize(): InitializeResult {
    const response = this.#call('initialize');
    if (isRpcError(response)) throw new Error(`initialize failed: ${response.error.message}`);
    return response.result as unknown as InitializeResult;
  }

  /** Discover tools and adapt them to the agent's own tool-definition shape. */
  listTools(): ToolDefinition[] {
    const response = this.#call('tools/list');
    if (isRpcError(response)) throw new Error(`tools/list failed: ${response.error.message}`);
    const { tools } = response.result as unknown as Pick<McpManifest, 'tools'>;
    return tools.map((spec) => ({
      name: spec.name,
      description: spec.description,
      inputSchema: spec.inputSchema,
    }));
  }

  /**
   * Invoke the tool the model selected, over the protocol, and map the answer back into
   * the agent's `ToolResultMessage`. Three outcomes collapse into the runtime's normal
   * error handling:
   *   - protocol error (unknown tool, bad args)  → isError: true, message from the envelope
   *   - tool ran but failed (result.isError)      → isError: true, message from the tool
   *   - success                                   → isError: false, the tool's text output
   */
  callTool(call: ToolCall): ToolResultMessage {
    const response = this.#call('tools/call', {
      name: call.toolName,
      arguments: call.arguments,
    });

    const base = { role: 'tool' as const, toolCallId: call.id, toolName: call.toolName };

    if (isRpcError(response)) {
      return { ...base, result: response.error.message, isError: true };
    }
    const result = response.result as unknown as ToolCallResult;
    const text: JsonValue = result.content.map((block) => block.text).join('\n');
    return { ...base, result: text, isError: result.isError };
  }
}
