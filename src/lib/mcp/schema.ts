/**
 * A deliberately tiny JSON-Schema check for tool arguments — enough to show that the
 * SERVER validates at the protocol boundary, not enough to be a real validator. Real MCP
 * servers validate arguments fully (and clients may pre-validate too). We support exactly
 * what the demo tools declare: an object schema with typed `properties`, a `required`
 * list, and `additionalProperties: false`. Anything fancier is out of scope on purpose.
 */
import type { JsonObject, JsonValue } from '../model';

type JsonType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

function jsonTypeOf(value: JsonValue): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonType;
}

/** Returns null when `args` satisfy `schema`, or a human-readable reason when they don't. */
export function validateArgs(schema: JsonObject, args: JsonObject): string | null {
  const properties = (schema.properties as JsonObject | undefined) ?? {};
  const required = (schema.required as string[] | undefined) ?? [];
  const additional = schema.additionalProperties;

  for (const key of required) {
    if (!(key in args)) return `missing required argument "${key}"`;
  }

  if (additional === false) {
    for (const key of Object.keys(args)) {
      if (!(key in properties)) return `unexpected argument "${key}"`;
    }
  }

  for (const [key, value] of Object.entries(args)) {
    const propSchema = properties[key] as JsonObject | undefined;
    const expected = propSchema?.type as JsonType | undefined;
    if (expected && jsonTypeOf(value) !== expected) {
      return `argument "${key}" must be ${expected}, got ${jsonTypeOf(value)}`;
    }
  }

  return null;
}
