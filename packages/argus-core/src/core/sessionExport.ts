import { Database } from './db.js';
import { MemoryManager } from './memory.js';
import { SessionManager } from './session.js';
import * as fsModule from 'node:fs/promises';

export interface ArgusExport {
  version: '1.0';
  exportedAt: string;
  sessions: Array<{
    id:        string;
    title:     string;
    createdAt: number;
    updatedAt: number;
    messages:  Array<{ id: string; role: string; content: string; createdAt: number }>;
  }>;
  memory: Array<{
    id:        string;
    key:       string;
    value:     string;
    type:      string;
    createdAt: number;
    updatedAt: number;
  }>;
}

export class SessionExporter {
  constructor(
    private db:       Database,
    private memory:   MemoryManager,
    private sessions: SessionManager,
  ) {}

  // ── Export ────────────────────────────────────────────────────────────────

  exportAll(): ArgusExport {
    const sessionList = this.sessions.list(9999);
    const sessions = sessionList.map((s) => {
      const full = this.sessions.get(s.id);
      return {
        id:        s.id,
        title:     s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messages:  full?.messages.map((m) => ({
          id:        m.id,
          role:      m.role,
          content:   m.content,
          createdAt: m.createdAt,
        })) ?? [],
      };
    });

    const memory = this.memory.list();

    return {
      version:    '1.0',
      exportedAt: new Date().toISOString(),
      sessions,
      memory: memory.map((m) => ({
        id:        m.id,
        key:       m.key,
        value:     m.value,
        type:      m.type,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    };
  }

  async exportToFile(filepath: string): Promise<void> {
    const json = JSON.stringify(this.exportAll(), null, 2);
    await fsModule.writeFile(filepath, json, 'utf-8');
  }

  toJson(): string {
    return JSON.stringify(this.exportAll(), null, 2);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  importFromJson(json: string): { sessions: number; memory: number } {
    const data: ArgusExport = JSON.parse(json);
    if (data.version !== '1.0') throw new Error(`Unsupported export version: ${data.version}`);
    return this._import(data);
  }

  async importFromFile(filepath: string): Promise<{ sessions: number; memory: number }> {
    const json = await fsModule.readFile(filepath, 'utf-8');
    return this.importFromJson(json);
  }

  private _import(data: ArgusExport): { sessions: number; memory: number } {
    let sessionCount = 0;
    let memoryCount  = 0;

    for (const s of data.sessions) {
      // Skip if session already exists
      const existing = this.sessions.get(s.id);
      if (existing) continue;

      // Create session with original id via raw SQL (SessionManager.create() auto-generates id)
      this.db.run(
        'INSERT OR IGNORE INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [s.id, s.title, s.createdAt, s.updatedAt],
      );
      for (const m of s.messages) {
        this.db.run(
          'INSERT OR IGNORE INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
          [m.id, s.id, m.role, m.content, m.createdAt],
        );
      }
      this.db.save();
      sessionCount++;
    }

    for (const m of data.memory) {
      this.memory.set(m.key, m.value, m.type as 'fact' | 'preference');
      memoryCount++;
    }

    return { sessions: sessionCount, memory: memoryCount };
  }
}
