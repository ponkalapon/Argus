/**
 * MCP (Model Context Protocol) HTTP client.
 *
 * Supports MCP-over-HTTP-SSE (Anthropic spec):
 *   GET  {url}               → SSE stream or tool list (discovery)
 *   POST {url}               → invoke a tool
 *
 * Also supports the simplified "Streamable HTTP" transport:
 *   POST {url}               → { jsonrpc:"2.0", method:"tools/list" | "tools/call", ... }
 */

import { McpServer, McpToolDef, updateMcpServer } from './mcpStorage';

// ─── JSON-RPC helpers ──────────────────────────────────────────────────────

const rpc = (method: string, params?: unknown) => ({
  jsonrpc: '2.0' as const,
  id: Date.now(),
  method,
  params,
});

// ─── Discovery ─────────────────────────────────────────────────────────────

/**
 * Fetch the list of tools from an MCP server.
 * Tries JSON-RPC tools/list first, then falls back to SSE-based GET.
 */
export const discoverMcpTools = async (server: McpServer): Promise<McpToolDef[]> => {
  const url = server.url.replace(/\/$/, '');

  // Strategy 1: JSON-RPC tools/list (Streamable HTTP transport)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(rpc('tools/list')),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const tools: McpToolDef[] = data?.result?.tools ?? [];
      if (tools.length > 0) return tools;
    }
  } catch {}

  // Strategy 2: GET + parse JSON/SSE
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json, text/event-stream' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const text = await res.text();
      // Try JSON first
      try {
        const data = JSON.parse(text);
        return data?.tools ?? data?.result?.tools ?? [];
      } catch {}
      // Try SSE lines
      const lines = text.split('\n').filter((l) => l.startsWith('data:'));
      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(5).trim());
          const tools = data?.result?.tools ?? data?.tools;
          if (Array.isArray(tools) && tools.length > 0) return tools;
        } catch {}
      }
    }
  } catch {}

  return [];
};

/**
 * Ping a server and update its status in storage.
 */
export const testMcpServer = async (server: McpServer): Promise<{ ok: boolean; message: string; tools: McpToolDef[] }> => {
  try {
    const tools = await discoverMcpTools(server);
    const message = tools.length > 0
      ? `Подключено · ${tools.length} инструмент${tools.length === 1 ? '' : tools.length < 5 ? 'а' : 'ов'}`
      : 'Подключено · инструменты не найдены';
    await updateMcpServer(server.id, { status: 'ok', statusMessage: message, tools });
    return { ok: true, message, tools };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Не удалось подключиться';
    await updateMcpServer(server.id, { status: 'error', statusMessage: message, tools: [] });
    return { ok: false, message, tools: [] };
  }
};

// ─── Tool invocation ───────────────────────────────────────────────────────

/**
 * Call a specific tool on an MCP server.
 */
export const callMcpTool = async (
  server: McpServer,
  toolName: string,
  toolArgs: Record<string, unknown>,
): Promise<string> => {
  const url = server.url.replace(/\/$/, '');

  // Strategy 1: JSON-RPC tools/call
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(rpc('tools/call', { name: toolName, arguments: toolArgs })),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      const content = data?.result?.content;
      if (Array.isArray(content)) {
        return content.map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
      }
      if (typeof content === 'string') return content;
      if (data?.result) return JSON.stringify(data.result);
    }
  } catch {}

  // Strategy 2: REST-style POST to {url}/{toolName}
  try {
    const res = await fetch(`${url}/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(toolArgs),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const text = await res.text();
      try {
        return JSON.stringify(JSON.parse(text));
      } catch {
        return text;
      }
    }
  } catch {}

  throw new Error(`MCP сервер "${server.name}": не удалось выполнить инструмент "${toolName}"`);
};

// ─── Build OpenAI-compatible tool definitions ──────────────────────────────

export const mcpToolsToOpenAI = (server: McpServer): any[] => {
  if (!server.enabled || !server.tools?.length) return [];
  return server.tools.map((tool) => ({
    type: 'function',
    function: {
      name: `mcp__${server.id}__${tool.name}`,
      description: `[MCP: ${server.name}] ${tool.description}`,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    },
  }));
};

/**
 * Try to execute a tool call that starts with "mcp__".
 * Returns null if the tool name doesn't match MCP format.
 */
export const tryExecuteMcpTool = async (
  toolName: string,
  toolArgs: Record<string, unknown>,
  servers: McpServer[],
): Promise<string | null> => {
  if (!toolName.startsWith('mcp__')) return null;

  const parts = toolName.split('__');
  // Format: mcp__{serverId}__{toolName}
  // Note: serverId itself may contain underscores so we split carefully
  if (parts.length < 3) return null;

  const serverId = parts.slice(1, -1).join('__');
  const mcpToolName = parts[parts.length - 1];

  const server = servers.find((s) => s.id === serverId && s.enabled);
  if (!server) return `Ошибка: MCP сервер "${serverId}" не найден или отключён.`;

  try {
    return await callMcpTool(server, mcpToolName, toolArgs);
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка выполнения MCP инструмента';
  }
};
