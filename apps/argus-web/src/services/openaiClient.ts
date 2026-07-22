import { getSoul, updateSoul } from './soul';
import { listSkills } from './skills';
import { searchMemory } from './memory';
import { TOOL_DEFINITIONS, executeTool } from './tools';
import { workspaceSummary } from './workspace';
import {
  AgentSettings,
  ChatCompletionContext,
  ChatCompletionMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionResult,
} from '../types';

const MAX_ITERATIONS = 100;
const MAX_CONTEXT_TOKENS = 12000;
const MEMORY_NUDGE_INTERVAL = 3;

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

export const normalizeBaseUrl = (baseUrl: string) => {
  let trimmed = trimTrailingSlashes(baseUrl.trim());

  if (!trimmed) {
    throw new Error('Укажи Base URL в настройках.');
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Base URL должен начинаться с http:// или https://.');
  }

  if (trimmed.toLowerCase().endsWith('/v1')) {
    trimmed = trimTrailingSlashes(trimmed.slice(0, -3));
  }

  return trimmed;
};

const formatMemoryContext = (items: { key: string; value: string }[]) => {
  if (items.length === 0) return '';
  const lines = items.map((i) => `- [${i.key}]: ${i.value}`);
  return `### Сохранённая память (учитывай это):\n${lines.join('\n')}`;
};

const formatSkillIndex = (skills: { name: string; description: string }[]) => {
  if (skills.length === 0) return '';
  const lines = skills.map((s) => `- ${s.name}: ${s.description}`);
  return `### Доступные навыки (используй use_skill если применимо):\n${lines.join('\n')}`;
};

const buildSystemPrompt = async (userMessage: string, context?: ChatCompletionContext) => {
  const soul = await getSoul();

  let finalPrompt = soul;

  const [memoryItems, skills] = await Promise.all([
    searchMemory(userMessage),
    listSkills(),
  ]);

  const memoryContext = formatMemoryContext(memoryItems);
  const skillIndex = formatSkillIndex(skills);

  if (memoryContext) {
    finalPrompt += `\n\n══════════════════════════════════════════════\n${memoryContext}\n══════════════════════════════════════════════`;
  }

  if (skillIndex) {
    finalPrompt += `\n\n${skillIndex}`;
  }

  const nowStr = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  finalPrompt += `\n\n## ТЕКУЩЕЕ ВРЕМЯ И ДАТА\nСегодня: ${nowStr}. Всегда используй настоящую свежую информацию.`;

  if (context?.internetEnabled) {
    try {
      const { webSearch } = await import('./webSearch');
      const searchQuery = userMessage.trim() || 'новости';
      const searchRes = await webSearch(searchQuery);
      if (searchRes.results && searchRes.results.length > 0) {
        const searchCtx = searchRes.results
          .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
          .join('\n\n');
        finalPrompt += `\n\n══════════════════════════════════════════════\n## СВЕЖИЕ РЕЗУЛЬТАТЫ ЖИВОГО ИНТЕРНЕТ-ПОИСКА (ОТ ${nowStr}):\n${searchCtx}\n══════════════════════════════════════════════\nОпирайся на эти живые результаты из интернета. Отвечай подробно и актуально.`;
      }
    } catch {}
  }

  finalPrompt += '\n\n## СОХРАНЕНИЕ НАВЫКОВ\nКогда пользователь просит запомнить, создать или сохранить навык (skill), ты ОБЯЗАН использовать инструмент save_skill({ name, description, pattern, triggerKeywords }).';

  return finalPrompt;
};

export const getEstimatedSystemPromptTokens = async (userMessage: string, context?: ChatCompletionContext): Promise<number> => {
  try {
    const prompt = await buildSystemPrompt(userMessage, context);
    return estimateTokens(prompt);
  } catch {
    return 1500; // safe default fallback
  }
};

