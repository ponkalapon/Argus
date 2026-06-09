import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class Database {
  private db!: SqlJsDatabase;
  private dbPath: string;

  constructor(dataDir?: string) {
    this.dbPath = path.join(dataDir || path.join(process.cwd(), 'data'), 'argus.db');
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.run('PRAGMA journal_mode=WAL;');
    this.run('PRAGMA foreign_keys=ON;');
    this.createTables();
    this.save();
  }

  private createTables(): void {
    this.run(`
      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'fact',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

    this.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

    this.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`);

    this.run(`
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`);

    this.run(`
      CREATE TABLE IF NOT EXISTS rag_keywords (
        chunk_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        FOREIGN KEY (chunk_id) REFERENCES rag_chunks(id) ON DELETE CASCADE
      )`);

    this.run(`
      CREATE TABLE IF NOT EXISTS skills (
        name TEXT PRIMARY KEY,
        description TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        category TEXT DEFAULT '',
        updated_at INTEGER NOT NULL
      )`);

    this.run(`
      CREATE TABLE IF NOT EXISTS workspace_files (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

    this.run(`
      CREATE TABLE IF NOT EXISTS token_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`);

    this.run(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`);

    this.run(`
      CREATE TABLE IF NOT EXISTS trajectory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT DEFAULT '',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`);

    // Indexes
    this.run('CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key)');
    this.run('CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type)');
    this.run('CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)');
    this.run('CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)');
    this.run('CREATE INDEX IF NOT EXISTS idx_rag_keywords_keyword ON rag_keywords(keyword)');
    this.run('CREATE INDEX IF NOT EXISTS idx_workspace_files_ws ON workspace_files(workspace_id)');
    this.run('CREATE INDEX IF NOT EXISTS idx_token_stats_session ON token_stats(session_id)');
    this.run('CREATE INDEX IF NOT EXISTS idx_trajectory_session ON trajectory(session_id)');
  }

  /** Run SQL with optional positional params */
  run(sql: string, params?: unknown[]): void {
    if (params && params.length > 0) {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
    } else {
      this.db.run(sql);
    }
  }

  /** Query rows as objects */
  queryObjects<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    const stmt = this.db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  /** Get first row */
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null {
    const results = this.queryObjects<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  save(): void {
    const data = this.db.export();
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  close(): void {
    this.save();
    this.db.close();
  }

  getDbPath(): string {
    return this.dbPath;
  }
}
