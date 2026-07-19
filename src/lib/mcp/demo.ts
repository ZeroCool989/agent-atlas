/**
 * A tiny, deterministic MCP server used by both the unit tests and the handshake
 * visualization — so every envelope shown in the lesson is real output of this toy, never
 * hand-written. It models a "docs" server an agent might connect to: two tools, one
 * resource, one prompt. `search_docs` always succeeds; `get_doc` throws on an unknown id,
 * which is how the lesson shows a TOOL error (a normal result with isError: true) as
 * distinct from a PROTOCOL error.
 */
import type { JsonObject, JsonValue, ToolCall } from '../model';
import { McpServer, type McpToolHandler } from './server';

interface Doc {
  id: string;
  title: string;
  body: string;
}

const CORPUS: Doc[] = [
  { id: 'mcp-overview', title: 'What MCP is', body: 'MCP standardizes how a client connects to tools, resources, and prompts.' },
  { id: 'transports', title: 'stdio and HTTP transports', body: 'The same JSON-RPC envelope travels over stdio or HTTP.' },
  { id: 'tool-calling', title: 'Tool calling underneath', body: 'MCP adds no capability; the model still just does tool-calling.' },
];

const searchDocs: McpToolHandler = {
  spec: {
    name: 'search_docs',
    description: 'Search the documentation corpus and return matching titles.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for' },
        limit: { type: 'number', description: 'Max results (default 3)' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  run(args: JsonObject): JsonValue {
    const query = String(args.query).toLowerCase();
    const limit = typeof args.limit === 'number' ? args.limit : 3;
    const hits = CORPUS.filter(
      (d) => d.title.toLowerCase().includes(query) || d.body.toLowerCase().includes(query),
    )
      .slice(0, limit)
      .map((d) => ({ id: d.id, title: d.title }));
    return hits as unknown as JsonValue;
  },
};

const getDoc: McpToolHandler = {
  spec: {
    name: 'get_doc',
    description: 'Fetch one document body by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The document id' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  run(args: JsonObject): JsonValue {
    const doc = CORPUS.find((d) => d.id === args.id);
    if (!doc) throw new Error(`no document with id "${String(args.id)}"`);
    return doc.body;
  },
};

/** Build a fresh demo server (fresh so tests never share mutable state). */
export function createDemoServer(): McpServer {
  return new McpServer({
    name: 'docs-server',
    tools: [searchDocs, getDoc],
    resources: [
      {
        uri: 'docs://index',
        name: 'Documentation index',
        description: 'The list of available documents.',
        read: () => CORPUS.map((d) => `${d.id}: ${d.title}`).join('\n'),
      },
    ],
    prompts: [
      { name: 'explain_like_five', description: 'Explain a document in plain language.' },
    ],
  });
}

/** The tool call the visualization walks through: the model asks to search the docs. */
export const DEMO_TOOL_CALL: ToolCall = {
  id: 'call_1',
  toolName: 'search_docs',
  arguments: { query: 'mcp' },
};
