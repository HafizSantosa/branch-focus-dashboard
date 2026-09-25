import Database from "better-sqlite3";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type { FilterOptions, LopRecord } from "@/types/lop";

const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "users.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let database: Database.Database | null = null;

function getDb(): Database.Database {
  if (database) return database;

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  database = db;
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                   TEXT PRIMARY KEY,
      username             TEXT NOT NULL,
      email                TEXT NOT NULL,
      password             TEXT NOT NULL,
      company              TEXT,
      role                 TEXT NOT NULL DEFAULT 'viewer'
                             CHECK (role IN ('admin', 'viewer')),
      email_verified       INTEGER NOT NULL DEFAULT 0
                             CHECK (email_verified IN (0, 1)),
      active               INTEGER NOT NULL DEFAULT 1
                             CHECK (active IN (0, 1)),
      verification_token   TEXT,
      verification_expires INTEGER,
      password_reset_token_hash TEXT,
      password_reset_expires INTEGER,
      session_version      INTEGER NOT NULL DEFAULT 0,
      created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at           INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_username_nocase
      ON users(username COLLATE NOCASE);
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_nocase
      ON users(email COLLATE NOCASE);
    CREATE UNIQUE INDEX IF NOT EXISTS users_verification_token
      ON users(verification_token)
      WHERE verification_token IS NOT NULL;

    CREATE TABLE IF NOT EXISTS app_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sheet_snapshot (
      id                  INTEGER PRIMARY KEY CHECK (id = 1),
      sheet_url           TEXT NOT NULL,
      records_json        TEXT NOT NULL,
      filter_options_json TEXT NOT NULL,
      synced_at           INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      scope        TEXT NOT NULL,
      key_hash     TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      attempts     INTEGER NOT NULL,
      PRIMARY KEY (scope, key_hash)
    );

    CREATE INDEX IF NOT EXISTS rate_limits_window_start
      ON rate_limits(window_start);
  `);

  const userCols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const columns = new Set(userCols.map((col) => col.name));
  if (!columns.has("company")) db.exec("ALTER TABLE users ADD COLUMN company TEXT;");
  if (!columns.has("password_reset_token_hash")) {
    db.exec("ALTER TABLE users ADD COLUMN password_reset_token_hash TEXT;");
  }
  if (!columns.has("password_reset_expires")) {
    db.exec("ALTER TABLE users ADD COLUMN password_reset_expires INTEGER;");
  }
  if (!columns.has("session_version")) {
    db.exec("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;");
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_password_reset_token_hash
      ON users(password_reset_token_hash)
      WHERE password_reset_token_hash IS NOT NULL;
  `);
}


export type UserRole = "admin" | "viewer";

export interface DbUser {
  id: string;
  username: string;
  email: string;
  password: string;
  company?: string | null;
  role: UserRole;
  email_verified: 0 | 1;
  active: 0 | 1;
  verification_token: string | null;
  verification_expires: number | null;
  password_reset_token_hash: string | null;
  password_reset_expires: number | null;
  session_version: number;
  created_at: number;
  updated_at: number;
}

export interface CreateUserInput {
  id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  company?: string | null;
  email_verified?: 0 | 1;
  active?: 0 | 1;
  verification_token?: string | null;
  verification_expires?: number | null;
}

