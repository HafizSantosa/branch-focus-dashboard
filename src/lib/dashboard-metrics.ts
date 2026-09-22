import type { LopRecord } from "@/types/lop";

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
