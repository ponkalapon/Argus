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

const STORAGE_KEY = '@skills_store';
const MAX_SKILLS = 20;

let cache: Skill[] | null = null;

const load = async (): Promise<Skill[]> => {
  if (cache) return cache;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  cache = raw ? JSON.parse(raw) : [];
  return cache!;
};

const save = async (skills: Skill[]) => {
  cache = skills;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const saveSkill = async (skill: Omit<Skill, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<Skill> => {
  const skills = await load();

  const existing = skills.find(
    (s) => s.name.toLowerCase() === skill.name.toLowerCase(),
  );
  if (existing) {
    existing.pattern = skill.pattern;
    existing.description = skill.description;
    existing.triggerKeywords = skill.triggerKeywords;
    existing.updatedAt = Date.now();
    await save(skills);
    return existing;
  }

  const newSkill: Skill = {
    ...skill,
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
    const match = skill.triggerKeywords.some((kw) => q.includes(kw.toLowerCase()));
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
        s.triggerKeywords.some((kw) => kw.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 5);
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
  return skills.sort((a, b) => b.usageCount - a.usageCount);
};

export const deleteSkill = async (id: string) => {
  const skills = await load();
  await save(skills.filter((s) => s.id !== id));
};

export const formatSkillIndex = (skills: Skill[]): string => {
  if (!skills.length) return '';

  return (
    'SKILLS\n' +
    skills
      .map(
        (s, i) =>
          `${i + 1}. ${s.name} — ${s.description} (used ${s.usageCount}x)`,
      )
      .join('\n')
  );
};
