import * as Calendar from 'expo-calendar';
import { getSoul, updateSoul } from './soul';
import * as ContactsService from './contacts';
import { phoneSearchFiles, phoneSearchChats, phoneSearchMemory } from './localSearch';
import { webSearch, fetchPage } from './webSearch';
import {
  deleteMemory,
  memorySummary,
  rememberFact,
  rememberPreference,
  replaceMemory,
  searchMemory,
  updateMemoryImportance,
} from './memory';
import { deleteSkill, listSkills, saveSkill, searchSkills, useSkill } from './skills';
import { searchSessions, sessionSearchSummary } from './sessionSearch';
import { listTrajectories, getTrajectoryDetail, saveTrajectory, TrajectoryStep } from './trajectory';
import {
  deleteWorkspaceFile,
  listWorkspaceFiles,
  readWorkspaceFile,
  workspaceSummary,
  writeWorkspaceFile,
} from './workspace';
import {
  createSandbox,
  listSandboxes,
  sandboxWriteFile,
  sandboxReadFile,
  sandboxListFiles,
  sandboxDeleteFile,
} from './sandbox';

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'list_calendar_events',
      description: 'Получает список событий из календаря пользователя на указанный период',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Дата начала в формате ISO' },
          endDate: { type: 'string', description: 'Дата окончания в формате ISO' },
        },
        required: ['startDate', 'endDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Создает новое событие в основном календаре пользователя',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Название события' },
          startDate: { type: 'string', description: 'Дата начала в формате ISO' },
          endDate: { type: 'string', description: 'Дата окончания в формате ISO' },
          location: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['title', 'startDate', 'endDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_soul',
      description: 'Читает твой SOUL.md — файл идентичности. Там записано кто ты, твой стиль общения и ценности.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_soul',
      description: 'Обновляет твой SOUL.md — меняет твою идентичность, стиль общения, ценности. Используй чтобы эволюционировать.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Полное содержимое SOUL.md. Должно начинаться с # SOUL.md',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember_fact',
      description: 'Сохраняет важный факт (проект, окружение, конфигурация, решение). Используй для информации, которая пригодится в следующих сессиях.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Факт для долгосрочной памяти' },
          type: {
            type: 'string',
            enum: ['fact', 'preference', 'project', 'habit', 'tool_skill'],
            description: 'Тип памяти: fact — общий факт, preference — предпочтение, project — проект',
          },
          importance: {
            type: 'number',
            description: 'Важность 0.0–1.0 (по умолчанию 0.6)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Теги для поиска: project, env, config, stack и т.д.',
          },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember_preference',
      description: 'Сохраняет предпочтение пользователя (стиль общения, привычки, формат ответов, workflow). Попадает в USER-профиль.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Предпочтение пользователя' },
          importance: {
            type: 'number',
            description: 'Важность 0.0–1.0 (по умолчанию 0.7)',
          },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_memory',
      description: 'Ищет факты и предпочтения в долгосрочной памяти. Используй перед ответом, чтобы вспомнить контекст.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Поисковой запрос' },
          tier: {
            type: 'string',
            enum: ['agent', 'user'],
            description: 'agent — факты, user — предпочтения',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_memory',
      description: 'Удаляет конкретный факт из памяти по фрагменту текста',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Фрагмент текста для удаления' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory_summary',
      description: 'Показывает все сохраненные факты с типами и важностью',
      parameters: {
        type: 'object',
        properties: {
          tier: {
            type: 'string',
            enum: ['agent', 'user'],
            description: 'agent — факты, user — предпочтения',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_memory_importance',
      description: 'Меняет важность факта. Повышай для часто используемых, понижай для устаревших.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Фрагмент текста факта' },
          importance: { type: 'number', description: 'Новая важность 0.0–1.0' },
        },
        required: ['text', 'importance'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_memory',
      description: 'Заменяет существующий факт в памяти по совпадению текста. Используй для обновления устаревшей информации.',
      parameters: {
        type: 'object',
        properties: {
          oldText: { type: 'string', description: 'Текст или фрагмент существующего факта' },
          newText: { type: 'string', description: 'Новый текст для замены' },
        },
        required: ['oldText', 'newText'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'session_search',
      description: 'Ищет информацию в истории прошлых диалогов. Используй чтобы вспомнить что обсуждалось ранее.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Поисковой запрос' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_trajectories',
      description: 'Показывает список сохраненных решений сложных задач (траекторий).',
      parameters: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'true — только успешные, false — только неудачные, пусто — все',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trajectory',
      description: 'Показывает детали конкретного решения задачи по ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID траектории из list_trajectories' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_skill',
      description: 'Сохраняет повторяемый паттерн решения задачи как навык. Используй после успешного решения сложной задачи (5+ шагов).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Название навыка (напр. "deploy_react_app")' },
          description: { type: 'string', description: 'Краткое описание что делает' },
          pattern: { type: 'string', description: 'Пошаговый паттерн действий' },
          triggerKeywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ключевые слова для авто-подбора (напр. deploy, react, build)',
          },
        },
        required: ['name', 'description', 'pattern', 'triggerKeywords'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_skill',
      description: 'Ищет подходящий навык по описанию задачи',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Описание задачи' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_skills',
      description: 'Показывает все сохраненные навыки',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'workspace_summary',
      description: 'Показывает список всех файлов в рабочей области чата с размерами',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'workspace_read_file',
      description: 'Читает содержимое файла из рабочей области',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Относительный путь к файлу' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'workspace_write_file',
      description: 'Создает или перезаписывает файл в рабочей области. Используй для кода, конфигов, заметок, документации.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Относительный путь (напр. src/app.tsx)' },
          content: { type: 'string', description: 'Содержимое файла' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'workspace_delete_file',
      description: 'Удаляет файл из рабочей области',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Относительный путь к файлу' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sandbox_create',
      description: 'Создаёт новую песочницу (sandbox) — отдельную среду для запуска кода, HTML, SVG. Возвращает ID новой песочницы.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Название песочницы' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sandbox_write_file',
      description: 'Записывает файл в песочницу. Поддерживает HTML, CSS, JS, SVG и другие текстовые форматы.',
      parameters: {
        type: 'object',
        properties: {
          sandboxId: { type: 'string', description: 'ID песочницы' },
          path: { type: 'string', description: 'Путь к файлу (напр. index.html)' },
          content: { type: 'string', description: 'Содержимое файла' },
        },
        required: ['sandboxId', 'path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sandbox_read_file',
      description: 'Читает содержимое файла в песочнице',
      parameters: {
        type: 'object',
        properties: {
          sandboxId: { type: 'string', description: 'ID песочницы' },
          path: { type: 'string', description: 'Путь к файлу' },
        },
        required: ['sandboxId', 'path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sandbox_list_files',
      description: 'Списывает все файлы в песочнице',
      parameters: {
        type: 'object',
        properties: {
          sandboxId: { type: 'string', description: 'ID песочницы' },
        },
        required: ['sandboxId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sandbox_delete_file',
      description: 'Удаляет файл из песочницы',
      parameters: {
        type: 'object',
        properties: {
          sandboxId: { type: 'string', description: 'ID песочницы' },
          path: { type: 'string', description: 'Путь к файлу' },
        },
        required: ['sandboxId', 'path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description: 'Ищет контакты в телефонной книге. Без согласия пользователя возвращает только безопасный предпросмотр без полных номеров.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Имя или номер для поиска' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'initiate_communication',
      description: 'Открывает звонилку или SMS только после подтверждения пользователем имени, номера и действия.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['call', 'sms'], description: 'call — позвонить, sms — написать' },
          phone: { type: 'string', description: 'Номер телефона' },
          name: { type: 'string', description: 'Имя контакта (опционально)' },
        },
        required: ['action', 'phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'phone_search_files',
      description: 'Ищет файлы на устройстве по имени. Проверяет рабочую область и выбранные папки.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Имя файла или его часть' },
          directory: { type: 'string', description: 'Путь к папке (опционально)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'phone_search_chats',
      description: 'Ищет информацию в истории прошлых диалогов. Используй чтобы вспомнить что обсуждалось.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Поисковой запрос' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Ищет информацию в интернете. Используй когда нужны актуальные данные, новости или факты.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Поисковой запрос' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'visit_page',
      description: 'Читает содержимое веб-страницы по URL. Используй после web_search чтобы получить детали.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Полный URL страницы' },
        },
        required: ['url'],
      },
    },
  },
];

async function getDefaultCalendarSource() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars.find((cal) => cal.isPrimary) || calendars[0];
}

const fuzzyFindMemory = async (text: string, items: any[]) => {
  const q = text.toLowerCase();
  return items.find(
    (m) =>
      m.text.toLowerCase().includes(q) ||
      q.includes(m.text.toLowerCase().slice(0, 10)),
  );
};

export const TOOL_HANDLERS: Record<
  string,
  (args: any, ctx?: {
    workspaceId?: string;
    contactsAccessEnabled?: boolean;
    requestContactDisclosure?: (payload: {
      query: string;
      results: ContactsService.ContactSafePreview[];
    }) => Promise<boolean>;
    confirmCommunication?: (payload: { action: 'call' | 'sms'; phone: string; name?: string }) => Promise<boolean>;
  }) => Promise<any>
> = {
  list_calendar_events: async ({ startDate, endDate }) => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') throw new Error('Нет доступа к календарю');

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calendarIds = calendars.map((c) => c.id);
    const events = await Calendar.getEventsAsync(
      calendarIds,
      new Date(startDate),
      new Date(endDate),
    );
    return events.map((e) => ({
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      location: e.location,
    }));
  },
  create_calendar_event: async ({ title, startDate, endDate, location, notes }) => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') throw new Error('Нет доступа к календарю');

    const defaultCalendar = await getDefaultCalendarSource();
    if (!defaultCalendar) throw new Error('Календарь не найден');

    const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
      title,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      location,
      notes,
    });
    return { success: true, eventId };
  },
  read_soul: async () => {
    const content = await getSoul();
    return { soul: content, length: content.length };
  },
  update_soul: async ({ content }) => {
    if (!content || !content.trim()) throw new Error('SOUL.md не может быть пустым');
    const updated = await updateSoul(content.trim());
    return { updated: true, length: updated.length };
  },
  remember_fact: async ({ text, type, importance, tags }) => {
    if (!text || !text.trim()) throw new Error('Факт не может быть пустым');
    const item = await rememberFact(text.trim(), { type, importance, tags });
    return { stored: true, id: item.id, tier: item.tier, importance: item.importance };
  },
  remember_preference: async ({ text, importance }) => {
    if (!text || !text.trim()) throw new Error('Предпочтение не может быть пустым');
    const item = await rememberPreference(text.trim(), { importance });
    return { stored: true, id: item.id, tier: 'user', importance: item.importance };
  },
  search_memory: async ({ query, tier }) => {
    const items = await searchMemory(query || '', { tier });
    return {
      results: items.map((item) => ({
        text: item.text,
        type: item.type,
        tier: item.tier,
        importance: item.importance,
        tags: item.tags,
      })),
    };
  },
  delete_memory: async ({ text }) => {
    const items = await searchMemory(text);
    if (items.length === 0) return { deleted: false, reason: 'Не найдено' };
    for (const item of items) {
      await deleteMemory(item.id);
    }
    return { deleted: true, count: items.length };
  },
  memory_summary: async ({ tier }) => {
    return { summary: await memorySummary(tier) };
  },
  update_memory_importance: async ({ text, importance }) => {
    const items = await searchMemory(text);
    if (items.length === 0) return { updated: false, reason: 'Не найдено' };
    await updateMemoryImportance(items[0].id, importance);
    return { updated: true, newImportance: importance };
  },
  replace_memory: async ({ oldText, newText }) => {
    if (!oldText || !newText) throw new Error('oldText и newText обязательны');
    const result = await replaceMemory(oldText, newText);
    return result;
  },
  session_search: async ({ query }) => {
    const results = await searchSessions(query || '');
    return {
      results: results.map((r) => ({
        chatId: r.chatId,
        title: r.title,
        excerpt: r.excerpt,
        relevance: r.score.toFixed(2),
        date: new Date(r.updatedAt).toLocaleDateString('ru-RU'),
      })),
    };
  },
  list_trajectories: async ({ success }) => {
    const items = await listTrajectories(success);
    return {
      trajectories: items.map((t) => ({
        id: t.id,
        summary: t.summary,
        toolCount: t.toolCount,
        success: t.success,
        date: new Date(t.createdAt).toLocaleDateString('ru-RU'),
      })),
    };
  },
  get_trajectory: async ({ id }) => {
    const trajectory = await getTrajectoryDetail(id);
    if (!trajectory) return { error: 'Траектория не найдена' };
    return {
      summary: trajectory.summary,
      toolCount: trajectory.toolCount,
      success: trajectory.success,
      steps: trajectory.steps.map((s) => ({
        iteration: s.iteration,
        role: s.role,
        content: s.content.slice(0, 500),
        toolName: s.toolName,
      })),
    };
  },
  save_skill: async ({ name, description, pattern, triggerKeywords }) => {
    const skill = await saveSkill({ name, description, pattern, triggerKeywords });
    return { saved: true, id: skill.id, name: skill.name };
  },
  search_skill: async ({ query }) => {
    const results = await searchSkills(query);
    return {
      results: results.map((s) => ({
        name: s.name,
        description: s.description,
        usageCount: s.usageCount,
      })),
    };
  },
  list_skills: async () => {
    const skills = await listSkills();
    return {
      skills: skills.map((s) => ({
        name: s.name,
        description: s.description,
        usageCount: s.usageCount,
        triggerKeywords: s.triggerKeywords,
      })),
    };
  },
  workspace_summary: async (_args, ctx) => {
    if (!ctx?.workspaceId) return { error: 'Нет активной рабочей области' };
    return { summary: await workspaceSummary(ctx.workspaceId) };
  },
  workspace_read_file: async ({ path }, ctx) => {
    if (!ctx?.workspaceId) return { error: 'Нет активной рабочей области' };
    const content = await readWorkspaceFile(ctx.workspaceId, path);
    return { path, content, length: content.length };
  },
  workspace_write_file: async ({ path, content }, ctx) => {
    if (!ctx?.workspaceId) return { error: 'Нет активной рабочей области' };
    const result = await writeWorkspaceFile(ctx.workspaceId, path, content);
    return { success: true, path: result.path, size: result.size };
  },
  workspace_delete_file: async ({ path }, ctx) => {
    if (!ctx?.workspaceId) return { error: 'Нет активной рабочей области' };
    return deleteWorkspaceFile(ctx.workspaceId, path);
  },
  sandbox_create: async ({ name }) => {
    if (!name || !name.trim()) throw new Error('Название песочницы обязательно');
    const sb = await createSandbox(name.trim());
    return { sandboxId: sb.id, name: sb.name, createdAt: sb.createdAt };
  },
  sandbox_write_file: async ({ sandboxId, path, content }) => {
    if (!sandboxId || !path) throw new Error('sandboxId и path обязательны');
    const result = await sandboxWriteFile(sandboxId, path, content);
    return { success: true, path: result.path, size: result.size };
  },
  sandbox_read_file: async ({ sandboxId, path }) => {
    if (!sandboxId || !path) throw new Error('sandboxId и path обязательны');
    const content = await sandboxReadFile(sandboxId, path);
    return { path, content, length: content.length };
  },
  sandbox_list_files: async ({ sandboxId }) => {
    if (!sandboxId) throw new Error('sandboxId обязателен');
    const files = await sandboxListFiles(sandboxId);
    return { files: files.map((f) => ({ path: f.path, size: f.size, updatedAt: f.updatedAt })) };
  },
  sandbox_delete_file: async ({ sandboxId, path }) => {
    if (!sandboxId || !path) throw new Error('sandboxId и path обязательны');
    return sandboxDeleteFile(sandboxId, path);
  },
  search_contacts: async ({ query }, ctx) => {
    if (!query) throw new Error('Запрос обязателен');
    if (!ctx?.contactsAccessEnabled) {
      return {
        error: 'Доступ ассистента к контактам выключен в настройках',
        requiresSettings: true,
        safe: true,
      };
    }

    const results = await ContactsService.searchContacts(query);
    const safeResults = results.map(ContactsService.toSafeContactPreview);

    if (results.length === 0) {
      return { results: [], safe: true };
    }

    const approved = ctx.requestContactDisclosure
      ? await ctx.requestContactDisclosure({ query, results: safeResults })
      : false;

    if (!approved) {
      return {
        results: safeResults,
        safe: true,
        requiresUserApproval: true,
        message: 'Полные номера скрыты. Попроси пользователя подтвердить выдачу номеров в интерфейсе.',
      };
    }

    return {
      results: results.map((c) => ({
        id: c.id,
        name: c.name,
        phones: c.phones,
      })),
      safe: false,
      userApprovedPhoneDisclosure: true,
    };
  },
  initiate_communication: async ({ action, phone, name }, ctx) => {
    if (action !== 'call' && action !== 'sms') {
      throw new Error('Неизвестное действие. Используй call или sms.');
    }
    if (!phone) throw new Error('Номер телефона обязателен');
    if (!ctx?.contactsAccessEnabled) {
      return { error: 'Доступ ассистента к контактам выключен в настройках', requiresSettings: true };
    }
    if (!ctx.confirmCommunication) {
      return { error: 'Нужно подтверждение пользователя в текущей сессии перед звонком или SMS' };
    }

    const confirmed = await ctx.confirmCommunication({ action, phone, name });
    if (!confirmed) {
      return {
        error: 'Пользователь не подтвердил номер и действие в текущей сессии',
        action,
        contact: name || phone,
      };
    }

    if (action === 'call') {
      ContactsService.openDialer(phone);
      return { status: 'opened_dialer', contact: name || phone, action: 'call' };
    }

    ContactsService.openSms(phone);
    return { status: 'opened_sms', contact: name || phone, action: 'sms' };
  },
  phone_search_files: async ({ query, directory }) => {
    if (!query) throw new Error('Запрос обязателен');
    const results = await phoneSearchFiles(query);
    return {
      results: results.map((f) => ({
        name: f.name,
        path: f.path,
        size: f.size,
        isDirectory: f.isDirectory,
      })),
    };
  },
  phone_search_chats: async ({ query }) => {
    const results = await phoneSearchChats(query || '');
    return {
      results: results.map((r) => ({
        chatId: r.chatId,
        title: r.title,
        excerpt: r.excerpt,
        relevance: r.score.toFixed(2),
      })),
    };
  },
  web_search: async ({ query }) => {
    if (!query) throw new Error('Запрос обязателен');
    const results = await webSearch(query);
    return { results };
  },
  visit_page: async ({ url }) => {
    if (!url) throw new Error('URL обязателен');
    const content = await fetchPage(url);
    return { url, content, length: content.length };
  },
};
