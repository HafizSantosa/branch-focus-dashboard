import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";

const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!username || !email || !password) {
  console.error(
    "ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required."
  );
  process.exit(1);
}
if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
  console.error("ADMIN_USERNAME must be 3-32 safe username characters.");
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("ADMIN_EMAIL is invalid.");
  process.exit(1);
}
if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
  console.error("ADMIN_PASSWORD must be 12-72 bytes.");
  process.exit(1);
}

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "data", "users.db");
const db = new Database(dbPath);
const usersTable = db
  .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'")
  .get();
if (!usersTable) {
  console.error("The users table does not exist. Start the application once first.");
  db.close();
  process.exit(1);
}

const duplicate = db
  .prepare(
    "SELECT id FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE"
  )
  .get(username, email);
if (duplicate) {
  console.error("An account already uses this username or email.");
  db.close();
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);
db.prepare(`
  INSERT INTO users
    (id, username, email, password, role, email_verified, active)
  VALUES (?, ?, ?, ?, 'admin', 1, 1)
`).run(randomUUID(), username, email, passwordHash);
db.close();
console.info(`Created verified administrator "${username}".`);
