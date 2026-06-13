import * as http from 'node:http';
import { ArgusCore } from '../core/index.js';
import { ChatMessage } from '../types.js';
import { SessionExporter } from '../core/sessionExport.js';

/**
 * HTTP API Server for Argus Core.
 * Allows mobile/desktop apps to communicate with the core.
 *
 * Endpoints:
 *   GET  /health          - Health check
 *   POST /chat            - Send message (non-streaming)
 *   GET  /chat/stream     - SSE streaming chat
 *   GET  /sessions        - List sessions
 *   POST /sessions        - Create session
 *   GET  /sessions/:id    - Get session details
 *   POST /sessions/:id/message - Add message
 *   GET  /memory          - List/search memory
 *   POST /memory          - Add memory
 *   GET  /stats           - Token stats
 *   POST /config          - Update config
 */

export function startApiServer(core: ArgusCore): void {
  const port = core.settings.port;

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const path = url.pathname;
    const method = req.method || 'GET';

    try {
      // ─── Health ───
      if (path === '/health' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, model: core.settings.model, uptime: process.uptime() }));
        return;
      }

      // ─── Config ───
      if (path === '/config' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          baseUrl: core.settings.baseUrl,
          model: core.settings.model,
          apiKeySet: !!core.settings.apiKey,
          port: core.settings.port,
        }));
        return;
      }

      if (path === '/config' && method === 'POST') {
        const body = await readBody(req);
        const data = JSON.parse(body);
        if (data.model) core.settings.model = data.model;
        if (data.baseUrl) core.settings.baseUrl = data.baseUrl;
        if (data.apiKey) core.settings.apiKey = data.apiKey;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // ─── Chat (non-streaming) ───
      if (path === '/chat' && method === 'POST') {
        const body = await readBody(req);
        const data = JSON.parse(body);
        const sessionId = data.sessionId || core.sessions.create();
        const message = String(data.message || '');

        if (!message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Message is required' }));
          return;
        }

        const response = await core.chat(sessionId, message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, sessionId, response }));
        return;
      }

      // ─── Chat Streaming (SSE) ───
      if (path === '/chat/stream' && method === 'GET') {
        const sessionId = url.searchParams.get('sessionId') || core.sessions.create();
        const message = url.searchParams.get('message') || '';

        if (!message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'message query param is required' }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        // Add user message
        core.sessions.addMessage(sessionId, 'user', message);

        // Build context
        const systemPrompt = await core.soul.buildSystemPrompt();
        const contextMessages = core.sessions.getContextMessages(sessionId, systemPrompt, 30);

        const ragContext = await core.rag.buildContext(message);
        if (ragContext) {
          contextMessages.push({
            role: 'system' as const,
            content: `Relevant context from knowledge base:\n${ragContext}`,
          });
        }

        // Send session info
        res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

        let fullText = '';
        try {
          const result = await core.llm.chat({
            settings: { baseUrl: core.settings.baseUrl, model: core.settings.model, allowAssistantContacts: true },
            apiKey: core.settings.apiKey,
            messages: contextMessages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
            tools: core.tools.getDefinitions(),
            onToken: (token) => {
              fullText += token;
              res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
            },
          });

          // Save to session
          core.sessions.addMessage(sessionId, 'assistant', result.text);

          if (result.usage) {
            core.tokenStats.record(sessionId, result.usage.input, result.usage.output);
          }

          // Auto-title
          const session = core.sessions.get(sessionId);
          if (session && session.messages.length <= 2) {
            const title = message.length > 50 ? message.slice(0, 50) + '…' : message;
            core.sessions.rename(sessionId, title);
          }

          res.write(`data: ${JSON.stringify({ type: 'done', usage: result.usage })}\n\n`);
        } catch (err) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: err instanceof Error ? err.message : 'Unknown error' })}\n\n`);
        }

        res.end();
        return;
      }

      // ─── Sessions ───
      if (path === '/sessions' && method === 'GET') {
        const sessions = core.sessions.list();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, sessions }));
        return;
      }

      if (path === '/sessions' && method === 'POST') {
        const body = await readBody(req);
        const data = body ? JSON.parse(body) : {};
        const id = core.sessions.create(data.title);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, sessionId: id }));
        return;
      }

      // ─── Session by ID ───
      const sessionMatch = path.match(/^\/sessions\/(.+)$/);
      if (sessionMatch) {
        const sessionId = sessionMatch[1];

        if (method === 'GET') {
          const session = core.sessions.get(sessionId);
          if (!session) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Session not found' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, session }));
          return;
        }

        if (method === 'POST' && path.endsWith('/message')) {
          const body = await readBody(req);
          const data = JSON.parse(body);
          const msg = core.sessions.addMessage(sessionId, data.role || 'user', String(data.content || ''));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, messageId: msg }));
          return;
        }
      }

      // ─── Memory ───
      if (path === '/memory' && method === 'GET') {
        const type = url.searchParams.get('type') || undefined;
        const entries = core.memory.list(type);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, entries }));
        return;
      }

      if (path === '/memory' && method === 'POST') {
        const body = await readBody(req);
        const data = JSON.parse(body);
        core.memory.set(data.key, data.value, data.type || 'fact');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // ─── Stats ───
      if (path === '/stats' && method === 'GET') {
        const total = core.tokenStats.getTotalStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, stats: total }));
        return;
      }

      // ─── Export ───
      if (path === '/export' && method === 'GET') {
        const exporter = new SessionExporter(core.db, core.memory, core.sessions);
        const json = exporter.toJson();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(json);
        return;
      }

      if (path === '/import' && method === 'POST') {
        const body = await readBody(req);
        const exporter = new SessionExporter(core.db, core.memory, core.sessions);
        const result = exporter.importFromJson(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, imported: result }));
        return;
      }

      // ─── 404 ───
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Not found' }));

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Internal error' }));
    }
  });

  server.listen(port, () => {
    console.log(`\n${'[API]'} Argus API server running on http://localhost:${port}`);
    console.log(`${'[API]'} Endpoints:`);
    console.log(`${'[API]'}   GET  /health`);
    console.log(`${'[API]'}   POST /chat`);
    console.log(`${'[API]'}   GET  /chat/stream?sessionId=X&message=hello`);
    console.log(`${'[API]'}   GET  /sessions`);
    console.log(`${'[API]'}   POST /sessions`);
    console.log(`${'[API]'}   GET  /sessions/:id`);
    console.log(`${'[API]'}   POST /sessions/:id/message`);
    console.log(`${'[API]'}   GET  /memory`);
    console.log(`${'[API]'}   POST /memory`);
    console.log(`${'[API]'}   GET  /stats`);
    console.log(`${'[API]'}   GET  /export`);
    console.log(`${'[API]'}   POST /import`);
    console.log(`\n${'[API]'} Press Ctrl+C to stop\n`);
  });
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}
