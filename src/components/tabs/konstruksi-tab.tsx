"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LopRecord } from "@/types/lop";
import { formatNumber, formatPercent } from "@/lib/utils";

interface KonstruksiTabProps {
  data: LopRecord[];
}

const STAGE_COLORS: Record<string, string> = {
  "01. Persiapan": "#94a3b8", // Slate 400
  "02. Material Delivery": "#64748b", // Slate 500
  "02. Matdel": "#64748b",
  "03. OGP Instalasi": "#f59e0b", // Amber 500
  "04. Finish Instalasi": "#3b82f6", // Blue 500
  "05. Go Live": "#10b981", // Emerald 500
  "Drop": "#f43f5e", // Rose 500
};

const PIE_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#64748b",
];

export function KonstruksiTab({ data }: KonstruksiTabProps) {
  const [unit, setUnit] = useState<"port" | "lop">("port");

  const isPort = unit === "port";
  const unitLabel = isPort ? "Port" : "LOP";

  // 1. Pipeline Stages Data with PT2 vs PT3 breakdown (excluding drops)
  const pipelineData = useMemo(() => {
    const stages = [
      "01. Persiapan",
      "02. Material Delivery",
      "03. OGP Instalasi",
      "04. Finish Instalasi",
      "05. Go Live",
    ];

    let grandSum = 0;

    const items = stages.map((stageName) => {
      let pt2 = 0;
      let pt3 = 0;
      for (const d of data) {
        if (d.statusKonstruksi === stageName) {
          if (isPort) {
            const val = stageName === "05. Go Live" ? (d.portReal || d.portPlan) : d.portPlan;
            if (d.pt === "PT2") pt2 += val;
            else if (d.pt === "PT3") pt3 += val;
          } else {
            if (d.pt === "PT2") pt2 += 1;
            else if (d.pt === "PT3") pt3 += 1;
          }
        }
      }
      const total = pt2 + pt3;
      grandSum += total;

      return {
        stage: stageName,
        pt2,
        pt3,
        total,
      };
    });

    return {
      items: items.map((item) => ({
        ...item,
        pct: grandSum > 0 ? (item.total / grandSum) * 100 : 0,
      })),
      grandSum,
    };
  }, [data, isPort]);

  // 2. Status by Area Data
  const areaData = useMemo(() => {
    const areas = ["AREA 1", "AREA 2", "AREA 3", "AREA 4"];
    return areas.map((area) => {
      const subset = data.filter((d) => d.area === area);

      const getVal = (condition: (d: LopRecord) => boolean, isGl = false) => {
        let sum = 0;
        for (const d of subset) {
          if (condition(d)) {
            if (isPort) {
              sum += isGl ? (d.portReal || d.portPlan) : d.portPlan;
            } else {
              sum += 1;
            }
          }
        }
        return sum;
      };

      const persiapan = getVal((d) => d.statusKonstruksi === "01. Persiapan");
      const matdel = getVal((d) => d.statusKonstruksi === "02. Material Delivery" || d.statusKonstruksi === "02. Matdel");
      const ogp = getVal((d) => d.statusKonstruksi === "03. OGP Instalasi");
      const finish = getVal((d) => d.statusKonstruksi === "04. Finish Instalasi");
      const golive = getVal((d) => d.statusKonstruksi === "05. Go Live", true);
      const drop = getVal(
        (d) => d.statusKonstruksi.startsWith("00.") || d.statusKonstruksi.startsWith("0.")
      );

      const total = persiapan + matdel + ogp + finish + golive + drop;

      return {
        area,
        persiapan,
        matdel,
        ogp,
        finish,
        golive,
        drop,
        total,
      };
    });
  }, [data, isPort]);

  // 3. Status by Branch (Top 20)
  const branchData = useMemo(() => {
    const branchMap = new Map<string, LopRecord[]>();
    for (const r of data) {
      if (!r.branch) continue;
      if (!branchMap.has(r.branch)) {
        branchMap.set(r.branch, []);
      }
      branchMap.get(r.branch)!.push(r);
    }

    const sortedBranches = Array.from(branchMap.entries())
      .map(([branch, rows]) => {
        const getVal = (condition: (d: LopRecord) => boolean, isGl = false) => {
          let sum = 0;
          for (const d of rows) {
            if (condition(d)) {
              if (isPort) {
                sum += isGl ? (d.portReal || d.portPlan) : d.portPlan;
              } else {
                sum += 1;
              }
            }
          }
          return sum;
        };

        const persiapan = getVal((d) => d.statusKonstruksi === "01. Persiapan");
        const matdel = getVal((d) => d.statusKonstruksi === "02. Material Delivery" || d.statusKonstruksi === "02. Matdel");
        const ogp = getVal((d) => d.statusKonstruksi === "03. OGP Instalasi");
        const finish = getVal((d) => d.statusKonstruksi === "04. Finish Instalasi");
        const golive = getVal((d) => d.statusKonstruksi === "05. Go Live", true);
        const drop = getVal(
          (d) => d.statusKonstruksi.startsWith("00.") || d.statusKonstruksi.startsWith("0.")
        );

        const total = persiapan + matdel + ogp + finish + golive + drop;

        return {
          branch,
          persiapan,
          matdel,
          ogp,
          finish,
          golive,
          drop,
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    return sortedBranches;
  }, [data, isPort]);

  // 4. Kendala Distribution (Donut)
  const kendalaData = useMemo(() => {
    const map = new Map<string, number>();
    let totalWithKendala = 0;
    for (const r of data) {
      const k = r.groupingKendala.trim();
      if (k) {
        const addVal = isPort ? r.portPlan : 1;
        map.set(k, (map.get(k) || 0) + addVal);
        totalWithKendala += addVal;
      }
    }

    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 7);
    const remainder = sorted.slice(7);
    const otherCount = remainder.reduce((sum, item) => sum + item[1], 0);

    const result = top.map(([name, value], i) => ({
      name,
      value,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));

    if (otherCount > 0) {
      result.push({
        name: "Kendala Lainnya",
        value: otherCount,
        color: "#94a3b8",
      });
    }

    return { items: result, total: totalWithKendala };
  }, [data, isPort]);

  return (
    <div className="space-y-4">
      {/* Unit Metric Toggle: Port vs LOP */}
      <div className="flex justify-end">
        <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Construction Pipeline Horizontal Stacked Bars */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span>Pipeline Tahapan Konstruksi (Non-Drop)</span>
              <span className="text-xs font-normal text-slate-500">
                {formatNumber(pipelineData.grandSum)} {unitLabel} Aktif & Go Live
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Distribusi volume {isPort ? "kapasitas port" : "LOP"} pada tiap tahapan pengerjaan (Split PT2 vs PT3)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={pipelineData.items}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    dataKey="stage"
                    type="category"
                    tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
                    width={115}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = pipelineData.items.find((s) => s.stage === label);
                        const total = item?.total || 1;
                        const pct = item?.pct || 0;
                        return (
                          <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[200px]">
                            <p className="font-bold text-slate-100 mb-2 border-b border-slate-700 pb-1 flex justify-between">
                              <span>{label}</span>
                              <span className="text-blue-300 font-semibold">{formatPercent(pct)}</span>
                            </p>
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between">
                                <span className="text-blue-400">PT2:</span>
                                <span className="font-semibold text-white">
                                  {formatNumber(item?.pt2 || 0)} {unitLabel}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-purple-400">PT3:</span>
                                <span className="font-semibold text-white">
                                  {formatNumber(item?.pt3 || 0)} {unitLabel}
                                </span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-slate-700 font-bold">
                                <span>Total:</span>
                                <span className="text-yellow-400">
                                  {formatNumber(total)} {unitLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 5 }} />
                  <Bar
                    dataKey="pt2"
                    name="PT2"
                    stackId="pipe"
                    fill="#3b82f6"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="pt3"
                    name="PT3"
                    stackId="pipe"
                    fill="#8b5cf6"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pipeline Stage Flow Step Cards */}
            <div className="grid grid-cols-5 gap-1.5 pt-3 border-t border-slate-100 text-center">
              {pipelineData.items.map((s, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[11px] font-bold text-slate-700 truncate mb-1">
                      {s.stage.replace(/^\d+\.\s*/, "")}
                    </div>
                    <div className="text-sm font-extrabold text-slate-800 tabular-nums">
                      {formatNumber(s.total)}
                    </div>
                    <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                      {formatPercent(s.pct)}
                    </div>
                  </div>

                  {/* Clean 2-column PT breakdown without any overflow */}
                  <div className="grid grid-cols-2 gap-1 pt-1.5 mt-2 border-t border-slate-200/70 text-center">
                    <div className="bg-blue-50/60 rounded py-0.5 px-0.5 border border-blue-100">
                      <span className="text-[8.5px] font-semibold text-blue-700 block uppercase">PT2</span>
                      <span className="text-[10px] font-bold text-slate-800 tabular-nums block truncate">
                        {formatNumber(s.pt2)}
                      </span>
                    </div>
                    <div className="bg-purple-50/60 rounded py-0.5 px-0.5 border border-purple-100">
                      <span className="text-[8.5px] font-semibold text-purple-700 block uppercase">PT3</span>
                      <span className="text-[10px] font-bold text-slate-800 tabular-nums block truncate">
                        {formatNumber(s.pt3)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 2. Status by Area (Stacked Bars) */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span>Komposisi Status per Area ({unitLabel})</span>
              <span className="text-xs font-normal text-slate-500">4 Area Operasional</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Distribusi tahapan konstruksi dan drop dalam satuan {isPort ? "port" : "LOP"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={areaData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    dataKey="area"
                    type="category"
                    tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
                    width={70}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = areaData.find((a) => a.area === label);
                        const total = item?.total || 1;
                        return (
                          <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[190px]">
                            <p className="font-bold text-slate-100 mb-2 border-b border-slate-700 pb-1">
                              {label} ({formatNumber(total)} {unitLabel})
                            </p>
                            <div className="space-y-1">
                              {payload.map((p, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between gap-3 text-[11px]"
                                >
                                  <span className="flex items-center gap-1.5 text-slate-300">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: p.color }}
                                    />
                                    {p.name}:
                                  </span>
                                  <span className="font-semibold text-white">
                                    {formatNumber(Number(p.value))} (
                                    {formatPercent((Number(p.value) / total) * 100)})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar
                    dataKey="persiapan"
                    name="01. Persiapan"
                    stackId="a"
                    fill={STAGE_COLORS["01. Persiapan"]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="matdel"
                    name="02. Material Delivery"
                    stackId="a"
                    fill={STAGE_COLORS["02. Material Delivery"]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="ogp"
                    name="03. OGP Instalasi"
                    stackId="a"
                    fill={STAGE_COLORS["03. OGP Instalasi"]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="finish"
                    name="04. Finish Instalasi"
                    stackId="a"
                    fill={STAGE_COLORS["04. Finish Instalasi"]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="golive"
                    name="05. Go Live"
                    stackId="a"
                    fill={STAGE_COLORS["05. Go Live"]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="drop"
                    name="Drop"
                    stackId="a"
                    fill={STAGE_COLORS["Drop"]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 3. Status by Branch (Top 20) */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span>Status Konstruksi Top 20 Branch ({unitLabel})</span>
              <span className="text-xs font-normal text-slate-500">Urutan Volume Terbesar</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Profil progres konstruksi dan drop di 20 branch dengan volume {unitLabel} tertinggi
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[420px] w-full overflow-y-auto">
              <ResponsiveContainer width="100%" height={560}>
                <BarChart
                  data={branchData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    dataKey="branch"
                    type="category"
                    tick={{ fontSize: 10, fill: "#334155" }}
                    width={120}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = branchData.find((b) => b.branch === label);
                        const total = item?.total || 1;
                        return (
                          <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[200px]">
                            <p className="font-bold text-slate-100 mb-2 border-b border-slate-700 pb-1">
                              {label} (Total: {formatNumber(total)} {unitLabel})
                            </p>
                            <div className="space-y-1">
                              {payload.map((p, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between gap-3 text-[11px]"
                                >
                                  <span className="flex items-center gap-1.5 text-slate-300">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: p.color }}
                                    />
                                    {p.name}:
                                  </span>
                                  <span className="font-semibold text-white">
                                    {formatNumber(Number(p.value))} (
                                    {formatPercent((Number(p.value) / total) * 100)})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar
                    dataKey="persiapan"
                    name="01. Persiapan"
                    stackId="b"
                    fill={STAGE_COLORS["01. Persiapan"]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="matdel"
                    name="02. Material Delivery"
                    stackId="b"
                    fill={STAGE_COLORS["02. Material Delivery"]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="ogp"
                    name="03. OGP Instalasi"
                    stackId="b"
                    fill={STAGE_COLORS["03. OGP Instalasi"]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="finish"
                    name="04. Finish Instalasi"
                    stackId="b"
                    fill={STAGE_COLORS["04. Finish Instalasi"]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="golive"
                    name="05. Go Live"
                    stackId="b"
                    fill={STAGE_COLORS["05. Go Live"]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="drop"
                    name="Drop"
                    stackId="b"
                    fill={STAGE_COLORS["Drop"]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 4. Kendala Distribution Donut Chart */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span>Distribusi Kendala ({unitLabel})</span>
              <span className="text-xs font-normal text-slate-500">
                {formatNumber(kendalaData.total)} {unitLabel} Terkendala
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Pengelompokan jenis kendala lapangan berdasarkan volume {unitLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[420px] w-full flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="h-[280px] w-full md:w-1/2 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          const pct =
                            kendalaData.total > 0 ? (d.value / kendalaData.total) * 100 : 0;
                          return (
                            <div className="bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-xl border border-slate-700 max-w-xs">
                              <p className="font-semibold text-slate-200">{d.name}</p>
                              <p className="text-blue-400 font-bold mt-1 text-sm">
                                {formatNumber(d.value)} {unitLabel} ({formatPercent(pct)})
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={kendalaData.items}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {kendalaData.items.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Donut Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-slate-800">
                    {formatNumber(kendalaData.total)}
                  </span>
                  <span className="text-[11px] text-slate-500">Total {unitLabel}</span>
                </div>
              </div>

              {/* Custom Legend List */}
              <div className="w-full md:w-1/2 space-y-2 max-h-[380px] overflow-y-auto pr-2">
                {kendalaData.items.map((item, idx) => {
                  const pct =
                    kendalaData.total > 0 ? (item.value / kendalaData.total) * 100 : 0;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50/80 border border-slate-100 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate mr-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-slate-700 truncate" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900">
                          {formatNumber(item.value)}
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1">
                          ({formatPercent(pct)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
