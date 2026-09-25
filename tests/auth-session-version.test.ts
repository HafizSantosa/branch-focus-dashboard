import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("JWT refresh rejects old session versions and accepts current versions", () => {
  const dbPath = path.join(tmpdir(), `lop-session-version-${randomUUID()}.db`);
  const script = `
    import assert from "node:assert/strict";
    process.env.DB_PATH = ${JSON.stringify(dbPath)};
    const { userDb } = await import("./src/lib/db.ts");
    userDb.create({
      id: "version-user", username: "versionuser", email: "version@example.com",
      password: "hash", role: "admin", email_verified: 1,
    });
    userDb.updatePassword("version-user", "updated-hash");
    userDb.create({
      id: "legacy-user", username: "legacyuser", email: "legacy@example.com",
      password: "hash", role: "viewer", email_verified: 1,
    });
    const { authOptions } = await import("./src/lib/auth-options.ts");
    const refresh = authOptions.callbacks.jwt;
    const stale = await refresh({ token: { sub: "version-user", sessionVersion: 0 } });
    assert.equal(stale.authenticated, false);
    const current = await refresh({ token: { sub: "version-user", sessionVersion: 1 } });
    assert.equal(current.authenticated, true);
    const legacySession = await refresh({ token: { sub: "legacy-user" } });
    assert.equal(legacySession.authenticated, true);
    assert.equal(legacySession.sessionVersion, undefined);
    const loggedIn = await refresh({
      token: {}, user: { id: "version-user", role: "admin", sessionVersion: 1 },
    });
    assert.equal(loggedIn.authenticated, true);
    assert.equal(loggedIn.sessionVersion, 1);
    const session = authOptions.callbacks.session({
      session: { user: {} }, token: loggedIn,
    });
    assert.equal(session.user.sessionVersion, 1);
  `;
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
    });
  } finally {
    for (const suffix of ["", "-shm", "-wal"]) {
      rmSync(`${dbPath}${suffix}`, { force: true });
    }
  }
});
