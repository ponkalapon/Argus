import { Database } from './db.js';
import { ChatMessage, SessionRecord } from '../types.js';

const uuid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class SessionManager {
  constructor(private db: Database) {}

  create(title = 'New Chat'): string {
    const id = uuid();
    const now = Date.now();
    this.db.run(
      'INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [id, title, now, now]
    );
    this.db.save();
    return id;
  }

  get(id: string): SessionRecord | null {
    const session = this.db.get<{ id: string; title: string; created_at: number; updated_at: number }>(
      'SELECT * FROM sessions WHERE id = ?', [id]
    );
    if (!session) return null;

    const messages = this.db.queryObjects<ChatMessage>(
      'SELECT id, role, content, created_at AS createdAt FROM messages WHERE session_id = ? ORDER BY created_at ASC',
      [id]
    );

    return {
      id: session.id,
      title: session.title,
      messages,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    };
  }

  list(limit = 20): { id: string; title: string; messageCount: number; createdAt: number; updatedAt: number }[] {
    return this.db.queryObjects(
      `SELECT s.id, s.title, s.created_at AS createdAt, s.updated_at AS updatedAt,
              (SELECT COUNT(*) FROM messages WHERE session_id = s.id) AS messageCount
       FROM sessions s ORDER BY s.updated_at DESC LIMIT ?`,
      [limit]
    ) as { id: string; title: string; messageCount: number; createdAt: number; updatedAt: number }[];
  }

  addMessage(sessionId: string, role: string, content: string): string {
    const id = uuid();
    const now = Date.now();
    this.db.run(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, sessionId, role, content, now]
    );
    this.db.run('UPDATE sessions SET updated_at = ? WHERE id = ?', [now, sessionId]);
    this.db.save();
    return id;
  }

  delete(id: string): boolean {
    const existing = this.db.get<{ id: string }>('SELECT id FROM sessions WHERE id = ?', [id]);
    if (!existing) return false;
    this.db.run('DELETE FROM messages WHERE session_id = ?', [id]);
    this.db.run('DELETE FROM sessions WHERE id = ?', [id]);
    this.db.save();
    return true;
  }

  rename(id: string, title: string): void {
    this.db.run('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?', [title, Date.now(), id]);
    this.db.save();
  }

  search(query: string): { sessionId: string; sessionTitle: string; message: ChatMessage }[] {
    const messages = this.db.queryObjects<{
      id: string; role: string; content: string; created_at: number;
      session_id: string; title: string;
    }>(
      `SELECT m.id, m.role, m.content, m.created_at, m.session_id, s.title
       FROM messages m JOIN sessions s ON m.session_id = s.id
       WHERE m.content LIKE ?
       ORDER BY m.created_at DESC LIMIT 30`,
      [`%${query}%`]
    );

    return messages.map(m => ({
      sessionId: m.session_id,
      sessionTitle: m.title,
      message: { id: m.id, role: m.role as ChatMessage['role'], content: m.content, createdAt: m.created_at },
    }));
  }

  getContextMessages(sessionId: string, systemPrompt = '', limit = 20): { role: string; content: string }[] {
    const messages = this.db.queryObjects<{ role: string; content: string }>(
      'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
    const result: { role: string; content: string }[] = systemPrompt ? [{ role: 'system', content: systemPrompt }] : [];
    const recent = messages.slice(-limit);
    result.push(...recent.map(m => ({ role: m.role, content: m.content })));
    return result;
  }
}
