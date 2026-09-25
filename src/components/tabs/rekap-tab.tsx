"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LopRecord } from "@/types/lop";
import { formatNumber } from "@/lib/utils";
import { Download, Table as TableIcon } from "lucide-react";

interface RekapTabProps {
  data: LopRecord[];
}

interface StageSplit {
  pt2: number;
  pt3: number;
  total: number;
}

interface BranchRekap {
  area: string;
  branch: string;
  dropDbp: StageSplit;
  kendala: StageSplit;
  persiapan: StageSplit;
  matdel: StageSplit;
  ogp: StageSplit;
  finish: StageSplit;
  goLive: StageSplit;
  total: StageSplit;
  ach: number;
}

interface AreaGroup {
  area: string;
  branches: BranchRekap[];
  subtotal: BranchRekap;
}

const DEFAULT_BRANCH_BY_AREA: Record<string, string[]> = {
  "AREA 1": [
    "BANDA ACEH",
    "BENGKULU",
    "BUKIT TINGGI",
    "DUMAI",
    "JAMBI",
    "PADANG SIDEMPUAN",
    "PANGKAL PINANG",
  ],
  "AREA 2": ["BANDUNG", "BEKASI", "BOGOR", "KARAWANG", "TASIKMALAYA"],
  "AREA 3": ["FLORES", "KUPANG", "SURABAYA"],
  "AREA 4": ["BANJARMASIN", "MANADO", "SORONG", "TERNATE", "TIMIKA"],
};

function emptySplit(): StageSplit {
  return { pt2: 0, pt3: 0, total: 0 };
}

function sumSplits(a: StageSplit, b: StageSplit): StageSplit {
  return {
    pt2: a.pt2 + b.pt2,
    pt3: a.pt3 + b.pt3,
    total: a.total + b.total,
  };
}

function getAchStyle(ach: number): string {
  if (ach >= 10) return "bg-emerald-100 text-emerald-900 font-bold border border-emerald-300";
  if (ach >= 5) return "bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200";
  if (ach >= 2) return "bg-slate-100 text-slate-700 font-medium";
  if (ach > 0) return "bg-rose-50 text-rose-700 font-medium border border-rose-200";
  return "bg-rose-100 text-rose-800 font-semibold border border-rose-300";
}

