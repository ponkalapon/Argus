import { Database } from './db.js';
import { Skill } from '../types.js';

export class SkillsManager {
  constructor(private db: Database) {}

  set(name: string, skill: Omit<Skill, 'name'>): void {
    this.db.run(
      'INSERT OR REPLACE INTO skills (name, description, content, category, updated_at) VALUES (?, ?, ?, ?, ?)',
      [name, skill.description, skill.content, skill.category || '', Date.now()]
    );
    this.db.save();
  }

  get(name: string): Skill | null {
    return this.db.get<Skill>(
      'SELECT name, description, content, category FROM skills WHERE name = ?',
      [name]
    );
  }

  list(category?: string): Skill[] {
    let sql = 'SELECT name, description, content, category FROM skills';
    const params: unknown[] = [];
    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }
    sql += ' ORDER BY name';
    return this.db.queryObjects<Skill>(sql, params.length > 0 ? params : undefined);
  }

  delete(name: string): boolean {
    const existing = this.db.get<{ name: string }>('SELECT name FROM skills WHERE name = ?', [name]);
    if (!existing) return false;
    this.db.run('DELETE FROM skills WHERE name = ?', [name]);
    this.db.save();
    return true;
  }

  search(query: string): Skill[] {
    return this.db.queryObjects<Skill>(
      `SELECT name, description, content, category FROM skills
       WHERE name LIKE ? OR description LIKE ? OR content LIKE ?
       ORDER BY name LIMIT 20`,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );
  }
}
