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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LopRecord } from "@/types/lop";
import { formatNumber, formatPercent } from "@/lib/utils";
import { TrendingUp, BarChart2 } from "lucide-react";

interface PortTabProps {
  data: LopRecord[];
}

export function PortTab({ data }: PortTabProps) {
  // 1. Port Realization by Area
  const areaPortData = useMemo(() => {
    const areas = ["AREA 1", "AREA 2", "AREA 3", "AREA 4"];
    return areas.map((area) => {
      const subset = data.filter((d) => d.area === area);
      const portPlan = subset.reduce((acc, curr) => acc + curr.portPlan, 0);
      const portReal = subset.reduce((acc, curr) => acc + curr.portReal, 0);
      const rate = portPlan > 0 ? (portReal / portPlan) * 100 : 0;

      return {
        area,
        portPlan,
        portReal,
        rate,
        count: subset.length,
      };
    });
  }, [data]);

  // 2. Port Realization by Branch (Top 20)
  const branchPortData = useMemo(() => {
    const branchMap = new Map<string, { plan: number; real: number; count: number }>();

    for (const r of data) {
      if (!r.branch) continue;
      if (!branchMap.has(r.branch)) {
        branchMap.set(r.branch, { plan: 0, real: 0, count: 0 });
      }
      const entry = branchMap.get(r.branch)!;
      entry.plan += r.portPlan;
      entry.real += r.portReal;
      entry.count += 1;
    }

    return Array.from(branchMap.entries())
      .map(([branch, val]) => {
        const rate = val.plan > 0 ? (val.real / val.plan) * 100 : 0;
        return {
          branch,
          portPlan: val.plan,
          portReal: val.real,
          rate,
          count: val.count,
        };
      })
      .sort((a, b) => b.portPlan - a.portPlan)
      .slice(0, 20);
  }, [data]);

  const totalPlan = areaPortData.reduce((acc, curr) => acc + curr.portPlan, 0);
  const totalReal = areaPortData.reduce((acc, curr) => acc + curr.portReal, 0);
  const overallRate = totalPlan > 0 ? (totalReal / totalPlan) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* 1. Port Realization by Area */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <span>Realisasi Port per Area (Plan vs Real)</span>
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Total Realisasi: {formatPercent(overallRate)}
            </span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Perbandingan total kapasitas Port Plan dengan Port Go Live fisik yang telah terpasang
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaPortData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="area" tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const item = areaPortData.find((a) => a.area === label);
                      return (
                        <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[200px]">
                          <p className="font-bold text-slate-100 mb-2 border-b border-slate-700 pb-1">
                            {label} ({item?.count} LOP)
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-blue-300">
                              <span>Port Plan:</span>
                              <span className="font-semibold">{formatNumber(item?.portPlan || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-emerald-300">
                              <span>Port Go Live:</span>
                              <span className="font-semibold">{formatNumber(item?.portReal || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-amber-300 pt-1 border-t border-slate-800">
                              <span>Tingkat Realisasi:</span>
                              <span className="font-bold">{formatPercent(item?.rate || 0)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="portPlan" name="Port Plan" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="portReal" name="Port Go Live" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Area Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100">
            {areaPortData.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700">{item.area}</span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                    {formatPercent(item.rate)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2 text-xs">
                  <span className="text-slate-500">Plan:</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{formatNumber(item.portPlan)}</span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-500">Go Live:</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">{formatNumber(item.portReal)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2. Port Realization by Branch (Top 20) */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Port Plan vs Realisasi Top 20 Branch</span>
            </span>
            <span className="text-xs font-normal text-slate-500">Urutan Berdasarkan Kapasitas Port Plan</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Komparasi target port dan realisasi fisik di 20 branch prioritas tertinggi
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[480px] w-full overflow-y-auto">
            <ResponsiveContainer width="100%" height={620}>
              <BarChart
                data={branchPortData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 30, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis dataKey="branch" type="category" tick={{ fontSize: 10, fill: "#334155" }} width={130} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const item = branchPortData.find((b) => b.branch === label);
                      return (
                        <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl border border-slate-700 min-w-[210px]">
                          <p className="font-bold text-slate-100 mb-2 border-b border-slate-700 pb-1">
                            {label} ({item?.count} LOP)
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-blue-300">
                              <span>Port Plan:</span>
                              <span className="font-semibold">{formatNumber(item?.portPlan || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-emerald-300">
                              <span>Port Go Live:</span>
                              <span className="font-semibold">{formatNumber(item?.portReal || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-amber-300 pt-1 border-t border-slate-800">
                              <span>Tingkat Realisasi:</span>
                              <span className="font-bold">{formatPercent(item?.rate || 0)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="portPlan" name="Port Plan" fill="#3b82f6" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                <Bar dataKey="portReal" name="Port Go Live" fill="#10b981" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