export const userDb = {
  findByUsername(username: string): DbUser | undefined {
    return getDb()
      .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
      .get(username.trim()) as DbUser | undefined;
  },

  findByEmail(email: string): DbUser | undefined {
    return getDb()
      .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
      .get(email.trim()) as DbUser | undefined;
  },

  findById(id: string): DbUser | undefined {
    return getDb()
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(id) as DbUser | undefined;
  },

  findAll(): DbUser[] {
    return getDb()
      .prepare("SELECT * FROM users ORDER BY created_at DESC")
      .all() as DbUser[];
  },

  create(user: CreateUserInput): void {
    getDb()
      .prepare(`
        INSERT INTO users
          (id, username, email, password, company, role, email_verified, active,
           verification_token, verification_expires)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        user.id,
        user.username.trim(),
        user.email.trim().toLowerCase(),
        user.password,
        user.company?.trim() || null,
        user.role,
        user.email_verified ?? 0,
        user.active ?? 1,
        user.verification_token ?? null,
        user.verification_expires ?? null
      );
  },

  consumeVerificationToken(
    token: string,
    now = Math.floor(Date.now() / 1000)
  ): "verified" | "expired" | "invalid" {
    const db = getDb();
    return db.transaction(() => {
      const user = db
        .prepare("SELECT id, verification_expires FROM users WHERE verification_token = ?")
        .get(token) as Pick<DbUser, "id" | "verification_expires"> | undefined;
      if (!user) return "invalid";

      if (!user.verification_expires || user.verification_expires < now) {
        db.prepare(`
          UPDATE users
          SET verification_token = NULL, verification_expires = NULL,
              updated_at = unixepoch()
          WHERE id = ?
        `).run(user.id);
        return "expired";
      }

      const result = db.prepare(`
        UPDATE users
        SET email_verified = 1, verification_token = NULL,
            verification_expires = NULL, updated_at = unixepoch()
        WHERE id = ? AND verification_token = ?
      `).run(user.id, token);
      return result.changes === 1 ? "verified" : "invalid";
    })();
  },

  renewPendingRegistration(
    id: string,
    passwordHash: string,
    token: string,
    expires: number,
    company?: string | null
  ): boolean {
    const result = getDb()
      .prepare(`
        UPDATE users
        SET password = ?, verification_token = ?, verification_expires = ?,
            company = COALESCE(?, company),
            active = 1, updated_at = unixepoch()
        WHERE id = ? AND email_verified = 0
      `)
      .run(passwordHash, token, expires, company?.trim() || null, id);
    return result.changes === 1;
  },

  updatePassword(id: string, passwordHash: string): boolean {
    const result = getDb()
      .prepare(`
        UPDATE users
        SET password = ?, password_reset_token_hash = NULL,
            password_reset_expires = NULL, session_version = session_version + 1,
            updated_at = unixepoch()
        WHERE id = ?
      `)
      .run(passwordHash, id);
    return result.changes === 1;
  },

  issuePasswordReset(id: string, tokenHash: string, expires: number): boolean {
    const result = getDb()
      .prepare(`
        UPDATE users
        SET password_reset_token_hash = ?, password_reset_expires = ?,
            updated_at = unixepoch()
        WHERE id = ? AND active = 1 AND email_verified = 1
      `)
      .run(tokenHash, expires, id);
    return result.changes === 1;
  },

  clearPasswordReset(id: string, tokenHash: string): void {
    getDb()
      .prepare(`
        UPDATE users
        SET password_reset_token_hash = NULL, password_reset_expires = NULL,
            updated_at = unixepoch()
        WHERE id = ? AND password_reset_token_hash = ?
      `)
      .run(id, tokenHash);
  },

  hasValidPasswordReset(
    tokenHash: string,
    now = Math.floor(Date.now() / 1000)
  ): boolean {
    return Boolean(
      getDb()
        .prepare(`
          SELECT 1 FROM users
          WHERE password_reset_token_hash = ? AND password_reset_expires >= ?
            AND active = 1 AND email_verified = 1
        `)
        .get(tokenHash, now)
    );
  },

  consumePasswordReset(
    tokenHash: string,
    passwordHash: string,
    now = Math.floor(Date.now() / 1000)
  ): boolean {
    const result = getDb()
      .prepare(`
        UPDATE users
        SET password = ?, password_reset_token_hash = NULL,
            password_reset_expires = NULL, session_version = session_version + 1,
            updated_at = unixepoch()
        WHERE password_reset_token_hash = ? AND password_reset_expires >= ?
          AND active = 1 AND email_verified = 1
      `)
      .run(passwordHash, tokenHash, now);
    return result.changes === 1;
  },

  updateRole(id: string, role: UserRole): boolean {
    const result = getDb()
      .prepare("UPDATE users SET role = ?, updated_at = unixepoch() WHERE id = ?")
      .run(role, id);
    return result.changes === 1;
  },

  updateActive(id: string, active: 0 | 1): boolean {
    const result = getDb()
      .prepare("UPDATE users SET active = ?, updated_at = unixepoch() WHERE id = ?")
      .run(active, id);
    return result.changes === 1;
  },

  delete(id: string): boolean {
    return getDb().prepare("DELETE FROM users WHERE id = ?").run(id).changes === 1;
  },
};

export const settingsDb = {
  get(key: string): string | undefined {
    const row = getDb()
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value;
  },

  set(key: string, value: string): void {
    getDb()
      .prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, unixepoch())
        ON CONFLICT(key) DO UPDATE
        SET value = excluded.value, updated_at = unixepoch()
      `)
      .run(key, value);
  },
};

