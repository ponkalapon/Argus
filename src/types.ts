export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type ChatMessage = {
  id: string;
  role: Exclude<Role, 'system' | 'tool'>;
  content: string;
  createdAt: number;
};

export type StoredChat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type AgentSettings = {
  baseUrl: string;
  model: string;
};

export type StoredSettings = AgentSettings;

export type AgentStatus = 'idle' | 'thinking' | 'error';

export type ChatCompletionMessage = {
  role: Role;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
};

export type ChatCompletionContext = {
  workspaceId?: string;
  memoryContext?: string;
  workspaceContext?: string;
};

export type ChatCompletionRequest = {
  settings: AgentSettings;
  apiKey: string;
  messages: ChatCompletionMessage[];
  context?: ChatCompletionContext;
  onToken?: (token: string) => void;
};

export type TokenUsage = {
  input: number;
  output: number;
  total: number;
};

export type ChatCompletionResult = {
  text: string;
  usage?: TokenUsage;
};
