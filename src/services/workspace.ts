import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

export type WorkspaceFile = {
  path: string;
  content: string;
  updatedAt: number;
  size: number;
};

const safeSegment = (segment: string) => segment.replace(/[^a-zA-Z0-9._-]+/g, '_');

const normalizeRelativePath = (path: string) => {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!normalized || normalized.includes('..')) {
    throw new Error('Некорректный путь файла. Используй относительный путь без ..');
  }
  return normalized;
};

const getWorkspaceDir = (workspaceId: string) =>
  new Directory(Paths.document, 'workspaces', safeSegment(workspaceId));

const ensureWorkspaceDir = async (workspaceId: string) => {
  const root = new Directory(Paths.document, 'workspaces');
  if (!root.exists) {
    root.create({ intermediates: true });
  }
  const dir = getWorkspaceDir(workspaceId);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
};

const collectFiles = (dir: Directory, basePath: string): WorkspaceFile[] => {
  if (!dir.exists) return [];

  const entries = dir.list();
  const result: WorkspaceFile[] = [];

  for (const entry of entries) {
    if (entry instanceof Directory) {
      result.push(...collectFiles(entry, `${basePath}/${entry.name}`));
    } else if (entry instanceof File) {
      const content = entry.textSync();
      const info = entry.info();
      result.push({
        path: `${basePath}/${entry.name}`,
        content,
        updatedAt: info.modificationTime ?? Date.now(),
        size: info.size ?? content.length,
      });
    }
  }

  return result.sort((a, b) => a.path.localeCompare(b.path));
};

export const ensureWorkspace = async (workspaceId: string) => {
  await ensureWorkspaceDir(workspaceId);
};

export const listWorkspaceFiles = async (workspaceId: string): Promise<WorkspaceFile[]> => {
  await ensureWorkspaceDir(workspaceId);
  const dir = getWorkspaceDir(workspaceId);
  return collectFiles(dir, '');
};

export const writeWorkspaceFile = async (workspaceId: string, path: string, content: string) => {
  await ensureWorkspaceDir(workspaceId);
  const normalPath = normalizeRelativePath(path);
  const segments = normalPath.split('/');
  const fileName = segments.pop()!;
  let parentDir = getWorkspaceDir(workspaceId);

  for (const segment of segments) {
    const sub = new Directory(parentDir, segment);
    if (!sub.exists) {
      sub.create({ intermediates: true });
    }
    parentDir = sub;
  }

  const file = new File(parentDir, fileName);
  file.write(content);
  const info = file.info();

  return {
    path: normalPath,
    size: info.size ?? content.length,
    updatedAt: info.modificationTime ?? Date.now(),
  };
};

export const readWorkspaceFile = async (workspaceId: string, path: string) => {
  const normalPath = normalizeRelativePath(path);
  const dir = getWorkspaceDir(workspaceId);
  const file = new File(dir, ...normalPath.split('/'));
  if (!file.exists) {
    throw new Error(`Файл не найден: ${path}`);
  }
  return file.text();
};

export const deleteWorkspaceFile = async (workspaceId: string, path: string) => {
  const normalPath = normalizeRelativePath(path);
  const dir = getWorkspaceDir(workspaceId);
  const file = new File(dir, ...normalPath.split('/'));
  if (file.exists) {
    file.delete();
  }
  return { deleted: normalPath };
};

export const deleteWorkspace = async (workspaceId: string) => {
  const dir = getWorkspaceDir(workspaceId);
  if (dir.exists) {
    dir.delete();
  }
};

export const workspaceSummary = async (workspaceId: string) => {
  const files = await listWorkspaceFiles(workspaceId);
  if (!files.length) return 'Рабочая область пуста.';

  return files.map((file) => `- ${file.path} (${file.size} bytes)`).join('\n');
};

export const exportWorkspaceFile = async (workspaceId: string, path: string) => {
  const content = await readWorkspaceFile(workspaceId, path);
  const normalPath = normalizeRelativePath(path);
  const fileName = normalPath.split('/').pop()!;
  const cacheFile = new File(Paths.cache, fileName);
  cacheFile.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(cacheFile.uri);
  }

  return cacheFile.uri;
};

export const exportWorkspaceArchive = async (workspaceId: string, title = 'workspace') => {
  const files = await listWorkspaceFiles(workspaceId);
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  const base64 = await zip.generateAsync({ type: 'base64' });
  const fileName = `${safeSegment(title || workspaceId)}.zip`;
  const cacheFile = new File(Paths.cache, fileName);
  cacheFile.write(base64);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(cacheFile.uri);
  }

  return cacheFile.uri;
};