export interface SheetSnapshot {
  sheetUrl: string;
  records: LopRecord[];
  filterOptions: FilterOptions;
  syncedAt: number;
}

export const sheetSnapshotDb = {
  get(): SheetSnapshot | undefined {
    const row = getDb()
      .prepare(`
        SELECT sheet_url, records_json, filter_options_json, synced_at
        FROM sheet_snapshot
        WHERE id = 1
      `)
      .get() as
      | {
          sheet_url: string;
          records_json: string;
          filter_options_json: string;
          synced_at: number;
        }
      | undefined;
    if (!row) return undefined;
    return {
      sheetUrl: row.sheet_url,
      records: JSON.parse(row.records_json) as LopRecord[],
      filterOptions: JSON.parse(row.filter_options_json) as FilterOptions,
      syncedAt: row.synced_at,
    };
  },

  replace(snapshot: SheetSnapshot, persistConfiguredSource = false): void {
    const db = getDb();
    db.transaction(() => {
      db.prepare(`
        INSERT INTO sheet_snapshot
          (id, sheet_url, records_json, filter_options_json, synced_at)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          sheet_url = excluded.sheet_url,
          records_json = excluded.records_json,
          filter_options_json = excluded.filter_options_json,
          synced_at = excluded.synced_at
      `).run(
        snapshot.sheetUrl,
        JSON.stringify(snapshot.records),
        JSON.stringify(snapshot.filterOptions),
        snapshot.syncedAt
      );

      if (persistConfiguredSource) {
        db.prepare(`
          INSERT INTO app_settings (key, value, updated_at)
          VALUES ('google_sheet_url', ?, unixepoch())
          ON CONFLICT(key) DO UPDATE
          SET value = excluded.value, updated_at = unixepoch()
        `).run(snapshot.sheetUrl);
      }
    })();
  },
};

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export const rateLimitDb = {
  consume(
    scope: string,
    key: string,
    limit: number,
    windowSeconds: number,
    now = Math.floor(Date.now() / 1000)
  ): RateLimitResult {
    const db = getDb();
    const keyHash = createHash("sha256").update(key).digest("hex");

    return db.transaction(() => {
      db.prepare("DELETE FROM rate_limits WHERE window_start < ?").run(
        now - 24 * 60 * 60
      );
      const row = db
        .prepare(`
          SELECT window_start, attempts
          FROM rate_limits
          WHERE scope = ? AND key_hash = ?
        `)
        .get(scope, keyHash) as
        | { window_start: number; attempts: number }
        | undefined;

      if (!row || now - row.window_start >= windowSeconds) {
        db.prepare(`
          INSERT INTO rate_limits (scope, key_hash, window_start, attempts)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(scope, key_hash) DO UPDATE
          SET window_start = excluded.window_start, attempts = 1
        `).run(scope, keyHash, now);
        return { allowed: true, retryAfterSeconds: 0 };
      }

      const retryAfterSeconds = Math.max(
        1,
        windowSeconds - (now - row.window_start)
      );
      if (row.attempts >= limit) {
        return { allowed: false, retryAfterSeconds };
      }

      db.prepare(`
        UPDATE rate_limits
        SET attempts = attempts + 1
        WHERE scope = ? AND key_hash = ?
      `).run(scope, keyHash);
      return { allowed: true, retryAfterSeconds: 0 };
    })();
  },
};

export function checkDatabase(): void {
  getDb().prepare("SELECT 1").get();
}
