// ─── Core types for Argus CLI / Core ───

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  id: string;
  role: Exclude<Role, 'system' | 'tool'>;
  content: string;
  createdAt: number;
}

export interface StoredChat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentSettings {
  baseUrl: string;
  model: string;
  allowAssistantContacts: boolean;
}

export type AgentStatus = 'idle' | 'thinking' | 'error';

export interface ChatCompletionMessage {
  role: Role;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface ChatCompletionResult {
  text: string;
  usage?: TokenUsage;
}

export interface ChatCompletionRequest {
  settings: AgentSettings;
  apiKey: string;
  messages: ChatCompletionMessage[];
  onToken?: (token: string) => void;
  tools?: ToolDefinition[];
}

// ─── Core types ───

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  type: 'fact' | 'preference' | 'session' | 'skill';
  createdAt: number;
  updatedAt: number;
}

export interface SessionRecord {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface RAGChunk {
  id: string;
  content: string;
  source: string;
  embedding?: number[];
  createdAt: number;
}

export interface Skill {
  name: string;
  description: string;
  content: string;
  category?: string;
}

export interface WorkspaceFile {
  path: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Sandbox {
  id: string;
  name: string;
  createdAt: number;
  lastActive: number;
}

// ─── API types ───

export interface ApiRequest {
  type: 'chat' | 'memory' | 'session' | 'search' | 'tools' | 'sandbox' | 'system';
  payload: Record<string, unknown>;
}

export interface ApiResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

// ─── CLI config ───

export interface CLIConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  dataDir: string;
  port: number;
  allowAssistantContacts: boolean;
}
