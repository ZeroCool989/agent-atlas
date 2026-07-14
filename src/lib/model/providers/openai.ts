/**
 * OpenAI Chat Completions adapter → neutral ModelProvider. Because Qwen, Llama,
 * Mistral, DeepSeek, and most local servers expose OpenAI-compatible endpoints,
 * "adding a provider" is usually just this adapter with a different `baseUrl` —
 * see `openAiCompatible()` below.
 *
 * Mapping notes:
 *  - system text becomes the first message (OpenAI's convention);
 *  - tool-call arguments arrive as a JSON STRING; when it doesn't parse, that is
 *    measurable model behavior — the adapter passes empty arguments (which the
 *    runtime's validation will reject, observably) and records a `warnings` entry;
 *  - finish reasons: stop→completed, tool_calls→tool-call, length→length,
 *    content_filter→content-filter, else unknown.
 */
import type { JsonObject, ModelProvider, ModelRequest, ModelResponse, StopReason, ToolCall } from '../types';
import { DEFAULT_TIMEOUT_MS, expectShape, postJson } from './shared';
import type { RealProviderConfig } from './shared';

const STOP_REASONS: Record<string, StopReason> = {
  stop: 'completed',
  tool_calls: 'tool-call',
  length: 'length',
  content_filter: 'content-filter',
};

function toOpenAiMessages(request: ModelRequest): unknown[] {
  const messages: unknown[] = [];
  if (request.system !== undefined) messages.push({ role: 'system', content: request.system });
  for (const message of request.messages) {
    switch (message.role) {
      case 'user':
        messages.push({ role: 'user', content: message.text });
        break;
      case 'assistant':
        messages.push({
          role: 'assistant',
          content: message.text ?? null,
          ...(message.toolCalls && message.toolCalls.length > 0
            ? {
                tool_calls: message.toolCalls.map((call) => ({
                  id: call.id,
                  type: 'function',
                  function: { name: call.toolName, arguments: JSON.stringify(call.arguments) },
                })),
              }
            : {}),
        });
        break;
      case 'tool':
        messages.push({
          role: 'tool',
          tool_call_id: message.toolCallId,
          content: JSON.stringify(message.result),
        });
        break;
    }
  }
  return messages;
}

export class OpenAiProvider implements ModelProvider {
  readonly #config: RealProviderConfig;
  readonly #providerName: string;

  constructor(config: RealProviderConfig, providerName = 'openai') {
    this.#config = config;
    this.#providerName = providerName;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const config = this.#config;
    const name = this.#providerName;
    const { json, latencyMs } = await postJson(
      `${config.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`,
      { authorization: `Bearer ${config.apiKey}` },
      {
        model: config.model,
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
        ...(config.seed !== undefined ? { seed: config.seed } : {}),
        ...(config.maxOutputTokens !== undefined ? { max_tokens: config.maxOutputTokens } : {}),
        messages: toOpenAiMessages(request),
        ...(request.tools && request.tools.length > 0
          ? {
              tools: request.tools.map((tool) => ({
                type: 'function',
                function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
              })),
            }
          : {}),
      },
      config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      name,
    );

    const payload = json as {
      choices?: Array<{
        message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> };
        finish_reason?: string;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const choice = expectShape(payload.choices?.[0], 'choices[0]', name);
    const message = expectShape(choice.message, 'choices[0].message', name);

    const warnings: string[] = [];
    const toolCalls: ToolCall[] = (message.tool_calls ?? []).map((call, index) => {
      const id = call.id ?? `${name}-call-${index + 1}`;
      const toolName = expectShape(call.function?.name, 'tool_call function name', name);
      let parsedArguments: JsonObject = {};
      const rawArguments = call.function?.arguments ?? '{}';
      try {
        const parsed = JSON.parse(rawArguments);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedArguments = parsed as JsonObject;
        } else {
          warnings.push(`tool call "${toolName}" arguments were valid JSON but not an object: ${rawArguments.slice(0, 120)}`);
        }
      } catch {
        warnings.push(`tool call "${toolName}" arguments were not valid JSON: ${rawArguments.slice(0, 120)}`);
      }
      return { id, toolName, arguments: parsedArguments };
    });

    return {
      ...(message.content ? { text: message.content } : {}),
      toolCalls,
      stopReason: STOP_REASONS[choice.finish_reason ?? ''] ?? 'unknown',
      usage: {
        latencyMs,
        ...(payload.usage?.prompt_tokens !== undefined ? { inputTokens: payload.usage.prompt_tokens } : {}),
        ...(payload.usage?.completion_tokens !== undefined ? { outputTokens: payload.usage.completion_tokens } : {}),
        ...(payload.usage?.total_tokens !== undefined ? { totalTokens: payload.usage.total_tokens } : {}),
      },
      provider: name,
      model: config.model,
      ...(warnings.length > 0 ? { warnings } : {}),
      raw: json,
    };
  }
}

/** Qwen/Llama/Mistral/DeepSeek/local servers: the same protocol, a different URL. */
export function openAiCompatible(providerName: string, config: RealProviderConfig): ModelProvider {
  if (!config.baseUrl) throw new Error(`openAiCompatible("${providerName}") requires a baseUrl`);
  return new OpenAiProvider(config, providerName);
}
