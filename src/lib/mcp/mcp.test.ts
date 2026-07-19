import { describe, expect, it } from 'vitest';

import type { ToolCall } from '../model';
import { McpClient } from './client';
import { createDemoServer, DEMO_TOOL_CALL } from './demo';
import { isRpcError, RPC_ERROR, type RpcRequest } from './protocol';
import { validateArgs } from './schema';
import { InProcessTransport, type ExchangeObserver } from './transport';

function connect(observer?: ExchangeObserver) {
  const server = createDemoServer();
  const transport = new InProcessTransport(server, observer);
  return { server, client: new McpClient(transport) };
}

describe('McpServer manifest', () => {
  it('advertises tools, resources, and prompts', () => {
    const manifest = createDemoServer().manifest();
    expect(manifest.tools.map((t) => t.name)).toEqual(['search_docs', 'get_doc']);
    expect(manifest.resources.map((r) => r.uri)).toEqual(['docs://index']);
    expect(manifest.prompts.map((p) => p.name)).toEqual(['explain_like_five']);
  });

  it('reports its capabilities in initialize', () => {
    const { client } = connect();
    const init = client.initialize();
    expect(init.capabilities).toEqual({ tools: true, resources: true, prompts: true });
    expect(init.serverName).toBe('docs-server');
  });
});

describe('McpClient discovery', () => {
  it('maps the manifest into the agent ToolDefinition shape', () => {
    const { client } = connect();
    const tools = client.listTools();
    // Discovered tools are indistinguishable from hardcoded ToolDefinitions.
    expect(tools[0]).toMatchObject({
      name: 'search_docs',
      description: expect.any(String),
      inputSchema: { type: 'object' },
    });
    expect(tools.map((t) => t.name)).toEqual(['search_docs', 'get_doc']);
  });
});

describe('McpClient.callTool → ToolResultMessage', () => {
  it('maps a successful call into a tool result the agent loop can consume', () => {
    const { client } = connect();
    const result = client.callTool(DEMO_TOOL_CALL);
    expect(result).toMatchObject({
      role: 'tool',
      toolCallId: 'call_1',
      toolName: 'search_docs',
      isError: false,
    });
    // Real output, computed by the toy — the mcp-overview doc matches "mcp".
    expect(String(result.result)).toContain('mcp-overview');
  });

  it('maps a tool that runs but fails into isError: true (not a protocol error)', () => {
    const { client } = connect();
    const call: ToolCall = { id: 'call_2', toolName: 'get_doc', arguments: { id: 'does-not-exist' } };
    const result = client.callTool(call);
    expect(result.isError).toBe(true);
    expect(String(result.result)).toContain('no document with id');
  });

  it('maps an unknown tool into a protocol error surfaced as isError', () => {
    const { client } = connect();
    const call: ToolCall = { id: 'call_3', toolName: 'no_such_tool', arguments: {} };
    const result = client.callTool(call);
    expect(result.isError).toBe(true);
    expect(String(result.result)).toContain('unknown tool');
  });

  it('rejects arguments that violate the declared schema', () => {
    const { client } = connect();
    const call: ToolCall = { id: 'call_4', toolName: 'search_docs', arguments: { wrong: 1 } };
    const result = client.callTool(call);
    expect(result.isError).toBe(true);
    expect(String(result.result)).toMatch(/missing required argument|unexpected argument/);
  });
});

describe('protocol-level errors', () => {
  it('returns METHOD_NOT_FOUND for an unknown method', () => {
    const server = createDemoServer();
    const request: RpcRequest = { jsonrpc: '2.0', id: 9, method: 'does/notexist' };
    const response = server.handle(request);
    expect(isRpcError(response)).toBe(true);
    if (isRpcError(response)) expect(response.error.code).toBe(RPC_ERROR.METHOD_NOT_FOUND);
  });

  it('preserves the request id on the response envelope', () => {
    const server = createDemoServer();
    const response = server.handle({ jsonrpc: '2.0', id: 42, method: 'tools/list' });
    expect(response.id).toBe(42);
  });
});

describe('transport', () => {
  it('records every request/response exchange for audit', () => {
    const exchanges: string[] = [];
    const { client } = connect((req, res) => {
      exchanges.push(`${req.method} → ${isRpcError(res) ? 'error' : 'ok'}`);
    });
    client.initialize();
    client.listTools();
    client.callTool(DEMO_TOOL_CALL);
    expect(exchanges).toEqual([
      'initialize → ok',
      'tools/list → ok',
      'tools/call → ok',
    ]);
  });

  it('assigns monotonically increasing request ids', () => {
    const ids: number[] = [];
    const { client } = connect((req) => ids.push(req.id));
    client.initialize();
    client.listTools();
    expect(ids).toEqual([1, 2]);
  });
});

describe('validateArgs', () => {
  const schema = {
    type: 'object',
    properties: { query: { type: 'string' }, limit: { type: 'number' } },
    required: ['query'],
    additionalProperties: false,
  };

  it('accepts valid args', () => {
    expect(validateArgs(schema, { query: 'x', limit: 2 })).toBeNull();
  });
  it('flags a missing required key', () => {
    expect(validateArgs(schema, {})).toContain('missing required');
  });
  it('flags an unexpected key', () => {
    expect(validateArgs(schema, { query: 'x', extra: 1 })).toContain('unexpected');
  });
  it('flags a wrong type', () => {
    expect(validateArgs(schema, { query: 5 })).toContain('must be string');
  });
});
