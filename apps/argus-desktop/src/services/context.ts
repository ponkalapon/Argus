import { ChatCompletionMessage } from '../types';

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-5': 128000,
  'gpt-5.4': 128000,
  'claude-3-haiku': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-opus': 200000,
  'claude-3.5-sonnet': 200000,
  'claude-3.5-haiku': 200000,
  'claude-4-sonnet': 200000,
  'claude-4-opus': 200000,
  'claude-sonnet-4': 200000,
  'gemini-1.5-pro': 1048576,
  'gemini-1.5-flash': 1048576,
  'gemini-2.0-flash': 1048576,
  'gemma-2-2b': 8192,
  'gemma-2-9b': 8192,
  'gemma-2-27b': 8192,
  'llama-3.1-8b': 131072,
  'llama-3.1-70b': 131072,
  'llama-3.1-405b': 131072,
  'llama-3.2-3b': 131072,
  'llama-3.3-70b': 131072,
  'mixtral-8x7b': 32768,
  'mixtral-8x22b': 65536,
  'mistral-large': 131072,
  'deepseek-v2': 128000,
  'deepseek-v3': 128000,
  'deepseek-r1': 128000,
  'qwen-2.5-7b': 32768,
  'qwen-2.5-32b': 32768,
  'qwen-2.5-72b': 32768,
  'qwen-3': 131072,
  'qwen-3.5': 131072,
  'phi-3': 128000,
  'phi-4': 128000,
};

const DEFAULT_CONTEXT_WINDOW = 8192;
const COMPRESSION_THRESHOLD = 0.85;
const HEAD_COUNT = 4;
const TAIL_TOKENS_RESERVE = 4000;
const MIN_COMPRESSION_SAVING = 0.10;

export const getContextWindow = (modelName: string): number => {
  const normalized = modelName.toLowerCase().trim();

  const exact = MODEL_CONTEXT_WINDOWS[normalized];
  if (exact) return exact;

  for (const [key, size] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (normalized.includes(key)) return size;
  }

  return DEFAULT_CONTEXT_WINDOW;
};

export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
};

export const estimateMessagesTokens = (messages: ChatCompletionMessage[]): number => {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content || '');
    if (msg.tool_calls) {
      total += 400;
    }
    total += 4;
  }
  return total;
};

export const shouldCompress = (
  messages: ChatCompletionMessage[],
  modelName: string,
): { needed: boolean; used: number; total: number; pct: number } => {
  const contextWindow = getContextWindow(modelName);
  const used = estimateMessagesTokens(messages);
  const pct = used / contextWindow;

  return {
    needed: pct >= COMPRESSION_THRESHOLD,
    used,
    total: contextWindow,
    pct,
  };
};

export type CompressionPlan = {
  head: ChatCompletionMessage[];
  middle: ChatCompletionMessage[];
  tail: ChatCompletionMessage[];
};

let progressiveHeadOffset = 0;

export const resetCompression = () => {
  progressiveHeadOffset = 0;
};

export const buildCompressionPlan = (messages: ChatCompletionMessage[]): CompressionPlan => {
  const effectiveHeadCount = Math.max(1, HEAD_COUNT - progressiveHeadOffset);

  if (messages.length <= effectiveHeadCount + 4) {
    return { head: messages, middle: [], tail: [] };
  }

  const head = messages.slice(0, effectiveHeadCount);

  let tailTokenBudget = TAIL_TOKENS_RESERVE;
  const tail: ChatCompletionMessage[] = [];
  for (let i = messages.length - 1; i >= effectiveHeadCount; i--) {
    const msg = messages[i];
    const tokens = estimateTokens(msg.content || '') + 4;
    if (tailTokenBudget - tokens > 0 || tail.length < 2) {
      tail.unshift(msg);
      tailTokenBudget -= tokens;
    } else {
      break;
    }
  }

  const middle = messages.slice(head.length, messages.length - tail.length);

  return { head, middle, tail };
};

export const needFlushBeforeCompress = (
  messages: ChatCompletionMessage[],
  modelName: string,
): boolean => {
  const ctx = getContextWindow(modelName);
  const used = estimateMessagesTokens(messages);
  return used >= ctx * (COMPRESSION_THRESHOLD - 0.1);
};

export const compressMessages = (
  messages: ChatCompletionMessage[],
  summary: string,
): ChatCompletionMessage[] => {
  const { head, middle, tail } = buildCompressionPlan(messages);

  if (middle.length === 0) return messages;

  const compressedTail = tail.length > 0 ? tail : [tail[tail.length - 1]].filter(Boolean);

  const summaryMsg: ChatCompletionMessage = {
    role: 'system',
    content: `[Сжатие контекста] Ранее в разговоре:\n${summary}`,
  };

  progressiveHeadOffset = Math.min(progressiveHeadOffset + 1, HEAD_COUNT - 1);

  return [...head, summaryMsg, ...compressedTail];
};

export const wasCompressionEffective = (
  beforeTokens: number,
  afterTokens: number,
): boolean => {
  if (beforeTokens <= 0) return false;
  const saving = 1 - afterTokens / beforeTokens;
  return saving >= MIN_COMPRESSION_SAVING;
};
