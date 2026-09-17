import { LopRecord, FilterOptions } from "@/types/lop";
import { parseCsvString, normalizeGoogleSheetUrl, BRANCH_TO_AREA } from "./parse-csv-pure";

export { parseCsvString, normalizeGoogleSheetUrl, BRANCH_TO_AREA };

export const DEFAULT_GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1-gPTbg9lJpow7Ir5iU7OGNFQIHoZ0Mja5IuLpGpIW0g/edit?usp=sharing";

export async function parseCsvData(): Promise<{ records: LopRecord[]; filterOptions: FilterOptions }> {
  const rawUrl = process.env.GOOGLE_SHEET_URL || DEFAULT_GOOGLE_SHEET_URL;
  const exportUrl = normalizeGoogleSheetUrl(rawUrl);

  try {
    const res = await fetch(exportUrl, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`Failed to fetch Google Sheet at build time: HTTP ${res.status}`);
      return {
        records: [],
        filterOptions: {
          prioFlag: [],
          pt: [],
          area: [],
          regional: [],
          branch: [],
          statusKonstruksi: [],
        },
      };
    }

    const csvContent = await res.text();
    return parseCsvString(csvContent);
  } catch (error) {
    console.error("Error fetching Google Sheet at build time:", error);
    return {
      records: [],
      filterOptions: {
        prioFlag: [],
        pt: [],
        area: [],
        regional: [],
        branch: [],
        statusKonstruksi: [],
      },
    };
  }
}
