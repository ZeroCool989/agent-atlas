/**
 * The transport is the pipe an envelope travels down. Real MCP defines two: stdio (the
 * client spawns the server as a subprocess and they exchange JSON-RPC over stdin/stdout)
 * and HTTP (the server is a remote endpoint). Both carry the SAME envelope — the transport
 * is interchangeable, which is the point.
 *
 * This toy uses an in-process transport: no socket, no subprocess, just a function call.
 * To keep the teaching honest that everything crossing the boundary must be JSON, we
 * round-trip the envelope through `JSON.parse(JSON.stringify(...))` — a non-serializable
 * value would break here exactly as it would over a real wire. The optional `onExchange`
 * hook is where an audit log or an egress monitor would sit (see the governance section).
 */
import type { RpcRequest, RpcResponse } from './protocol';
import type { McpServer } from './server';

export interface Transport {
  /** Carry a request to the server and bring back its response. */
  send(request: RpcRequest): RpcResponse;
}

/** A recorder for every request/response pair that crosses the transport. */
export type ExchangeObserver = (request: RpcRequest, response: RpcResponse) => void;

export class InProcessTransport implements Transport {
  readonly #server: McpServer;
  readonly #onExchange?: ExchangeObserver;

  constructor(server: McpServer, onExchange?: ExchangeObserver) {
    this.#server = server;
    this.#onExchange = onExchange;
  }

  send(request: RpcRequest): RpcResponse {
    // The serialization boundary — proves the envelope is plain JSON in both directions.
    const onWire = JSON.parse(JSON.stringify(request)) as RpcRequest;
    const response = JSON.parse(JSON.stringify(this.#server.handle(onWire))) as RpcResponse;
    this.#onExchange?.(onWire, response);
    return response;
  }
}
