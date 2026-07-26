import AsyncStorage from '@react-native-async-storage/async-storage';

export type McpServerStatus = 'untested' | 'ok' | 'error';

export interface McpServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  status: McpServerStatus;
  statusMessage?: string;
  /** Tool definitions fetched from this server */
  tools?: McpToolDef[];
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

const KEY = '@argus_mcp_servers_v1';

export const loadMcpServers = async (): Promise<McpServer[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as McpServer[];
  } catch {
    return [];
  }
};

export const saveMcpServers = async (servers: McpServer[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(servers));
  } catch {}
};

export const addMcpServer = async (server: Omit<McpServer, 'id'>): Promise<McpServer> => {
  const servers = await loadMcpServers();
  const newServer: McpServer = {
    ...server,
    id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  await saveMcpServers([...servers, newServer]);
  return newServer;
};

export const updateMcpServer = async (id: string, updates: Partial<McpServer>): Promise<void> => {
  const servers = await loadMcpServers();
  await saveMcpServers(servers.map((s) => (s.id === id ? { ...s, ...updates } : s)));
};

export const deleteMcpServer = async (id: string): Promise<void> => {
  const servers = await loadMcpServers();
  await saveMcpServers(servers.filter((s) => s.id !== id));
};
