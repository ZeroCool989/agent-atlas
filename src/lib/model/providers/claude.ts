/**
 * Anthropic Messages API adapter → neutral ModelProvider. Mapping notes:
 *  - system text: top-level `system` field (matches our request shape directly);
 *  - assistant tool calls: `tool_use` content blocks; tool results: `tool_result`
 *    blocks inside a USER message (Anthropic's convention);
 *  - stop reasons: end_turn→completed, tool_use→tool-call, max_tokens→length,
 *    refusal→content-filter, anything else→unknown (mapped, never guessed).
 */
import type { JsonObject, Message, ModelProvider, ModelRequest, ModelResponse, StopReason, ToolCall } from '../types';
import { DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_TIMEOUT_MS, expectShape, postJson } from './shared';
import type { RealProviderConfig } from './shared';

const STOP_REASONS: Record<string, StopReason> = {
  end_turn: 'completed',
  stop_sequence: 'completed',
  tool_use: 'tool-call',
  max_tokens: 'length',
  refusal: 'content-filter',
};

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: JsonObject }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

function toAnthropicMessages(messages: Message[]): Array<{ role: 'user' | 'assistant'; content: ContentBlock[] }> {
  return messages.map((message) => {
    switch (message.role) {
      case 'user':
        return { role: 'user' as const, content: [{ type: 'text' as const, text: message.text }] };
      case 'assistant':
        return {
          role: 'assistant' as const,
          content: [
            ...(message.text ? [{ type: 'text' as const, text: message.text }] : []),
            ...(message.toolCalls ?? []).map((call) => ({
              type: 'tool_use' as const,
              id: call.id,
              name: call.toolName,
              input: call.arguments,
            })),
          ],
        };
      case 'tool':
        return {
          role: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: message.toolCallId,
              content: JSON.stringify(message.result),
              ...(message.isError ? { is_error: true } : {}),
            },
          ],
        };
    }
  });
}

export class ClaudeProvider implements ModelProvider {
  readonly #config: RealProviderConfig;

  constructor(config: RealProviderConfig) {
    this.#config = config;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const config = this.#config;
    const { json, latencyMs } = await postJson(
      `${config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`,
      { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
      {
        model: config.model,
        max_tokens: config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
        ...(request.system !== undefined ? { system: request.system } : {}),
        messages: toAnthropicMessages(request.messages),
        ...(request.tools && request.tools.length > 0
          ? {
              tools: request.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema,
              })),
            }
          : {}),
      },
      config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      'claude',
    );

    const payload = json as {
      content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: JsonObject }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const content = expectShape(payload.content, 'content', 'claude');

    const textParts = content.filter((b) => b.type === 'text').map((b) => b.text ?? '');
    const toolCalls: ToolCall[] = content
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({
        id: expectShape(b.id, 'tool_use.id', 'claude'),
        toolName: expectShape(b.name, 'tool_use.name', 'claude'),
        arguments: b.input ?? {},
      }));

    const inputTokens = payload.usage?.input_tokens;
    const outputTokens = payload.usage?.output_tokens;
    return {
      ...(textParts.length > 0 ? { text: textParts.join('') } : {}),
      toolCalls,
      stopReason: STOP_REASONS[payload.stop_reason ?? ''] ?? 'unknown',
      usage: {
        latencyMs,
        ...(inputTokens !== undefined ? { inputTokens } : {}),
        ...(outputTokens !== undefined ? { outputTokens } : {}),
        ...(inputTokens !== undefined && outputTokens !== undefined
          ? { totalTokens: inputTokens + outputTokens }
          : {}),
      },
      provider: 'claude',
      model: this.#config.model,
      raw: json,
    };
  }
}
