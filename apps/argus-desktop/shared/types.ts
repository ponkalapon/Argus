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
  allowAssistantContacts: boolean;
  internetEnabled: boolean;
  apiFormat: 'openai' | 'ollama' | 'anthropic' | 'kobold';
  language: string;
};

export type AgentStatus = 'idle' | 'thinking' | 'error';

export type ProjectInfo = {
  path: string;
  name: string;
};

export type ChatCompletionMessage = {
  role: Role;
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

export type ChatCompletionResult = {
  text: string;
  usage?: { input: number; output: number; total: number };
};

export type ChatCompletionRequest = {
  settings: AgentSettings;
  apiKey: string;
  messages: ChatCompletionMessage[];
  context?: {
    workspaceId?: string;
    workspaceContext?: string;
  };
  onToken?: (token: string) => void;
  tools?: any[];
};

declare global {
  interface Window {
    argus: {
      selectFolder: () => Promise<string | null>;
      loadProjects: () => Promise<ProjectInfo[]>;
      saveProjects: (projects: ProjectInfo[]) => Promise<boolean>;
      loadSettings: () => Promise<AgentSettings>;
      saveSettings: (settings: AgentSettings) => Promise<boolean>;
      loadApiKey: () => Promise<string>;
      saveApiKey: (key: string) => Promise<boolean>;
      listFiles: (projectPath: string) => Promise<{ path: string; name: string; isDir: boolean; size: number }[]>;
      readFile: (projectPath: string, filePath: string) => Promise<{ content?: string; error?: string }>;
      writeFile: (projectPath: string, filePath: string, content: string) => Promise<{ success?: boolean; error?: string }>;
      getProjectName: (projectPath: string) => Promise<string>;
      loadChats: (projectPath: string) => Promise<StoredChat[]>;
      saveChats: (projectPath: string, chats: StoredChat[]) => Promise<boolean>;
      onNavigate: (callback: (screen: string) => void) => void;
    };
  }
}
