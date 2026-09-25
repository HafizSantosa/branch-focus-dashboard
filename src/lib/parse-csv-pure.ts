import Papa from "papaparse";
import type { LopRecord, FilterOptions } from "@/types/lop";

export const BRANCH_TO_AREA: Record<string, string> = {
  // AREA 1 (Sumatra)
  "ACEH": "AREA 1",
  "BANDA ACEH": "AREA 1",
  "MEDAN": "AREA 1",
  "PEMATANG SIANTAR": "AREA 1",
  "PADANG SIDEMPUAN": "AREA 1",
  "PADANG": "AREA 1",
  "BUKIT TINGGI": "AREA 1",
  "PEKANBARU": "AREA 1",
  "DUMAI": "AREA 1",
  "BATAM": "AREA 1",
  "JAMBI": "AREA 1",
  "PALEMBANG": "AREA 1",
  "PANGKAL PINANG": "AREA 1",
  "BENGKULU": "AREA 1",
  "LAMPUNG": "AREA 1",
  "BANDAR LAMPUNG": "AREA 1",

  // AREA 2 (Jabotabek / Jabar)
  "SERANG": "AREA 2",
  "TANGERANG": "AREA 2",
  "JAKARTA BARAT": "AREA 2",
  "JAKARTA PUSAT": "AREA 2",
  "JAKARTA SELATAN": "AREA 2",
  "JAKARTA TIMUR": "AREA 2",
  "JAKARTA UTARA": "AREA 2",
  "DEPOK": "AREA 2",
  "BOGOR": "AREA 2",
  "BEKASI": "AREA 2",
  "KARAWANG": "AREA 2",
  "BANDUNG": "AREA 2",
  "CIREBON": "AREA 2",
  "TASIKMALAYA": "AREA 2",
  "SUKABUMI": "AREA 2",

  // AREA 3 (Jawa Bali Nusra)
  "SEMARANG": "AREA 3",
  "SOLO": "AREA 3",
  "PURWOKERTO": "AREA 3",
  "SURABAYA": "AREA 3",
  "MALANG": "AREA 3",
  "JEMBER": "AREA 3",
  "KEDIRI": "AREA 3",
  "MADIUN": "AREA 3",
  "DENPASAR": "AREA 3",
  "MATARAM": "AREA 3",
  "KUPANG": "AREA 3",
  "FLORES": "AREA 3",

  // AREA 4 (Pamasuka)
  "MAKASSAR": "AREA 4",
  "MANADO": "AREA 4",
  "PALU": "AREA 4",
  "KENDARI": "AREA 4",
  "GORONTALO": "AREA 4",
  "AMBON": "AREA 4",
  "TERNATE": "AREA 4",
  "JAYAPURA": "AREA 4",
  "SORONG": "AREA 4",
  "TIMIKA": "AREA 4",
  "SAMARINDA": "AREA 4",
  "BALIKPAPAN": "AREA 4",
  "PONTIANAK": "AREA 4",
  "BANJARMASIN": "AREA 4",
};

export function normalizeGoogleSheetUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  // If already a published CSV export link
  if (trimmed.includes("/pub?output=csv") || trimmed.includes("/pub?output=tsv")) {
    return trimmed;
  }

  // If already an export format=csv link
  if (trimmed.includes("/export?format=csv")) {
    return trimmed;
  }

  // Standard edit/sharing link: https://docs.google.com/spreadsheets/d/{ID}/edit...
  const match = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    const sheetId = match[1];
    const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
    const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : "";
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
  }

  return trimmed;
}

export function parseCleanNumber(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.trim().replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "#N/A") return 0;
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function parseDateToIso(val: string | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "#N/A" || trimmed === "-") return null;

  // DD/MM/YYYY
  const slashParts = trimmed.split("/");
  if (slashParts.length === 3) {
    const day = slashParts[0].padStart(2, "0");
    const month = slashParts[1].padStart(2, "0");
    const year = slashParts[2].length === 2 ? `20${slashParts[2]}` : slashParts[2];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function parsePlanGLxl(val: string | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "#N/A" || trimmed === "-") return null;
  if (trimmed.toLowerCase() === "done") return "Done";
  if (trimmed.toLowerCase() === "drop") return "DROP";
  return parseDateToIso(trimmed);
}

export function parseEtaDate(val: string | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed === "#N/A" ||
    trimmed === "-" ||
    trimmed.toLowerCase().includes("ready")
  )
    return null;

  const monthMap: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    mei: "05",
    may: "05",
    jun: "06",
    jul: "07",
    agu: "08",
    aug: "08",
    sep: "09",
    okt: "10",
    oct: "10",
    nop: "11",
    nov: "11",
    des: "12",
    dec: "12",
  };

  const dashParts = trimmed.split("-");
  if (dashParts.length === 3) {
    const day = dashParts[0].padStart(2, "0");
    const monthKey = dashParts[1].slice(0, 3).toLowerCase();
    const month = monthMap[monthKey] || "09";
    return `${day}/${month}`;
  }

  const slashParts = trimmed.split("/");
  if (slashParts.length >= 2) {
    const day = slashParts[0].padStart(2, "0");
    const month = slashParts[1].padStart(2, "0");
    return `${day}/${month}`;
  }

  return null;
}

function cleanString(val: string | undefined): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (trimmed === "#N/A") return "";
  return trimmed;
}

const INDONESIAN_MONTH_ORDER = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember",
] as const;

