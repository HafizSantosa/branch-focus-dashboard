import type { LopRecord } from "@/types/lop";

export const DETAIL_DATA_COLUMNS = [
  { key: "ihldLopId", label: "iHLD LoP ID" },
  { key: "portPlan", label: "Port Plan" },
  { key: "portReal", label: "Port Real" },
  { key: "area", label: "Area TSEL" },
  { key: "regional", label: "Regional TSEL" },
  { key: "branch", label: "Branch TSEL" },
  { key: "pt", label: "PT" },
  { key: "mitra", label: "Mitra" },
  { key: "cekWo", label: "Cek WO" },
  { key: "prioFlag", label: "Flag" },
  { key: "prioritas20Branch", label: "Prioritas 20 Branch" },
  { key: "statusKonstruksi", label: "Status Kontruksi" },
  { key: "statusMaterial", label: "Status Material" },
  { key: "groupingKendala", label: "Grouping Kendala" },
] as const satisfies ReadonlyArray<{
  key: keyof LopRecord;
  label: string;
}>;

export type DetailDataColumnKey = (typeof DETAIL_DATA_COLUMNS)[number]["key"];

function escapeCsv(value: LopRecord[DetailDataColumnKey]): string {
  if (value === null || value === undefined) return '""';
  const text = String(value);
  // Spreadsheet apps can execute formulas even when a CSV cell is quoted.
  const safe =
    typeof value === "string" && /^[\s\u0000-\u001f\uFEFF]*[=+\-@]/u.test(text)
      ? `'${text}`
      : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildDetailCsv(records: readonly LopRecord[]): string {
  const header = DETAIL_DATA_COLUMNS.map((column) => column.label).join(",");
  const rows = records.map((record) =>
    DETAIL_DATA_COLUMNS.map((column) => escapeCsv(record[column.key])).join(",")
  );

  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}
