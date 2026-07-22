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

export type ApiFormat = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'kobold' | 'textgen';

export type AgentSettings = {
  baseUrl: string;
  model: string;
  allowAssistantContacts: boolean;
  internetEnabled: boolean;
  apiFormat: ApiFormat;
  language: string;
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
  contactsAccessEnabled?: boolean;
  requestContactDisclosure?: (payload: {
    query: string;
    results: { id: string; name: string; phoneCount: number; maskedPhones: string[] }[];
  }) => Promise<boolean>;
  confirmCommunication?: (payload: { action: 'call' | 'sms'; phone: string; name?: string }) => Promise<boolean>;
};

export type ChatCompletionRequest = {
  settings: AgentSettings;
  apiKey: string;
  messages: ChatCompletionMessage[];
  context?: ChatCompletionContext;
  onToken?: (token: string) => void;
  tools?: any[];
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
