import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { LopRecord } from "../src/types/lop";

process.env.DB_PATH = ":memory:";
process.env.LOCAL_BACKUP_ENABLED = "true";
const backup = import("../src/lib/local-backup");

const record: LopRecord = {
  ihldLopId: "LOP-A",
  namaProyek: "Project A",
  portPlan: 64,
  portReal: 32,
  area: "AREA 1",
  regional: "SUMBAGTENG",
  branch: "PADANG",
  pt: "PT3",
  mitra: "Fiberhome",
  prioritasPerBranch: "Priority",
  prioFlag: "Prio September",
  activeFlag: "Y",
  branchFokus: true,
  prioritas20Branch: "20 Branch",
  statusKonstruksi: "05. Go Live",
  statusMaterial: "Ready",
  statusGL: "01. Golive",
  statusGdTa: "Done",
  planGL: "2026-09-23",
  planGLxl: "2026-09-24",
  planEta: "23/09",
  groupingKendala: "",
  keterangan: "",
  cekWo: "Sudah WO",
};

const snapshot = async () => ({
  sheetUrl: "https://docs.google.com/spreadsheets/d/test/edit",
  records: [record, { ...record, ihldLopId: "LOP-O", prioFlag: "Prio Oktober" }],
  filterOptions: {
    prioFlag: [], pt: [], mitra: [], area: [], regional: [], branch: [],
    statusKonstruksi: [],
  },
  syncedAt: 1,
});

test("local backup schedule uses Jakarta calendar days and retries failures", async () => {
  const { getLocalBackupConfig, shouldRunLocalBackup } = await backup;
  const config = getLocalBackupConfig({ LOCAL_BACKUP_ENABLED: "true" });
  assert.equal(config.dailyAt, "02:00");
  assert.equal(config.timeZone, "Asia/Jakarta");
  const before = new Date("2026-09-22T18:59:00Z");
  const due = new Date("2026-09-22T19:00:00Z");
  assert.equal(shouldRunLocalBackup(before, config), true);
  assert.equal(shouldRunLocalBackup(before, config, {
    outcome: "success", lastAttemptAt: before.getTime() / 1_000,
    lastSuccessDate: "2026-09-22",
  }), false);
  assert.equal(shouldRunLocalBackup(before, config, {
    outcome: "success", lastAttemptAt: 0,
    lastSuccessDate: "2026-09-21",
  }), true);
  assert.equal(shouldRunLocalBackup(due, config), true);
  assert.equal(shouldRunLocalBackup(due, config, {
    outcome: "success", lastAttemptAt: due.getTime() / 1_000,
    lastSuccessDate: "2026-09-23",
  }), false);
  assert.equal(shouldRunLocalBackup(due, config, {
    outcome: "error", lastAttemptAt: due.getTime() / 1_000,
  }), false);
  assert.equal(shouldRunLocalBackup(new Date(due.getTime() + 3_600_000), config, {
    outcome: "error", lastAttemptAt: due.getTime() / 1_000,
  }), true);
});

test("daily backup writes all snapshot rows, retains newest files, and catches up once", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lop-local-backup-"));
  process.env.LOCAL_BACKUP_DIR = dir;
  process.env.LOCAL_BACKUP_KEEP_DAYS = "2";
  const {
    runLocalBackup, runLocalBackupIfDue, listLocalBackups,
    getLocalBackupStatus, getLocalBackupConfig,
  } = await backup;
  try {
    const first = await runLocalBackup({
      now: new Date("2026-09-22T19:00:00Z"), syncSnapshot: snapshot,
    });
    assert.equal(first.fileName, "LOP_Detail_Unfiltered_2026-09-23.csv");
    assert.equal(first.rowCount, 2);
    const csv = await readFile(path.join(dir, first.fileName), "utf8");
    const rows = csv.trim().split("\r\n");
    assert.equal(rows.length, 3);
    assert.ok(rows[1].includes('"LOP-A"'));
    assert.ok(rows[2].includes('"LOP-O"'));
    const repeated = await runLocalBackup({
      now: new Date("2026-09-22T19:30:00Z"),
      syncSnapshot: async () => { throw new Error("existing backup must not resync"); },
    });
    assert.equal(repeated.alreadyExists, true);
    assert.equal(await readFile(path.join(dir, first.fileName), "utf8"), csv);
    assert.deepEqual(await readdir(dir), [first.fileName]);
    assert.equal(await runLocalBackupIfDue(new Date("2026-09-22T19:10:00Z")), false);
    assert.equal(getLocalBackupStatus().lastSuccessDate, "2026-09-23");

    await runLocalBackup({
      now: new Date("2026-09-23T19:00:00Z"), syncSnapshot: snapshot,
    });
    await runLocalBackup({
      now: new Date("2026-09-24T19:00:00Z"), syncSnapshot: snapshot,
    });
    assert.deepEqual((await listLocalBackups()).map((f) => f.date), [
      "2026-09-25", "2026-09-24",
    ]);
    assert.deepEqual((await readdir(dir)).sort(), [
      "LOP_Detail_Unfiltered_2026-09-24.csv",
      "LOP_Detail_Unfiltered_2026-09-25.csv",
    ]);
    const inaccessible = path.join(dir, "not-a-directory");
    await writeFile(inaccessible, "file");
    await assert.rejects(
      listLocalBackups({ ...getLocalBackupConfig(), backupDir: inaccessible }),
      /ENOTDIR/
    );
  } finally {
    delete process.env.LOCAL_BACKUP_DIR;
    delete process.env.LOCAL_BACKUP_KEEP_DAYS;
    await rm(dir, { recursive: true, force: true });
  }
});

test("backup routes restrict access to administrators only", async () => {
  const { authorizeApi } = await import("../src/lib/server-auth");
  const { userDb } = await import("../src/lib/db");

  // Unauthenticated
  const unauth = await authorizeApi("admin", null);
  assert.equal(unauth.user, null);
  assert.equal(unauth.response?.status, 401);

  // Create viewer and admin users
  userDb.create({
    id: "backup-viewer",
    username: "backupviewer",
    email: "viewer@example.com",
    password: "hash",
    role: "viewer",
    email_verified: 1,
    active: 1,
  });
  userDb.create({
    id: "backup-admin",
    username: "backupadmin",
    email: "admin@example.com",
    password: "hash",
    role: "admin",
    email_verified: 1,
    active: 1,
  });

  // Viewer session: rejected with 403 Forbidden
  const viewerSession = {
    user: {
      id: "backup-viewer",
      role: "viewer" as const,
      authenticated: true,
      sessionVersion: 0,
    },
    expires: "2099-01-01",
  };
  const viewerRes = await authorizeApi("admin", viewerSession);
  assert.equal(viewerRes.user, null);
  assert.equal(viewerRes.response?.status, 403);

  // Admin session: authorized successfully
  const adminSession = {
    user: {
      id: "backup-admin",
      role: "admin" as const,
      authenticated: true,
      sessionVersion: 0,
    },
    expires: "2099-01-01",
  };
  const adminRes = await authorizeApi("admin", adminSession);
  assert.equal(adminRes.response, null);
  assert.equal(adminRes.user?.id, "backup-admin");
  assert.equal(adminRes.user?.role, "admin");
});