const parseJsonOrSsePayload = (rawText: string): ChatCompletionResponse => {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error('API ответил пустым телом.');
  }

  if (!trimmed.startsWith('data:')) {
    return JSON.parse(trimmed) as ChatCompletionResponse;
  }

  const chunks = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, '').trim())
    .filter((line) => line && line !== '[DONE]');

  let fullText = '';
  let lastJson: ChatCompletionResponse | null = null;

  for (const chunk of chunks) {
    try {
      const data = JSON.parse(chunk) as ChatCompletionResponse;
      lastJson = data;
      fullText += extractTextFromJson(data);
    } catch {}
  }

  if (fullText.trim()) {
    return {
      choices: [{ message: { role: 'assistant', content: fullText.trim() } }],
      usage: lastJson?.usage,
    };
  }

  if (lastJson) return lastJson;

  throw new Error('Не удалось извлечь содержимое из SSE ответа.');
};

const extractTextFromJson = (data: ChatCompletionResponse): string => {
  const choice = data.choices?.[0];
  if (!choice) return '';

  if (choice.message?.content) {
    return choice.message.content;
  }

  if (choice.delta?.content) {
    return choice.delta.content;
  }

  return '';
};

const extractToolCalls = (data: ChatCompletionResponse): any[] | undefined => {
  const choice = data.choices?.[0];
  if (!choice) return undefined;

  return choice.message?.tool_calls || choice.delta?.tool_calls;
};

const parseResponsePayload = async (response: Response): Promise<ChatCompletionResponse> => {
  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (trimmed.startsWith('<')) {
    throw new Error(`Сервер (код ${response.status}) вернул HTML-страницу вместо JSON. Проверь API ключ и Base URL в настройках.`);
  }

  try {
    return parseJsonOrSsePayload(trimmed);
  } catch (error) {
    const preview = trimmed.slice(0, 160) || 'empty body';
    const reason = error instanceof Error ? error.message : 'parse failed';
    throw new Error(`Не удалось разобрать ответ API: ${reason}. Начало ответа: ${preview}`);
  }
};

const parseErrorMessage = async (response: Response) => {
  const status = response.status;
  const statusText = response.statusText;
  const rawText = await response.text().catch(() => '');
  const trimmed = rawText.trim();

  if (trimmed.startsWith('<')) {
    return `Ошибка сервера (${status} ${statusText || 'Error'}): Сервер вернул HTML-страницу вместо JSON. Проверь API ключ и Base URL в настройках.`;
  }

  try {
    const data = JSON.parse(trimmed);
    return data.error?.message || data.message || `Код ошибки ${status}: ${trimmed.slice(0, 150)}`;
  } catch {
    return `Код ошибки ${status} (${statusText || 'Error'}): ${trimmed.slice(0, 150) || 'Пустой ответ'}`;
  }
};

const createHeaders = (apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };

  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  return headers;
};

const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retries = 2,
  delayMs = 1000,
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) {
        return res;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }

    if (i < retries) {
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }

  throw lastError || new Error('Network request failed');
};

const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

const estimateMessagesTokens = (messages: ChatCompletionMessage[]): number => {
  return messages.reduce((acc, m) => acc + estimateTokens(m.content || ''), 0);
};

const shouldCompress = (
  messages: ChatCompletionMessage[],
  model: string,
): { needed: boolean; totalTokens: number } => {
  const totalTokens = estimateMessagesTokens(messages);
  return {
    needed: totalTokens > MAX_CONTEXT_TOKENS,
    totalTokens,
  };
};

const buildCompressionPlan = (messages: ChatCompletionMessage[]) => {
  if (messages.length <= 4) {
    return { head: messages, middle: [], tail: [] };
  }

  const head = messages.slice(0, 1);
  const tail = messages.slice(-3);
  const middle = messages.slice(1, -3);

  return { head, middle, tail };
};

