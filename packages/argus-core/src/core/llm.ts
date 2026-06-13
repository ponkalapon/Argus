import { AgentSettings, ChatCompletionMessage, ChatCompletionResult, ToolDefinition } from '../types.js';
import { withRetry } from './retry.js';

export interface LLMOptions {
  settings: AgentSettings;
  apiKey: string;
  messages: ChatCompletionMessage[];
  onToken?: (token: string) => void;
  tools?: ToolDefinition[];
  signal?: AbortSignal;
  /** Max retry attempts (default 90) */
  maxRetries?: number;
  /** Per-attempt timeout ms (default 30000) */
  timeoutMs?: number;
  /** Called on each retry attempt */
  onRetry?: (attempt: number, error: Error) => void;
}

export class LLMClient {
  /** Send a chat completion request with automatic retry (up to 90 attempts) */
  async chat(opts: LLMOptions): Promise<ChatCompletionResult> {
    // If caller already has a signal (e.g. user cancel) — honour it by not wrapping
    if (opts.signal) {
      return this._doRequest(opts, opts.signal);
    }

    return withRetry(
      (signal) => this._doRequest(opts, signal),
      {
        maxRetries: opts.maxRetries ?? 90,
        timeoutMs:  opts.timeoutMs  ?? 30000,
        onRetry:    opts.onRetry,
      },
    );
  }

  private async _doRequest(opts: LLMOptions, signal: AbortSignal): Promise<ChatCompletionResult> {
    const { settings, apiKey, messages, onToken, tools } = opts;

    const body: Record<string, unknown> = {
      model:    settings.model,
      messages,
      stream:   onToken ? true : false,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const baseUrl = settings.baseUrl.replace(/\/+$/, '');
    const url = baseUrl.includes('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(baseUrl.includes('openrouter') ? { 'HTTP-Referer': 'https://argus-cli.local', 'X-Title': 'Argus CLI' } : {}),
      },
      body:   JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`LLM API error ${response.status}: ${errText}`);
    }

    if (onToken) {
      return this.handleStream(response, onToken);
    }
    return this.handleResponse(response);
  }

  private async handleResponse(response: Response): Promise<ChatCompletionResult> {
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?:   { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const text  = data.choices?.[0]?.message?.content || '';
    const usage = data.usage
      ? { input: data.usage.prompt_tokens || 0, output: data.usage.completion_tokens || 0, total: data.usage.total_tokens || 0 }
      : undefined;

    return { text, usage };
  }

  private async handleStream(response: Response, onToken: (token: string) => void): Promise<ChatCompletionResult> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');

    const decoder = new TextDecoder();
    let fullText     = '';
    let inputTokens  = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
              usage?:   { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { fullText += content; onToken(content); }
            if (parsed.usage) {
              inputTokens  = parsed.usage.prompt_tokens  || 0;
              outputTokens = parsed.usage.completion_tokens || 0;
            }
          } catch { /* skip malformed JSON */ }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      text:  fullText,
      usage: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    };
  }
}
