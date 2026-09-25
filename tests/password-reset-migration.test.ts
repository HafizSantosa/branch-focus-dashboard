import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import Database from "better-sqlite3";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";

const legacySchema = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    company TEXT,
    role TEXT NOT NULL DEFAULT 'viewer',
    email_verified INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    verification_token TEXT,
    verification_expires INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`;

for (const partiallyMigrated of [false, true]) {
  test(`migrates ${partiallyMigrated ? "partially upgraded" : "legacy"} users table without losing rows`, (t) => {
    const dbPath = path.join(tmpdir(), `lop-reset-migration-${randomUUID()}.db`);
    t.after(() => {
      for (const suffix of ["", "-shm", "-wal"]) {
        rmSync(`${dbPath}${suffix}`, { force: true });
      }
    });
    const setup = new Database(dbPath);
    setup.exec(legacySchema);
    if (partiallyMigrated) {
      setup.exec("ALTER TABLE users ADD COLUMN password_reset_token_hash TEXT;");
    }
    setup.prepare(`
      INSERT INTO users (id, username, email, password)
      VALUES (?, ?, ?, ?)
    `).run("preserved-user", "preserved", "preserved@example.com", "hash");
    setup.close();

    // A separate process gives module-level DB_PATH initialization a clean singleton.
    const migration = `
      const { userDb } = await import("./src/lib/db.ts");
      const user = userDb.findById("preserved-user");
      if (!user || user.username !== "preserved") throw new Error("legacy user missing");
    `;
    execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", migration], {
      cwd: process.cwd(),
      env: { ...process.env, DB_PATH: dbPath },
      stdio: "pipe",
    });

    const migrated = new Database(dbPath, { readonly: true });
    const columns = migrated.prepare("PRAGMA table_info(users)").all() as Array<{
      name: string;
      dflt_value: string | null;
    }>;
    const columnByName = Object.fromEntries(columns.map((column) => [column.name, column]));
    assert.ok(columnByName.password_reset_token_hash);
    assert.ok(columnByName.password_reset_expires);
    assert.equal(columnByName.session_version.dflt_value, "0");
    const preservedUser = migrated
      .prepare("SELECT username FROM users WHERE id = ?")
      .get("preserved-user") as { username: string } | undefined;
    assert.equal(preservedUser?.username, "preserved");
    const index = migrated.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type = 'index' AND name = 'users_password_reset_token_hash'
    `).get() as { sql: string } | undefined;
    assert.match(index?.sql ?? "", /WHERE password_reset_token_hash IS NOT NULL/i);
    migrated.close();
  });
}
