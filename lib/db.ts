import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type RunResult = {
  success: true;
  meta: { changes: number; last_row_id: number };
};

export class PreparedStatement {
  constructor(
    private readonly database: Database.Database,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new PreparedStatement(this.database, this.sql, params);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.database.prepare(this.sql).get(...this.params) as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: this.database.prepare(this.sql).all(...this.params) as T[] };
  }

  async run(): Promise<RunResult> {
    return this.runSync();
  }

  runSync(): RunResult {
    const result = this.database.prepare(this.sql).run(...this.params);
    return {
      success: true,
      meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) },
    };
  }
}

export class AppDatabase {
  private readonly database: Database.Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new Database(path);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('foreign_keys = ON');
    this.database.pragma('busy_timeout = 5000');
  }

  prepare(sql: string) {
    return new PreparedStatement(this.database, sql);
  }

  async batch(statements: PreparedStatement[]) {
    return this.database.transaction(() => statements.map((statement) => statement.runSync()))();
  }
}

declare global {
  // eslint-disable-next-line no-var
  var duePassiDatabase: AppDatabase | undefined;
}

export function getDb() {
  if (!globalThis.duePassiDatabase) {
    const databasePath = resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || '.data/duepassi.sqlite');
    globalThis.duePassiDatabase = new AppDatabase(databasePath);
  }
  return globalThis.duePassiDatabase;
}