const summarizeMiddle = async (
  messages: ChatCompletionMessage[],
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<string> => {
  const { head, middle, tail } = buildCompressionPlan(messages);

  if (middle.length === 0) return '';

  const summaryMessages = [
    {
      role: 'system' as const,
      content:
        'Твоя задача — кратко пересказать диалог ниже. ' +
        'Выдели: (1) ключевые решения, (2) важные факты, (3) что осталось сделать. ' +
        'Не добавляй отсебятину. Пиши на том же языке, что и диалог. Будь максимально сжат.',
    },
    {
      role: 'user' as const,
      content: middle.map((m) => `[${m.role}]: ${m.content || ''}`).join('\n'),
    },
  ];

  const response = await fetchWithRetry(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: createHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: summaryMessages,
      max_tokens: 1024,
      temperature: 0.3,
      stream: false,
    }),
  }).catch(() => null);

  if (!response || !response.ok) {
    return '';
  }

  const data = await parseResponsePayload(response.clone()).catch(() => null);
  if (!data) return '';
  return extractTextFromJson(data).trim();
};

export const requestChatCompletion = async ({
  settings,
  apiKey,
  messages,
  context,
  onToken,
  tools,
}: ChatCompletionRequest): Promise<ChatCompletionResult> => {
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const model = settings.model.trim();

  if (!model) {
    throw new Error('Укажи название модели в настройках.');
  }

  let currentMessages = [...messages];
  let iterationCount = 0;

  const userContent = messages.map((m) => m.content || '').join(' ');

  const [workspaceCtx] = await Promise.all([
    context?.workspaceId
      ? workspaceSummary(context.workspaceId).catch(() => '')
      : Promise.resolve(''),
  ]);

  const extendedCtx: ChatCompletionContext = {
    ...context,
    workspaceContext: workspaceCtx
      ? `Текущая рабочая область (workspace):\n${workspaceCtx}\n\nИНСТРУКЦИЯ: Когда пользователь просит создать код, приложение, проект или любые файлы — обязательно используй workspace_write_file для сохранения файлов в рабочую область. Для многофайловых проектов создавай полноценную структуру (папки, package.json, конфиги, исходники). Пиши код сразу в файлы через workspace_write_file, а не просто показывай его в чате.`
      : undefined,
  };

  const systemPrompt = await buildSystemPrompt(userContent, extendedCtx);

  while (iterationCount < MAX_ITERATIONS) {
    iterationCount++;

    const shouldNudge =
      iterationCount > 1 &&
      iterationCount % MEMORY_NUDGE_INTERVAL === 0;

    const compressInfo = shouldCompress(currentMessages, model);

    let nudgeOrFlushMessages = currentMessages;

    if (compressInfo.needed) {
      const summaryText = await summarizeMiddle(
        currentMessages,
        baseUrl,
        apiKey,
        model,
      );

      const { head, tail } = buildCompressionPlan(currentMessages);

      const compressedMessages: ChatCompletionMessage[] = [
        ...head,
        {
          role: 'system' as const,
          content: summaryText
            ? `[Автосжатие контекста] Краткая выжимка предыдущего общения:\n${summaryText}`
            : '[Автосжатие контекста] Часть истории сжата.',
        },
        ...tail,
      ];

      currentMessages = compressedMessages;

      nudgeOrFlushMessages = [
        ...currentMessages,
        {
          role: 'system' as const,
          content:
            '[Context Warning] Контекст приближается к лимиту. Если в этом разговоре есть важная информация — сохрани её через remember_fact или remember_preference СЕЙЧАС. Затем я сожму контекст.',
        },
      ];
    } else if (shouldNudge && !compressInfo.needed) {
      nudgeOrFlushMessages = [
        ...currentMessages,
        {
          role: 'system' as const,
          content:
            '[Memory Nudge] Если появилась важная информация обо мне, проектах или предпочтениях — сохрани через remember_fact или remember_preference.',
        },
      ];
    }

    const response = await fetchWithRetry(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: createHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...nudgeOrFlushMessages,
        ],
        temperature: 0.7,
        max_tokens: 4096,
        max_output_tokens: 4096,
        stream: Boolean(onToken),
        tools: tools || TOOL_DEFINITIONS,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response.clone()));
    }

    let text = '';
    let toolCalls: any[] | undefined;
    let streamUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

    if (onToken) {
      const clonedResponse = response.clone();
      const streamResult = await readStreamingResponse(response, onToken);
      if (!streamResult) {
        const data = await parseResponsePayload(clonedResponse);
        text = extractTextFromJson(data);
        toolCalls = extractToolCalls(data);
        streamUsage = data.usage;
      } else {
        text = streamResult.text;
        toolCalls = streamResult.toolCalls;
        streamUsage = streamResult.usage;
      }
    } else {
      const data = await parseResponsePayload(response.clone());
      text = extractTextFromJson(data);
      toolCalls = extractToolCalls(data);
      streamUsage = data.usage;
    }

    if (!toolCalls || toolCalls.length === 0) {
      if (!text.trim() && !toolCalls) {
        throw new Error('API ответил без текста. Проверь совместимость модели с /v1/chat/completions.');
      }
      // Auto-detect if model declared creating/saving a skill in text
      try {
        const skillMatch = /(?:навык|skill)\s+[`"']?([a-z0-9_\-а-я]+)[`"']?\s+(?:успешно\s+)?(?:сохранен|сохранён|создан|сохраненный)/i.exec(text);
        if (skillMatch && skillMatch[1]) {
          const skillName = skillMatch[1].trim();
          const { saveSkill } = await import('./skills');
          await saveSkill({
            name: skillName,
            description: `Навык ${skillName}, сохранённый во время диалога`,
            pattern: text,
            triggerKeywords: [skillName.toLowerCase()],
          });
        }
      } catch {}

      return {
        text: text.trim(),
        usage: streamUsage ? { input: streamUsage.prompt_tokens, output: streamUsage.completion_tokens, total: streamUsage.total_tokens } : undefined,
      };
    }

    currentMessages.push({
      role: 'assistant',
      content: text,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const functionName = toolCall.function?.name;
      const argsRaw = toolCall.function?.arguments || '{}';
      let args: any = {};

      try {
        args = JSON.parse(argsRaw);
      } catch {
        args = {};
      }

      let toolResult = '';
      try {
        toolResult = await executeTool(functionName, args, extendedCtx);
      } catch (err) {
        toolResult = `Ошибка выполнения инструмента ${functionName}: ${err instanceof Error ? err.message : String(err)}`;
      }

      currentMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: functionName,
        content: toolResult,
      });
    }
  }

  throw new Error('Достигнут лимит итераций выполнения инструментов.');
};

