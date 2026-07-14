/**
 * Environment and provider wiring for local experiment runs. Keys come from a
 * git-ignored `.env` (see .env.example); a matrix row whose key is missing is
 * SKIPPED with a visible reason, never an error — so the framework runs end-to-end
 * with zero keys (scripted rows) and scales up as keys are added.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseScenario, ScriptedProvider } from '../../src/lib/model';
import type { ModelProvider } from '../../src/lib/model';
import { ClaudeProvider, GeminiProvider, OpenAiProvider, openAiCompatible } from '../../src/lib/model/providers';
import type { MatrixRow } from './types';

export function loadEnv(): void {
  try {
    process.loadEnvFile(join(process.cwd(), '.env'));
  } catch {
    // no .env — fine; scripted rows still run
  }
}

const KEY_ENV: Record<string, string> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  'openai-compatible': 'OPENAI_COMPATIBLE_API_KEY',
};

/** Fresh provider per run (scripted sessions are single-replay by design). */
export function buildProvider(row: MatrixRow): { provider: ModelProvider } | { skip: string } {
  if (row.kind === 'scripted') {
    const file = join(process.cwd(), 'src/lib/model/scenarios', `${row.scenario}.scenario.json`);
    return { provider: new ScriptedProvider(parseScenario(JSON.parse(readFileSync(file, 'utf8')))) };
  }

  const envVar = KEY_ENV[row.provider]!;
  const apiKey = process.env[envVar];
  if (!apiKey) return { skip: `missing ${envVar} in .env` };

  const config = {
    apiKey,
    model: row.model,
    ...(row.temperature !== undefined ? { temperature: row.temperature } : {}),
    ...(row.seed !== undefined ? { seed: row.seed } : {}),
    ...(row.maxOutputTokens !== undefined ? { maxOutputTokens: row.maxOutputTokens } : {}),
  };

  switch (row.provider) {
    case 'claude':
      return { provider: new ClaudeProvider(config) };
    case 'openai':
      return { provider: new OpenAiProvider(config) };
    case 'gemini':
      return { provider: new GeminiProvider(config) };
    case 'openai-compatible': {
      const baseUrl = row.baseUrlEnv ? process.env[row.baseUrlEnv] : undefined;
      if (!baseUrl) return { skip: `missing base URL (env ${row.baseUrlEnv ?? 'unset'})` };
      return { provider: openAiCompatible(row.providerName ?? 'openai-compatible', { ...config, baseUrl }) };
    }
  }
}

export function rowProviderName(row: MatrixRow): string {
  return row.kind === 'scripted' ? 'scripted' : (row.providerName ?? row.provider);
}

export function rowModelName(row: MatrixRow): string {
  return row.kind === 'scripted' ? `scenario:${row.scenario}` : row.model;
}
