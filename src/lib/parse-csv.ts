import type { LopRecord, FilterOptions } from "@/types/lop";
import { settingsDb } from "@/lib/db";
import {
  parseCsvString,
  normalizeGoogleSheetUrl,
  BRANCH_TO_AREA,
} from "./parse-csv-pure";

export { parseCsvString, normalizeGoogleSheetUrl, BRANCH_TO_AREA };

export const DEFAULT_GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1-gPTbg9lJpow7Ir5iU7OGNFQIHoZ0Mja5IuLpGpIW0g/edit?usp=sharing";
export const GOOGLE_SHEET_SETTING_KEY = "google_sheet_url";

export function validateGoogleSheetUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("URL Google Spreadsheet tidak valid.");
  }

  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
    throw new Error("Sumber data harus menggunakan URL HTTPS dari docs.google.com.");
  }
  if (!/^\/spreadsheets\/d\/[a-zA-Z0-9_-]+\//.test(url.pathname)) {
    throw new Error("URL Google Spreadsheet tidak memiliki ID spreadsheet yang valid.");
  }
  return rawUrl.trim();
}

export function getConfiguredSheetUrl(): string {
  return (
    settingsDb.get(GOOGLE_SHEET_SETTING_KEY) ??
    process.env.GOOGLE_SHEET_URL ??
    DEFAULT_GOOGLE_SHEET_URL
  );
}

export async function parseCsvData(
  rawUrl = getConfiguredSheetUrl()
): Promise<{ records: LopRecord[]; filterOptions: FilterOptions }> {
  const validatedUrl = validateGoogleSheetUrl(rawUrl);
  const exportUrl = normalizeGoogleSheetUrl(validatedUrl);
  const response = await fetch(exportUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Google Spreadsheet merespons HTTP ${response.status}.`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 10 * 1024 * 1024) {
    throw new Error("Ukuran CSV melebihi batas 10 MB.");
  }

  const csvContent = await response.text();
  if (!csvContent.trim()) throw new Error("Google Spreadsheet mengembalikan CSV kosong.");
  if (csvContent.length > 10 * 1024 * 1024) {
    throw new Error("Ukuran CSV melebihi batas 10 MB.");
  }

  const parsed = parseCsvString(csvContent);
  if (parsed.records.length === 0) {
    throw new Error("CSV tidak berisi data LOP yang dapat diproses.");
  }
  return parsed;
}
