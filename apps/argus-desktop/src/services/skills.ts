import AsyncStorage from '@react-native-async-storage/async-storage';

export type Skill = {
  id: string;
  name: string;
  description: string;
  pattern: string;
  triggerKeywords: string[];
  usageCount: number;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = '@skills_store_v2';
const LEGACY_KEY = '@skills_store';
const MAX_SKILLS = 50;

let cache: Skill[] | null = null;

const load = async (): Promise<Skill[]> => {
  try {
    const raw = (await AsyncStorage.getItem(STORAGE_KEY)) || (await AsyncStorage.getItem(LEGACY_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cache = parsed;
        return parsed;
      }
    }
  } catch {}
  return [];
};

const save = async (skills: Skill[]) => {
  cache = skills;
  const data = JSON.stringify(skills);
  await AsyncStorage.setItem(STORAGE_KEY, data);
  await AsyncStorage.setItem(LEGACY_KEY, data);
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const saveSkill = async (skill: Omit<Skill, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<Skill> => {
  const skills = await load();

  const existing = skills.find(
    (s) => s.name.toLowerCase() === skill.name.toLowerCase(),
  );
  if (existing) {
    existing.pattern = skill.pattern || '';
    existing.description = skill.description || '';
    existing.triggerKeywords = Array.isArray(skill.triggerKeywords) ? skill.triggerKeywords : [];
    existing.updatedAt = Date.now();
    await save(skills);
    return existing;
  }

  const newSkill: Skill = {
    ...skill,
    pattern: skill.pattern || '',
    description: skill.description || '',
    triggerKeywords: Array.isArray(skill.triggerKeywords) ? skill.triggerKeywords : [],
    id: createId(),
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (skills.length >= MAX_SKILLS) {
    skills.sort((a, b) => a.usageCount - b.usageCount);
    skills[0] = newSkill;
  } else {
    skills.push(newSkill);
  }

  await save(skills);
  return newSkill;
};

export const findSkill = async (query: string): Promise<Skill | null> => {
  const skills = await load();
  const q = query.toLowerCase();

  for (const skill of skills) {
    const match = (skill.triggerKeywords || []).some((kw) => q.includes(kw.toLowerCase()));
    if (match) return skill;
  }

  for (const skill of skills) {
    if (skill.name.toLowerCase().includes(q)) return skill;
  }

  return null;
};

export const searchSkills = async (query: string): Promise<Skill[]> => {
  const skills = await load();
  const q = query.toLowerCase();

  return skills
    .filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.triggerKeywords || []).some((kw) => kw.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 10);
};

export const useSkill = async (id: string) => {
  const skills = await load();
  const skill = skills.find((s) => s.id === id);
  if (skill) {
    skill.usageCount++;
    skill.updatedAt = Date.now();
    await save(skills);
  }
};

export const listSkills = async (): Promise<Skill[]> => {
  const skills = await load();
  return skills.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const deleteSkill = async (id: string) => {
  const skills = await load();
  await save(skills.filter((s) => s.id !== id && s.name !== id));
};

export const formatSkillIndex = (skills: Skill[]): string => {
  if (!skills.length) return '';

  return (
    'АКТИВНЫЕ НАВЫКИ (SKILLS)\n' +
    skills
      .map(
        (s, i) =>
          `${i + 1}. [${s.name}]: ${s.description} (инструкция: ${s.pattern})`,
      )
      .join('\n')
  );
};

export type PresetSkill = Omit<Skill, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'> & {
  category: string;
  icon: string;
};

export const PRESET_SKILLS: PresetSkill[] = [
  {
    name: 'Код и Рефакторинг',
    category: 'Разработка',
    icon: 'code',
    description: 'Оптимизирует код, исправляет скрытые баги, повышает читаемость и обрабатывает краевые случаи.',
    pattern: 'Проведи глубокий рефакторинг данного кода: сделай его чистым, производительным, безопасным, обработай краевые случаи и добавь понятные комментарии к сложной логике.',
    triggerKeywords: ['рефакторинг', 'код', 'оптимизация', 'баг', 'refactor', 'clean code'],
  },
  {
    name: 'Генератор Unit-тестов',
    category: 'Тестирование',
    icon: 'flask',
    description: 'Создает полные модульные тесты с большим покрытием позитивных и негативных сценариев.',
    pattern: 'Напиши исчерпывающий набор unit-тестов для этого кода. Включи тесты на успешное выполнение, ошибочные входные данные, граничные значения и моки зависимостей.',
    triggerKeywords: ['тест', 'unit test', 'юнит-тест', 'testing', 'jest', 'vitest'],
  },
  {
    name: 'Архитектор Баз Данных (SQL)',
    category: 'Базы данных',
    icon: 'database',
    description: 'Проектирует схемы БД, пишет сложные SQL запросы и помогает с индексами.',
    pattern: 'Составь оптимальный SQL-запрос или схему таблицы с учётом правильных типов данных, первичных/внешних ключей и индексов для высокой производительности.',
    triggerKeywords: ['sql', 'бд', 'database', 'postgres', 'таблица', 'query'],
  },
  {
    name: 'Сводка и Анализ (Summarizer)',
    category: 'Продуктивность',
    icon: 'file',
    description: 'Делает структурированную краткую выжимку любого длинного текста, лога или документа.',
    pattern: 'Сделай краткую, но содержательную выжимку следующего текста. Выдели главные мысли в виде маркированного списка, ключевые выводы и основные термины.',
    triggerKeywords: ['суммаризация', 'выжимка', 'конспект', 'summary', 'кратко'],
  },
  {
    name: 'UI/UX Компоненты',
    category: 'Дизайн & Фронтенд',
    icon: 'palette',
    description: 'Спроектирует стильный UI компонент с микроанимациями, адаптивностью и темной темой.',
    pattern: 'Спроектируй премиальный UI-компонент со стильной современной эстетикой, поддержкой тёмной темы, плавными переходами, hover-эффектами и чистой версткой.',
    triggerKeywords: ['ui', 'ux', 'компонент', 'верстка', 'дизайн', 'css', 'react'],
  },
  {
    name: 'Переводчик & Локализация',
    category: 'Текст',
    icon: 'globe',
    description: 'Точный профессиональный перевод с сохранением контекста, IT-терминологии и стиля.',
    pattern: 'Переведи предоставленный текст на указанный язык с максимальной точностью. Сохраняй технический контекст, естественность речи и специфическую терминологию.',
    triggerKeywords: ['перевод', 'translate', 'локализация', 'язык', 'english'],
  },
];

export const installPresetSkill = async (preset: PresetSkill): Promise<Skill> => {
  return saveSkill({
    name: preset.name,
    description: preset.description,
    pattern: preset.pattern,
    triggerKeywords: preset.triggerKeywords,
  });
};
