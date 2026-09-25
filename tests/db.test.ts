import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { before } from "node:test";
import type * as DbModule from "../src/lib/db";

process.env.DB_PATH = path.join(tmpdir(), `lop-priority-${randomUUID()}.db`);
process.env.AUTH_USERS_FILE = path.join(tmpdir(), `missing-${randomUUID()}.json`);

// The database path is read at module initialization, so this test must set its
// isolated path before loading the known module. Dynamic loading is intentional.
let database: typeof DbModule;
before(async () => {
  database = await import("../src/lib/db");
});

test("bootstraps a fresh database before querying users", () => {
  assert.deepEqual(database.userDb.findAll(), []);
});

test("consumes verification tokens exactly once", () => {
  database.userDb.create({
    id: "pending-user",
    username: "pending",
    email: "pending@example.com",
    password: "hash",
    role: "viewer",
    verification_token: "single-use-token",
    verification_expires: 2_000,
  });

  assert.equal(
    database.userDb.consumeVerificationToken("single-use-token", 1_000),
    "verified"
  );
  assert.equal(
    database.userDb.consumeVerificationToken("single-use-token", 1_000),
    "invalid"
  );

  const verified = database.userDb.findById("pending-user");
  assert.equal(verified?.email_verified, 1);
  assert.equal(verified?.verification_token, null);
  assert.equal(verified?.verification_expires, null);
});

test("expires verification tokens without activating the account", () => {
  database.userDb.create({
    id: "expired-user",
    username: "expired",
    email: "expired@example.com",
    password: "hash",
    role: "viewer",
    verification_token: "expired-token",
    verification_expires: 500,
  });

  assert.equal(
    database.userDb.consumeVerificationToken("expired-token", 1_000),
    "expired"
  );
  const expired = database.userDb.findById("expired-user");
  assert.equal(expired?.email_verified, 0);
  assert.equal(expired?.verification_token, null);
});

test("persists global settings and enforces fixed-window limits", () => {
  database.settingsDb.set(
    "google_sheet_url",
    "https://docs.google.com/example"
  );
  assert.equal(
    database.settingsDb.get("google_sheet_url"),
    "https://docs.google.com/example"
  );

  assert.equal(
    database.rateLimitDb.consume("test", "identity", 2, 60, 1_000).allowed,
    true
  );
  assert.equal(
    database.rateLimitDb.consume("test", "identity", 2, 60, 1_001).allowed,
    true
  );
  const blocked = database.rateLimitDb.consume(
    "test",
    "identity",
    2,
    60,
    1_002
  );
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 58);
  assert.equal(
    database.rateLimitDb.consume("test", "identity", 2, 60, 1_060).allowed,
    true
  );
});

test("atomically replaces the global spreadsheet snapshot and configured source", () => {
  const snapshot = {
    sheetUrl: "https://docs.google.com/spreadsheets/d/shared/edit",
    records: [],
    filterOptions: {
      prioFlag: [],
      pt: [],
      mitra: [],
      area: [],
      regional: [],
      branch: [],
      statusKonstruksi: [],
    },
    syncedAt: 1_234,
  };

  database.sheetSnapshotDb.replace(snapshot, true);

  assert.deepEqual(database.sheetSnapshotDb.get(), snapshot);
  assert.equal(
    database.settingsDb.get("google_sheet_url"),
    snapshot.sheetUrl
  );
});

test("keeps the last shared snapshot when an upstream sync fails", async () => {
  const previous = database.sheetSnapshotDb.get();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 503 });

  try {
    const { syncSheetSnapshot } = await import("../src/lib/data-sync");
    await assert.rejects(
      syncSheetSnapshot(
        "https://docs.google.com/spreadsheets/d/unavailable/edit"
      ),
      /HTTP 503/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(database.sheetSnapshotDb.get(), previous);
});

test("persists user company affiliation", () => {
  database.userDb.create({
    id: "company-user",
    username: "companyuser",
    email: "company@example.com",
    password: "hash",
    company: "PT Telkom Akses",
    role: "viewer",
  });

  const user = database.userDb.findById("company-user");
  assert.equal(user?.company, "PT Telkom Akses");
});

test("password reset links are restricted, replaceable, expiring, and single-use", () => {
  database.userDb.create({
    id: "reset-user",
    username: "resetuser",
    email: "reset@example.com",
    password: "old-hash",
    role: "viewer",
    email_verified: 1,
  });
  database.userDb.create({
    id: "inactive-reset-user",
    username: "inactivereset",
    email: "inactive-reset@example.com",
    password: "old-hash",
    role: "viewer",
    email_verified: 1,
  });
  database.userDb.create({
    id: "unverified-reset-user",
    username: "unverifiedreset",
    email: "unverified-reset@example.com",
    password: "old-hash",
    role: "viewer",
  });

  assert.equal(database.userDb.findById("reset-user")?.session_version, 0);
  assert.equal(database.userDb.issuePasswordReset("inactive-reset-user", "disabled-hash", 2_000), true);
  assert.equal(database.userDb.updateActive("inactive-reset-user", 0), true);
  assert.equal(database.userDb.issuePasswordReset("inactive-reset-user", "inactive", 2_000), false);
  assert.equal(database.userDb.consumePasswordReset("disabled-hash", "disabled-password", 2_000), false);
  assert.equal(database.userDb.findById("inactive-reset-user")?.password, "old-hash");
  assert.equal(database.userDb.findById("inactive-reset-user")?.session_version, 0);
  assert.equal(database.userDb.issuePasswordReset("unverified-reset-user", "unverified", 2_000), false);
  assert.equal(database.userDb.issuePasswordReset("reset-user", "first-hash", 2_000), true);
  assert.equal(database.userDb.hasValidPasswordReset("first-hash", 2_000), true);
  assert.equal(database.userDb.hasValidPasswordReset("first-hash", 2_001), false);
  assert.equal(database.userDb.issuePasswordReset("reset-user", "replacement-hash", 2_100), true);
  assert.equal(database.userDb.hasValidPasswordReset("first-hash", 2_000), false);
  assert.equal(database.userDb.hasValidPasswordReset("replacement-hash", 2_100), true);

  assert.equal(database.userDb.consumePasswordReset("wrong-hash", "wrong-password", 2_000), false);
  assert.equal(database.userDb.findById("reset-user")?.password, "old-hash");
  assert.equal(database.userDb.consumePasswordReset("replacement-hash", "new-hash", 2_100), true);
  assert.equal(database.userDb.consumePasswordReset("replacement-hash", "replay-hash", 2_100), false);
  const resetUser = database.userDb.findById("reset-user");
  assert.equal(resetUser?.password, "new-hash");
  assert.equal(resetUser?.session_version, 1);
  assert.equal(resetUser?.password_reset_token_hash, null);
  assert.equal(resetUser?.password_reset_expires, null);

  database.userDb.issuePasswordReset("reset-user", "clear-hash", 3_000);
  database.userDb.clearPasswordReset("reset-user", "not-current-hash");
  assert.equal(database.userDb.hasValidPasswordReset("clear-hash", 2_000), true);
  database.userDb.clearPasswordReset("reset-user", "clear-hash");
  assert.equal(database.userDb.hasValidPasswordReset("clear-hash", 2_000), false);

  assert.equal(database.userDb.updatePassword("reset-user", "changed-hash"), true);
  const changedUser = database.userDb.findById("reset-user");
  assert.equal(changedUser?.session_version, 2);
  assert.equal(changedUser?.password_reset_token_hash, null);
  assert.equal(changedUser?.password_reset_expires, null);
});
