/**
 * Argus API Client — connects mobile/desktop apps to the Argus CLI backend.
 * All AI logic, memory, RAG, tools, sessions run on the server.
 */

import type { AgentSettings, ChatCompletionResult, MemoryEntry, Skill, TokenUsage } from '../types';

// Default backend URL; can be overridden per-call
let _baseUrl = 'http://localhost:3456';

export const setBaseUrl = (url: string) => { _baseUrl = url.replace(/\/+$/, ''); };
export const getBaseUrl = () => _baseUrl;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${_baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }

  const data = await res.json();
  if (!data.ok) throw new ApiError(res.status, data.error || 'Unknown error');
  return data.data as T;
}

// ─── Chat ───

export type ChatResult = {
  text: string;
  usage?: TokenUsage;
};

/** Non-streaming chat */
export const chat = async (
  sessionId: string,
  message: string,
): Promise<{ sessionId: string; response: string }> => {
  const res = await fetch(`${_baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
};

/** Streaming chat via SSE — returns collected full text */
export const chatStream = (
  sessionId: string,
  message: string,
  onToken: (token: string) => void,
): Promise<{ sessionId: string; text: string; usage?: TokenUsage }> => {
  return new Promise((resolve, reject) => {
    const url = `${_baseUrl}/chat/stream?sessionId=${encodeURIComponent(sessionId)}&message=${encodeURIComponent(message)}`;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 120000);

    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          let msg = `HTTP ${response.status}`;
          try { const d = await response.json(); msg = d.error || msg; } catch {}
          throw new Error(msg);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'token') {
                fullText += data.token;
                onToken(data.token);
              } else if (data.type === 'session') {
                // session info
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Stream error');
              } else if (data.type === 'done') {
                clearTimeout(timeout);
                resolve({ sessionId, text: fullText, usage: data.usage });
              }
            } catch (e) {
              // skip malformed lines
            }
          }
        }
        clearTimeout(timeout);
        resolve({ sessionId, text: fullText });
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
};

// ─── Sessions ───

export interface SessionSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface SessionDetail {
  id: string;
  title: string;
  messages: { id: string; role: string; content: string; createdAt: number }[];
  createdAt: number;
  updatedAt: number;
}

export const listSessions = (): Promise<{ ok: boolean; sessions: SessionSummary[] }> =>
  fetch(`${_baseUrl}/sessions`).then(r => r.json());

export const createSession = (title?: string): Promise<{ ok: boolean; sessionId: string }> =>
  fetch(`${_baseUrl}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  }).then(r => r.json());

export const getSession = (id: string): Promise<{ ok: boolean; session: SessionDetail }> =>
  fetch(`${_baseUrl}/sessions/${encodeURIComponent(id)}`).then(r => r.json());

export const addMessageToSession = (sessionId: string, role: string, content: string): Promise<{ ok: boolean; messageId: string }> =>
  fetch(`${_baseUrl}/sessions/${encodeURIComponent(sessionId)}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, content }),
  }).then(r => r.json());

// ─── Memory ───

export const listMemory = (type?: string): Promise<{ ok: boolean; entries: MemoryEntry[] }> => {
  const params = type ? `?type=${encodeURIComponent(type)}` : '';
  return fetch(`${_baseUrl}/memory${params}`).then(r => r.json());
};

export const addMemory = (key: string, value: string, type = 'fact'): Promise<{ ok: boolean }> =>
  fetch(`${_baseUrl}/memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, type }),
  }).then(r => r.json());

// ─── Stats ───

export interface StatsResponse {
  ok: boolean;
  stats: { input: number; output: number; total: number };
}

export const getStats = (): Promise<StatsResponse> =>
  fetch(`${_baseUrl}/stats`).then(r => r.json());

// ─── Health ───

export const health = (): Promise<{ ok: boolean; model: string }> =>
  fetch(`${_baseUrl}/health`).then(r => r.json());

// ─── Config (runtime) ───

export const getConfig = (): Promise<{ baseUrl: string; model: string; apiKeySet: boolean; port: number }> =>
  fetch(`${_baseUrl}/config`).then(r => r.json());

export const setConfig = (cfg: { model?: string; baseUrl?: string; apiKey?: string }): Promise<{ ok: boolean }> =>
  fetch(`${_baseUrl}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  }).then(r => r.json());
