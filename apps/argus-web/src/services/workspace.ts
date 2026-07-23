import AsyncStorage from '@react-native-async-storage/async-storage';
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

const getStorageKey = (workspaceId: string) => `argus.workspace.${safeSegment(workspaceId)}`;

export const ensureWorkspace = async (_workspaceId: string) => {};

export const listWorkspaceFiles = async (workspaceId: string): Promise<WorkspaceFile[]> => {
  const raw = await AsyncStorage.getItem(getStorageKey(workspaceId));
  if (!raw) return [];
  try {
    const files: WorkspaceFile[] = JSON.parse(raw);
    return Array.isArray(files) ? files.sort((a, b) => a.path.localeCompare(b.path)) : [];
  } catch {
    return [];
  }
};

export const writeWorkspaceFile = async (workspaceId: string, path: string, content: string) => {
  const normalPath = normalizeRelativePath(path);
  const files = await listWorkspaceFiles(workspaceId);
  const now = Date.now();
  const existingIndex = files.findIndex((f) => f.path === normalPath);
  const fileData: WorkspaceFile = {
    path: normalPath,
    content,
    updatedAt: now,
    size: content.length,
  };

  if (existingIndex >= 0) {
    files[existingIndex] = fileData;
  } else {
    files.push(fileData);
  }

  await AsyncStorage.setItem(getStorageKey(workspaceId), JSON.stringify(files));
  return {
    path: normalPath,
    size: content.length,
    updatedAt: now,
  };
};

export const readWorkspaceFile = async (workspaceId: string, path: string) => {
  const normalPath = normalizeRelativePath(path);
  const files = await listWorkspaceFiles(workspaceId);
  const file = files.find((f) => f.path === normalPath);
  if (!file) {
    throw new Error(`Файл не найден: ${path}`);
  }
  return file.content;
};

export const deleteWorkspaceFile = async (workspaceId: string, path: string) => {
  const normalPath = normalizeRelativePath(path);
  const files = await listWorkspaceFiles(workspaceId);
  const filtered = files.filter((f) => f.path !== normalPath);
  await AsyncStorage.setItem(getStorageKey(workspaceId), JSON.stringify(filtered));
  return { deleted: normalPath };
};

export const deleteWorkspace = async (workspaceId: string) => {
  await AsyncStorage.removeItem(getStorageKey(workspaceId));
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
  
  if (typeof window !== 'undefined' && window.document) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    return link.href;
  }
  return '';
};

export const exportWorkspaceArchive = async (workspaceId: string, title = 'workspace') => {
  const files = await listWorkspaceFiles(workspaceId);
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  const archiveBlob = await zip.generateAsync({ type: 'blob' });
  const fileName = `${safeSegment(title || workspaceId)}.zip`;

  if (typeof window !== 'undefined' && window.document) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(archiveBlob);
    link.download = fileName;
    link.click();
    return link.href;
  }

  return '';
};