export function RekapTab({ data }: RekapTabProps) {
  const { isAdmin } = useAuth();
  const [viewMode, setViewMode] = useState<"detail" | "compact">("detail");

  // Calculate full matrix grouping by Area and Branch
  const { areaGroups, grandTotal, kpis } = useMemo(() => {
    // Collect all branches present in data + defaults
    const branchRowsMap = new Map<string, LopRecord[]>();
    const observedBranchesByArea = new Map<string, Set<string>>();
    for (const record of data) {
      if (!record.branch) continue;
      const branch = record.branch.toUpperCase().trim();
      if (!branchRowsMap.has(branch)) {
        branchRowsMap.set(branch, []);
      }
      branchRowsMap.get(branch)!.push(record);

      if (!observedBranchesByArea.has(record.area)) {
        observedBranchesByArea.set(record.area, new Set());
      }
      observedBranchesByArea.get(record.area)!.add(branch);
    }

    const calculateBranchRekap = (areaName: string, branchName: string): BranchRekap => {
      const rows = branchRowsMap.get(branchName) || [];

      const calcStage = (stageMatch: (s: string) => boolean): StageSplit => {
        let pt2 = 0;
        let pt3 = 0;
        for (const r of rows) {
          if (stageMatch(r.statusKonstruksi || "")) {
            if (r.pt === "PT2") pt2 += r.portPlan;
            else if (r.pt === "PT3") pt3 += r.portPlan;
          }
        }
        return { pt2, pt3, total: pt2 + pt3 };
      };

      const dropDbp = calcStage((s) => s === "0. Drop DBP");
      const kendala = calcStage(
        (s) => s === "00. Propose Drop" || s.toLowerCase().includes("kendala")
      );
      const persiapan = calcStage((s) => s === "01. Persiapan");
      const matdel = calcStage((s) => s === "02. Material Delivery" || s === "02. Matdel");
      const ogp = calcStage((s) => s === "03. OGP Instalasi");
      const finish = calcStage((s) => s === "04. Finish Instalasi");

      // 05. Go Live is portReal
      let glPt2 = 0;
      let glPt3 = 0;
      for (const r of rows) {
        if (r.pt === "PT2") glPt2 += r.portReal;
        else if (r.pt === "PT3") glPt3 += r.portReal;
      }
      const goLive: StageSplit = { pt2: glPt2, pt3: glPt3, total: glPt2 + glPt3 };

      const totalPt2 =
        dropDbp.pt2 +
        kendala.pt2 +
        persiapan.pt2 +
        matdel.pt2 +
        ogp.pt2 +
        finish.pt2 +
        goLive.pt2;
      const totalPt3 =
        dropDbp.pt3 +
        kendala.pt3 +
        persiapan.pt3 +
        matdel.pt3 +
        ogp.pt3 +
        finish.pt3 +
        goLive.pt3;
      const totalCombined = totalPt2 + totalPt3;
      const ach = totalCombined > 0 ? (goLive.total / totalCombined) * 100 : 0;

      return {
        area: areaName,
        branch: branchName,
        dropDbp,
        kendala,
        persiapan,
        matdel,
        ogp,
        finish,
        goLive,
        total: { pt2: totalPt2, pt3: totalPt3, total: totalCombined },
        ach,
      };
    };

    const areaNames = ["AREA 1", "AREA 2", "AREA 3", "AREA 4"];
    const groups: AreaGroup[] = [];

    let gtDropDbp = emptySplit();
    let gtKendala = emptySplit();
    let gtPersiapan = emptySplit();
    let gtMatdel = emptySplit();
    let gtOgp = emptySplit();
    let gtFinish = emptySplit();
    let gtGoLive = emptySplit();
    let gtTotal = emptySplit();

    for (const area of areaNames) {
      const defaultBranches = DEFAULT_BRANCH_BY_AREA[area] || [];
      const additionalBranches = Array.from(
        observedBranchesByArea.get(area) ?? []
      )
        .filter((branch) => !defaultBranches.includes(branch))
        .sort();
      const definedBranches = [...defaultBranches, ...additionalBranches];
      const branchRekaps: BranchRekap[] = [];

      let stDropDbp = emptySplit();
      let stKendala = emptySplit();
      let stPersiapan = emptySplit();
      let stMatdel = emptySplit();
      let stOgp = emptySplit();
      let stFinish = emptySplit();
      let stGoLive = emptySplit();
      let stTotal = emptySplit();

      for (const b of definedBranches) {
        const row = calculateBranchRekap(area, b);
        branchRekaps.push(row);

        stDropDbp = sumSplits(stDropDbp, row.dropDbp);
        stKendala = sumSplits(stKendala, row.kendala);
        stPersiapan = sumSplits(stPersiapan, row.persiapan);
        stMatdel = sumSplits(stMatdel, row.matdel);
        stOgp = sumSplits(stOgp, row.ogp);
        stFinish = sumSplits(stFinish, row.finish);
        stGoLive = sumSplits(stGoLive, row.goLive);
        stTotal = sumSplits(stTotal, row.total);
      }

      const stAch = stTotal.total > 0 ? (stGoLive.total / stTotal.total) * 100 : 0;
      const subtotalRow: BranchRekap = {
        area,
        branch: `${area} TOTAL`,
        dropDbp: stDropDbp,
        kendala: stKendala,
        persiapan: stPersiapan,
        matdel: stMatdel,
        ogp: stOgp,
        finish: stFinish,
        goLive: stGoLive,
        total: stTotal,
        ach: stAch,
      };

      groups.push({
        area,
        branches: branchRekaps,
        subtotal: subtotalRow,
      });

      gtDropDbp = sumSplits(gtDropDbp, stDropDbp);
      gtKendala = sumSplits(gtKendala, stKendala);
      gtPersiapan = sumSplits(gtPersiapan, stPersiapan);
      gtMatdel = sumSplits(gtMatdel, stMatdel);
      gtOgp = sumSplits(gtOgp, stOgp);
      gtFinish = sumSplits(gtFinish, stFinish);
      gtGoLive = sumSplits(gtGoLive, stGoLive);
      gtTotal = sumSplits(gtTotal, stTotal);
    }

    const gtAch = gtTotal.total > 0 ? (gtGoLive.total / gtTotal.total) * 100 : 0;
    const grandTotalRow: BranchRekap = {
      area: "ALL",
      branch: "GRAND TOTAL",
      dropDbp: gtDropDbp,
      kendala: gtKendala,
      persiapan: gtPersiapan,
      matdel: gtMatdel,
      ogp: gtOgp,
      finish: gtFinish,
      goLive: gtGoLive,
      total: gtTotal,
      ach: gtAch,
    };

    const pipelineTotal =
      gtPersiapan.total + gtMatdel.total + gtOgp.total + gtFinish.total;
    const dropTotal = gtDropDbp.total + gtKendala.total;

    return {
      areaGroups: groups,
      grandTotal: grandTotalRow,
      kpis: {
        totalPort: gtTotal.total,
        totalPt2: gtTotal.pt2,
        totalPt3: gtTotal.pt3,
        goLivePort: gtGoLive.total,
        achPct: gtAch,
        pipelinePort: pipelineTotal,
        dropPort: dropTotal,
      },
    };
  }, [data]);

  // Export Matrix Table to CSV
  const handleExportMatrixCsv = () => {
    const csvRows: string[] = [];

    if (viewMode === "detail") {
      csvRows.push(
        "AREA,BRANCH,0. Drop DBP (PT2),0. Drop DBP (PT3),0. Drop DBP (Total),00. Kendala (PT2),00. Kendala (PT3),00. Kendala (Total),01. Persiapan (PT2),01. Persiapan (PT3),01. Persiapan (Total),02. Material Delivery (PT2),02. Material Delivery (PT3),02. Material Delivery (Total),03. OGP (PT2),03. OGP (PT3),03. OGP (Total),04. Finish (PT2),04. Finish (PT3),04. Finish (Total),05. Go Live (PT2),05. Go Live (PT3),05. Go Live (Total),Total (PT2),Total (PT3),Total Keseluruhan,Ach %"
      );

      for (const grp of areaGroups) {
        for (const b of grp.branches) {
          csvRows.push(
            `"${b.area}","${b.branch}",${b.dropDbp.pt2},${b.dropDbp.pt3},${b.dropDbp.total},${b.kendala.pt2},${b.kendala.pt3},${b.kendala.total},${b.persiapan.pt2},${b.persiapan.pt3},${b.persiapan.total},${b.matdel.pt2},${b.matdel.pt3},${b.matdel.total},${b.ogp.pt2},${b.ogp.pt3},${b.ogp.total},${b.finish.pt2},${b.finish.pt3},${b.finish.total},${b.goLive.pt2},${b.goLive.pt3},${b.goLive.total},${b.total.pt2},${b.total.pt3},${b.total.total},"${b.ach.toFixed(2)}%"`
          );
        }
        const s = grp.subtotal;
        csvRows.push(
          `"${s.area}","${s.branch}",${s.dropDbp.pt2},${s.dropDbp.pt3},${s.dropDbp.total},${s.kendala.pt2},${s.kendala.pt3},${s.kendala.total},${s.persiapan.pt2},${s.persiapan.pt3},${s.persiapan.total},${s.matdel.pt2},${s.matdel.pt3},${s.matdel.total},${s.ogp.pt2},${s.ogp.pt3},${s.ogp.total},${s.finish.pt2},${s.finish.pt3},${s.finish.total},${s.goLive.pt2},${s.goLive.pt3},${s.goLive.total},${s.total.pt2},${s.total.pt3},${s.total.total},"${s.ach.toFixed(2)}%"`
        );
      }

      const g = grandTotal;
      csvRows.push(
        `"ALL","${g.branch}",${g.dropDbp.pt2},${g.dropDbp.pt3},${g.dropDbp.total},${g.kendala.pt2},${g.kendala.pt3},${g.kendala.total},${g.persiapan.pt2},${g.persiapan.pt3},${g.persiapan.total},${g.matdel.pt2},${g.matdel.pt3},${g.matdel.total},${g.ogp.pt2},${g.ogp.pt3},${g.ogp.total},${g.finish.pt2},${g.finish.pt3},${g.finish.total},${g.goLive.pt2},${g.goLive.pt3},${g.goLive.total},${g.total.pt2},${g.total.pt3},${g.total.total},"${g.ach.toFixed(2)}%"`
      );
    } else {
      csvRows.push(
        "AREA,BRANCH,0. Drop DBP,00. Kendala,01. Persiapan,02. Material Delivery,03. OGP Instalasi,04. Finish Instalasi,05. Go Live,Total Keseluruhan,Ach %"
      );
      for (const grp of areaGroups) {
        for (const b of grp.branches) {
          csvRows.push(
            `"${b.area}","${b.branch}",${b.dropDbp.total},${b.kendala.total},${b.persiapan.total},${b.matdel.total},${b.ogp.total},${b.finish.total},${b.goLive.total},${b.total.total},"${b.ach.toFixed(2)}%"`
          );
        }
        const s = grp.subtotal;
        csvRows.push(
          `"${s.area}","${s.branch}",${s.dropDbp.total},${s.kendala.total},${s.persiapan.total},${s.matdel.total},${s.ogp.total},${s.finish.total},${s.goLive.total},${s.total.total},"${s.ach.toFixed(2)}%"`
        );
      }
      const g = grandTotal;
      csvRows.push(
        `"ALL","${g.branch}",${g.dropDbp.total},${g.kendala.total},${g.persiapan.total},${g.matdel.total},${g.ogp.total},${g.finish.total},${g.goLive.total},${g.total.total},"${g.ach.toFixed(2)}%"`
      );
    }

    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Tabel_Rekapitulasi_LOP_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderCell = (val: number, isSubtotal = false, isZeroEmpty = false) => {
    if (val === 0 && isZeroEmpty) {
      return <span className="text-slate-300">-</span>;
    }
    return (
      <span
        className={`tabular-nums ${
          isSubtotal
            ? "font-bold text-slate-900"
            : val > 0
            ? "font-medium text-slate-800"
            : "text-slate-400"
        }`}
      >
        {formatNumber(val)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Executive KPI summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="glass-card p-3 border-l-4 border-l-blue-600">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">
            Total Kapasitas Port
          </div>
          <div className="text-xl font-extrabold text-slate-800 mt-0.5 tabular-nums">
            {formatNumber(kpis.totalPort)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            PT2: {formatNumber(kpis.totalPt2)} | PT3: {formatNumber(kpis.totalPt3)}
          </div>
        </Card>

        <Card className="glass-card p-3 border-l-4 border-l-emerald-600">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">
            05. Go Live (Port Go Live)
          </div>
          <div className="text-xl font-extrabold text-emerald-700 mt-0.5 tabular-nums">
            {formatNumber(kpis.goLivePort)}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">
            Port fisik aktif terpasang
          </div>
        </Card>

        <Card className="glass-card p-3 border-l-4 border-l-teal-600">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">
            Tingkat Realisasi (Ach)
          </div>
          <div className="text-xl font-extrabold text-teal-700 mt-0.5 tabular-nums">
            {kpis.achPct.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Go Live / Total Keseluruhan
          </div>
        </Card>

        <Card className="glass-card p-3 border-l-4 border-l-amber-600">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">
            Pipeline Konstruksi Port
          </div>
          <div className="text-xl font-extrabold text-amber-700 mt-0.5 tabular-nums">
            {formatNumber(kpis.pipelinePort)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Tahap 01 Persiapan s/d 04 Finish
          </div>
        </Card>

        <Card className="glass-card p-3 border-l-4 border-l-rose-600 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">
            Drop & Kendala Port
          </div>
          <div className="text-xl font-extrabold text-rose-700 mt-0.5 tabular-nums">
            {formatNumber(kpis.dropPort)}
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5">
            0. Drop DBP + 00. Kendala
          </div>
        </Card>
      </div>

      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur border border-slate-200/80 p-3 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
            <TableIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Tabel Rekapitulasi Tahapan Port per Wilayah
            </h3>
            <p className="text-xs text-slate-500">
              Distribusi port plan & realisasi berdasarkan tahapan konstruksi (PT2 vs PT3)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode("detail")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === "detail"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Detail PT (PT2 / PT3)
            </button>
            <button
              onClick={() => setViewMode("compact")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                viewMode === "compact"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ringkas (Total)
            </button>
          </div>

          {/* Export Matrix Button — Admin only */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMatrixCsv}
              className="h-8 text-xs font-medium bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Unduh Tabel Rekapitulasi CSV</span>
            </Button>
          )}
        </div>
      </div>

      {/* Matrix Table with SOLID Opaque Sticky Columns */}
      <Card className="glass-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            {/* Header Tier 1 */}
            <thead>
              <tr className="bg-sky-100 text-slate-800 border-b border-slate-300 font-bold uppercase tracking-wider text-center">
                <th
                  rowSpan={viewMode === "detail" ? 2 : 1}
                  className="py-2.5 px-2.5 border-r border-slate-300 w-[80px] min-w-[80px] max-w-[80px] text-center bg-sky-200 text-slate-900 sticky left-0 z-30 font-extrabold"
                >
                  AREA
                </th>
                <th
                  rowSpan={viewMode === "detail" ? 2 : 1}
                  className="py-2.5 px-3 border-r-2 border-slate-300 w-[150px] min-w-[150px] max-w-[150px] text-left bg-sky-200 text-slate-900 sticky left-[80px] z-30 font-extrabold shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]"
                >
                  BRANCH
                </th>
                <th
                  colSpan={viewMode === "detail" ? 3 : 1}
                  className="py-1.5 px-2 border-r border-slate-300 bg-sky-100"
                >
                  0. Drop DBP
                </th>
                <th
                  colSpan={viewMode === "detail" ? 3 : 1}
                  className="py-1.5 px-2 border-r border-slate-300 bg-sky-100"
                >
                  00. Kendala
                </th>
                <th
                  colSpan={viewMode === "detail" ? 3 : 1}
                  className="py-1.5 px-2 border-r border-slate-300 bg-sky-100"
                >
                  01. Persiapan
                </th>
                <th
                  colSpan={viewMode === "detail" ? 3 : 1}
                  className="py-1.5 px-2 border-r border-slate-300 bg-sky-100"
                >
                  02. Material Delivery
                </th>
                <th
                  colSpan={viewMode === "detail" ? 3 : 1}
                  className="py-1.5 px-2 border-r border-slate-300 bg-sky-100"
                >
                  03. OGP Instalasi
                </th>
                <th
                  colSpan={viewMode === "detail" ? 3 : 1}
                  className="py-1.5 px-2 border-r border-slate-300 bg-sky-100"
                >
                  04. Finish Instalasi
                </th>
                <th
                  colSpan={viewMode === "detail" ? 3 : 1}
                  className="py-1.5 px-2 border-r border-slate-300 bg-emerald-100 text-emerald-950 font-extrabold"
                >
                  05. Go Live
                </th>
                <th
                  colSpan={viewMode === "detail" ? 3 : 1}
                  className="py-1.5 px-2 border-r border-slate-300 bg-sky-200 text-slate-900 font-extrabold"
                >
                  Total Keseluruhan
                </th>
                <th
                  rowSpan={viewMode === "detail" ? 2 : 1}
                  className="py-2.5 px-2.5 w-[75px] bg-emerald-200 text-emerald-950 font-extrabold text-center"
                >
                  Ach
                </th>
              </tr>

              {/* Header Tier 2 (PT2, PT3, PT2+3) */}
              {viewMode === "detail" && (
                <tr className="bg-sky-50 text-[10px] text-slate-600 border-b border-slate-300 font-semibold text-center">
                  <th className="py-1 px-1.5 border-r border-slate-200">PT2</th>
                  <th className="py-1 px-1.5 border-r border-slate-200">PT3</th>
                  <th className="py-1 px-1.5 border-r border-slate-300 font-bold text-slate-800">
                    PT2+3
                  </th>

                  <th className="py-1 px-1.5 border-r border-slate-200">PT2</th>
                  <th className="py-1 px-1.5 border-r border-slate-200">PT3</th>
                  <th className="py-1 px-1.5 border-r border-slate-300 font-bold text-slate-800">
                    PT2+3
                  </th>

                  <th className="py-1 px-1.5 border-r border-slate-200">PT2</th>
                  <th className="py-1 px-1.5 border-r border-slate-200">PT3</th>
                  <th className="py-1 px-1.5 border-r border-slate-300 font-bold text-slate-800">
                    PT2+3
                  </th>

                  <th className="py-1 px-1.5 border-r border-slate-200">PT2</th>
                  <th className="py-1 px-1.5 border-r border-slate-200">PT3</th>
                  <th className="py-1 px-1.5 border-r border-slate-300 font-bold text-slate-800">
                    PT2+3
                  </th>

                  <th className="py-1 px-1.5 border-r border-slate-200">PT2</th>
                  <th className="py-1 px-1.5 border-r border-slate-200">PT3</th>
                  <th className="py-1 px-1.5 border-r border-slate-300 font-bold text-slate-800">
                    PT2+3
                  </th>

                  <th className="py-1 px-1.5 border-r border-slate-200">PT2</th>
                  <th className="py-1 px-1.5 border-r border-slate-200">PT3</th>
                  <th className="py-1 px-1.5 border-r border-slate-300 font-bold text-slate-800">
                    PT2+3
                  </th>

                  <th className="py-1 px-1.5 border-r border-slate-200 bg-emerald-50">PT2</th>
                  <th className="py-1 px-1.5 border-r border-slate-200 bg-emerald-50">PT3</th>
                  <th className="py-1 px-1.5 border-r border-slate-300 font-bold text-emerald-900 bg-emerald-100">
                    PT2+3
                  </th>

                  <th className="py-1 px-1.5 border-r border-slate-200 bg-sky-100">PT2</th>
                  <th className="py-1 px-1.5 border-r border-slate-200 bg-sky-100">PT3</th>
                  <th className="py-1 px-1.5 border-r border-slate-300 font-bold text-slate-900 bg-sky-200">
                    PT2+3
                  </th>
                </tr>
              )}
            </thead>

            {/* Table Body grouped by Area */}
            <tbody>
              {areaGroups.map((grp) => (
                <div key={grp.area} style={{ display: "contents" }}>
                  {grp.branches.map((b) => (
                    <tr
                      key={b.branch}
                      className="hover:bg-blue-50/50 border-b border-slate-200 transition-colors"
                    >
                      {/* Area cell on every branch row with solid opaque background */}
                      <td className="py-1.5 px-2.5 border-r border-slate-300 font-bold text-slate-800 text-center bg-slate-100 sticky left-0 z-10 w-[80px] min-w-[80px] max-w-[80px]">
                        {b.area}
                      </td>

                      {/* Branch Name with solid opaque background & shadow border */}
                      <td className="py-1.5 px-3 border-r-2 border-slate-300 font-semibold text-slate-800 whitespace-nowrap bg-white sticky left-[80px] z-10 w-[150px] min-w-[150px] max-w-[150px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]">
                        {b.branch}
                      </td>

                      {/* 0. Drop DBP */}
                      {viewMode === "detail" ? (
                        <>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.dropDbp.pt2, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.dropDbp.pt3, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-200 font-semibold">
                            {renderCell(b.dropDbp.total)}
                          </td>
                        </>
                      ) : (
                        <td className="py-1 px-2 text-right border-r border-slate-200 font-semibold">
                          {renderCell(b.dropDbp.total)}
                        </td>
                      )}

                      {/* 00. Kendala */}
                      {viewMode === "detail" ? (
                        <>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.kendala.pt2, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.kendala.pt3, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-200 font-semibold">
                            {renderCell(b.kendala.total)}
                          </td>
                        </>
                      ) : (
                        <td className="py-1 px-2 text-right border-r border-slate-200 font-semibold">
                          {renderCell(b.kendala.total)}
                        </td>
                      )}

                      {/* 01. Persiapan */}
                      {viewMode === "detail" ? (
                        <>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.persiapan.pt2, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.persiapan.pt3, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-200 font-semibold">
                            {renderCell(b.persiapan.total)}
                          </td>
                        </>
                      ) : (
                        <td className="py-1 px-2 text-right border-r border-slate-200 font-semibold">
                          {renderCell(b.persiapan.total)}
                        </td>
                      )}

                      {/* 02. Matdel */}
                      {viewMode === "detail" ? (
                        <>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.matdel.pt2, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.matdel.pt3, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-200 font-semibold">
                            {renderCell(b.matdel.total)}
                          </td>
                        </>
                      ) : (
                        <td className="py-1 px-2 text-right border-r border-slate-200 font-semibold">
                          {renderCell(b.matdel.total)}
                        </td>
                      )}

                      {/* 03. OGP Instalasi */}
                      {viewMode === "detail" ? (
                        <>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.ogp.pt2, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.ogp.pt3, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-200 font-semibold">
                            {renderCell(b.ogp.total)}
                          </td>
                        </>
                      ) : (
                        <td className="py-1 px-2 text-right border-r border-slate-200 font-semibold">
                          {renderCell(b.ogp.total)}
                        </td>
                      )}

                      {/* 04. Finish Instalasi */}
                      {viewMode === "detail" ? (
                        <>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.finish.pt2, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100">
                            {renderCell(b.finish.pt3, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-200 font-semibold">
                            {renderCell(b.finish.total)}
                          </td>
                        </>
                      ) : (
                        <td className="py-1 px-2 text-right border-r border-slate-200 font-semibold">
                          {renderCell(b.finish.total)}
                        </td>
                      )}

                      {/* 05. Go Live */}
                      {viewMode === "detail" ? (
                        <>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100 bg-emerald-50">
                            {renderCell(b.goLive.pt2, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100 bg-emerald-50">
                            {renderCell(b.goLive.pt3, false, true)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-200 font-bold text-emerald-800 bg-emerald-100/80">
                            {renderCell(b.goLive.total)}
                          </td>
                        </>
                      ) : (
                        <td className="py-1 px-2 text-right border-r border-slate-200 font-bold text-emerald-800 bg-emerald-100/80">
                          {renderCell(b.goLive.total)}
                        </td>
                      )}

                      {/* Total Keseluruhan */}
                      {viewMode === "detail" ? (
                        <>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100 font-medium">
                            {renderCell(b.total.pt2)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-100 font-medium">
                            {renderCell(b.total.pt3)}
                          </td>
                          <td className="py-1 px-1.5 text-right border-r border-slate-200 font-bold text-slate-900 bg-slate-50">
                            {renderCell(b.total.total)}
                          </td>
                        </>
                      ) : (
                        <td className="py-1 px-2 text-right border-r border-slate-200 font-bold text-slate-900 bg-slate-50">
                          {renderCell(b.total.total)}
                        </td>
                      )}

                      {/* Ach % */}
                      <td className="py-1 px-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] ${getAchStyle(
                            b.ach
                          )}`}
                        >
                          {b.ach.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Area Subtotal Row with SOLID Opaque Backgrounds on both columns */}
                  <tr className="bg-sky-100 border-y-2 border-sky-300 font-bold text-slate-900">
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center uppercase sticky left-0 z-10 w-[80px] min-w-[80px] max-w-[80px] bg-sky-200 font-extrabold text-slate-900">
                      {grp.area}
                    </td>
                    <td className="py-2 px-3 border-r-2 border-slate-300 text-left uppercase sticky left-[80px] z-10 w-[150px] min-w-[150px] max-w-[150px] bg-sky-200 font-extrabold text-slate-900 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)] whitespace-nowrap">
                      {grp.subtotal.branch}
                    </td>

                    {/* 0. Drop DBP Subtotal */}
                    {viewMode === "detail" ? (
                      <>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.dropDbp.pt2, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.dropDbp.pt3, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                          {renderCell(grp.subtotal.dropDbp.total, true)}
                        </td>
                      </>
                    ) : (
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                        {renderCell(grp.subtotal.dropDbp.total, true)}
                      </td>
                    )}

                    {/* 00. Kendala Subtotal */}
                    {viewMode === "detail" ? (
                      <>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.kendala.pt2, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.kendala.pt3, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                          {renderCell(grp.subtotal.kendala.total, true)}
                        </td>
                      </>
                    ) : (
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                        {renderCell(grp.subtotal.kendala.total, true)}
                      </td>
                    )}

                    {/* 01. Persiapan Subtotal */}
                    {viewMode === "detail" ? (
                      <>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.persiapan.pt2, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.persiapan.pt3, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                          {renderCell(grp.subtotal.persiapan.total, true)}
                        </td>
                      </>
                    ) : (
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                        {renderCell(grp.subtotal.persiapan.total, true)}
                      </td>
                    )}

                    {/* 02. Matdel Subtotal */}
                    {viewMode === "detail" ? (
                      <>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.matdel.pt2, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.matdel.pt3, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                          {renderCell(grp.subtotal.matdel.total, true)}
                        </td>
                      </>
                    ) : (
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                        {renderCell(grp.subtotal.matdel.total, true)}
                      </td>
                    )}

                    {/* 03. OGP Subtotal */}
                    {viewMode === "detail" ? (
                      <>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.ogp.pt2, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.ogp.pt3, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                          {renderCell(grp.subtotal.ogp.total, true)}
                        </td>
                      </>
                    ) : (
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                        {renderCell(grp.subtotal.ogp.total, true)}
                      </td>
                    )}

                    {/* 04. Finish Subtotal */}
                    {viewMode === "detail" ? (
                      <>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.finish.pt2, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200">
                          {renderCell(grp.subtotal.finish.pt3, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                          {renderCell(grp.subtotal.finish.total, true)}
                        </td>
                      </>
                    ) : (
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-extrabold text-slate-900 bg-sky-100">
                        {renderCell(grp.subtotal.finish.total, true)}
                      </td>
                    )}

                    {/* 05. Go Live Subtotal */}
                    {viewMode === "detail" ? (
                      <>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200 bg-emerald-100">
                          {renderCell(grp.subtotal.goLive.pt2, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200 bg-emerald-100">
                          {renderCell(grp.subtotal.goLive.pt3, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-300 font-black text-emerald-950 bg-emerald-200">
                          {renderCell(grp.subtotal.goLive.total, true)}
                        </td>
                      </>
                    ) : (
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-black text-emerald-950 bg-emerald-200">
                        {renderCell(grp.subtotal.goLive.total, true)}
                      </td>
                    )}

                    {/* Total Keseluruhan Subtotal */}
                    {viewMode === "detail" ? (
                      <>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200 bg-sky-100">
                          {renderCell(grp.subtotal.total.pt2, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-200 bg-sky-100">
                          {renderCell(grp.subtotal.total.pt3, true)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-300 font-black text-slate-950 bg-sky-200">
                          {renderCell(grp.subtotal.total.total, true)}
                        </td>
                      </>
                    ) : (
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-black text-slate-950 bg-sky-200">
                        {renderCell(grp.subtotal.total.total, true)}
                      </td>
                    )}

                    {/* Subtotal Ach % */}
                    <td className="py-1.5 px-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getAchStyle(
                          grp.subtotal.ach
                        )}`}
                      >
                        {grp.subtotal.ach.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                </div>
              ))}

              {/* GRAND TOTAL ROW with SOLID Opaque Dark Background */}
              <tr className="bg-slate-950 text-white border-t-4 border-slate-900 font-extrabold text-xs">
                <td className="py-2.5 px-2.5 text-center font-black text-white border-r border-slate-800 sticky left-0 z-20 w-[80px] min-w-[80px] max-w-[80px] bg-slate-950">
                  ALL
                </td>
                <td className="py-2.5 px-3 text-left font-black text-white whitespace-nowrap border-r-2 border-slate-700 sticky left-[80px] z-20 w-[150px] min-w-[150px] max-w-[150px] bg-slate-950 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.2)]">
                  GRAND TOTAL
                </td>

                {/* 0. Drop DBP Grand Total */}
                {viewMode === "detail" ? (
                  <>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.dropDbp.pt2)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.dropDbp.pt3)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-700 font-black text-white">
                      {formatNumber(grandTotal.dropDbp.total)}
                    </td>
                  </>
                ) : (
                  <td className="py-2 px-2 text-right border-r border-slate-700 font-black text-white">
                    {formatNumber(grandTotal.dropDbp.total)}
                  </td>
                )}

                {/* 00. Kendala Grand Total */}
                {viewMode === "detail" ? (
                  <>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.kendala.pt2)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.kendala.pt3)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-700 font-black text-white">
                      {formatNumber(grandTotal.kendala.total)}
                    </td>
                  </>
                ) : (
                  <td className="py-2 px-2 text-right border-r border-slate-700 font-black text-white">
                    {formatNumber(grandTotal.kendala.total)}
                  </td>
                )}

                {/* 01. Persiapan Grand Total */}
                {viewMode === "detail" ? (
                  <>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.persiapan.pt2)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.persiapan.pt3)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-700 font-black text-white">
                      {formatNumber(grandTotal.persiapan.total)}
                    </td>
                  </>
                ) : (
                  <td className="py-2 px-2 text-right border-r border-slate-700 font-black text-white">
                    {formatNumber(grandTotal.persiapan.total)}
                  </td>
                )}

                {/* 02. Matdel Grand Total */}
                {viewMode === "detail" ? (
                  <>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.matdel.pt2)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.matdel.pt3)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-700 font-black text-white">
                      {formatNumber(grandTotal.matdel.total)}
                    </td>
                  </>
                ) : (
                  <td className="py-2 px-2 text-right border-r border-slate-700 font-black text-white">
                    {formatNumber(grandTotal.matdel.total)}
                  </td>
                )}

                {/* 03. OGP Grand Total */}
                {viewMode === "detail" ? (
                  <>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.ogp.pt2)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.ogp.pt3)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-700 font-black text-white">
                      {formatNumber(grandTotal.ogp.total)}
                    </td>
                  </>
                ) : (
                  <td className="py-2 px-2 text-right border-r border-slate-700 font-black text-white">
                    {formatNumber(grandTotal.ogp.total)}
                  </td>
                )}

                {/* 04. Finish Grand Total */}
                {viewMode === "detail" ? (
                  <>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.finish.pt2)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.finish.pt3)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-700 font-black text-white">
                      {formatNumber(grandTotal.finish.total)}
                    </td>
                  </>
                ) : (
                  <td className="py-2 px-2 text-right border-r border-slate-700 font-black text-white">
                    {formatNumber(grandTotal.finish.total)}
                  </td>
                )}

                {/* 05. Go Live Grand Total */}
                {viewMode === "detail" ? (
                  <>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-emerald-300">
                      {formatNumber(grandTotal.goLive.pt2)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-emerald-300">
                      {formatNumber(grandTotal.goLive.pt3)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-700 font-black text-emerald-400 bg-slate-900">
                      {formatNumber(grandTotal.goLive.total)}
                    </td>
                  </>
                ) : (
                  <td className="py-2 px-2 text-right border-r border-slate-700 font-black text-emerald-400 bg-slate-900">
                    {formatNumber(grandTotal.goLive.total)}
                  </td>
                )}

                {/* Total Keseluruhan Grand Total */}
                {viewMode === "detail" ? (
                  <>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.total.pt2)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-800 text-slate-300">
                      {formatNumber(grandTotal.total.pt3)}
                    </td>
                    <td className="py-2 px-1.5 text-right border-r border-slate-700 font-black text-yellow-300 bg-slate-900">
                      {formatNumber(grandTotal.total.total)}
                    </td>
                  </>
                ) : (
                  <td className="py-2 px-2 text-right border-r border-slate-700 font-black text-yellow-300 bg-slate-900">
                    {formatNumber(grandTotal.total.total)}
                  </td>
                )}

                {/* Grand Total Ach % */}
                <td className="py-2 px-2 text-center bg-emerald-500 text-slate-950 font-black text-xs">
                  {grandTotal.ach.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
