import { ChatCompletionContext, ChatCompletionMessage, ChatCompletionRequest, ChatCompletionResult } from '../types';
import { formatMemoryContext, searchMemory } from './memory';
import { formatSkillIndex, listSkills } from './skills';
import { getSoul } from './soul';
import { workspaceSummary } from './workspace';
import { TOOL_DEFINITIONS, TOOL_HANDLERS } from './tools';
import { saveTrajectory, TrajectoryStep } from './trajectory';
import {
  buildCompressionPlan,
  compressMessages,
  estimateMessagesTokens,
  getContextWindow,
  needFlushBeforeCompress,
  shouldCompress,
  wasCompressionEffective,
} from './context';

const MAX_ITERATIONS = 25;
const MEMORY_NUDGE_INTERVAL = 3;

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

export const normalizeBaseUrl = (baseUrl: string) => {
  const trimmed = trimTrailingSlashes(baseUrl.trim());

  if (!trimmed) {
    throw new Error('Укажи Base URL в настройках.');
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Base URL должен начинаться с http:// или https://.');
  }

  return trimmed;
};

const buildSystemPrompt = async (
  userMessage: string,
  context?: ChatCompletionContext,
): Promise<string> => {
  const soul = await getSoul();

  let finalPrompt = `══════════════════════════════════════════════\n${soul}\n══════════════════════════════════════════════`;

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

  if (context?.workspaceContext) {
    finalPrompt += `\n\n## Рабочая область\n${context.workspaceContext}`;
  }

  return finalPrompt;
};

type ChatCompletionResponse = {
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

const extractTextFromJson = (data: ChatCompletionResponse) =>
  data.choices?.[0]?.message?.content ||
  data.choices?.[0]?.delta?.content ||
  data.choices?.[0]?.text ||
  data.output_text ||
  '';

const extractToolCalls = (data: ChatCompletionResponse) =>
  data.choices?.[0]?.message?.tool_calls ||
  data.choices?.[0]?.delta?.tool_calls;

const splitSseEvents = (buffer: string) => {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() || '';
  return { events: parts, rest };
};

const extractSseDataLines = (event: string) =>
  event
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, '').trim())
    .filter(Boolean);

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
    const data = JSON.parse(chunk) as ChatCompletionResponse;
    lastJson = data;
    fullText += extractTextFromJson(data);
  }

  if (fullText.trim()) {
    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: fullText,
          },
        },
      ],
    };
  }

  if (lastJson) {
    return lastJson;
  }

  throw new Error('API вернул stream без данных.');
};

const parseResponsePayload = async (response: Response): Promise<ChatCompletionResponse> => {
  const rawText = await response.text();

  try {
    return parseJsonOrSsePayload(rawText);
  } catch (error) {
    const preview = rawText.trim().slice(0, 160) || 'empty body';
    const reason = error instanceof Error ? error.message : 'parse failed';
    throw new Error(`Не удалось разобрать ответ API: ${reason}. Начало ответа: ${preview}`);
  }
};

const parseErrorMessage = async (response: Response) => {
  const fallback = `API вернул ошибку ${response.status}`;

  try {
    const data = await parseResponsePayload(response);
    return data.error?.message || data.message || fallback;
  } catch (error) {
    return error instanceof Error ? error.message : fallback;
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

const readStreamingResponse = async (response: Response, onToken: (token: string) => void) => {
  const body = response.body;
  const reader = body?.getReader?.();

  if (!reader) {
    const data = await parseResponsePayload(response);
    const text = extractTextFromJson(data);
    if (text) {
      onToken(text);
    }
    return { text, toolCalls: extractToolCalls(data), usage: data.usage };
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let toolCalls: any[] = [];
  let finalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

  const handleData = (rawData: string) => {
    if (!rawData || rawData === '[DONE]') return;

    const data = JSON.parse(rawData) as ChatCompletionResponse;
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

  return {
    text: fullText,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: finalUsage,
  };
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

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: createHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: summaryMessages,
      max_tokens: 1024,
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    return '';
  }

  const data = await parseResponsePayload(response);
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
  let pendingFlushNudge = false;

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

    if (pendingFlushNudge || needFlushBeforeCompress(currentMessages, model)) {
      pendingFlushNudge = false;
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

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
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
      throw new Error(await parseErrorMessage(response));
    }

    let text = '';
    let toolCalls: any[] | undefined;
    let streamUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

    if (onToken) {
      const streamResult = await readStreamingResponse(response, onToken);
      text = streamResult.text;
      toolCalls = streamResult.toolCalls;
      streamUsage = streamResult.usage;
    } else {
      const data = await parseResponsePayload(response);
      text = extractTextFromJson(data);
      toolCalls = extractToolCalls(data);
      streamUsage = data.usage;
    }

    if (!toolCalls || toolCalls.length === 0) {
      if (!text.trim() && !toolCalls) {
        throw new Error('API ответил без текста. Проверь совместимость модели с /v1/chat/completions.');
      }
      return {
        text: text.trim(),
        usage: streamUsage ? { input: streamUsage.prompt_tokens, output: streamUsage.completion_tokens, total: streamUsage.total_tokens } : undefined,
      };
    }

    currentMessages.push({
      role: 'assistant',
      content: text || null,
      tool_calls: toolCalls,
    });

    const handlerCtx = { workspaceId: context?.workspaceId };

    for (const toolCall of toolCalls) {
      const handler = TOOL_HANDLERS[toolCall.function.name];
      if (handler) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await handler(args, handlerCtx);
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (e) {
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error: e instanceof Error ? e.message : String(e),
            }),
          });
        }
      }
    }

    const info = shouldCompress(currentMessages, model);

    if (info.needed) {
      const beforeTokens = estimateMessagesTokens(currentMessages);
      const summary = await summarizeMiddle(currentMessages, baseUrl, apiKey, model);

      if (summary) {
        const compressed = compressMessages(currentMessages, summary);
        const afterTokens = estimateMessagesTokens(compressed);

        if (wasCompressionEffective(beforeTokens, afterTokens)) {
          currentMessages = compressed;
        }
      }
    } else if (info.pct >= 0.75 && !pendingFlushNudge) {
      pendingFlushNudge = true;
    }
  }

  const lastAssistant = [...currentMessages]
    .reverse()
    .find((m) => m.role === 'assistant' && m.content);
  const resultText = lastAssistant?.content || 'Достигнут лимит итераций.';

  const toolSteps = currentMessages
    .filter((m) => m.role === 'tool' || m.role === 'assistant')
    .map((m, i) => ({
      iteration: Math.floor(i / 2),
      role: m.role as 'assistant' | 'tool',
      content: m.content || '',
      toolName: m.tool_calls?.[0]?.function?.name,
    }));

  if (toolSteps.length >= 6) {
    const summaryLine = resultText.slice(0, 120);
    saveTrajectory(summaryLine, toolSteps, toolSteps.length > 0).catch(() => {});
  }

  return { text: resultText };
};
