import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeGoogleSheetUrl,
  parseCsvString,
} from "../src/lib/parse-csv-pure";

const headers = [
  "iHLD LoP ID",
  "Nama Proyek",
  "Port Plan",
  "Port Real",
  "Total BOQ",
  "Capex per Port",
  "Area TSEL",
  "Regional TSEL",
  "Branch TSEL",
  "PT",
  "Mitra",
  "Prioritas per Branch",
  "Cek WO",
  "Flag",
  "cek go live 1 sept",
  "cek drop PT2",
  "flag",
  "Bracnh Fokus",
  "Prioritas 20 Branch",
  "Cek 115K",
  "Status Kontruksi",
  "Status Material",
  "Plan K12",
  "Plan K24",
  "Plan ETA",
  "Plan GL",
  "Grouping Kendala",
  "Status FI NY Golive",
  "Keterangan",
  "",
  "Status GD TA",
  "Status GL",
  "Plan GL xl",
  "Keterangan",
  "PORT AANWIJZING",
  "NILAI WO+IZIN/QE+REDESAIN",
  "CPP",
];

function createCsv(headerRow = headers): string {
  const row = Array.from({ length: headers.length }, () => "");
  row[0] = "LOP-1";
  row[1] = "Project One";
  row[2] = "1.440";
  row[3] = "48";
  row[7] = "EASTERN JABOTABEK";
  row[8] = "BEKASI";
  row[9] = "PT3";
  row[10] = "Telkom Akses";
  row[13] = "Prio September";
  row[17] = "Y";
  row[18] = "20 Branch";
  row[20] = "04. Finish Instalasi";
  row[21] = "Ready";
  row[25] = "21/09/2026";
  row[27] = "Belum Ada Jadwal Integrasi";
  row[28] = "Keterangan sentinel";
  row[30] = "GD sentinel";
  row[31] = "00. Ny Golive";
  row[32] = "Done";
  return `${headerRow.join(",")}\n${row.join(",")}`;
}

test("parses the expected spreadsheet contract", () => {
  const result = parseCsvString(createCsv());
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.records[0], {
    ihldLopId: "LOP-1",
    namaProyek: "Project One",
    portPlan: 1440,
    portReal: 48,
    area: "AREA 2",
    regional: "EASTERN JABOTABEK",
    branch: "BEKASI",
    pt: "PT3",
    mitra: "Telkom Akses",
    prioritasPerBranch: "",
    cekWo: "",
    prioFlag: "Prio September",
    activeFlag: "",
    branchFokus: true,
    prioritas20Branch: "20 Branch",
    statusKonstruksi: "04. Finish Instalasi",
    statusMaterial: "Ready",
    planGL: "2026-09-21",
    groupingKendala: "",
    statusFiNyGolive: "Belum Ada Jadwal Integrasi",
    keterangan: "Keterangan sentinel",
    statusGdTa: "GD sentinel",
    statusGL: "00. Ny Golive",
    planGLxl: "Done",
    planEta: null,
  });
});

test("rejects a shifted spreadsheet schema instead of silently corrupting fields", () => {
  const changedHeaders = [...headers];
  changedHeaders[2] = "Unexpected Column";
  assert.throws(
    () => parseCsvString(createCsv(changedHeaders)),
    /kolom 3 harus berisi "Port Plan"/
  );
});
test("rejects an absent or shifted Finish Instalasi status column", () => {
  const missingColumn = [...headers];
  missingColumn.splice(27, 1);
  assert.throws(
    () => parseCsvString(createCsv(missingColumn)),
    /kolom 28 harus berisi "Status FI NY Golive"/
  );

  const shiftedColumn = [...headers];
  shiftedColumn[27] = "Unexpected Column";
  assert.throws(
    () => parseCsvString(createCsv(shiftedColumn)),
    /kolom 28 harus berisi "Status FI NY Golive"/
  );
});

test("maps an empty Finish Instalasi status cell to an empty string", () => {
  const csv = createCsv().replace("Belum Ada Jadwal Integrasi", "");
  assert.equal(parseCsvString(csv).records[0].statusFiNyGolive, "");
});

test("preserves a selected Google Sheet gid in its CSV export URL", () => {
  assert.equal(
    normalizeGoogleSheetUrl(
      "https://docs.google.com/spreadsheets/d/sheet-id/edit?usp=sharing#gid=123"
    ),
    "https://docs.google.com/spreadsheets/d/sheet-id/export?format=csv&gid=123"
  );
});

test("orders priority programs chronologically by Indonesian month", () => {
  const priorities = ["Prio Oktober", "Prio Agustus", "Prio September"];
  const rows = priorities.map((priority, index) => {
    const row = Array.from({ length: headers.length }, () => "");
    row[0] = `LOP-${index + 1}`;
    row[2] = "1";
    row[3] = "0";
    row[8] = "BEKASI";
    row[9] = "PT3";
    row[13] = priority;
    row[20] = "01. Persiapan";
    return row.join(",");
  });

  const result = parseCsvString([headers.join(","), ...rows].join("\n"));

  assert.deepEqual(result.filterOptions.prioFlag, [
    "Prio Agustus",
    "Prio September",
    "Prio Oktober",
  ]);
});
