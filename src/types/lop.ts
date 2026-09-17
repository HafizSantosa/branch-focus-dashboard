export interface LopRecord {
  ihldLopId: string;
  namaProyek: string;
  portPlan: number;
  portReal: number;
  area: string; // Derived from branch
  regional: string;
  branch: string;
  pt: string; // "PT2" | "PT3"
  mitra: string;
  prioritasPerBranch: string;
  prioFlag: string; // "Prio September" | "Prio Agustus"
  activeFlag: string; // "Y" | "N"
  branchFokus: boolean;
  prioritas20Branch?: string;
  statusKonstruksi: string;
  statusMaterial: string;
  statusGL: string;
  statusGdTa: string;
  planGL: string | null; // ISO date string
  planGLxl: string | null; // ISO date string, or "Done"/"DROP"
  groupingKendala: string;
  keterangan: string;
  cekWo: string;
}

export type FilterState = {
  prioFlag: string[];
  pt: string[];
  mitra: string[];
  area: string[];
  regional: string[];
  branch: string[];
  statusKonstruksi: string[];
  branchFokus: boolean;
  search: string;
};

export type FilterOptions = {
  [K in keyof Omit<FilterState, "branchFokus" | "search">]: string[];
};
