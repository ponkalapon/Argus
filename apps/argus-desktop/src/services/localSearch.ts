import { searchSessions } from './sessionSearch';
import { searchMemory } from './memory';

export type LocalFileResult = {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modificationTime?: number;
};

let externalSearchRoot: string | null = null;

export const setExternalSearchRoot = (dir: string) => {
  externalSearchRoot = dir;
};

export const clearExternalSearchRoot = () => {
  externalSearchRoot = null;
};

export const getExternalSearchRoot = () => externalSearchRoot;

export const searchLocalFiles = async (query: string, maxResults = 20): Promise<LocalFileResult[]> => {
  return [];
};

export const phoneSearchFiles = async (query: string): Promise<LocalFileResult[]> => {
  return searchLocalFiles(query, 10);
};

export const phoneSearchChats = async (query: string) => {
  return searchSessions(query);
};

export const phoneSearchMemory = async (query: string) => {
  return searchMemory(query);
};
