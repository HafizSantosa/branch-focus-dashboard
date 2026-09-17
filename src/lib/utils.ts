import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const idNumberFormatter = new Intl.NumberFormat("id-ID");

export function formatNumber(value: number): string {
  return idNumberFormatter.format(isNaN(value) ? 0 : value);
}

export function formatPercent(value: number, decimals = 1): string {
  if (isNaN(value) || !isFinite(value)) return "0.0%";
  return `${value.toFixed(decimals)}%`;
}

export function getStatusBadgeVariant(status: string): string {
  const trimmed = status.trim();
  if (trimmed.startsWith("05.") || trimmed.toLowerCase().includes("golive") || trimmed === "Done") {
    return "bg-emerald-100 text-emerald-800 border-emerald-300";
  }
  if (trimmed.startsWith("00.") || trimmed.startsWith("0.") || trimmed.toLowerCase().includes("drop")) {
    return "bg-rose-100 text-rose-800 border-rose-300";
  }
  if (trimmed.startsWith("04.")) {
    return "bg-indigo-100 text-indigo-800 border-indigo-300";
  }
  if (trimmed.startsWith("03.")) {
    return "bg-amber-100 text-amber-800 border-amber-300";
  }
  if (trimmed.startsWith("02.")) {
    return "bg-blue-100 text-blue-800 border-blue-300";
  }
  if (trimmed.startsWith("01.")) {
    return "bg-slate-100 text-slate-800 border-slate-300";
  }
  return "bg-gray-100 text-gray-700 border-gray-300";
}

export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

export function sumBy<T>(arr: T[], fn: (item: T) => number): number {
  let total = 0;
  for (const item of arr) {
    const val = fn(item);
    if (!isNaN(val) && isFinite(val)) {
      total += val;
    }
  }
  return total;
}
