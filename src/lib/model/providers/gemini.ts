/**
 * Google Gemini generateContent adapter → neutral ModelProvider. Mapping notes:
 *  - roles are user/model; system text goes in `systemInstruction`;
 *  - Gemini function calls carry NO ids — the adapter synthesizes deterministic ones
 *    (`gemini-call-N`) so the runtime's duplicate-id protection still works; tool
 *    results map back by FUNCTION NAME (Gemini's convention), using our toolName;
 *  - finish reasons: STOP→completed (tool-call when functionCall parts are present —
 *    Gemini signals tool use through parts, not the finish reason), MAX_TOKENS→length,
 *    SAFETY/RECITATION→content-filter, else unknown.
 */
import type { JsonObject, Message, ModelProvider, ModelRequest, ModelResponse, StopReason, ToolCall } from '../types';
import { DEFAULT_TIMEOUT_MS, expectShape, postJson } from './shared';
import type { RealProviderConfig } from './shared';

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args?: JsonObject } }
  | { functionResponse: { name: string; response: JsonObject } };

function toGeminiContents(messages: Message[]): Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> {
  return messages.map((message) => {
    switch (message.role) {
      case 'user':
        return { role: 'user' as const, parts: [{ text: message.text }] };
      case 'assistant':
        return {
          role: 'model' as const,
          parts: [
            ...(message.text ? [{ text: message.text }] : []),
            ...(message.toolCalls ?? []).map((call) => ({
              functionCall: { name: call.toolName, args: call.arguments },
            })),
          ],
        };
      case 'tool':
        return {
          role: 'user' as const,
          parts: [
            {
              functionResponse: {
                name: message.toolName,
                response: { result: message.result } as JsonObject,
              },
            },
          ],
        };
    }
  });
}

export class GeminiProvider implements ModelProvider {
  readonly #config: RealProviderConfig;

  constructor(config: RealProviderConfig) {
    this.#config = config;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const config = this.#config;
    const base = config.baseUrl ?? 'https://generativelanguage.googleapis.com';
    const { json, latencyMs } = await postJson(
      `${base}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
      {},
      {
        ...(request.system !== undefined ? { systemInstruction: { parts: [{ text: request.system }] } } : {}),
        contents: toGeminiContents(request.messages),
        ...(request.tools && request.tools.length > 0
          ? {
              tools: [
                {
                  functionDeclarations: request.tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema,
                  })),
                },
              ],
            }
          : {}),
        ...(config.temperature !== undefined || config.maxOutputTokens !== undefined
          ? {
              generationConfig: {
                ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
                ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
              },
            }
          : {}),
      },
      config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      'gemini',
    );

    const payload = json as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; functionCall?: { name?: string; args?: JsonObject } }> };
        finishReason?: string;
      }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };
    const candidate = expectShape(payload.candidates?.[0], 'candidates[0]', 'gemini');
    const parts = candidate.content?.parts ?? [];

    const textParts = parts.filter((p) => p.text !== undefined).map((p) => p.text!);
    const toolCalls: ToolCall[] = parts
      .filter((p) => p.functionCall !== undefined)
      .map((p, index) => ({
        id: `gemini-call-${index + 1}`, // Gemini calls carry no id — synthesized, documented above
        toolName: expectShape(p.functionCall!.name, 'functionCall.name', 'gemini'),
        arguments: p.functionCall!.args ?? {},
      }));

    const finishMap: Record<string, StopReason> = {
      STOP: 'completed',
      MAX_TOKENS: 'length',
      SAFETY: 'content-filter',
      RECITATION: 'content-filter',
    };
    const mapped = finishMap[candidate.finishReason ?? ''] ?? 'unknown';

    return {
      ...(textParts.length > 0 ? { text: textParts.join('') } : {}),
      toolCalls,
      stopReason: toolCalls.length > 0 && mapped === 'completed' ? 'tool-call' : mapped,
      usage: {
        latencyMs,
        ...(payload.usageMetadata?.promptTokenCount !== undefined
          ? { inputTokens: payload.usageMetadata.promptTokenCount }
          : {}),
        ...(payload.usageMetadata?.candidatesTokenCount !== undefined
          ? { outputTokens: payload.usageMetadata.candidatesTokenCount }
          : {}),
        ...(payload.usageMetadata?.totalTokenCount !== undefined
          ? { totalTokens: payload.usageMetadata.totalTokenCount }
          : {}),
      },
      provider: 'gemini',
      model: config.model,
      raw: json,
    };
  }
}
