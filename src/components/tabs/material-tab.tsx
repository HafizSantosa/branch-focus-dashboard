"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LopRecord } from "@/types/lop";
import { formatNumber, formatPercent } from "@/lib/utils";
import { CheckCircle2, Clock, PackageCheck, AlertTriangle, Layers, CalendarClock, Download } from "lucide-react";

interface MaterialTabProps {
  data: LopRecord[];
}

const ACTIVE_STAGES = [
  "01. Persiapan",
  "02. Material Delivery",
  "03. OGP Instalasi",
  "04. Finish Instalasi",
];
const ALLOWED_ETA_DATES = [
  "20/09",
  "23/09",
  "25/09",
  "26/09",
  "27/09",
  "30/09",
  "05/10",
  "06/10",
  "14/10",
];


function normalizeStage(stage: string): string {
  const s = (stage || "").trim();
  if (s === "02. Matdel") return "02. Material Delivery";
  return s;
}

function normalizeMaterialStatus(status: string): "Ready" | "NY Ready" | "Belum Terdata" {
  const s = (status || "").trim().toLowerCase();
  if (s === "ready") return "Ready";
  if (s === "ny ready" || s === "not yet ready" || s.includes("ny")) return "NY Ready";
  return "Belum Terdata";
}

function getEtaHeatmapClass(val: number): string {
  if (val >= 2000) return "bg-[#c26d24] text-white font-extrabold";
  if (val >= 800) return "bg-[#e2b078] text-slate-900 font-bold";
  if (val > 0) return "bg-[#faedd8] text-slate-800 font-semibold";
  return "";
}

