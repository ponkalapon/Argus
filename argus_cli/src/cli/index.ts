import * as readline from 'node:readline';
import { ArgusCore } from '../core/index.js';

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';
const GRAY = '\x1b[90m';

export class CLI {
  private core: ArgusCore;
  private currentSessionId: string | null = null;
  private rl: readline.Interface | null = null;

  constructor(core: ArgusCore) {
    this.core = core;
  }

  async start(): Promise<void> {
    console.log(`${BOLD}${CYAN}
   ╔══════════════════════════════╗
   ║        ${WHITE}ARGUS${CYAN} CLI          ║
   ║    ${GRAY}Local AI Agent${CYAN}          ║
   ╚══════════════════════════════╝${RESET}
    `);

    const baseUrl = this.core.settings.baseUrl;
    const model = this.core.settings.model;
    const apiKeyOk = this.core.settings.apiKey ? '✓' : '✗';
    console.log(`${GRAY}Endpoint: ${baseUrl}${RESET}`);
    console.log(`${GRAY}Model:    ${model}${RESET}`);
    console.log(`${GRAY}API Key:  ${apiKeyOk}${RESET}`);
    console.log(`${GRAY}DB:       ${this.core.db.getDbPath()}${RESET}`);
    console.log('');

    // Check for missing API key
    if (!this.core.settings.apiKey) {
      console.log(`${YELLOW}⚠ No API key configured. Set with: /config apiKey <your-key>${RESET}`);
      console.log('');
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${CYAN}argus> ${RESET}`,
    });

    // Create or resume session
    const sessions = this.core.sessions.list(5);
    if (sessions.length > 0) {
      this.currentSessionId = sessions[0].id;
      console.log(`${GRAY}Resumed session: ${sessions[0].title} (${this.currentSessionId.slice(0, 8)}…)${RESET}`);
      // Show last 3 messages
      const session = this.core.sessions.get(this.currentSessionId);
      if (session && session.messages.length > 0) {
        const recent = session.messages.slice(-3);
        for (const msg of recent) {
          const label = msg.role === 'user' ? 'You' : 'Argus';
          const color = msg.role === 'user' ? GREEN : CYAN;
          const content = msg.content.length > 120 ? msg.content.slice(0, 120) + '…' : msg.content;
          console.log(`  ${color}${label}:${RESET} ${content}`);
        }
      }
    } else {
      this.currentSessionId = this.core.sessions.create();
      console.log(`${GRAY}New session created: ${this.currentSessionId.slice(0, 8)}…${RESET}`);
      console.log(`${GRAY}Type your message or /help for commands${RESET}`);
    }

    console.log('');
    this.rl.prompt();

    this.rl.on('line', async (line: string) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
      } else if (trimmed) {
        await this.handleMessage(trimmed);
      }
      this.rl?.prompt();
    });

    this.rl.on('close', () => {
      console.log(`\n${YELLOW}Goodbye!${RESET}`);
      this.core.db.close();
      process.exit(0);
    });
  }

  private async handleCommand(cmd: string): Promise<void> {
    const parts = cmd.slice(1).split(' ').filter(Boolean);
    const command = parts[0]?.toLowerCase();

    switch (command) {
      case 'help':
        this.showHelp();
        break;

      case 'new':
        this.currentSessionId = this.core.sessions.create();
        console.log(`${GREEN}✓ New session started: ${this.currentSessionId.slice(0, 8)}…${RESET}`);
        break;

      case 'sessions': {
        const sessions = this.core.sessions.list(10);
        if (sessions.length === 0) {
          console.log(`${YELLOW}No sessions yet.${RESET}`);
        } else {
          console.log(`${BOLD}Sessions:${RESET}`);
          for (const s of sessions) {
            const active = s.id === this.currentSessionId ? ' ←' : '';
            console.log(`  ${s.id.slice(0, 8)}… ${s.title} (${s.messageCount} msgs)${active}`);
          }
        }
        break;
      }

      case 'switch': {
        const id = parts[1];
        if (!id) {
          console.log(`${YELLOW}Usage: /switch <session-id-prefix>${RESET}`);
          break;
        }
        const sessions = this.core.sessions.list(20);
        const match = sessions.find(s => s.id.startsWith(id));
        if (match) {
          this.currentSessionId = match.id;
          console.log(`${GREEN}✓ Switched to: ${match.title}${RESET}`);
        } else {
          console.log(`${RED}✗ Session not found: ${id}${RESET}`);
        }
        break;
      }

      case 'rename': {
        const name = parts.slice(1).join(' ');
        if (this.currentSessionId && name) {
          this.core.sessions.rename(this.currentSessionId, name);
          console.log(`${GREEN}✓ Session renamed to: ${name}${RESET}`);
        }
        break;
      }

      case 'delete': {
        const id = parts[1] || this.currentSessionId;
        if (id) {
          const sessions = this.core.sessions.list(20);
          const match = sessions.find(s => s.id.startsWith(id));
          if (match) {
            this.core.sessions.delete(match.id);
            console.log(`${GREEN}✓ Deleted session: ${match.title}${RESET}`);
            if (this.currentSessionId === match.id) {
              const remaining = this.core.sessions.list(1);
              this.currentSessionId = remaining.length > 0 ? remaining[0].id : this.core.sessions.create();
              console.log(`${GRAY}Switched to: ${this.currentSessionId.slice(0, 8)}…${RESET}`);
            }
          } else {
            console.log(`${RED}✗ Session not found${RESET}`);
          }
        }
        break;
      }

      case 'memory':
      case 'mem': {
        const sub = parts[1];
        if (sub === 'list') {
          const entries = this.core.memory.list();
          if (entries.length === 0) {
            console.log(`${YELLOW}No memories yet.${RESET}`);
          } else {
            console.log(`${BOLD}Memory:${RESET}`);
            for (const e of entries) {
              const icon = e.type === 'preference' ? '⭐' : e.type === 'fact' ? '📌' : '📝';
              console.log(`  ${icon} [${e.type}] ${e.key}: ${e.value}`);
            }
          }
        } else if (sub === 'delete') {
          const key = parts.slice(2).join(' ');
          if (key && this.core.memory.delete(key)) {
            console.log(`${GREEN}✓ Deleted: ${key}${RESET}`);
          }
        } else if (sub === 'search') {
          const query = parts.slice(2).join(' ');
          const results = this.core.memory.search(query);
          if (results.length === 0) {
            console.log(`${YELLOW}No results for "${query}"${RESET}`);
          } else {
            for (const r of results) {
              console.log(`  [${r.type}] ${r.key}: ${r.value}`);
            }
          }
        } else {
          console.log(`${YELLOW}Usage: /memory <list|delete|search> [args]${RESET}`);
        }
        break;
      }

      case 'config': {
        const key = parts[1];
        const value = parts.slice(2).join(' ');
        if (key && value) {
          if (key === 'apiKey') {
            this.core.settings.apiKey = value;
            console.log(`${GREEN}✓ API key updated${RESET}`);
          } else if (key === 'model') {
            this.core.settings.model = value;
            console.log(`${GREEN}✓ Model updated: ${value}${RESET}`);
          } else if (key === 'baseUrl') {
            this.core.settings.baseUrl = value;
            console.log(`${GREEN}✓ Base URL updated: ${value}${RESET}`);
          } else {
            console.log(`${YELLOW}Unknown config: ${key}${RESET}`);
          }
        } else {
          console.log(`${BOLD}Configuration:${RESET}`);
          console.log(`  Model:   ${this.core.settings.model}`);
          console.log(`  URL:     ${this.core.settings.baseUrl}`);
          console.log(`  API Key: ${this.core.settings.apiKey ? '✓ set' : '✗ not set'}`);
          console.log(`  Port:    ${this.core.settings.port}`);
          console.log(`Use /config <key> <value> to change`);
        }
        break;
      }

      case 'stats': {
        const total = this.core.tokenStats.getTotalStats();
        console.log(`${BOLD}Token Usage:${RESET}`);
        console.log(`  Total:   ${total.total.toLocaleString()}`);
        console.log(`  Input:   ${total.input.toLocaleString()}`);
        console.log(`  Output:  ${total.output.toLocaleString()}`);
        if (this.currentSessionId) {
          const session = this.core.tokenStats.getSessionStats(this.currentSessionId);
          console.log(`  Session: ${session.total.toLocaleString()}`);
        }
        break;
      }

      case 'export': {
        if (this.currentSessionId) {
          const session = this.core.sessions.get(this.currentSessionId);
          if (session) {
            const json = JSON.stringify(session, null, 2);
            console.log(json);
          }
        }
        break;
      }

      case 'api':
        console.log(`Starting API server on port ${this.core.settings.port}...`);
        const { startApiServer } = await import('../api/server.js');
        startApiServer(this.core);
        break;

      case 'exit':
      case 'quit':
        console.log(`${YELLOW}Goodbye!${RESET}`);
        this.core.db.close();
        process.exit(0);

      default:
        console.log(`${YELLOW}Unknown command: /${command}${RESET}`);
        console.log(`Type ${CYAN}/help${RESET} for available commands`);
    }
  }

  private async handleMessage(text: string): Promise<void> {
    if (!this.currentSessionId) {
      this.currentSessionId = this.core.sessions.create();
    }

    try {
      process.stdout.write(`${CYAN}Argus thinking…${RESET}\r`);

      let fullResponse = '';
      const result = await this.core.llm.chat({
        settings: { baseUrl: this.core.settings.baseUrl, model: this.core.settings.model, allowAssistantContacts: true },
        apiKey: this.core.settings.apiKey,
        messages: [
          { role: 'system', content: `You are Argus CLI — helpful AI assistant. Current time: ${new Date().toISOString()}` },
          { role: 'user', content: text },
        ],
        onToken: (token) => {
          if (!fullResponse) {
            process.stdout.write('\r' + ' '.repeat(50) + '\r');
          }
          process.stdout.write(token);
          fullResponse += token;
        },
      });

      // Save to session
      this.core.sessions.addMessage(this.currentSessionId, 'user', text);
      this.core.sessions.addMessage(this.currentSessionId, 'assistant', result.text);

      if (result.usage) {
        this.core.tokenStats.record(this.currentSessionId, result.usage.input, result.usage.output);
      }

      // Auto-generate session title from first exchange
      const session = this.core.sessions.get(this.currentSessionId);
      if (session && session.messages.length <= 2) {
        const title = text.length > 50 ? text.slice(0, 50) + '…' : text;
        this.core.sessions.rename(this.currentSessionId, title);
      }

      process.stdout.write('\n\n');
    } catch (error) {
      process.stdout.write('\n');
      console.log(`${RED}✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}${RESET}`);
    }
  }

  private showHelp(): void {
    console.log(`${BOLD}Commands:${RESET}`);
    console.log(`  ${CYAN}/help${RESET}          Show this help`);
    console.log(`  ${CYAN}/new${RESET}           Start new session`);
    console.log(`  ${CYAN}/sessions${RESET}      List sessions`);
    console.log(`  ${CYAN}/switch <id>${RESET}   Switch to session`);
    console.log(`  ${CYAN}/rename <name>${RESET} Rename current session`);
    console.log(`  ${CYAN}/delete [id]${RESET}   Delete session`);
    console.log(`  ${CYAN}/memory list${RESET}   Show memories`);
    console.log(`  ${CYAN}/memory search <q>${RESET}`);
    console.log(`  ${CYAN}/memory delete <k>${RESET}`);
    console.log(`  ${CYAN}/config${RESET}        Show config`);
    console.log(`  ${CYAN}/config <k> <v>${RESET} Set config`);
    console.log(`  ${CYAN}/stats${RESET}         Token usage stats`);
    console.log(`  ${CYAN}/export${RESET}        Export session as JSON`);
    console.log(`  ${CYAN}/api${RESET}           Start API server`);
    console.log(`  ${CYAN}/exit${RESET}          Exit`);
    console.log('');
    console.log(`${BOLD}Tips:${RESET}`);
    console.log(`  Type any message to chat with Argus`);
    console.log(`  Use tools: /read_file, /write_file, /web_search`);
  }
}

const WHITE = '\x1b[97m';
