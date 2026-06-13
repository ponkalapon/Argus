import { Database } from './db.js';
import { MemoryManager } from './memory.js';
import { SessionManager } from './session.js';
import { LLMClient } from './llm.js';
import { WorkspaceManager } from './workspace.js';
import { ToolRegistry } from './tools.js';
import { RAGEngine } from './rag.js';
import { Soul } from './soul.js';
import { SkillsManager } from './skills.js';
import { TrajectoryTracker } from './trajectory.js';
import { TokenStats } from './tokenStats.js';
import { WebSearch } from './webSearch.js';

export class ArgusCore {
  db: Database;
  memory: MemoryManager;
  sessions: SessionManager;
  llm: LLMClient;
  workspace: WorkspaceManager;
  tools: ToolRegistry;
  rag: RAGEngine;
  soul: Soul;
  skills: SkillsManager;
  trajectory: TrajectoryTracker;
  tokenStats: TokenStats;
  webSearch: WebSearch;
  settings: {
    baseUrl: string;
    model: string;
    apiKey: string;
    dataDir: string;
    port: number;
  };

  constructor(opts?: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    dataDir?: string;
    port?: number;
  }) {
    this.settings = {
      baseUrl: opts?.baseUrl || 'https://api.openai.com/v1',
      model: opts?.model || 'gpt-4o-mini',
      apiKey: opts?.apiKey || '',
      dataDir: opts?.dataDir || '',
      port: opts?.port || 3456,
    };

    this.db = new Database(this.settings.dataDir);
    this.memory = new MemoryManager(this.db);
    this.sessions = new SessionManager(this.db);
    this.llm = new LLMClient();
    this.workspace = new WorkspaceManager(this.db);
    this.tools = new ToolRegistry();
    this.rag = new RAGEngine(this.db);
    this.skills = new SkillsManager(this.db);
    this.trajectory = new TrajectoryTracker(this.db);
    this.tokenStats = new TokenStats(this.db);
    this.webSearch = new WebSearch();

    // Soul depends on memory, rag, tools
    this.soul = new Soul(this.memory, this.rag, this.tools);
  }

  async init(): Promise<void> {
    await this.db.init();
    this.tools.registerBuiltins();
  }

  async chat(sessionId: string, userMessage: string): Promise<string> {
    // Add user message
    this.sessions.addMessage(sessionId, 'user', userMessage);
    this.trajectory.log(sessionId, 'user_message', userMessage.slice(0, 200));

    // Build system prompt
    const systemPrompt = await this.soul.buildSystemPrompt();

    // Get conversation context
    const contextMessages = this.sessions.getContextMessages(sessionId, systemPrompt, 30);

    // Add rag context if relevant
    const ragContext = await this.rag.buildContext(userMessage);
    if (ragContext) {
      // Insert RAG context as a system message
      contextMessages.push({
        role: 'system' as const,
        content: `Relevant context from knowledge base:\n${ragContext}`,
      });
    }

    // Call LLM
    const result = await this.llm.chat({
      settings: { baseUrl: this.settings.baseUrl, model: this.settings.model, allowAssistantContacts: true },
      apiKey: this.settings.apiKey,
      messages: contextMessages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
      tools: this.tools.getDefinitions(),
    });

    // Record token usage
    if (result.usage) {
      this.tokenStats.record(sessionId, result.usage.input, result.usage.output);
    }

    // Add assistant response
    this.sessions.addMessage(sessionId, 'assistant', result.text);
    this.trajectory.log(sessionId, 'assistant_message', result.text.slice(0, 200));

    return result.text;
  }
}

export { SessionExporter, ArgusExport } from './sessionExport.js';
