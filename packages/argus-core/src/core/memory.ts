import { Database } from './db.js';
import { MemoryEntry } from '../types.js';

const uuid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class MemoryManager {
  constructor(private db: Database) {}

  set(key: string, value: string, type: MemoryEntry['type'] = 'fact'): void {
    const now = Date.now();
    const existing = this.db.get<{ id: string }>('SELECT id FROM memory WHERE key = ?', [key]);
    if (existing) {
      this.db.run('UPDATE memory SET value = ?, updated_at = ? WHERE key = ?', [value, now, key]);
    } else {
      this.db.run(
        'INSERT INTO memory (id, key, value, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid(), key, value, type, now, now]
      );
    }
    this.db.save();
  }

  get(key: string): MemoryEntry | null {
    return this.db.get<MemoryEntry>(
      'SELECT id, key, value, type, created_at AS createdAt, updated_at AS updatedAt FROM memory WHERE key = ?',
      [key]
    );
  }

  search(query: string, type?: string): MemoryEntry[] {
    let sql = `SELECT id, key, value, type, created_at AS createdAt, updated_at AS updatedAt 
               FROM memory WHERE (key LIKE ? OR value LIKE ?)`;
    const params: unknown[] = [`%${query}%`, `%${query}%`];
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY updated_at DESC LIMIT 50';
    return this.db.queryObjects<MemoryEntry>(sql, params);
  }

  delete(key: string): boolean {
    const existing = this.db.get<{ id: string }>('SELECT id FROM memory WHERE key = ?', [key]);
    if (!existing) return false;
    this.db.run('DELETE FROM memory WHERE key = ?', [key]);
    this.db.save();
    return true;
  }

  list(type?: string): MemoryEntry[] {
    let sql = `SELECT id, key, value, type, created_at AS createdAt, updated_at AS updatedAt 
               FROM memory`;
    const params: unknown[] = [];
    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }
    sql += ' ORDER BY updated_at DESC LIMIT 100';
    return this.db.queryObjects<MemoryEntry>(sql, params.length > 0 ? params : undefined);
  }

  async buildContext(query: string): Promise<string> {
    const entries = this.search(query);
    if (entries.length === 0) return '';
    
    const facts = entries.filter(e => e.type === 'fact').map(e => `- ${e.key}: ${e.value}`).join('\n');
    const prefs = entries.filter(e => e.type === 'preference').map(e => `- ${e.key}: ${e.value}`).join('\n');
    
    const parts: string[] = [];
    if (facts) parts.push('📌 Facts:\n' + facts);
    if (prefs) parts.push('⭐ Preferences:\n' + prefs);
    
    return parts.join('\n\n');
  }
}
