/**
 * Scene builder for the MCP handshake visual (ADR-0004, plan §8 Tier 2). Pure data:
 * `() => Scene[]`, no React/Astro/timers. Every envelope shown is the REAL output of the
 * in-memory toy in `src/lib/mcp` — a recording transport captures each request/response
 * pair, so the picture can never drift from the protocol code.
 *
 * The story in seven steps: a host with a client on one side and a server on the other →
 * the client connects (initialize) → discovers the tool manifest (tools/list) → the model
 * selects a tool → the client invokes it over the envelope (tools/call) → the server
 * returns → the result maps back into the agent's tool-result and re-enters the loop.
 * The load-bearing point the visual makes: the standardized envelope is the same shape at
 * every hop, and once discovered, an MCP tool is just an ordinary tool-call.
 */
import {
  createDemoServer,
  DEMO_TOOL_CALL,
  InProcessTransport,
  McpClient,
  type RpcRequest,
  type RpcResponse,
} from '../mcp';
import type { TokenState } from './types';

export type EnvelopeDirection = 'client-to-server' | 'server-to-client' | 'internal';

export interface EnvelopeView {
  readonly label: string;
  readonly direction: EnvelopeDirection;
  /** Pretty-printed JSON — the standardized message at this hop. */
  readonly json: string;
}

export interface HandshakeRow {
  readonly index: number;
  readonly label: string;
  readonly state: TokenState;
}

export interface McpHandshakeScene {
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  readonly description: string;
  /** Who acts at this step — drives the actor badge. */
  readonly actor: 'host' | 'client' | 'model' | 'server' | 'agent-loop';
  readonly envelopes: readonly EnvelopeView[];
  /** Tools the client has discovered so far (revealed after tools/list). */
  readonly discoveredTools: readonly string[];
  readonly rows: readonly HandshakeRow[];
}

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const ROW_LABELS = [
  'Host + client on one side, server on the other',
  'Client connects (initialize)',
  'Client discovers tools (tools/list)',
  'Model selects a tool',
  'Client invokes (tools/call)',
  'Server returns the result',
  'Result enters the agent loop',
] as const;

function rowsAt(current: number): HandshakeRow[] {
  return ROW_LABELS.map((label, index) => ({
    index,
    label,
    state: index < current ? 'completed' : index === current ? 'active' : 'inactive',
  }));
}

export function buildMcpHandshakeScenes(): McpHandshakeScene[] {
  // Drive the real toy, recording every exchange so the envelopes below are genuine.
  const server = createDemoServer();
  const log: Array<{ request: RpcRequest; response: RpcResponse }> = [];
  const transport = new InProcessTransport(server, (request, response) =>
    log.push({ request, response }),
  );
  const client = new McpClient(transport);

  const init = client.initialize(); // log[0]
  const tools = client.listTools(); // log[1]
  const toolResult = client.callTool(DEMO_TOOL_CALL); // log[2]

  const [initEx, listEx, callEx] = log;
  const toolNames = tools.map((t) => t.name);
  const totalSteps = ROW_LABELS.length;
  const scene = (
    step: number,
    props: Omit<McpHandshakeScene, 'step' | 'totalSteps' | 'rows'>,
  ): McpHandshakeScene => ({ step, totalSteps, rows: rowsAt(step), ...props });

  return [
    scene(0, {
      title: 'Two sides, one protocol',
      description:
        'The host application holds an MCP client; the server (its own process, written once by whoever owns the integration) holds the tools. Nothing has crossed the wire yet. MCP is the agreement about what will.',
      actor: 'host',
      envelopes: [],
      discoveredTools: [],
    }),
    scene(1, {
      title: 'Client connects — initialize',
      description: `The client opens the connection and negotiates a protocol version. The server answers with its capabilities: tools ${init.capabilities.tools}, resources ${init.capabilities.resources}, prompts ${init.capabilities.prompts}. This is pure plumbing — no model involved yet.`,
      actor: 'client',
      envelopes: [
        { label: 'request: initialize', direction: 'client-to-server', json: pretty(initEx!.request) },
        { label: 'response: capabilities', direction: 'server-to-client', json: pretty(initEx!.response) },
      ],
      discoveredTools: [],
    }),
    scene(2, {
      title: 'Discovery — tools/list',
      description: `The client asks what tools exist and gets back a manifest of ${toolNames.length}: ${toolNames.join(', ')}. Each tool arrives with a JSON-Schema input — the exact shape the model already reads for native tool-calling. The client wrote no code specific to this server to learn any of it.`,
      actor: 'client',
      envelopes: [
        { label: 'request: tools/list', direction: 'client-to-server', json: pretty(listEx!.request) },
        { label: 'response: tool manifest', direction: 'server-to-client', json: pretty(listEx!.response) },
      ],
      discoveredTools: toolNames,
    }),
    scene(3, {
      title: 'The model selects a tool',
      description:
        'The discovered tools are handed to the model as ordinary tool definitions. The model does what it always does — it emits a tool call. It has no idea MCP exists; to it this is plain tool-calling. This is the honest heart of MCP: it is not a new capability.',
      actor: 'model',
      envelopes: [
        { label: 'model output: ToolCall', direction: 'internal', json: pretty(DEMO_TOOL_CALL) },
      ],
      discoveredTools: toolNames,
    }),
    scene(4, {
      title: 'Client invokes — tools/call',
      description:
        'The client wraps the model’s tool call in the same JSON-RPC envelope and sends it to the server. Note the shape is identical to initialize and tools/list — one envelope carries every operation, which is what lets one server serve any client.',
      actor: 'client',
      envelopes: [
        { label: 'request: tools/call', direction: 'client-to-server', json: pretty(callEx!.request) },
      ],
      discoveredTools: toolNames,
    }),
    scene(5, {
      title: 'Server returns the result',
      description:
        'The server runs its handler and returns the output as content blocks with an isError flag. A tool that fails would come back here as isError: true — a normal result, distinct from a protocol error like an unknown method. This result was computed by the toy server, not scripted.',
      actor: 'server',
      envelopes: [
        { label: 'response: tool result', direction: 'server-to-client', json: pretty(callEx!.response) },
      ],
      discoveredTools: toolNames,
    }),
    scene(6, {
      title: 'Back into the agent loop',
      description:
        'The client maps the protocol result into the agent’s own ToolResultMessage — the same observation type a hardcoded tool would produce. MCP disappears; the agent loop continues exactly as in the tool-calling lesson. The protocol was plumbing from start to finish.',
      actor: 'agent-loop',
      envelopes: [
        { label: 'mapped: ToolResultMessage', direction: 'internal', json: pretty(toolResult) },
      ],
      discoveredTools: toolNames,
    }),
  ];
}
