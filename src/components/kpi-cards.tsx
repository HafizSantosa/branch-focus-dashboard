"use client";

import { useMemo } from "react";
import { Target, TrendingDown, ClipboardList, Truck, HardHat, Layers, Rocket } from "lucide-react";
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
    let goLivePort = 0;
    let goLiveLop = 0;

    for (const d of data) {
      const s = d.statusKonstruksi || "";
      if (
        s.startsWith("00.") ||
        s.startsWith("0.") ||
        s.toLowerCase().includes("drop") ||
        s.toLowerCase().includes("kendala")
      ) {
        dropPort += d.portPlan;
        dropLop += 1;
      } else if (s === "01. Persiapan") {
        persiapanPort += d.portPlan;
        persiapanLop += 1;
      } else if (s === "02. Material Delivery" || s === "02. Matdel") {
        matdelPort += d.portPlan;
        matdelLop += 1;
      } else if (s === "03. OGP Instalasi") {
        ogpPort += d.portPlan;
        ogpLop += 1;
      } else if (s === "04. Finish Instalasi") {
        finishPort += d.portPlan;
        finishLop += 1;
      } else if (s === "05. Go Live") {
        goLivePort += d.portReal;
        goLiveLop += 1;
      }
    }

    return {
      totalLop,
      totalPortPlan,
      totalPortReal,
      realizationRate,
      dropPort,
      dropLop,
      dropPct: totalPortPlan > 0 ? (dropPort / totalPortPlan) * 100 : 0,
      persiapanPort,
      persiapanLop,
      persiapanPct: totalPortPlan > 0 ? (persiapanPort / totalPortPlan) * 100 : 0,
      matdelPort,
      matdelLop,
      matdelPct: totalPortPlan > 0 ? (matdelPort / totalPortPlan) * 100 : 0,
      ogpPort,
      ogpLop,
      ogpPct: totalPortPlan > 0 ? (ogpPort / totalPortPlan) * 100 : 0,
      finishPort,
      finishLop,
      finishPct: totalPortPlan > 0 ? (finishPort / totalPortPlan) * 100 : 0,
      goLivePort,
      goLiveLop,
      goLivePct: totalPortPlan > 0 ? (goLivePort / totalPortPlan) * 100 : 0,
    };
  }, [data]);

  const cards = [
    {
      title: "Port Plan",
      count: formatNumber(metrics.totalPortPlan),
      total: undefined,
      subtext: `${formatNumber(metrics.totalLop)} LOP`,
      icon: Target,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      accent: "from-blue-500/10 to-transparent",
    },
    {
      title: "Drop / Kendala",
      count: formatNumber(metrics.dropPort),
      total: formatNumber(metrics.totalPortPlan),
      subtext: `${formatPercent(metrics.dropPct)} (${formatNumber(metrics.dropLop)} LOP)`,
      icon: TrendingDown,
      color: "text-rose-600 bg-rose-50 border-rose-200",
      accent: "from-rose-500/10 to-transparent",
    },
    {
      title: "Persiapan",
      count: formatNumber(metrics.persiapanPort),
      total: formatNumber(metrics.totalPortPlan),
      subtext: `${formatPercent(metrics.persiapanPct)} (${formatNumber(metrics.persiapanLop)} LOP)`,
      icon: ClipboardList,
      color: "text-slate-600 bg-slate-100 border-slate-300",
      accent: "from-slate-500/10 to-transparent",
    },
    {
      title: "Material Delivery",
      count: formatNumber(metrics.matdelPort),
      total: formatNumber(metrics.totalPortPlan),
      subtext: `${formatPercent(metrics.matdelPct)} (${formatNumber(metrics.matdelLop)} LOP)`,
      icon: Truck,
      color: "text-cyan-600 bg-cyan-50 border-cyan-200",
      accent: "from-cyan-500/10 to-transparent",
    },
    {
      title: "OGP Instalasi",
      count: formatNumber(metrics.ogpPort),
      total: formatNumber(metrics.totalPortPlan),
      subtext: `${formatPercent(metrics.ogpPct)} (${formatNumber(metrics.ogpLop)} LOP)`,
      icon: HardHat,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      accent: "from-amber-500/10 to-transparent",
    },
    {
      title: "Finish Instalasi",
      count: formatNumber(metrics.finishPort),
      total: formatNumber(metrics.totalPortPlan),
      subtext: `${formatPercent(metrics.finishPct)} (${formatNumber(metrics.finishLop)} LOP)`,
      icon: Layers,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
      accent: "from-indigo-500/10 to-transparent",
    },
    {
      title: "Port Go Live",
      count: formatNumber(metrics.goLivePort),
      total: formatNumber(metrics.totalPortPlan),
      subtext: `${formatPercent(metrics.goLivePct)} (${formatNumber(metrics.goLiveLop)} LOP)`,
      icon: Rocket,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      accent: "from-emerald-500/10 to-transparent",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card key={i} className="glass-card relative overflow-hidden">
            <div
              className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${c.accent} rounded-bl-full pointer-events-none`}
            />
            <CardContent className="p-3 sm:p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate mr-1">
                  {c.title}
                </span>
                <div className={`p-1.5 rounded-lg border shrink-0 ${c.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1 text-lg sm:text-xl font-bold tracking-tight text-slate-800 tabular-nums">
                <span>{c.count}</span>
                {c.total && (
                  <span className="text-[11px] font-normal text-slate-400">
                    / {c.total}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate min-h-[1rem]" title={c.subtext}>
                {c.subtext}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
