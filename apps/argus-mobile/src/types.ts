export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'ollama'
  | 'mistral'
  | 'cohere'
  | 'groq'
  | 'together'
  | 'xai'
  | 'deepseek'
  | 'azure'
  | 'custom';

/**
 * Схема авторизации для провайдера:
 * - apiKey   — Bearer token или x-api-key header
 * - oauth    — OAuth 2.0 (access token)
 * - none     — авторизация не нужна (Ollama local)
 * - azure    — API Key + resourceName + deploymentId
 */
export type AuthScheme = 'apiKey' | 'oauth' | 'none' | 'azure';

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
  provider: LLMProvider;
  baseUrl: string;
  model: string;
  allowAssistantContacts: boolean;
  /** Дополнительные поля для Azure */
  azureResourceName?: string;
  azureDeploymentId?: string;
  azureApiVersion?: string;
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
