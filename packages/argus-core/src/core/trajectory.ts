import { Database } from './db.js';

export class TrajectoryTracker {
  constructor(private db: Database) {}

  log(sessionId: string, action: string, details = ''): void {
    this.db.run(
      'INSERT INTO trajectory (session_id, action, details, created_at) VALUES (?, ?, ?, ?)',
      [sessionId, action, details, Date.now()]
    );
    this.db.save();
  }

  getSessionTrajectory(sessionId: string, limit = 50): { action: string; details: string; createdAt: number }[] {
    return this.db.queryObjects<{ action: string; details: string; createdAt: number }>(
      'SELECT action, details, created_at AS createdAt FROM trajectory WHERE session_id = ? ORDER BY created_at ASC LIMIT ?',
      [sessionId, limit]
    );
  }

  getRecent(limit = 20): { sessionId: string; action: string; details: string; createdAt: number }[] {
    return this.db.queryObjects<{ sessionId: string; action: string; details: string; createdAt: number }>(
      'SELECT session_id AS sessionId, action, details, created_at AS createdAt FROM trajectory ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }
}