function comparePriorityFlags(a: string, b: string): number {
  const normalizedA = a.toLocaleLowerCase("id");
  const normalizedB = b.toLocaleLowerCase("id");
  const monthA = INDONESIAN_MONTH_ORDER.findIndex((month) =>
    normalizedA.includes(month)
  );
  const monthB = INDONESIAN_MONTH_ORDER.findIndex((month) =>
    normalizedB.includes(month)
  );

  if (monthA !== -1 && monthB !== -1 && monthA !== monthB) {
    return monthA - monthB;
  }
  if (monthA !== -1 && monthB === -1) return -1;
  if (monthA === -1 && monthB !== -1) return 1;
  return a.localeCompare(b, "id");
}

export function parseCsvString(csvContent: string): {
  records: LopRecord[];
  filterOptions: FilterOptions;
} {
  const parsed = Papa.parse<string[]>(csvContent, {
    header: false,
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  if (rows.length <= 1) {
    return {
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
    };
  }

  // Auto-detect header row index (matches row with iHLD or LoP ID)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const firstCol = (rows[i][0] || "").toLowerCase().trim();
    if (firstCol.includes("ihld") || firstCol.includes("lop id")) {
      headerIndex = i;
      break;
    }
  }

  const headers = rows[headerIndex].map((value) =>
    (value || "").trim().toLowerCase().replace(/\s+/g, " ")
  );
  const requiredColumns: Array<[number, string, (header: string) => boolean]> = [
    [0, "iHLD LoP ID", (header) => header.includes("ihld") || header.includes("lop id")],
    [2, "Port Plan", (header) => header === "port plan"],
    [3, "Port Real", (header) => header === "port real"],
    [8, "Branch", (header) => header.includes("branch")],
    [9, "PT", (header) => header === "pt"],
    [20, "Status Konstruksi", (header) => header.startsWith("status kon")],
    [21, "Status Material", (header) => header === "status material"],
    [25, "Plan GL", (header) => header === "plan gl"],
    [30, "Status GL", (header) => header === "status gl"],
  ];
  const invalidColumn = requiredColumns.find(
    ([index, , matches]) => !matches(headers[index] || "")
  );
  if (invalidColumn) {
    throw new Error(
      `Format CSV berubah: kolom ${invalidColumn[0] + 1} harus berisi "${invalidColumn[1]}".`
    );
  }

  const records: LopRecord[] = [];
  const prioFlags = new Set<string>();
  const pts = new Set<string>();
  const mitras = new Set<string>();
  const areas = new Set<string>();
  const regionals = new Set<string>();
  const branches = new Set<string>();
  const statusKonstruksis = new Set<string>();

  const startRow = headerIndex + 1;
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 32) continue;

    const rawId = cleanString(row[0]);
    if (!rawId || rawId.toLowerCase().includes("ihld")) continue;

    const branch = cleanString(row[8]);
    const branchUpper = branch.toUpperCase();
    const fallbackArea = cleanString(row[6]).toUpperCase();
    const area =
      BRANCH_TO_AREA[branchUpper] || (fallbackArea.startsWith("AREA") ? fallbackArea : "UNKNOWN");

    const regional = cleanString(row[7]);
    const pt = cleanString(row[9]);
    const prioFlag = cleanString(row[13]);
    const activeFlag = cleanString(row[16]).toUpperCase();
    const branchFokusRaw = cleanString(row[17]).toUpperCase();
    const prioritas20Branch = cleanString(row[18]);
    const branchFokus =
      branchFokusRaw === "Y" || prioritas20Branch.toLowerCase().includes("20 branch");
    let statusKonstruksi = cleanString(row[20]);
    if (statusKonstruksi === "02. Matdel" || statusKonstruksi === "02. Material Delivery") {
      statusKonstruksi = "02. Material Delivery";
    }

    const mitra = cleanString(row[10]);
    if (prioFlag) prioFlags.add(prioFlag);
    if (pt) pts.add(pt);
    if (mitra) mitras.add(mitra);
    if (area && area !== "UNKNOWN") areas.add(area);
    if (regional) regionals.add(regional);
    if (branch) branches.add(branch);
    if (statusKonstruksi) statusKonstruksis.add(statusKonstruksi);

    records.push({
      ihldLopId: rawId,
      namaProyek: cleanString(row[1]),
      portPlan: parseCleanNumber(row[2]),
      portReal: parseCleanNumber(row[3]),
      area,
      regional,
      branch,
      pt,
      mitra: cleanString(row[10]),
      prioritasPerBranch: cleanString(row[11]),
      cekWo: cleanString(row[12]),
      prioFlag,
      activeFlag,
      branchFokus,
      prioritas20Branch,
      statusKonstruksi,
      statusMaterial: cleanString(row[21]),
      planGL: parseDateToIso(row[25]),
      groupingKendala: cleanString(row[26]),
      keterangan: cleanString(row[27]),
      statusGdTa: cleanString(row[29]),
      statusGL: cleanString(row[30]),
      planGLxl: parsePlanGLxl(row[31]),
      planEta: parseEtaDate(row[24]),
    });
  }

  // Pre-sort filter options
  const statusOrder = [
    "01. Persiapan",
    "02. Material Delivery",
    "03. OGP Instalasi",
    "04. Finish Instalasi",
    "05. Go Live",
    "00. Propose Drop",
    "0. Drop DBP",
  ];

  const sortedStatus = Array.from(statusKonstruksis).sort((a, b) => {
    const idxA = statusOrder.indexOf(a);
    const idxB = statusOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const filterOptions: FilterOptions = {
    prioFlag: Array.from(prioFlags).sort(comparePriorityFlags),
    pt: Array.from(pts).sort(),
    mitra: Array.from(mitras).sort(),
    area: Array.from(areas).sort(),
    regional: Array.from(regionals).sort(),
    branch: Array.from(branches).sort(),
    statusKonstruksi: sortedStatus,
  };

  return { records, filterOptions };
}
