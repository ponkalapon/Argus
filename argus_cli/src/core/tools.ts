import { ToolDefinition, ToolHandler } from '../types.js';

export class ToolRegistry {
  private tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>();

  /** Register a tool */
  register(name: string, description: string, parameters: Record<string, unknown>, handler: ToolHandler): void {
    this.tools.set(name, {
      definition: {
        type: 'function',
        function: { name, description, parameters },
      },
      handler,
    });
  }

  /** Get tool definitions for LLM API */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  /** Execute a tool by name */
  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.handler(args);
  }

  /** Check if a tool exists */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** List registered tools */
  list(): { name: string; description: string }[] {
    return Array.from(this.tools.entries()).map(([name, t]) => ({
      name,
      description: t.definition.function.description,
    }));
  }

  /** Register built-in tools */
  registerBuiltins(): void {
    this.register(
      'read_file',
      'Read the contents of a file from the workspace',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
        },
        required: ['path'],
      },
      async (args) => {
        return `[read_file] path=${args.path}`;
      }
    );

    this.register(
      'write_file',
      'Write content to a file in the workspace',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
      async (args) => {
        return `[write_file] path=${args.path}, size=${String(args.content || '').length} chars`;
      }
    );

    this.register(
      'web_search',
      'Search the web for information',
      {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
      async (args) => {
        return `[web_search] query="${args.query}"`;
      }
    );

    this.register(
      'memory_set',
      'Store information in long-term memory',
      {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Memory key' },
          value: { type: 'string', description: 'Value to remember' },
        },
        required: ['key', 'value'],
      },
      async (args) => {
        return `[memory_set] ${args.key}=${args.value}`;
      }
    );

    this.register(
      'memory_get',
      'Retrieve information from long-term memory',
      {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
      async (args) => {
        return `[memory_get] query="${args.query}"`;
      }
    );
  }
}
