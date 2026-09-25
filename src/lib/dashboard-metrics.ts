import type { FilterOptions, FilterState, LopRecord } from "@/types/lop";

export const CONSTRUCTION_PIPELINE_STAGES = [
  "01. Persiapan",
  "02. Material Delivery",
  "03. OGP Instalasi",
  "04. Finish Instalasi",
  "05. Go Live",
] as const;

type PipelineRecord = Pick<
  LopRecord,
  "statusKonstruksi" | "pt" | "portPlan" | "portReal"
>;

export interface ConstructionPipelineStage {
  stage: (typeof CONSTRUCTION_PIPELINE_STAGES)[number];
  pt2: number;
  pt3: number;
  unassigned: number;
  total: number;
  pct: number;
}

export interface ConstructionPipeline {
  items: ConstructionPipelineStage[];
  grandSum: number;
  unassignedTotal: number;
}

export function buildConstructionPipeline(
  data: readonly PipelineRecord[],
  unit: "port" | "lop"
): ConstructionPipeline {
  let grandSum = 0;
  let unassignedTotal = 0;

  const items = CONSTRUCTION_PIPELINE_STAGES.map((stage) => {
    let pt2 = 0;
    let pt3 = 0;
    let unassigned = 0;

    for (const record of data) {
      if (record.statusKonstruksi !== stage) continue;

      const value =
        unit === "lop"
          ? 1
          : stage === "05. Go Live"
            ? record.portReal
            : record.portPlan;

      if (record.pt === "PT2") pt2 += value;
      else if (record.pt === "PT3") pt3 += value;
      else unassigned += value;
    }

    const total = pt2 + pt3 + unassigned;
    grandSum += total;
    unassignedTotal += unassigned;
    return { stage, pt2, pt3, unassigned, total, pct: 0 };
  });

  return {
    items: items.map((item) => ({
      ...item,
      pct: grandSum > 0 ? (item.total / grandSum) * 100 : 0,
    })),
    grandSum,
    unassignedTotal,
  };
}

