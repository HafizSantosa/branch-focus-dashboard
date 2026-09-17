"use client";

import { useMemo } from "react";
import { FileText, Target, CheckCircle2, Rocket, Activity, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LopRecord } from "@/types/lop";
import { formatNumber, formatPercent, sumBy } from "@/lib/utils";

interface KpiCardsProps {
  data: LopRecord[];
}

export function KpiCards({ data }: KpiCardsProps) {
  const metrics = useMemo(() => {
    const totalLop = data.length;
    const totalPortPlan = sumBy(data, (d) => d.portPlan);
    const totalPortReal = sumBy(data, (d) => d.portReal);
    const realizationRate = totalPortPlan > 0 ? (totalPortReal / totalPortPlan) * 100 : 0;

    const goLiveCount = data.filter((d) => d.statusKonstruksi === "05. Go Live").length;
    const goLiveRate = totalLop > 0 ? (goLiveCount / totalLop) * 100 : 0;

    const activeStages = ["01. Persiapan", "02. Material Delivery", "02. Matdel", "03. OGP Instalasi", "04. Finish Instalasi"];
    const activeCount = data.filter((d) => activeStages.includes(d.statusKonstruksi)).length;
    const activeRate = totalLop > 0 ? (activeCount / totalLop) * 100 : 0;

    const dropCount = data.filter(
      (d) => d.statusKonstruksi.startsWith("00.") || d.statusKonstruksi.startsWith("0.")
    ).length;
    const dropRate = totalLop > 0 ? (dropCount / totalLop) * 100 : 0;

    return {
      totalLop,
      totalPortPlan,
      totalPortReal,
      realizationRate,
      goLiveCount,
      goLiveRate,
      activeCount,
      activeRate,
      dropCount,
      dropRate,
    };
  }, [data]);

  const cards = [
    {
      title: "Total LOP",
      count: formatNumber(metrics.totalLop),
      total: undefined,
      subtext: "",
      icon: FileText,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      accent: "from-blue-500/10 to-transparent",
    },
    {
      title: "Port Plan",
      count: formatNumber(metrics.totalPortPlan),
      total: undefined,
      subtext: "",
      icon: Target,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
      accent: "from-indigo-500/10 to-transparent",
    },
    {
      title: "Port Go Live",
      count: formatNumber(metrics.totalPortReal),
      total: formatNumber(metrics.totalPortPlan),
      subtext: `${formatPercent(metrics.realizationRate)} port go live`,
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      accent: "from-emerald-500/10 to-transparent",
    },
    {
      title: "Go Live",
      count: formatNumber(metrics.goLiveCount),
      total: formatNumber(metrics.totalLop),
      subtext: `${formatPercent(metrics.goLiveRate)} (05. Go Live)`,
      icon: Rocket,
      color: "text-teal-600 bg-teal-50 border-teal-200",
      accent: "from-teal-500/10 to-transparent",
    },
    {
      title: "Pipeline Aktif",
      count: formatNumber(metrics.activeCount),
      total: formatNumber(metrics.totalLop),
      subtext: `${formatPercent(metrics.activeRate)} dalam progres (01-04)`,
      icon: Activity,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      accent: "from-amber-500/10 to-transparent",
    },
    {
      title: "Drop LOP",
      count: formatNumber(metrics.dropCount),
      total: formatNumber(metrics.totalLop),
      subtext: `${formatPercent(metrics.dropRate)} Propose/Drop DBP`,
      icon: TrendingDown,
      color: "text-rose-600 bg-rose-50 border-rose-200",
      accent: "from-rose-500/10 to-transparent",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card key={i} className="glass-card relative overflow-hidden">
            <div
              className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${c.accent} rounded-bl-full pointer-events-none`}
            />
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate mr-1">
                  {c.title}
                </span>
                <div className={`p-1.5 rounded-lg border shrink-0 ${c.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1 text-xl font-bold tracking-tight text-slate-800 tabular-nums">
                <span>{c.count}</span>
                {c.total && (
                  <span className="text-xs font-normal text-slate-400">
                    / {c.total}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate min-h-[1rem]" title={c.subtext || undefined}>
                {c.subtext || "\u00A0"}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
