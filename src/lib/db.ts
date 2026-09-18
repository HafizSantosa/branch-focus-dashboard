import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "users.db");

// Ensure the data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  migrateFromJson(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                   TEXT PRIMARY KEY,
      username             TEXT UNIQUE NOT NULL,
      email                TEXT UNIQUE NOT NULL,
      password             TEXT NOT NULL,
      role                 TEXT NOT NULL DEFAULT 'viewer',
      email_verified       INTEGER NOT NULL DEFAULT 0,
      active               INTEGER NOT NULL DEFAULT 1,
      verification_token   TEXT,
      verification_expires INTEGER,
      created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at           INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

/** On first boot with an empty DB, import users from users.json if it exists. */
function migrateFromJson(db: Database.Database): void {
  const row = db.prepare("SELECT COUNT(*) AS c FROM users").get() as {
    c: number;
  };
  if (row.c > 0) return;

  const jsonPath =
    process.env.AUTH_USERS_FILE ||
    path.join(process.cwd(), "users.json");
  if (!fs.existsSync(jsonPath)) return;

  try {
    const users = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Array<{
      id: string;
      username: string;
      password: string;
      role: string;
    }>;
    const insert = db.prepare(`
      INSERT INTO users (id, username, email, password, role, email_verified, active)
      VALUES (?, ?, ?, ?, ?, 1, 1)
    `);
    for (const u of users) {
      insert.run(u.id, u.username, `${u.username}@migrated.local`, u.password, u.role);
    }
    console.log(`[db] Migrated ${users.length} users from users.json`);
  } catch (e) {
    console.error("[db] Migration from users.json failed:", e);
  }
}

export interface DbUser {
  id: string;
  username: string;
  email: string;
  password: string;
  role: "admin" | "viewer";
  email_verified: number; // 0 | 1
  active: number;         // 0 | 1
  verification_token: string | null;
  verification_expires: number | null;
  created_at: number;
  updated_at: number;
}

export const userDb = {
  findByUsername(username: string): DbUser | undefined {
    return getDb()
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as DbUser | undefined;
  },

  findByEmail(email: string): DbUser | undefined {
    return getDb()
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as DbUser | undefined;
  },

  findById(id: string): DbUser | undefined {
    return getDb()
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(id) as DbUser | undefined;
  },

  findByVerificationToken(token: string): DbUser | undefined {
    return getDb()
      .prepare("SELECT * FROM users WHERE verification_token = ?")
      .get(token) as DbUser | undefined;
  },

  findAll(): DbUser[] {
    return getDb()
      .prepare("SELECT * FROM users ORDER BY created_at DESC")
      .all() as DbUser[];
  },

  create(user: {
    id: string;
    username: string;
    email: string;
    password: string;
    role: string;
    verification_token: string;
    verification_expires: number;
  }): void {
    getDb()
      .prepare(`
        INSERT INTO users
          (id, username, email, password, role, email_verified, active, verification_token, verification_expires)
        VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
      `)
      .run(
        user.id,
        user.username,
        user.email,
        user.password,
        user.role,
        user.verification_token,
        user.verification_expires
      );
  },

  verifyEmail(id: string): void {
    getDb()
      .prepare(`
        UPDATE users
        SET email_verified = 1, verification_token = NULL,
            verification_expires = NULL, updated_at = unixepoch()
        WHERE id = ?
      `)
      .run(id);
  },

  updatePassword(id: string, passwordHash: string): void {
    getDb()
      .prepare(
        "UPDATE users SET password = ?, updated_at = unixepoch() WHERE id = ?"
      )
      .run(passwordHash, id);
  },

  updateRole(id: string, role: string): void {
    getDb()
      .prepare(
        "UPDATE users SET role = ?, updated_at = unixepoch() WHERE id = ?"
      )
      .run(role, id);
  },

  updateActive(id: string, active: number): void {
    getDb()
      .prepare(
        "UPDATE users SET active = ?, updated_at = unixepoch() WHERE id = ?"
      )
      .run(active, id);
  },

  delete(id: string): void {
    getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
  },
};
