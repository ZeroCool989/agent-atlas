import { describe, expect, it } from 'vitest';

import { buildMcpHandshakeScenes } from './mcp-handshake-scene';

describe('buildMcpHandshakeScenes', () => {
  const scenes = buildMcpHandshakeScenes();

  it('walks the seven handshake steps in order', () => {
    expect(scenes).toHaveLength(7);
    for (const [i, s] of scenes.entries()) {
      expect(s.step).toBe(i);
      expect(s.totalSteps).toBe(7);
      expect(s.rows[i]!.state).toBe('active');
    }
  });

  it('shows nothing on the wire before the connection opens', () => {
    expect(scenes[0]!.envelopes).toHaveLength(0);
    expect(scenes[0]!.discoveredTools).toHaveLength(0);
  });

  it('reveals the real tool manifest only after discovery', () => {
    expect(scenes[2]!.discoveredTools).toEqual(['search_docs', 'get_doc']);
    // Nothing discovered before the tools/list step.
    expect(scenes[1]!.discoveredTools).toHaveLength(0);
  });

  it('carries a genuine JSON-RPC 2.0 envelope on each protocol hop', () => {
    // initialize (step 1) and tools/call request (step 4) are real envelopes from the toy.
    const initReq = JSON.parse(scenes[1]!.envelopes[0]!.json);
    expect(initReq).toMatchObject({ jsonrpc: '2.0', method: 'initialize' });
    const callReq = JSON.parse(scenes[4]!.envelopes[0]!.json);
    expect(callReq).toMatchObject({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'search_docs' },
    });
  });

  it('shows the model emitting a plain ToolCall, unaware of MCP', () => {
    const toolCall = JSON.parse(scenes[3]!.envelopes[0]!.json);
    expect(toolCall).toMatchObject({ toolName: 'search_docs', arguments: { query: 'mcp' } });
    expect(scenes[3]!.actor).toBe('model');
  });

  it('ends by mapping the protocol result back into a ToolResultMessage', () => {
    const mapped = JSON.parse(scenes[6]!.envelopes[0]!.json);
    expect(mapped).toMatchObject({ role: 'tool', toolCallId: 'call_1', isError: false });
    expect(String(mapped.result)).toContain('mcp-overview');
  });

  it('uses the same envelope shape (jsonrpc 2.0) on every server-bound message', () => {
    const clientBound = scenes.flatMap((s) =>
      s.envelopes.filter((e) => e.direction === 'client-to-server'),
    );
    expect(clientBound.length).toBeGreaterThanOrEqual(3);
    for (const env of clientBound) {
      expect(JSON.parse(env.json).jsonrpc).toBe('2.0');
    }
  });
});
