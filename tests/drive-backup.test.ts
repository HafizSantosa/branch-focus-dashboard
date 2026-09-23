import assert from "node:assert/strict";
import test from "node:test";
import type { LopRecord } from "../src/types/lop";

process.env.DB_PATH = ":memory:";
process.env.GOOGLE_DRIVE_BACKUP_ENABLED = "true";
process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID = "test-drive-folder";
process.env.GOOGLE_DRIVE_BACKUP_DAILY_AT = "02:00";
process.env.GOOGLE_DRIVE_BACKUP_TIMEZONE = "Asia/Jakarta";
process.env.GOOGLE_APPLICATION_CREDENTIALS = "package.json";

const backupModulePromise = import("../src/lib/drive-backup");

function makeRecord(id: string, prioFlag: string): LopRecord {
  return {
    ihldLopId: id,
    namaProyek: `Project ${id}`,
    portPlan: 64,
    portReal: 32,
    area: "AREA 1",
    regional: "SUMBAGTENG",
    branch: "PADANG",
    pt: "PT3",
    mitra: "Fiberhome",
    prioritasPerBranch: "Priority",
    prioFlag,
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
}

test("daily scheduler waits for the configured local time and runs once per date", async () => {
  const { getDriveBackupConfig, shouldRunDriveBackup } =
    await backupModulePromise;
  const config = getDriveBackupConfig();
  const beforeSchedule = new Date("2026-09-22T18:59:00.000Z");
  const atSchedule = new Date("2026-09-22T19:00:00.000Z");

  assert.equal(shouldRunDriveBackup(beforeSchedule, config), false);
  assert.equal(shouldRunDriveBackup(atSchedule, config), true);
  assert.equal(
    shouldRunDriveBackup(atSchedule, config, {
      outcome: "success",
      lastAttemptAt: Math.floor(atSchedule.getTime() / 1_000),
      lastSuccessDate: "2026-09-23",
    }),
    false
  );
});

test("Drive backup uploads the complete unfiltered snapshot as one CSV", async () => {
  const { runDriveBackup } = await backupModulePromise;
  const records = [
    makeRecord("LOP-A", "Prio Agustus"),
    makeRecord("LOP-O", "Prio Oktober"),
  ];
  let uploadedCsv = "";
  let uploadedParent = "";
  let uploadedName = "";

  const fakeDrive = {
    files: {
      list: async () => ({ data: { files: [] } }),
      create: async (request: {
        requestBody?: { name?: string | null; parents?: string[] | null };
        media?: { body?: AsyncIterable<Uint8Array | string> };
      }) => {
        uploadedName = request.requestBody?.name ?? "";
        uploadedParent = request.requestBody?.parents?.[0] ?? "";
        if (request.media?.body) {
          for await (const chunk of request.media.body) {
            uploadedCsv += chunk.toString();
          }
        }
        return {
          data: {
            id: "drive-file-1",
            name: uploadedName,
            webViewLink: "https://drive.google.com/file/d/drive-file-1/view",
          },
        };
      },
    },
  };

  const status = await runDriveBackup({
    now: new Date("2026-09-22T19:00:00.000Z"),
    syncSnapshot: async () => ({
      sheetUrl: "https://docs.google.com/spreadsheets/d/test/edit",
      records,
      filterOptions: {
        prioFlag: ["Prio Agustus", "Prio Oktober"],
        pt: ["PT3"],
        mitra: ["Fiberhome"],
        area: ["AREA 1"],
        regional: ["SUMBAGTENG"],
        branch: ["PADANG"],
        statusKonstruksi: ["05. Go Live"],
      },
      syncedAt: 1,
    }),
    drive: fakeDrive as never,
  });

  assert.equal(uploadedParent, "test-drive-folder");
  assert.equal(uploadedName, "LOP_Detail_Unfiltered_2026-09-23.csv");
  assert.equal(uploadedCsv.split("\r\n").length, 3);
  assert.match(uploadedCsv, /"LOP-A"/);
  assert.match(uploadedCsv, /"LOP-O"/);
  assert.equal(status.outcome, "success");
  assert.equal(status.rowCount, 2);
  assert.equal(status.lastSuccessDate, "2026-09-23");
});
