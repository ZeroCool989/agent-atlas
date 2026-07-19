/**
 * An in-memory MCP server: it advertises a capability manifest and answers protocol
 * requests. This is the piece an integration author writes ONCE — the whole promise of
 * MCP is that this same server then works with any MCP-capable client. No sockets, no
 * process: `handle()` takes a request envelope and returns a response envelope, so the
 * transport is free to be anything (in this toy, an in-process function call).
 *
 * The load-bearing distinction it enforces (mirrors the tool-calling lesson's gates):
 *   - unknown method / unknown tool / bad arguments → a PROTOCOL error (RpcError)
 *   - a tool that runs but fails                     → a normal result, isError: true
 *   - a tool that succeeds                           → a normal result, isError: false
 */
import type { JsonObject, JsonValue } from '../model';
import {
  type McpManifest,
  type McpPromptSpec,
  type McpResourceSpec,
  type McpToolSpec,
  type RpcRequest,
  type RpcResponse,
  type ToolCallResult,
  PROTOCOL_VERSION,
  RPC_ERROR,
} from './protocol';
import { validateArgs } from './schema';

/** A tool the server can actually run. The handler is a deterministic function over its
 * validated arguments — never eval, a shell, or a network call (same rule as agent tools).
 * Throwing (or returning `{ error }`) becomes an isError result, not a protocol failure. */
export interface McpToolHandler {
  spec: McpToolSpec;
  run(args: JsonObject): JsonValue;
}

export interface McpServerConfig {
  name: string;
  tools: McpToolHandler[];
  resources?: Array<McpResourceSpec & { read(): string }>;
  prompts?: McpPromptSpec[];
}

export class McpServer {
  readonly #name: string;
  readonly #tools = new Map<string, McpToolHandler>();
  readonly #resources = new Map<string, McpResourceSpec & { read(): string }>();
  readonly #prompts: McpPromptSpec[];

  constructor(config: McpServerConfig) {
    this.#name = config.name;
    for (const tool of config.tools) {
      if (this.#tools.has(tool.spec.name)) {
        throw new Error(`duplicate tool "${tool.spec.name}"`);
      }
      this.#tools.set(tool.spec.name, tool);
    }
    for (const resource of config.resources ?? []) this.#resources.set(resource.uri, resource);
    this.#prompts = config.prompts ?? [];
  }

  /** The manifest a client discovers. */
  manifest(): McpManifest {
    return {
      serverName: this.#name,
      protocolVersion: PROTOCOL_VERSION,
      tools: [...this.#tools.values()].map((t) => t.spec),
      resources: [...this.#resources.values()].map(({ uri, name, description }) => ({
        uri,
        name,
        description,
      })),
      prompts: this.#prompts,
    };
  }

  /** The one entry point: a request envelope in, a response envelope out. */
  handle(request: RpcRequest): RpcResponse {
    const ok = (result: JsonValue): RpcResponse => ({ jsonrpc: '2.0', id: request.id, result });
    const fail = (code: number, message: string): RpcResponse => ({
      jsonrpc: '2.0',
      id: request.id,
      error: { code, message },
    });

    switch (request.method) {
      case 'initialize':
        return ok({
          protocolVersion: PROTOCOL_VERSION,
          serverName: this.#name,
          // What the server can do — clients read this to know which discovery calls to make.
          capabilities: {
            tools: this.#tools.size > 0,
            resources: this.#resources.size > 0,
            prompts: this.#prompts.length > 0,
          },
        });

      case 'tools/list':
        return ok({ tools: this.manifest().tools as unknown as JsonValue });

      case 'tools/call':
        return this.#callTool(request, ok, fail);

      case 'resources/list':
        return ok({ resources: this.manifest().resources as unknown as JsonValue });

      case 'resources/read': {
        const uri = request.params?.uri as string | undefined;
        const resource = uri ? this.#resources.get(uri) : undefined;
        if (!resource) return fail(RPC_ERROR.INVALID_PARAMS, `unknown resource "${uri}"`);
        return ok({ uri: resource.uri, text: resource.read() });
      }

      case 'prompts/list':
        return ok({ prompts: this.#prompts as unknown as JsonValue });

      default:
        return fail(RPC_ERROR.METHOD_NOT_FOUND, `unknown method "${request.method}"`);
    }
  }

  #callTool(
    request: RpcRequest,
    ok: (result: JsonValue) => RpcResponse,
    fail: (code: number, message: string) => RpcResponse,
  ): RpcResponse {
    const name = request.params?.name as string | undefined;
    const args = (request.params?.arguments as JsonObject | undefined) ?? {};
    const tool = name ? this.#tools.get(name) : undefined;

    // Protocol errors: the request itself is not answerable.
    if (!tool) return fail(RPC_ERROR.INVALID_PARAMS, `unknown tool "${name}"`);
    const schemaError = validateArgs(tool.spec.inputSchema, args);
    if (schemaError) return fail(RPC_ERROR.INVALID_PARAMS, schemaError);

    // Tool errors: the request was valid, the operation failed. This is a normal result.
    try {
      const value = tool.run(args);
      const result: ToolCallResult = {
        content: [{ type: 'text', text: stringify(value) }],
        isError: false,
      };
      return ok(result as unknown as JsonValue);
    } catch (error) {
      const result: ToolCallResult = {
        content: [{ type: 'text', text: (error as Error).message }],
        isError: true,
      };
      return ok(result as unknown as JsonValue);
    }
  }
}

function stringify(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
