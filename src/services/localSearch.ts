import { Directory, File, Paths } from 'expo-file-system';
import { searchSessions } from './sessionSearch';
import { searchMemory } from './memory';

export type LocalFileResult = {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modificationTime?: number;
};

const COMMON_DIRS = [
  Paths.document.uri,
  Paths.cache.uri,
  `${Paths.document.uri}workspace/`,
];

let externalSearchRoot: string | null = null;

export const setExternalSearchRoot = (dir: string) => {
  externalSearchRoot = dir;
};

export const clearExternalSearchRoot = () => {
  externalSearchRoot = null;
};

export const getExternalSearchRoot = () => externalSearchRoot;

const searchDirRecursive = async (
  dirPath: string,
  query: string,
  maxResults = 20,
  depth = 0,
): Promise<LocalFileResult[]> => {
  if (depth > 4 || maxResults <= 0) return [];
  const results: LocalFileResult[] = [];

  try {
    const dir = new Directory(dirPath);
    if (!dir.exists) return [];
    const entries = dir.list();
    for (const entry of entries) {
      if (results.length >= maxResults) break;
      try {
        const name = entry.name;
        const fullPath = entry.uri;
        const isDir = entry instanceof Directory;
        const match = name.toLowerCase().includes(query.toLowerCase());
        if (match) {
          results.push({
            name,
            path: fullPath,
            size: isDir ? 0 : (entry as File).size,
            isDirectory: isDir,
            modificationTime: isDir ? undefined : (entry as File).lastModified ?? undefined,
          });
        }
        if (isDir && match) {
          const sub = await searchDirRecursive(fullPath, query, maxResults - results.length, depth + 1);
          results.push(...sub);
        }
      } catch {}
    }
  } catch {}

  return results;
};

export const phoneSearchFiles = async (
  query: string,
  maxResults = 20,
): Promise<LocalFileResult[]> => {
  const results: LocalFileResult[] = [];

  for (const dir of COMMON_DIRS) {
    if (results.length >= maxResults) break;
    try {
      const d = new Directory(dir);
      if (d.exists) {
        const found = await searchDirRecursive(dir, query, maxResults - results.length);
        results.push(...found);
      }
    } catch {}
  }

  if (externalSearchRoot && results.length < maxResults) {
    try {
      const d = new Directory(externalSearchRoot);
      if (d.exists) {
        const extResults = await searchDirRecursive(
          externalSearchRoot,
          query,
          maxResults - results.length,
        );
        results.push(...extResults);
      }
    } catch {}
  }

  return results;
};

export const phoneSearchChats = async (query: string) => {
  return searchSessions(query);
};

export const phoneSearchMemory = async (query: string, tier?: 'agent' | 'user') => {
  return searchMemory(query, { tier });
};
