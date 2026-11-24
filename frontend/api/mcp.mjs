import { handleHttp } from './_lib/mcp.mjs';

/**
 * theinvitely.in MCP server, at https://theinvitely.in/mcp (see vercel.json).
 * Stateless Streamable HTTP: JSON-RPC over POST. The logic lives in _lib/mcp.mjs.
 */
export function POST(request) {
  return handleHttp(request);
}

export function GET(request) {
  return handleHttp(request);
}

export function OPTIONS(request) {
  return handleHttp(request);
}
