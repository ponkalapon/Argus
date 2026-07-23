import type { ChatCompletionMessage } from '../types';

export type ChatCompletionResponse = {
  choices?: Array<{
    message?: ChatCompletionMessage;
    delta?: Partial<ChatCompletionMessage>;
    text?: string | null;
    finish_reason?: string;
  }>;
  output_text?: string;
  error?: { message?: string; type?: string };
  message?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

export const extractTextFromJson = (data: ChatCompletionResponse) =>
  data.choices?.[0]?.message?.content ||
  data.choices?.[0]?.delta?.content ||
  data.choices?.[0]?.text ||
  data.output_text ||
  '';

export const extractToolCalls = (data: ChatCompletionResponse) =>
  data.choices?.[0]?.message?.tool_calls ||
  data.choices?.[0]?.delta?.tool_calls;

export const splitSseEvents = (buffer: string) => {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() || '';
  return { events: parts, rest };
};

export const extractSseDataLines = (event: string) =>
  event
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, '').trim())
    .filter(Boolean);

const parseSseJsonChunk = (rawData: string): ChatCompletionResponse => {
  try {
    return JSON.parse(rawData) as ChatCompletionResponse;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'parse failed';
    const preview = rawData.trim().slice(0, 160) || 'empty chunk';
    throw new Error(`Не удалось разобрать SSE chunk: ${reason}. Данные: ${preview}`);
  }
};

export const readStreamingResponse = async (response: Response, onToken: (token: string) => void) => {
  const body = response.body;
  const reader = body?.getReader?.();

  if (!reader) {
    return null;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let toolCalls: any[] = [];
  let finalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

  const handleData = (rawData: string) => {
    if (!rawData || rawData === '[DONE]') return;

    const data = parseSseJsonChunk(rawData);
    const token = extractTextFromJson(data);
    const deltaToolCalls = extractToolCalls(data);

    if (data.usage) {
      finalUsage = data.usage;
    }

    if (token) {
      fullText += token;
      onToken(token);
    }

    if (deltaToolCalls) {
      for (const call of deltaToolCalls) {
        const index = call.index ?? 0;
        if (!toolCalls[index]) {
          toolCalls[index] = { ...call, function: { ...call.function } };
        } else {
          if (call.function?.arguments) {
            toolCalls[index].function.arguments += call.function.arguments;
          }
        }
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    if (!buffer.trimStart().startsWith('data:')) continue;

    const { events, rest } = splitSseEvents(buffer);
    buffer = rest;

    for (const event of events) {
      const lines = extractSseDataLines(event);
      for (const line of lines) {
        handleData(line);
      }
    }
  }

  buffer += decoder.decode();

  const trailingEvent = buffer.trim();
  if (trailingEvent.startsWith('data:')) {
    const lines = extractSseDataLines(trailingEvent);
    for (const line of lines) {
      handleData(line);
    }
  }

  return {
    text: fullText,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: finalUsage,
  };
};

// ─── Retry wrapper ──────────────────────────────────────────────────────────
// Wraps the raw fetch call with up to 90 retries + 30 s per-attempt timeout.
// Used by openaiClient.ts instead of calling fetch() directly.

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: {
    maxRetries?: number;
    timeoutMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 90;
  const timeoutMs  = opts.timeoutMs  ?? 30000;
  let lastError!: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);

    // Merge caller signal with timeout signal
    const callerSignal = init.signal as AbortSignal | undefined;
    if (callerSignal?.aborted) throw new Error('Request aborted by caller');

    callerSignal?.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(tid);
      // 429 / 5xx — retryable; 4xx others — not retryable
      if (!response.ok && (response.status === 429 || response.status >= 500)) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (err) {
      clearTimeout(tid);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) break;
      opts.onRetry?.(attempt, lastError);
      const delay = Math.min(1000 * 2 ** (attempt - 1), 60000);
      await sleep(delay + Math.random() * 1000);
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts. Last: ${lastError.message}`);
}
