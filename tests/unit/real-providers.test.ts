import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModelError } from '../../src/lib/model';
import type { ModelRequest } from '../../src/lib/model';
import { ClaudeProvider, GeminiProvider, OpenAiProvider, openAiCompatible } from '../../src/lib/model/providers';

afterEach(() => vi.unstubAllGlobals());

function mockFetch(payload: unknown, status = 200) {
  const spy = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

const request: ModelRequest = {
  system: 'Use tools for arithmetic.',
  messages: [
    { role: 'user', text: 'What is 127 * 49?' },
    { role: 'assistant', toolCalls: [{ id: 'c1', toolName: 'calculator', arguments: { expression: '127*49' } }] },
    { role: 'tool', toolCallId: 'c1', toolName: 'calculator', result: 6223 },
  ],
  tools: [{ name: 'calculator', description: 'calc', inputSchema: { type: 'object' } }],
};

describe('ClaudeProvider', () => {
  it('maps requests (system top-level, tool_use/tool_result blocks) and responses', async () => {
    const spy = mockFetch({
      content: [{ type: 'text', text: '127 × 49 = 6,223.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 12 },
    });
    const response = await new ClaudeProvider({ apiKey: 'k', model: 'claude-x', temperature: 0 }).complete(request);

    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.system).toBe('Use tools for arithmetic.');
    expect(body.temperature).toBe(0);
    expect(body.messages[1].content[0]).toMatchObject({ type: 'tool_use', id: 'c1', name: 'calculator' });
    expect(body.messages[2]).toMatchObject({ role: 'user' }); // tool_result rides in a user message
    expect(body.messages[2].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'c1' });
    expect(body.tools[0]).toMatchObject({ name: 'calculator', input_schema: { type: 'object' } });

    expect(response).toMatchObject({
      text: '127 × 49 = 6,223.',
      stopReason: 'completed',
      provider: 'claude',
      model: 'claude-x',
      usage: { inputTokens: 100, outputTokens: 12, totalTokens: 112 },
    });
    expect(response.usage.latencyMs).toBeGreaterThanOrEqual(0); // measured, not fabricated
  });

  it('maps tool_use responses to neutral tool calls with stop reason tool-call', async () => {
    mockFetch({
      content: [{ type: 'tool_use', id: 'tu_1', name: 'calculator', input: { expression: '1+1' } }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 50, output_tokens: 20 },
    });
    const response = await new ClaudeProvider({ apiKey: 'k', model: 'claude-x' }).complete(request);
    expect(response.stopReason).toBe('tool-call');
    expect(response.toolCalls).toEqual([{ id: 'tu_1', toolName: 'calculator', arguments: { expression: '1+1' } }]);
  });

  it('maps HTTP errors and missing shapes to typed ModelErrors', async () => {
    mockFetch({ error: 'overloaded' }, 429);
    await expect(new ClaudeProvider({ apiKey: 'k', model: 'm' }).complete(request)).rejects.toMatchObject({
      code: 'provider-failure',
      context: { status: 429 },
    });
    mockFetch({ nonsense: true });
    await expect(new ClaudeProvider({ apiKey: 'k', model: 'm' }).complete(request)).rejects.toMatchObject({
      code: 'malformed-response',
    });
  });
});

describe('OpenAiProvider', () => {
  it('maps requests (system as first message, JSON-string arguments) and responses', async () => {
    const spy = mockFetch({
      choices: [{ message: { content: 'done' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 90, completion_tokens: 10, total_tokens: 100 },
    });
    const response = await new OpenAiProvider({ apiKey: 'k', model: 'gpt-x', seed: 42 }).complete(request);

    const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'Use tools for arithmetic.' });
    expect(body.seed).toBe(42);
    expect(body.messages[2].tool_calls[0].function.arguments).toBe('{"expression":"127*49"}'); // stringified
    expect(body.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
    expect(response).toMatchObject({ text: 'done', stopReason: 'completed', usage: { totalTokens: 100 } });
  });

  it('records a warning for unparseable tool-call arguments instead of hiding them', async () => {
    mockFetch({
      choices: [
        {
          message: { tool_calls: [{ id: 'x', function: { name: 'calculator', arguments: '{oops' } }] },
          finish_reason: 'tool_calls',
        },
      ],
    });
    const response = await new OpenAiProvider({ apiKey: 'k', model: 'gpt-x' }).complete(request);
    expect(response.stopReason).toBe('tool-call');
    expect(response.toolCalls[0]).toMatchObject({ toolName: 'calculator', arguments: {} });
    expect(response.warnings![0]).toContain('not valid JSON');
    expect(response.usage.inputTokens).toBeUndefined(); // absent usage stays absent
  });

  it('openAiCompatible reuses the adapter under a different name and base URL', async () => {
    const spy = mockFetch({ choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }] });
    const provider = openAiCompatible('deepseek', { apiKey: 'k', model: 'deepseek-x', baseUrl: 'https://api.deepseek.com' });
    const response = await provider.complete({ messages: [{ role: 'user', text: 'hi' }] });
    expect(spy.mock.calls[0]![0]).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(response.provider).toBe('deepseek');
    expect(() => openAiCompatible('qwen', { apiKey: 'k', model: 'q' })).toThrow(/baseUrl/);
  });
});

describe('GeminiProvider', () => {
  it('maps roles/parts and synthesizes deterministic tool-call ids', async () => {
    const spy = mockFetch({
      candidates: [
        {
          content: { parts: [{ functionCall: { name: 'calculator', args: { expression: '1+1' } } }] },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 8, totalTokenCount: 48 },
    });
    const response = await new GeminiProvider({ apiKey: 'k', model: 'gemini-x' }).complete(request);

    const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.systemInstruction.parts[0].text).toBe('Use tools for arithmetic.');
    expect(body.contents[1].role).toBe('model');
    expect(body.contents[2].parts[0].functionResponse).toMatchObject({ name: 'calculator' });
    expect(body.tools[0].functionDeclarations[0].name).toBe('calculator');

    // functionCall parts present → tool-call even though finishReason is STOP
    expect(response.stopReason).toBe('tool-call');
    expect(response.toolCalls).toEqual([
      { id: 'gemini-call-1', toolName: 'calculator', arguments: { expression: '1+1' } },
    ]);
    expect(response.usage).toMatchObject({ inputTokens: 40, outputTokens: 8, totalTokens: 48 });
  });

  it('maps safety stops to content-filter', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: 'blocked' }] }, finishReason: 'SAFETY' }] });
    const response = await new GeminiProvider({ apiKey: 'k', model: 'g' }).complete(request);
    expect(response.stopReason).toBe('content-filter');
  });
});

describe('timeouts', () => {
  it('maps aborts to a typed timeout error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        });
      }),
    );
    const provider = new ClaudeProvider({ apiKey: 'k', model: 'm', timeoutMs: 10 });
    await expect(provider.complete(request)).rejects.toMatchObject({ code: 'timeout' });
    expect(ModelError).toBeDefined();
  });
});
