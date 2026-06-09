import { MemoryManager } from './memory.js';
import { RAGEngine } from './rag.js';
import { ToolRegistry } from './tools.js';

export class Soul {
  constructor(
    private memory: MemoryManager,
    private rag: RAGEngine,
    private tools: ToolRegistry
  ) {}

  /** Build the system prompt for the agent */
  async buildSystemPrompt(): Promise<string> {
    const memories = this.memory.list();
    const facts = memories.filter(m => m.type === 'fact').slice(0, 20);
    const prefs = memories.filter(m => m.type === 'preference').slice(0, 10);

    const parts: string[] = [
      'You are Argus — an intelligent, helpful AI assistant running as a local CLI agent.',
      'You have access to long-term memory, a RAG knowledge base, and various tools.',
      'You are running on the user\'s machine with direct access to their workspace.',
      '',
      'Guidelines:',
      '- Be concise and helpful.',
      '- Use tools when they can provide better answers.',
      '- Remember user preferences and important facts.',
      '- When you need to search memory or knowledge, use the appropriate tools.',
      '- You can execute code, read/write files, and search the web.',
    ];

    if (facts.length > 0) {
      parts.push('', '📌 Known facts about the user:');
      for (const f of facts) {
        parts.push(`- ${f.key}: ${f.value}`);
      }
    }

    if (prefs.length > 0) {
      parts.push('', '⭐ User preferences:');
      for (const p of prefs) {
        parts.push(`- ${p.key}: ${p.value}`);
      }
    }

    const toolDefs = this.tools.list();
    if (toolDefs.length > 0) {
      parts.push('', '🛠️ Available tools:');
      for (const t of toolDefs) {
        parts.push(`- ${t.name}: ${t.description}`);
      }
    }

    return parts.join('\n');
  }

  /** Get a personality description for the agent */
  getPersonality(): string {
    return `Argus — local AI agent with memory, RAG, and tools.`;
  }
}