const readStreamingResponse = async (
  response: Response,
  onToken: (token: string) => void,
): Promise<{ text: string; toolCalls?: any[]; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } } | null> => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') && !contentType.includes('application/x-ndjson')) {
    return null;
  }

  if (!response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  const toolCallsAcc: Map<number, { id?: string; name?: string; arguments: string }> = new Map();
  let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      if (fullText.length === 0 && buffer.trim().startsWith('<')) {
        return null;
      }

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.replace(/^data:\s*/, '').trim();
        if (dataStr === '[DONE]') break;

        try {
          const json = JSON.parse(dataStr);

          if (json.usage) {
            usage = json.usage;
          }

          const choice = json.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;
          if (delta?.content) {
            fullText += delta.content;
            onToken(delta.content);
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const existing = toolCallsAcc.get(idx) || { arguments: '' };
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              toolCallsAcc.set(idx, existing);
            }
          }
        } catch {}
      }
    }
  } catch {
    return null;
  }

  const finalToolCalls = Array.from(toolCallsAcc.values()).map((tc) => ({
    id: tc.id || `call_${Math.random().toString(36).slice(2)}`,
    type: 'function',
    function: {
      name: tc.name || '',
      arguments: tc.arguments,
    },
  })).filter((tc) => tc.function.name);

  if (!fullText && finalToolCalls.length === 0) {
    return null;
  }

  return {
    text: fullText,
    toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
    usage,
  };
};
