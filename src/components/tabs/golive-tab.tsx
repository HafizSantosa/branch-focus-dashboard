"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ComposedChart,
  Line,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LopRecord } from "@/types/lop";
import { formatNumber, formatPercent } from "@/lib/utils";
import { Rocket, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface GoLiveTabProps {
  data: LopRecord[];
}

export function GoLiveTab({ data }: GoLiveTabProps) {
  // 1. Go-Live Achievement Metrics & Radial Ring
  const ringMetrics = useMemo(() => {
    const total = data.length;
    const nonDrop = data.filter(
      (d) => !d.statusKonstruksi.startsWith("00.") && !d.statusKonstruksi.startsWith("0.")
    ).length;

    const goLiveKonstruksi = data.filter((d) => d.statusKonstruksi === "05. Go Live").length;
    const goLiveSystem = data.filter((d) => d.statusGL === "01. Golive").length;
    const nyGoLive = data.filter((d) => d.statusGL === "00. Ny Golive").length;
    const inPipeline = data.filter((d) =>
      ["01. Persiapan", "02. Matdel", "03. OGP Instalasi", "04. Finish Instalasi"].includes(
        d.statusKonstruksi
      )
    ).length;

    const pctNonDrop = nonDrop > 0 ? (goLiveKonstruksi / nonDrop) * 100 : 0;
    const pctTotal = total > 0 ? (goLiveKonstruksi / total) * 100 : 0;

    let ringColor = "#ef4444"; // red
    if (pctNonDrop >= 60) ringColor = "#10b981"; // emerald
    else if (pctNonDrop >= 30) ringColor = "#f59e0b"; // amber

    const chartData = [
      {
        name: "Go Live",
        value: pctNonDrop,
        fill: ringColor,
      },
    ];

    return {
      total,
      nonDrop,
      goLiveKonstruksi,
      goLiveSystem,
      nyGoLive,
      inPipeline,
      pctNonDrop,
      pctTotal,
      ringColor,
      chartData,
    };
  }, [data]);

  // 2. Go-Live by Area Data (Stacked Bar)
  const areaGoLiveData = useMemo(() => {
    const areas = ["AREA 1", "AREA 2", "AREA 3", "AREA 4"];
    return areas.map((area) => {
      const subset = data.filter((d) => d.area === area);
      const golive = subset.filter(
        (d) => d.statusKonstruksi === "05. Go Live" || d.statusGL === "01. Golive"
      ).length;
      const nyGolive = subset.filter((d) => d.statusGL === "00. Ny Golive").length;
      const drop = subset.filter(
        (d) => d.statusKonstruksi.startsWith("00.") || d.statusKonstruksi.startsWith("0.")
      ).length;
      const pipeline = subset.filter((d) =>
        ["01. Persiapan", "02. Matdel", "03. OGP Instalasi", "04. Finish Instalasi"].includes(
          d.statusKonstruksi
        )
      ).length;

      return {
        area,
        golive,
        nyGolive,
        pipeline,
        drop,
        total: subset.length,
      };
    });
  }, [data]);

  // 3. Plan vs Actual Timeline (Weekly Grouping)
  const timelineData = useMemo(() => {
    const weekBuckets: Record<string, { label: string; planCount: number; actualCount: number; order: number }> = {
      "W38": { label: "W38 (14-20 Sep)", planCount: 0, actualCount: 0, order: 1 },
      "W39": { label: "W39 (21-27 Sep)", planCount: 0, actualCount: 0, order: 2 },
      "W40": { label: "W40 (28 Sep - 4 Okt)", planCount: 0, actualCount: 0, order: 3 },
      "W41": { label: "W41 (05-11 Okt)", planCount: 0, actualCount: 0, order: 4 },
      "W42": { label: "W42 (12-18 Okt)", planCount: 0, actualCount: 0, order: 5 },
      "W43+": { label: "W43+ (Lanjutan)", planCount: 0, actualCount: 0, order: 6 },
    };


    for (const r of data) {
      if (!r.planGL) continue;
      const parts = r.planGL.split("-");
      if (parts.length !== 3) continue;

      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      const isGl = r.statusKonstruksi === "05. Go Live" || r.statusGL === "01. Golive";

      if (year === 2026) {
        if (month === 9) {
          if (day <= 20) {
            weekBuckets["W38"].planCount++;
            if (isGl) weekBuckets["W38"].actualCount++;
          } else if (day <= 27) {
            weekBuckets["W39"].planCount++;
            if (isGl) weekBuckets["W39"].actualCount++;
          } else {
            weekBuckets["W40"].planCount++;
            if (isGl) weekBuckets["W40"].actualCount++;
          }
        } else if (month === 10) {
          if (day <= 4) {
            weekBuckets["W40"].planCount++;
            if (isGl) weekBuckets["W40"].actualCount++;
          } else if (day <= 11) {
            weekBuckets["W41"].planCount++;
            if (isGl) weekBuckets["W41"].actualCount++;
          } else if (day <= 18) {
            weekBuckets["W42"].planCount++;
            if (isGl) weekBuckets["W42"].actualCount++;
          } else {
            weekBuckets["W43+"].planCount++;
            if (isGl) weekBuckets["W43+"].actualCount++;
          }
        } else if (month > 10) {
          weekBuckets["W43+"].planCount++;
          if (isGl) weekBuckets["W43+"].actualCount++;
        }
      }
    }

    return Object.values(weekBuckets).sort((a, b) => a.order - b.order);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Top Row: Achievement Ring & Area Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Go-Live Achievement Ring */}
        <Card className="glass-card lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800">
              Pencapaian Go-Live
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Rasio LOP Go Live terhadap pipeline aktif (non-drop)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[220px] w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="90%"
                  barSize={18}
                  data={ringMetrics.chartData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar
                    background={{ fill: "#e2e8f0" }}
                    dataKey="value"
                    cornerRadius={10}
                    isAnimationActive={false}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-extrabold text-slate-800 tabular-nums">
                  {formatPercent(ringMetrics.pctNonDrop)}
                </span>
                <span className="text-xs text-slate-500 font-medium">dari Pipeline Aktif</span>
              </div>
            </div>

            {/* Quick Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
              <div className="p-2 rounded-lg bg-emerald-50/80 border border-emerald-100">
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Go Live (Konstruksi)</span>
                </div>
                <div className="text-base font-bold text-emerald-900 mt-0.5">
                  {formatNumber(ringMetrics.goLiveKonstruksi)} LOP
                </div>
                <div className="text-[10px] text-emerald-600">
                  {formatPercent(ringMetrics.pctTotal)} dari total LOP
                </div>
              </div>

              <div className="p-2 rounded-lg bg-teal-50/80 border border-teal-100">
                <div className="flex items-center gap-1.5 text-teal-700 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Status GL Sistem</span>
                </div>
                <div className="text-base font-bold text-teal-900 mt-0.5">
                  {formatNumber(ringMetrics.goLiveSystem)} LOP
                </div>
                <div className="text-[10px] text-teal-600">Terverifikasi &apos;01. Golive&apos;</div>
              </div>

              <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-100">
                <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-[11px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Not Yet Go-Live</span>
                </div>
                <div className="text-base font-bold text-amber-900 mt-0.5">
                  {formatNumber(ringMetrics.nyGoLive)} LOP
                </div>
                <div className="text-[10px] text-amber-600">Menunggu penyelesaian GL</div>
              </div>

              <div className="p-2 rounded-lg bg-blue-50/80 border border-blue-100">
                <div className="flex items-center gap-1.5 text-blue-700 font-semibold text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Pipeline Aktif</span>
                </div>
                <div className="text-base font-bold text-blue-900 mt-0.5">
                  {formatNumber(ringMetrics.inPipeline)} LOP
                </div>
                <div className="text-[10px] text-blue-600">Tahap 01-04 Konstruksi</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Go-Live by Area (Stacked Bar) */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span>Status Go-Live per Area</span>
              <span className="text-xs font-normal text-slate-500">Distribusi Komparatif</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Perbandingan LOP Go Live, NY Go Live, Pipeline Aktif, dan Drop di Area 1 - 4
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={areaGoLiveData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="area" tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = areaGoLiveData.find((a) => a.area === label);
                        const total = item?.total || 1;
                        return (
                          <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[200px]">
                            <p className="font-bold text-slate-100 mb-2 border-b border-slate-700 pb-1">
                              {label} (Total: {formatNumber(total)} LOP)
                            </p>
                            <div className="space-y-1">
                              {payload.map((p, i) => (
                                <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
                                  <span className="flex items-center gap-1.5 text-slate-300">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                    {p.name}:
                                  </span>
                                  <span className="font-semibold text-white">
                                    {formatNumber(Number(p.value))} ({formatPercent((Number(p.value) / total) * 100)})
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
                  <Bar dataKey="golive" name="Go Live" stackId="gl" fill="#10b981" isAnimationActive={false} />
                  <Bar dataKey="nyGolive" name="00. Ny Golive" stackId="gl" fill="#f59e0b" isAnimationActive={false} />
                  <Bar dataKey="pipeline" name="Pipeline Aktif" stackId="gl" fill="#3b82f6" isAnimationActive={false} />
                  <Bar dataKey="drop" name="Drop" stackId="gl" fill="#f43f5e" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Plan vs Actual Timeline */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
            <span>Timeline Jadwal Plan GL vs Realisasi</span>
            <span className="text-xs font-normal text-slate-500">Agregasi per Pekan (Weekly)</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Distribusi target jadwal Plan GL pada LOP prioritas dan pencapaian Go Live
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#334155" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[180px]">
                          <p className="font-bold text-slate-100 mb-2 border-b border-slate-700 pb-1">
                            {label}
                          </p>
                          <div className="space-y-1">
                            {payload.map((p, i) => (
                              <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
                                <span className="text-slate-300">{p.name}:</span>
                                <span className="font-semibold text-white">
                                  {formatNumber(Number(p.value))} LOP
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
                  dataKey="planCount"
                  name="Target Plan GL (LOP)"
                  fill="#93c5fd"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="actualCount"
                  name="Realisasi Go Live (LOP)"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#10b981" }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
