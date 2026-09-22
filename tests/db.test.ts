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
