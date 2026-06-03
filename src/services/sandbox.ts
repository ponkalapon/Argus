import AsyncStorage from '@react-native-async-storage/async-storage';
import { writeWorkspaceFile, readWorkspaceFile, listWorkspaceFiles, deleteWorkspaceFile } from './workspace';

const SANDBOX_INDEX_KEY = '@sandbox_index';

export type Sandbox = {
  id: string;
  name: string;
  createdAt: number;
  lastActive: number;
};

let cache: Sandbox[] | null = null;

const load = async (): Promise<Sandbox[]> => {
  if (cache) return cache;
  const raw = await AsyncStorage.getItem(SANDBOX_INDEX_KEY);
  cache = raw ? JSON.parse(raw) : [];
  return cache!;
};

const save = async (entries: Sandbox[]) => {
  cache = entries;
  await AsyncStorage.setItem(SANDBOX_INDEX_KEY, JSON.stringify(entries));
};

export const sandboxId = (name?: string) =>
  `${name?.replace(/\s+/g, '_').toLowerCase() || 'sandbox'}_${Date.now()}`;

export const createSandbox = async (name: string): Promise<Sandbox> => {
  const entries = await load();
  const sb: Sandbox = {
    id: sandboxId(name),
    name,
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
  entries.push(sb);
  await save(entries);
  return sb;
};

export const listSandboxes = async (): Promise<Sandbox[]> => {
  const entries = await load();
  return entries.sort((a, b) => b.lastActive - a.lastActive);
};

export const getSandbox = async (id: string): Promise<Sandbox | undefined> => {
  const entries = await load();
  return entries.find((s) => s.id === id);
};

export const deleteSandbox = async (id: string): Promise<boolean> => {
  const entries = await load();
  const idx = entries.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  await save(entries);
  return true;
};

export const touchSandbox = async (id: string) => {
  const entries = await load();
  const sb = entries.find((s) => s.id === id);
  if (!sb) return;
  sb.lastActive = Date.now();
  await save(entries);
};

export const sandboxPrefix = (sbId: string) => `sandbox_${sbId}`;

export const sandboxWriteFile = async (sbId: string, path: string, content: string) => {
  const prefixed = `${sandboxPrefix(sbId)}/${path}`;
  return writeWorkspaceFile(sbId, prefixed, content);
};

export const sandboxReadFile = async (sbId: string, path: string) => {
  const prefixed = `${sandboxPrefix(sbId)}/${path}`;
  return readWorkspaceFile(sbId, prefixed);
};

export const sandboxListFiles = async (sbId: string) => {
  const files = await listWorkspaceFiles(sbId);
  const prefix = sandboxPrefix(sbId);
  return files
    .filter((f) => f.path.startsWith(prefix))
    .map((f) => ({
      ...f,
      path: f.path.replace(`${prefix}/`, ''),
    }));
};

export const sandboxDeleteFile = async (sbId: string, path: string) => {
  const prefixed = `${sandboxPrefix(sbId)}/${path}`;
  return deleteWorkspaceFile(sbId, prefixed);
};
