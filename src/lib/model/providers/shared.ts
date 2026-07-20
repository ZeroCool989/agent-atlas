/**
 * Shared plumbing for the real-provider adapters. Raw `fetch` against vendor REST
 * APIs — no SDKs (ADR-0005): the mapping between vendor shapes and the neutral types
 * IS the lesson, and zero dependencies keeps it inspectable.
 *
 * Generation settings (temperature, seed, max output tokens) are PROVIDER-INSTANCE
 * configuration, not request fields: an experiment run = a configured provider, and
 * `ModelRequest` stays exactly as the runtime knows it (DECISIONS.md).
 *
 * These adapters are used ONLY by the local experiment framework (`experiments/`).
 * Nothing in the deployed site imports them; no key ever reaches the browser.
 */
import { ModelError } from '../errors';

export interface RealProviderConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  /** Required by some APIs (Anthropic); a sane teaching default is applied. */
  maxOutputTokens?: number;
  /** Best-effort reproducibility where the API supports it (OpenAI). */
  seed?: number;
  /** Override for OpenAI-compatible servers (Qwen, Llama, Mistral, DeepSeek, local). */
  baseUrl?: string;
  timeoutMs?: number;
  /**
   * Opt-in for direct browser → vendor calls (ADR-0006 Lab mode). When set, the Claude
   * adapter sends `anthropic-dangerous-direct-browser-access`, which Anthropic requires
   * to permit a request from a browser origin. Harmless server-side. Only ever true for a
   * user's own BYOK key held client-side — never for a bundled or server-held credential.
   */
  browserAccess?: boolean;
}

export const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
export const DEFAULT_TIMEOUT_MS = 60_000;

/** POST JSON with timeout; map transport/HTTP failures to typed ModelErrors. */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  providerName: string,
): Promise<{ json: unknown; latencyMs: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    clearTimeout(timer);
    if ((cause as Error).name === 'AbortError') {
      throw new ModelError('timeout', `${providerName}: no response within ${timeoutMs}ms`, {
        timeoutMs,
      });
    }
    throw new ModelError('provider-failure', `${providerName}: network error (${(cause as Error).message})`, {});
  }
  clearTimeout(timer);
  const latencyMs = Date.now() - startedAt;

  const text = await response.text();
  if (!response.ok) {
    throw new ModelError(
      'provider-failure',
      `${providerName}: HTTP ${response.status} — ${text.slice(0, 300)}`,
      { status: response.status },
    );
  }
  try {
    return { json: JSON.parse(text), latencyMs };
  } catch {
    throw new ModelError('malformed-response', `${providerName}: response was not valid JSON`, {});
  }
}

export function expectShape<T>(value: T | undefined | null, what: string, providerName: string): T {
  if (value === undefined || value === null) {
    throw new ModelError('malformed-response', `${providerName}: missing ${what} in response`, {});
  }
  return value;
}
