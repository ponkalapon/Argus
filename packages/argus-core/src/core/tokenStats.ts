import { Database } from './db.js';

export class TokenStats {
  constructor(private db: Database) {}

  record(sessionId: string, inputTokens: number, outputTokens: number): void {
    this.db.run(
      'INSERT INTO token_stats (session_id, input_tokens, output_tokens, total_tokens, created_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, inputTokens, outputTokens, inputTokens + outputTokens, Date.now()]
    );
    this.db.save();
  }

  getSessionStats(sessionId: string): { input: number; output: number; total: number } {
    const result = this.db.get<{ input: number; output: number; total: number }>(
      `SELECT COALESCE(SUM(input_tokens), 0) AS input,
              COALESCE(SUM(output_tokens), 0) AS output,
              COALESCE(SUM(total_tokens), 0) AS total
       FROM token_stats WHERE session_id = ?`,
      [sessionId]
    );
    return result || { input: 0, output: 0, total: 0 };
  }

  getTotalStats(): { input: number; output: number; total: number } {
    const result = this.db.get<{ input: number; output: number; total: number }>(
      `SELECT COALESCE(SUM(input_tokens), 0) AS input,
              COALESCE(SUM(output_tokens), 0) AS output,
              COALESCE(SUM(total_tokens), 0) AS total
       FROM token_stats`
    );
    return result || { input: 0, output: 0, total: 0 };
  }

  getAllSessionSummaries(): { sessionId: string; input: number; output: number; total: number }[] {
    return this.db.queryObjects<{ sessionId: string; input: number; output: number; total: number }>(
      `SELECT session_id AS sessionId,
              COALESCE(SUM(input_tokens), 0) AS input,
              COALESCE(SUM(output_tokens), 0) AS output,
              COALESCE(SUM(total_tokens), 0) AS total
       FROM token_stats
       GROUP BY session_id
       ORDER BY total DESC
       LIMIT 20`
    );
  }
}
