import { Database } from './db.js';

const uuid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class WorkspaceManager {
  constructor(private db: Database) {}

  writeFile(workspaceId: string, filePath: string, content: string): void {
    const now = Date.now();
    const existing = this.db.get<{ id: string }>(
      'SELECT id FROM workspace_files WHERE workspace_id = ? AND path = ?',
      [workspaceId, filePath]
    );

    if (existing) {
      this.db.run('UPDATE workspace_files SET content = ?, updated_at = ? WHERE id = ?', [content, now, existing.id]);
    } else {
      this.db.run(
        'INSERT INTO workspace_files (id, workspace_id, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid(), workspaceId, filePath, content, now, now]
      );
    }
    this.db.save();
  }

  readFile(workspaceId: string, filePath: string): string | null {
    const file = this.db.get<{ content: string }>(
      'SELECT content FROM workspace_files WHERE workspace_id = ? AND path = ?',
      [workspaceId, filePath]
    );
    return file?.content ?? null;
  }

  listFiles(workspaceId: string): { path: string; createdAt: number; updatedAt: number }[] {
    return this.db.queryObjects<{ path: string; createdAt: number; updatedAt: number }>(
      'SELECT path, created_at AS createdAt, updated_at AS updatedAt FROM workspace_files WHERE workspace_id = ? ORDER BY path',
      [workspaceId]
    );
  }

  deleteFile(workspaceId: string, filePath: string): boolean {
    const existing = this.db.get<{ id: string }>(
      'SELECT id FROM workspace_files WHERE workspace_id = ? AND path = ?',
      [workspaceId, filePath]
    );
    if (!existing) return false;
    this.db.run('DELETE FROM workspace_files WHERE id = ?', [existing.id]);
    this.db.save();
    return true;
  }

  exportWorkspace(workspaceId: string): Record<string, string> | null {
    const files = this.listFiles(workspaceId);
    if (files.length === 0) return null;
    const archive: Record<string, string> = {};
    for (const f of files) {
      const content = this.readFile(workspaceId, f.path);
      if (content !== null) archive[f.path] = content;
    }
    return archive;
  }
}