export function MaterialTab({ data }: MaterialTabProps) {
  const { isAdmin } = useAuth();
  const [unit, setUnit] = useState<"port" | "lop">("port");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const isPort = unit === "port";
  const unitLabel = isPort ? "Port" : "LOP";

  // Filter only active construction stages (Persiapan to Finish Instalasi)
  const activeRecords = useMemo(() => {
    return data.filter((d) => {
      const stage = normalizeStage(d.statusKonstruksi);
      if (!ACTIVE_STAGES.includes(stage)) return false;
      if (stageFilter !== "ALL" && stage !== stageFilter) return false;
      return true;
    });
  }, [data, stageFilter]);

  // Overall KPIs
  const kpis = useMemo(() => {
    let totalPort = 0;
    const totalLop = activeRecords.length;
    let readyPort = 0, readyLop = 0;
    let nyReadyPort = 0, nyReadyLop = 0;
    let unassignedPort = 0, unassignedLop = 0;

    for (const d of activeRecords) {
      const p = d.portPlan || 0;
      totalPort += p;
      const m = normalizeMaterialStatus(d.statusMaterial);
      if (m === "Ready") {
        readyPort += p;
        readyLop += 1;
      } else if (m === "NY Ready") {
        nyReadyPort += p;
        nyReadyLop += 1;
      } else {
        unassignedPort += p;
        unassignedLop += 1;
      }
    }

    const readyRate = totalPort > 0 ? (readyPort / totalPort) * 100 : 0;
    const nyReadyRate = totalPort > 0 ? (nyReadyPort / totalPort) * 100 : 0;

    return {
      totalPort,
      totalLop,
      readyPort,
      readyLop,
      readyRate,
      nyReadyPort,
      nyReadyLop,
      nyReadyRate,
      unassignedPort,
      unassignedLop,
    };
  }, [activeRecords]);

  // 1. Stage x Material Matrix Data
  const stageMatrixData = useMemo(() => {
    return ACTIVE_STAGES.map((stage) => {
      const subset = data.filter((d) => normalizeStage(d.statusKonstruksi) === stage);
      let ready = 0, nyReady = 0, unassigned = 0;
      let readyCount = 0, nyReadyCount = 0, unassignedCount = 0;

      for (const d of subset) {
        const val = isPort ? d.portPlan : 1;
        const m = normalizeMaterialStatus(d.statusMaterial);
        if (m === "Ready") {
          ready += val;
          readyCount += 1;
        } else if (m === "NY Ready") {
          nyReady += val;
          nyReadyCount += 1;
        } else {
          unassigned += val;
          unassignedCount += 1;
        }
      }

      const total = ready + nyReady + unassigned;
      const readyPct = total > 0 ? (ready / total) * 100 : 0;

      return {
        stage,
        shortStage: stage.replace(/^\d+\.\s*/, ""),
        ready,
        nyReady,
        unassigned,
        total,
        readyPct,
        readyCount,
        nyReadyCount,
        unassignedCount,
      };
    });
  }, [data, isPort]);

  // 2. Area x Material Readiness Data
  const areaMaterialData = useMemo(() => {
    const areas = ["AREA 1", "AREA 2", "AREA 3", "AREA 4"];
    return areas.map((area) => {
      const subset = activeRecords.filter((d) => d.area === area);
      let ready = 0, nyReady = 0, unassigned = 0;

      for (const d of subset) {
        const val = isPort ? d.portPlan : 1;
        const m = normalizeMaterialStatus(d.statusMaterial);
        if (m === "Ready") ready += val;
        else if (m === "NY Ready") nyReady += val;
        else unassigned += val;
      }

      const total = ready + nyReady + unassigned;
      const readyPct = total > 0 ? (ready / total) * 100 : 0;

      return {
        area,
        ready,
        nyReady,
        unassigned,
        total,
        readyPct,
      };
    });
  }, [activeRecords, isPort]);

  // 3. Top Branches with Material Bottleneck (NY Ready)
  const branchBottlenecks = useMemo(() => {
    const branchMap = new Map<
      string,
      { nyReadyPort: number; nyReadyLop: number; totalPort: number; totalLop: number; area: string }
    >();

    for (const d of activeRecords) {
      if (!d.branch) continue;
      if (!branchMap.has(d.branch)) {
        branchMap.set(d.branch, { nyReadyPort: 0, nyReadyLop: 0, totalPort: 0, totalLop: 0, area: d.area });
      }
      const item = branchMap.get(d.branch)!;
      const p = d.portPlan || 0;
      item.totalPort += p;
      item.totalLop += 1;
      if (normalizeMaterialStatus(d.statusMaterial) === "NY Ready") {
        item.nyReadyPort += p;
        item.nyReadyLop += 1;
      }
    }

    return Array.from(branchMap.entries())
      .map(([branch, stats]) => ({
        branch,
        area: stats.area,
        nyReady: isPort ? stats.nyReadyPort : stats.nyReadyLop,
        total: isPort ? stats.totalPort : stats.totalLop,
        lopCount: stats.nyReadyLop,
        portCount: stats.nyReadyPort,
      }))
      .filter((b) => b.nyReady > 0)
      .sort((a, b) => b.nyReady - a.nyReady)
      .slice(0, 10);
  }, [activeRecords, isPort]);

  // 4. Blocked LOP Records (NY Ready) for operational review
  const blockedLops = useMemo(() => {
    return activeRecords
      .filter((d) => normalizeMaterialStatus(d.statusMaterial) === "NY Ready")
      .slice(0, 50);
  }, [activeRecords]);

  // 5. Plan ETA Matrix computation (Regional x Date) following user's 9 ETA dates
  const etaTableData = useMemo(() => {
    const dates = ALLOWED_ETA_DATES;

    // Group by Area -> Regional across all data rows that have planEta in ALLOWED_ETA_DATES
    const areaMap = new Map<string, Map<string, Record<string, number>>>();

    for (const d of data) {
      if (!d.planEta || !dates.includes(d.planEta) || !d.regional) continue;
      const area = d.area || "UNKNOWN";
      const reg = d.regional;
      const p = d.portPlan || 0;

      if (!areaMap.has(area)) areaMap.set(area, new Map());
      const regMap = areaMap.get(area)!;
      if (!regMap.has(reg)) regMap.set(reg, {});
      const dateCounts = regMap.get(reg)!;
      dateCounts[d.planEta] = (dateCounts[d.planEta] || 0) + p;
    }

    const areaOrder = ["AREA 1", "AREA 2", "AREA 3", "AREA 4"];
    const groups: {
      area: string;
      regionals: { regional: string; byDate: Record<string, number>; total: number }[];
      subtotal: { byDate: Record<string, number>; total: number };
    }[] = [];

    const grandTotalByDate: Record<string, number> = {};
    dates.forEach((d) => (grandTotalByDate[d] = 0));
    let grandTotalOverall = 0;

    for (const area of areaOrder) {
      const regMap = areaMap.get(area);
      if (!regMap || regMap.size === 0) continue;

      const regList: { regional: string; byDate: Record<string, number>; total: number }[] = [];
      const subtotalByDate: Record<string, number> = {};
      dates.forEach((d) => (subtotalByDate[d] = 0));
      let subtotalOverall = 0;

      for (const [reg, byDate] of Array.from(regMap.entries())) {
        let regTotal = 0;
        for (const [d, val] of Object.entries(byDate)) {
          if (dates.includes(d)) {
            regTotal += val;
            subtotalByDate[d] = (subtotalByDate[d] || 0) + val;
            grandTotalByDate[d] = (grandTotalByDate[d] || 0) + val;
          }
        }
        regList.push({ regional: reg, byDate, total: regTotal });
        subtotalOverall += regTotal;
        grandTotalOverall += regTotal;
      }

      regList.sort((a, b) => a.regional.localeCompare(b.regional));

      groups.push({
        area,
        regionals: regList,
        subtotal: { byDate: subtotalByDate, total: subtotalOverall },
      });
    }

    return {
      dates,
      groups,
      grandTotal: { byDate: grandTotalByDate, total: grandTotalOverall },
    };
  }, [data]);

  // Export Plan ETA table to CSV
  const handleExportEtaCsv = () => {
    const headers = ["Regional", ...etaTableData.dates, "Total"];
    const csvRows = [headers.join(",")];

    for (const grp of etaTableData.groups) {
      for (const r of grp.regionals) {
        const rowVals = [
          `"${r.regional}"`,
          ...etaTableData.dates.map((d) => r.byDate[d] || 0),
          r.total,
        ];
        csvRows.push(rowVals.join(","));
      }
      const subVals = [
        `"${grp.area} Total"`,
        ...etaTableData.dates.map((d) => grp.subtotal.byDate[d] || 0),
        grp.subtotal.total,
      ];
      csvRows.push(subVals.join(","));
    }

    const grandVals = [
      `"TOTAL"`,
      ...etaTableData.dates.map((d) => etaTableData.grandTotal.byDate[d] || 0),
      etaTableData.grandTotal.total,
    ];
    csvRows.push(grandVals.join(","));

    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Plan_ETA_Material_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Cards for Material Readiness */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card p-3.5 border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Pipeline Aktif</span>
            <div className="p-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-1 tabular-nums">
            {formatNumber(kpis.totalPort)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {formatNumber(kpis.totalLop)} LOP (Tahap Persiapan s/d Finish Instalasi)
          </div>
        </Card>

        <Card className="glass-card p-3.5 border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase">Material Ready</span>
            <div className="p-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1 tabular-nums">
            {formatNumber(kpis.readyPort)}
          </div>
          <div className="text-xs text-emerald-700 mt-0.5 font-medium">
            {formatPercent(kpis.readyRate)} ({formatNumber(kpis.readyLop)} LOP)
          </div>
        </Card>

        <Card className="glass-card p-3.5 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase">Material Not Yet Ready</span>
            <div className="p-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1 tabular-nums">
            {formatNumber(kpis.nyReadyPort)}
          </div>
          <div className="text-xs text-amber-700 mt-0.5 font-medium">
            {formatPercent(kpis.nyReadyRate)} ({formatNumber(kpis.nyReadyLop)} LOP)
          </div>
        </Card>

      </div>

      {/* Control Bar: Unit Toggle & Stage Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 backdrop-blur border border-slate-200/70 p-2.5 rounded-xl">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-slate-500 font-medium mr-1 shrink-0">Filter Tahapan:</span>
          {["ALL", ...ACTIVE_STAGES].map((stg) => (
            <button
              key={stg}
              onClick={() => setStageFilter(stg)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 ${
                stageFilter === stg
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {stg === "ALL" ? "Semua Tahapan (01-04)" : stg.replace(/^\d+\.\s*/, "")}
            </button>
          ))}
        </div>

        <div className="flex items-center self-end sm:self-auto bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs shrink-0">
          <button
            onClick={() => setUnit("port")}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              unit === "port"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Port
          </button>
          <button
            onClick={() => setUnit("lop")}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              unit === "lop"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            LOP
          </button>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Material Readiness per Tahapan Konstruksi */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span>Kesiapan Material per Tahapan Konstruksi ({unitLabel})</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Ready: {formatPercent(kpis.readyRate)}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Distribusi status material (Ready, NY Ready, Belum Terdata) pada tiap fase konstruksi
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[310px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageMatrixData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="shortStage" tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = stageMatrixData.find((s) => s.shortStage === label);
                        const total = item?.total || 1;
                        return (
                          <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[200px]">
                            <p className="font-bold text-slate-100 mb-2 border-b border-slate-700 pb-1 flex justify-between">
                              <span>{item?.stage}</span>
                              <span className="text-blue-300 font-semibold">{formatNumber(total)} {unitLabel}</span>
                            </p>
                            <div className="space-y-1.5 text-[11px]">
                              <div className="flex justify-between text-emerald-300">
                                <span>Ready:</span>
                                <span className="font-bold">{formatNumber(item?.ready || 0)} ({formatPercent(((item?.ready || 0) / total) * 100)})</span>
                              </div>
                              <div className="flex justify-between text-amber-300">
                                <span>NY Ready:</span>
                                <span className="font-bold">{formatNumber(item?.nyReady || 0)} ({formatPercent(((item?.nyReady || 0) / total) * 100)})</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Belum Terdata:</span>
                                <span>{formatNumber(item?.unassigned || 0)} ({formatPercent(((item?.unassigned || 0) / total) * 100)})</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="ready" name="Ready" stackId="mat" fill="#10b981" isAnimationActive={false} />
                  <Bar dataKey="nyReady" name="NY Ready" stackId="mat" fill="#f59e0b" isAnimationActive={false} />
                  <Bar dataKey="unassigned" name="Belum Terdata (#N/A)" stackId="mat" fill="#94a3b8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Material Readiness per Area */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span>Kesiapan Material per Area ({unitLabel})</span>
              <span className="text-xs font-normal text-slate-500">4 Area Operasional</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Perbandingan kesiapan material proyek aktif antar wilayah
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[310px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={areaMaterialData} layout="vertical" margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis dataKey="area" type="category" tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} width={70} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = areaMaterialData.find((a) => a.area === label);
                        const total = item?.total || 1;
                        return (
                          <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[190px]">
                            <p className="font-bold text-slate-100 mb-2 border-b border-slate-700 pb-1">
                              {label} (Total: {formatNumber(total)} {unitLabel})
                            </p>
                            <div className="space-y-1.5 text-[11px]">
                              <div className="flex justify-between text-emerald-300">
                                <span>Ready:</span>
                                <span className="font-bold">{formatNumber(item?.ready || 0)} ({formatPercent(((item?.ready || 0) / total) * 100)})</span>
                              </div>
                              <div className="flex justify-between text-amber-300">
                                <span>NY Ready:</span>
                                <span className="font-bold">{formatNumber(item?.nyReady || 0)} ({formatPercent(((item?.nyReady || 0) / total) * 100)})</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Belum Terdata:</span>
                                <span>{formatNumber(item?.unassigned || 0)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="ready" name="Ready" stackId="amat" fill="#10b981" isAnimationActive={false} />
                  <Bar dataKey="nyReady" name="NY Ready" stackId="amat" fill="#f59e0b" isAnimationActive={false} />
                  <Bar dataKey="unassigned" name="Belum Terdata (#N/A)" stackId="amat" fill="#94a3b8" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Matrix Table and Top NY Ready Branches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cross-Tabulation Matrix Table */}
        <Card className="glass-card lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <span>Matriks Kesiapan Material per Tahapan Konstruksi</span>
              </span>
              <span className="text-xs text-slate-500 font-normal">Kapasitas Port & Jumlah LOP</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Rincian proyek yang siap material vs masih tertahan pengadaan per fase pengerjaan
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-center">
                    <th className="py-2 px-3 text-left w-[160px]">Tahapan Konstruksi</th>
                    <th className="py-2 px-2 text-right text-emerald-800 bg-emerald-50">Ready (Port)</th>
                    <th className="py-2 px-2 text-right text-emerald-800 bg-emerald-50">Ready (LOP)</th>
                    <th className="py-2 px-2 text-right text-amber-800 bg-amber-50">NY Ready (Port)</th>
                    <th className="py-2 px-2 text-right text-amber-800 bg-amber-50">NY Ready (LOP)</th>
                    <th className="py-2 px-2 text-right text-slate-700">Total (Port)</th>
                    <th className="py-2 px-2 text-center w-[85px] bg-slate-200/80">Kesiapan %</th>
                  </tr>
                </thead>
                <tbody>
                  {stageMatrixData.map((row) => (
                    <tr key={row.stage} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {row.stage}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40">
                        {formatNumber(row.ready)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-800 bg-emerald-50/40">
                        {formatNumber(row.readyCount)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-amber-700 bg-amber-50/40">
                        {formatNumber(row.nyReady)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-amber-800 bg-amber-50/40">
                        {formatNumber(row.nyReadyCount)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                        {formatNumber(row.total)}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold ${
                            row.readyPct >= 80
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : row.readyPct >= 50
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-rose-100 text-rose-800 border border-rose-300"
                          }`}
                        >
                          {formatPercent(row.readyPct)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-slate-900 text-white font-extrabold border-t-2 border-slate-950">
                    <td className="py-2.5 px-3 uppercase">Total Pipeline Aktif</td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-300 bg-slate-850">
                      {formatNumber(kpis.readyPort)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-300 bg-slate-850">
                      {formatNumber(kpis.readyLop)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-amber-300 bg-slate-850">
                      {formatNumber(kpis.nyReadyPort)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-amber-300 bg-slate-850">
                      {formatNumber(kpis.nyReadyLop)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-yellow-300">
                      {formatNumber(kpis.totalPort)}
                    </td>
                    <td className="py-2 px-2 text-center text-emerald-400 font-black">
                      {formatPercent(kpis.readyRate)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Top Branches Blocked by Material (NY Ready) */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Top Branch Tertahan Material</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Branch dengan volume status &quot;NY Ready&quot; terbesar
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {branchBottlenecks.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">
                  Tidak ada branch yang tertahan status NY Ready.
                </div>
              ) : (
                branchBottlenecks.map((item, idx) => (
                  <div
                    key={item.branch}
                    className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 border border-amber-200/60 text-xs"
                  >
                    <div className="truncate mr-2">
                      <div className="font-semibold text-slate-800 truncate">
                        {idx + 1}. {item.branch}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.area} &bull; {item.lopCount} LOP tertahan
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-amber-900 font-mono text-xs">
                        {formatNumber(item.portCount)}
                      </span>
                      <span className="text-[10px] text-amber-700 ml-1 font-medium">
                        Port
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Plan ETA Table by Regional and Area */}
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
          <div>
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-600" />
              <span>Tabel Rencana Kedatangan Material (Plan ETA)</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Distribusi jadwal estimasi kedatangan material (Port) per regional dan area operasional
            </CardDescription>
          </div>

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportEtaCsv}
              className="h-8 text-xs font-medium bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Unduh Plan ETA CSV</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="text-xs border-b border-slate-300">
                  <th className="py-2.5 px-3 text-left font-bold text-white bg-[#1e293b] border-r border-slate-700 min-w-[170px]">
                    Regional
                  </th>
                  {etaTableData.dates.map((d) => (
                    <th
                      key={d}
                      className="py-2.5 px-2 text-center font-bold text-white bg-[#b45309] border-r border-amber-800 min-w-[65px]"
                    >
                      {d}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right font-extrabold text-white bg-[#1e293b] min-w-[90px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {etaTableData.groups.map((grp) => (
                  <div key={grp.area} style={{ display: "contents" }}>
                    {grp.regionals.map((r) => (
                      <tr
                        key={r.regional}
                        className="border-b border-slate-200/80 hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-2 px-3 font-semibold text-slate-800 bg-white border-r border-slate-200 uppercase whitespace-nowrap">
                          {r.regional}
                        </td>
                        {etaTableData.dates.map((d) => {
                          const val = r.byDate[d] || 0;
                          return (
                            <td
                              key={d}
                              className={`py-1.5 px-2 text-center border-r border-slate-200 tabular-nums ${getEtaHeatmapClass(
                                val
                              )}`}
                            >
                              {val > 0 ? formatNumber(val) : ""}
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-right font-bold text-slate-900 bg-slate-50 border-slate-200 tabular-nums">
                          {formatNumber(r.total)}
                        </td>
                      </tr>
                    ))}

                    {/* Area Subtotal Row */}
                    <tr className="bg-slate-100/90 border-y-2 border-slate-300 font-bold text-slate-900">
                      <td className="py-2 px-3 font-extrabold text-slate-900 bg-slate-100 border-r border-slate-300 uppercase whitespace-nowrap">
                        {grp.area} Total
                      </td>
                      {etaTableData.dates.map((d) => {
                        const val = grp.subtotal.byDate[d] || 0;
                        return (
                          <td
                            key={d}
                            className="py-2 px-2 text-center font-extrabold text-slate-900 bg-slate-100 border-r border-slate-300 tabular-nums"
                          >
                            {val > 0 ? formatNumber(val) : ""}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-right font-black text-slate-950 bg-slate-200 border-slate-300 tabular-nums">
                        {formatNumber(grp.subtotal.total)}
                      </td>
                    </tr>
                  </div>
                ))}

                {/* Grand Total Row */}
                <tr className="bg-[#0f172a] text-white font-extrabold border-t-2 border-slate-950">
                  <td className="py-2.5 px-3 uppercase tracking-wider font-black text-white bg-[#0f172a] border-r border-slate-800 whitespace-nowrap">
                    TOTAL
                  </td>
                  {etaTableData.dates.map((d) => {
                    const val = etaTableData.grandTotal.byDate[d] || 0;
                    return (
                      <td
                        key={d}
                        className="py-2.5 px-2 text-center font-black text-white bg-[#0f172a] border-r border-slate-800 tabular-nums"
                      >
                        {val > 0 ? formatNumber(val) : ""}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-right font-black text-yellow-300 bg-[#0f172a] tabular-nums text-xs">
                    {formatNumber(etaTableData.grandTotal.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>


      {/* Operational Watchlist: Detail LOPs with NY Ready */}
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-2 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Daftar LOP Tertahan Material (Status: NY Ready)</span>
            </span>
            <span className="text-xs font-normal text-slate-500">
              Menampilkan {blockedLops.length} LOP
            </span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Daftar order proyek pada tahapan konstruksi aktif yang masih menunggu kesiapan pengadaan material
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[350px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-semibold text-slate-700">
                <tr>
                  <th className="py-2 px-3 text-left">ID LOP</th>
                  <th className="py-2 px-3 text-left">Nama Proyek</th>
                  <th className="py-2 px-3 text-left">Branch</th>
                  <th className="py-2 px-3 text-left">Tahap Konstruksi</th>
                  <th className="py-2 px-3 text-left">Mitra</th>
                  <th className="py-2 px-3 text-right">Port Plan</th>
                  <th className="py-2 px-3 text-center">Status Material</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {blockedLops.map((r) => (
                  <tr key={r.ihldLopId} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-semibold text-blue-700">
                      {r.ihldLopId}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 max-w-xs truncate" title={r.namaProyek}>
                      {r.namaProyek}
                    </td>
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      {r.branch} ({r.area})
                    </td>
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      {r.statusKonstruksi}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                      {r.mitra || "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                      {formatNumber(r.portPlan)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-semibold text-[10px]">
                        NY Ready
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