export function buildFinishStatusDistribution(
  data: readonly Pick<
    LopRecord,
    "statusKonstruksi" | "statusFiNyGolive" | "portPlan"
  >[],
  unit: "port" | "lop"
): { items: { name: string; value: number }[]; total: number } {
  const grouped = new Map<string, number>();
  let total = 0;

  for (const record of data) {
    if (record.statusKonstruksi !== "04. Finish Instalasi") continue;

    const value = unit === "lop" ? 1 : record.portPlan;
    const name = record.statusFiNyGolive?.trim() || "Status Belum Diisi";
    grouped.set(name, (grouped.get(name) || 0) + value);
    total += value;
  }

  const sorted = [...grouped.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const visibleItems = sorted.slice(0, 7);
  const remainder = sorted.slice(7).reduce((sum, item) => sum + item.value, 0);
  if (remainder > 0) {
    visibleItems.push({ name: "Status Lainnya", value: remainder });
  }

  return { items: visibleItems, total };
}

export function getDefaultPrioFlags(
  availableFlags?: readonly string[] | null
): string[] {
  const fallback = ["Prio Agustus", "Prio September"];
  if (!availableFlags || availableFlags.length === 0) {
    return fallback;
  }

  const targetMonths = ["agustus", "september"];
  const matched = availableFlags.filter((flag) => {
    const lower = flag.toLowerCase();
    return targetMonths.some((month) => lower.includes(month));
  });

  return matched;
}

export function createDefaultFilterState(
  options?: Partial<FilterOptions> | null
): FilterState {
  return {
    prioFlag: getDefaultPrioFlags(options?.prioFlag),
    pt: [],
    area: [],
    mitra: [],
    regional: [],
    branch: [],
    statusKonstruksi: [],
    branchFokus: true,
    search: "",
  };
}

export function createEmptyFilterState(): FilterState {
  return {
    prioFlag: [],
    pt: [],
    area: [],
    mitra: [],
    regional: [],
    branch: [],
    statusKonstruksi: [],
    branchFokus: true,
    search: "",
  };
}

export function isDefaultFilterState(
  state: FilterState,
  options?: Partial<FilterOptions> | null
): boolean {
  const defaultPrio = getDefaultPrioFlags(options?.prioFlag);
  const currentPrio = state.prioFlag || [];
  const samePrio =
    currentPrio.length === defaultPrio.length &&
    defaultPrio.every((p) => currentPrio.includes(p));

  return (
    samePrio &&
    (state.pt?.length || 0) === 0 &&
    (state.mitra?.length || 0) === 0 &&
    (state.area?.length || 0) === 0 &&
    (state.regional?.length || 0) === 0 &&
    (state.branch?.length || 0) === 0 &&
    (state.statusKonstruksi?.length || 0) === 0 &&
    state.branchFokus === true &&
    !state.search
  );
}

type KpiRecord = Pick<
  LopRecord,
  "statusKonstruksi" | "portPlan" | "portReal"
>;

export function buildKpiMetrics(data: readonly KpiRecord[]) {
  let totalPortPlan = 0;
  let totalPortReal = 0;
  let dropPort = 0;
  let dropLop = 0;
  let persiapanPort = 0;
  let persiapanLop = 0;
  let matdelPort = 0;
  let matdelLop = 0;
  let ogpPort = 0;
  let ogpLop = 0;
  let finishPort = 0;
  let finishLop = 0;
  let goLiveLop = 0;

  for (const record of data) {
    const portPlan = Number.isFinite(record.portPlan) ? record.portPlan : 0;
    const portReal = Number.isFinite(record.portReal) ? record.portReal : 0;
    totalPortPlan += portPlan;
    totalPortReal += portReal;
    if (portReal > 0) goLiveLop += 1;

    const status = record.statusKonstruksi || "";
    if (
      status.startsWith("00.") ||
      status.startsWith("0.") ||
      status.toLowerCase().includes("drop") ||
      status.toLowerCase().includes("kendala")
    ) {
      dropPort += portPlan;
      dropLop += 1;
    } else if (status === "01. Persiapan") {
      persiapanPort += portPlan;
      persiapanLop += 1;
    } else if (
      status === "02. Material Delivery" ||
      status === "02. Matdel"
    ) {
      matdelPort += portPlan;
      matdelLop += 1;
    } else if (status === "03. OGP Instalasi") {
      ogpPort += portPlan;
      ogpLop += 1;
    } else if (status === "04. Finish Instalasi") {
      finishPort += portPlan;
      finishLop += 1;
    }
  }

  return {
    totalLop: data.length,
    totalPortPlan,
    totalPortReal,
    realizationRate:
      totalPortPlan > 0 ? (totalPortReal / totalPortPlan) * 100 : 0,
    dropPort,
    dropLop,
    dropPct: totalPortPlan > 0 ? (dropPort / totalPortPlan) * 100 : 0,
    persiapanPort,
    persiapanLop,
    persiapanPct:
      totalPortPlan > 0 ? (persiapanPort / totalPortPlan) * 100 : 0,
    matdelPort,
    matdelLop,
    matdelPct: totalPortPlan > 0 ? (matdelPort / totalPortPlan) * 100 : 0,
    ogpPort,
    ogpLop,
    ogpPct: totalPortPlan > 0 ? (ogpPort / totalPortPlan) * 100 : 0,
    finishPort,
    finishLop,
    finishPct: totalPortPlan > 0 ? (finishPort / totalPortPlan) * 100 : 0,
    // Port Real is the authoritative realized/go-live port total. It can be
    // populated before the construction-status column is corrected.
    goLivePort: totalPortReal,
    goLiveLop,
    goLivePct:
      totalPortPlan > 0 ? (totalPortReal / totalPortPlan) * 100 : 0,
  };
}
