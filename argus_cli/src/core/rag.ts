import { Database } from './db.js';

const uuid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class RAGEngine {
  constructor(private db: Database) {}

  index(content: string, source = ''): void {
    const id = uuid();
    const now = Date.now();
    const keywords = this.extractKeywords(content);

    this.db.run(
      'INSERT INTO rag_chunks (id, content, source, created_at) VALUES (?, ?, ?, ?)',
      [id, content, source, now]
    );

    for (const keyword of keywords) {
      this.db.run(
        'INSERT INTO rag_keywords (chunk_id, keyword) VALUES (?, ?)',
        [id, keyword]
      );
    }
    this.db.save();
  }

  search(query: string, limit = 5): { content: string; source: string; score: number }[] {
    const keywords = this.extractKeywords(query);
    if (keywords.length === 0) return [];

    const placeholders = keywords.map(() => '?').join(',');
    const params: unknown[] = [...keywords, limit];
    const results = this.db.queryObjects<{ content: string; source: string; count: number }>(
      `SELECT rc.content, rc.source, COUNT(rk.chunk_id) AS count
       FROM rag_chunks rc
       JOIN rag_keywords rk ON rc.id = rk.chunk_id
       WHERE rk.keyword IN (${placeholders})
       GROUP BY rc.id
       ORDER BY count DESC
       LIMIT ?`,
      params
    );

    return results.map(r => ({
      content: r.content,
      source: r.source,
      score: r.count / keywords.length,
    }));
  }

  async buildContext(query: string, maxChunks = 3): Promise<string> {
    const results = this.search(query, maxChunks);
    if (results.length === 0) return '';

    return results.map((r, i) =>
      `[Context ${i + 1}]${r.source ? ` (from: ${r.source})` : ''}\n${r.content}`
    ).join('\n\n');
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && w.length < 30);

    const freq = new Map<string, number>();
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w)
      .filter(w => !['this', 'that', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where', 'which', 'their', 'there', 'about', 'would', 'could', 'should', 'after', 'before'].includes(w));
  }

  clear(): void {
    this.db.run('DELETE FROM rag_keywords');
    this.db.run('DELETE FROM rag_chunks');
    this.db.save();
  }
}
