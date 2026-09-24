import assert from "node:assert/strict";
import test from "node:test";
import { buildDetailCsv, DETAIL_DATA_COLUMNS } from "../src/lib/detail-data";
import type { LopRecord } from "../src/types/lop";

const record: LopRecord = {
  ihldLopId: "LOP-1",
  namaProyek: "Hidden project name",
  portPlan: 64,
  portReal: 32,
  area: "AREA 1",
  regional: "SUMBAGTENG",
  branch: "PADANG",
  pt: "PT3",
  mitra: "Fiberhome",
  prioritasPerBranch: "Hidden priority",
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
  groupingKendala: "Izin, ROW",
  keterangan: "Hidden note",
  cekWo: "Sudah WO",
};

test("detail table and CSV use the requested columns in the requested order", () => {
  assert.deepEqual(
    DETAIL_DATA_COLUMNS.map((column) => column.label),
    [
      "iHLD LoP ID",
      "Port Plan",
      "Port Real",
      "Area TSEL",
      "Regional TSEL",
      "Branch TSEL",
      "PT",
      "Mitra",
      "Cek WO",
      "Flag",
      "Prioritas 20 Branch",
      "Status Kontruksi",
      "Status Material",
      "Grouping Kendala",
    ]
  );

  const [header, row] = buildDetailCsv([record]).slice(1).split("\r\n");
  assert.equal(header, DETAIL_DATA_COLUMNS.map((column) => column.label).join(","));
  assert.equal(
    row,
    '"LOP-1","64","32","AREA 1","SUMBAGTENG","PADANG","PT3","Fiberhome","Sudah WO","Prio September","20 Branch","05. Go Live","Ready","Izin, ROW"'
  );
});

test("CSV exports neutralize spreadsheet formulas without altering numeric cells", () => {
  const csv = buildDetailCsv([{
    ...record,
    ihldLopId: "=1+1",
    branch: "+SUM(1,2)",
    mitra: "-CMD",
    statusMaterial: "@SUM(1,2)",
    groupingKendala: "\t=HYPERLINK(\"https://example.test\")",
    portPlan: -5,
  }]);
  assert.ok(csv.includes("\"'=1+1\""));
  assert.ok(csv.includes("\"'+SUM(1,2)\""));
  assert.ok(csv.includes("\"'-CMD\""));
  assert.ok(csv.includes("\"'@SUM(1,2)\""));
  assert.ok(csv.includes("\"'\t=HYPERLINK(\"\"https://example.test\"\")\""));
  assert.ok(csv.includes("\"-5\""));
});
