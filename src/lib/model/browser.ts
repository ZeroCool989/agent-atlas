/**
 * Bring-your-own-key provider factory for the Transcript Studio's Lab mode (ADR-0006).
 *
 * This is the ONLY place the deployed site constructs a real `ModelProvider`, and it does
 * so under the strict BYOK condition: the key comes from the user at runtime, lives only
 * in their browser, and the request goes browser → vendor directly. No key is ever
 * bundled, committed, or sent to our server (there is no server). `ScriptedProvider`
 * remains the default everywhere else.
 *
 * It is a thin wrapper over the existing real adapters (`ClaudeProvider`,
 * `openAiCompatible`) — the neutral `ModelProvider` boundary means the agent runtime
 * (`runAgent`) cannot tell a BYOK provider from a scripted one.
 */
import type { ModelProvider } from './types';
import { ClaudeProvider } from './providers/claude';
import { openAiCompatible } from './providers/openai';

export type ByokVendor = 'anthropic' | 'openai-compatible';

export interface ByokConfig {
  vendor: ByokVendor;
  /** The user's own key, from a client-side input. Never persisted server-side. */
  apiKey: string;
  /** Model id; a sensible default is applied per vendor when omitted. */
  model?: string;
  /** For openai-compatible: the endpoint (OpenAI, Together, Groq, a local Ollama, Hermes…). */
  baseUrl?: string;
  /** Kept small — a study summary, not an essay; also bounds the user's own bill. */
  maxOutputTokens?: number;
  temperature?: number;
}

/** Default model per vendor — current, capable, and inexpensive enough for study summaries. */
export const DEFAULT_MODELS: Record<ByokVendor, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  'openai-compatible': 'gpt-4o-mini',
};

/** A minimal catalog the Studio UI can offer; users may type any model id. */
export const MODEL_SUGGESTIONS: Record<ByokVendor, readonly string[]> = {
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-4-8'],
  'openai-compatible': ['gpt-4o-mini', 'gpt-4o', 'llama3.1', 'qwen2.5'],
};

export class ByokConfigError extends Error {}

/**
 * Construct a real provider from a BYOK config. Validates the minimum before any network
 * call so the UI can show a clean error rather than a vendor 401.
 */
export function createByokProvider(config: ByokConfig): ModelProvider {
  const apiKey = config.apiKey.trim();
  if (!apiKey) throw new ByokConfigError('An API key is required for Lab mode.');
  const model = config.model?.trim() || DEFAULT_MODELS[config.vendor];

  if (config.vendor === 'anthropic') {
    return new ClaudeProvider({
      apiKey,
      model,
      browserAccess: true, // ADR-0006: permit the direct browser → Anthropic call
      ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
      ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
    });
  }

  // openai-compatible: OpenAI itself, or any compatible server via baseUrl.
  const baseUrl = config.baseUrl?.trim() || 'https://api.openai.com';
  return openAiCompatible('byok', {
    apiKey,
    model,
    baseUrl,
    ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
  });
}

/** Redact a key for display/logging — first 3 and last 2 chars only. Never log the raw key. */
export function redactKey(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return '•'.repeat(k.length);
  return `${k.slice(0, 3)}…${k.slice(-2)}`;
}
