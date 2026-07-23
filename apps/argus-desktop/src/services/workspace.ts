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

const GLOBAL_FOLDER_KEY = '@argus_global_working_folder_v1';
const getStorageKey = (workspaceId: string) => `argus.workspace.${safeSegment(workspaceId)}`;
const getFolderNameKey = (workspaceId: string) => `argus.workspace_folder_name.${safeSegment(workspaceId)}`;

export const ensureWorkspace = async (_workspaceId: string) => {};

export const getWorkspaceFolderName = async (workspaceId: string): Promise<string | null> => {
  const specific = await AsyncStorage.getItem(getFolderNameKey(workspaceId));
  if (specific) return specific;

  const globalFolder = await AsyncStorage.getItem(GLOBAL_FOLDER_KEY);
  if (globalFolder) return globalFolder;

  if (typeof window !== 'undefined' && (window as any).electronAPI?.getDefaultDirectory) {
    try {
      const defaultDir = await (window as any).electronAPI.getDefaultDirectory();
      if (defaultDir) {
        await AsyncStorage.setItem(GLOBAL_FOLDER_KEY, defaultDir);
        return defaultDir;
      }
    } catch {}
  }

  return null;
};

export const setWorkspaceFolderName = async (workspaceId: string, folderName: string) => {
  await AsyncStorage.setItem(getFolderNameKey(workspaceId), folderName);
  await AsyncStorage.setItem(GLOBAL_FOLDER_KEY, folderName);
};

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

  // Write directly to physical hard disk if folder path is configured
  const folderName = await getWorkspaceFolderName(workspaceId);
  if (typeof window !== 'undefined' && (window as any).electronAPI?.writeFile && folderName) {
    try {
      await (window as any).electronAPI.writeFile(folderName, normalPath, content);
    } catch {}
  }

  return {
    path: normalPath,
    size: content.length,
    updatedAt: now,
  };
};

export const importWorkspaceFiles = async (workspaceId: string, newFiles: { path: string; content: string }[], folderName?: string) => {
  const files = await listWorkspaceFiles(workspaceId);
  const now = Date.now();

  newFiles.forEach((nf) => {
    try {
      const normalPath = normalizeRelativePath(nf.path);
      const existingIndex = files.findIndex((f) => f.path === normalPath);
      const fileData: WorkspaceFile = {
        path: normalPath,
        content: nf.content,
        updatedAt: now,
        size: nf.content.length,
      };
      if (existingIndex >= 0) {
        files[existingIndex] = fileData;
      } else {
        files.push(fileData);
      }
    } catch {}
  });

  await AsyncStorage.setItem(getStorageKey(workspaceId), JSON.stringify(files));
  if (folderName) {
    await setWorkspaceFolderName(workspaceId, folderName);
  }
};

export const selectLocalFolderOnPC = async (): Promise<{ folderName: string; files: { path: string; content: string }[] }> => {
  // Electron Native Directory Picker
  if (typeof window !== 'undefined' && (window as any).electronAPI?.selectDirectory) {
    try {
      const dirPath = await (window as any).electronAPI.selectDirectory();
      if (!dirPath) return { folderName: '', files: [] };
      const files = await (window as any).electronAPI.readDirectory(dirPath);
      return { folderName: dirPath, files };
    } catch {
      return { folderName: '', files: [] };
    }
  }

  // HTML5 Web File System Access API
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      const folderName = dirHandle.name;
      const files: { path: string; content: string }[] = [];

      const readDir = async (handle: any, currentPath = '') => {
        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            try {
              const file = await entry.getFile();
              if (file.size < 3 * 1024 * 1024) {
                const content = await file.text();
                const filePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                files.push({ path: filePath, content });
              }
            } catch {}
          } else if (entry.kind === 'directory' && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'build') {
            await readDir(entry, currentPath ? `${currentPath}/${entry.name}` : entry.name);
          }
        }
      };

      await readDir(dirHandle);
      return { folderName, files };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return { folderName: '', files: [] };
    }
  }
  return { folderName: '', files: [] };
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
