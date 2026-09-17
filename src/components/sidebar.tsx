"use client";

import { useMemo, useState } from "react";
import { Filter, RotateCcw, ChevronDown, ChevronLeft, Sparkles, Building2, MapPin, Layers, Flag, HardHat, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterState, FilterOptions } from "@/types/lop";
import { formatNumber } from "@/lib/utils";

interface SidebarProps {
  filterOptions: FilterOptions;
  filterState: FilterState;
  onFilterChange: (updater: (prev: FilterState) => FilterState) => void;
  onResetFilter: () => void;
  availableRegionals: string[];
  availableBranches: string[];
  totalCount: number;
  filteredCount: number;
  onCollapse?: () => void;
}
export function Sidebar({
  filterOptions,
  filterState,
  onFilterChange,
  onResetFilter,
  availableRegionals = [],
  availableBranches = [],
  totalCount = 0,
  filteredCount = 0,
  onCollapse,
}: SidebarProps) {
  const [branchSearch, setBranchSearch] = useState("");

  const toggleArrayFilter = (
    key: keyof Omit<FilterState, "branchFokus" | "search">,
    value: string
  ) => {
    onFilterChange((prev) => {
      const current = prev?.[key] || [];
      const exists = current.includes(value);
      const updated = exists ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const filteredBranchOptions = useMemo(() => {
    const list = availableBranches || [];
    if (!branchSearch.trim()) return list;
    const query = branchSearch.toLowerCase();
    return list.filter((b) => b.toLowerCase().includes(query));
  }, [availableBranches, branchSearch]);

  const hasActiveFilters = useMemo(() => {
    return (
      (filterState?.prioFlag?.length || 0) > 0 ||
      (filterState?.pt?.length || 0) > 0 ||
      (filterState?.mitra?.length || 0) > 0 ||
      (filterState?.area?.length || 0) > 0 ||
      (filterState?.regional?.length || 0) > 0 ||
      (filterState?.branch?.length || 0) > 0 ||
      (filterState?.statusKonstruksi?.length || 0) > 0 ||
      !filterState?.branchFokus ||
      Boolean(filterState?.search)
    );
  }, [filterState]);

  return (
    <aside className="w-72 bg-slate-900 text-slate-100 flex flex-col h-full border-r border-slate-800 select-none">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide">Filter Global</h2>
            <p className="text-xs text-slate-400">
              {formatNumber(filteredCount)} dari {formatNumber(totalCount)} LOP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilter}
              className="h-7 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          )}

          {onCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCollapse}
              className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800"
              title="Tutup Sidebar (Collapse)"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter Body with Scroll */}
      <ScrollArea className="flex-1 px-4 py-2">
        <div className="space-y-4 pb-6">
          {/* Branch Fokus Toggle */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Branch Fokus Only</span>
              </div>
              <p className="text-[11px] text-slate-400">Prioritas 20 Branch Fokus</p>
            </div>
            <Switch
              checked={filterState.branchFokus}
              onCheckedChange={(checked) =>
                onFilterChange((prev) => ({ ...prev, branchFokus: checked }))
              }
            />
          </div>

          <Separator className="bg-slate-800" />

          {/* 1. Program / Flag */}
          <details open className="group">
            <summary className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer list-none py-1 hover:text-white">
              <span className="flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-blue-400" />
                <span>Program Prioritas</span>
              </span>
              <div className="flex items-center gap-1.5">
                {filterState.prioFlag.length > 0 && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded-full">
                    {filterState.prioFlag.length}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 text-slate-400" />
              </div>
            </summary>
            <div className="mt-2 space-y-1.5 pl-2">
              {filterOptions.prioFlag.map((item) => {
                const checked = filterState.prioFlag.includes(item);
                return (
                  <label
                    key={item}
                    className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleArrayFilter("prioFlag", item)}
                      className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          </details>

          <Separator className="bg-slate-800" />

          {/* 2. Tipe PT */}
          <details open className="group">
            <summary className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer list-none py-1 hover:text-white">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Tipe PT</span>
              </span>
              <div className="flex items-center gap-1.5">
                {filterState.pt.length > 0 && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded-full">
                    {filterState.pt.length}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 text-slate-400" />
              </div>
            </summary>
            <div className="mt-2 space-y-1.5 pl-2">
              {filterOptions.pt.map((item) => {
                const checked = filterState.pt.includes(item);
                return (
                  <label
                    key={item}
                    className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleArrayFilter("pt", item)}
                      className="border-slate-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          </details>

          <Separator className="bg-slate-800" />

          {/* 3. Mitra Lapangan */}
          <details open className="group">
            <summary className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer list-none py-1 hover:text-white">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-teal-400" />
                <span>Mitra Lapangan</span>
              </span>
              <div className="flex items-center gap-1.5">
                {(filterState?.mitra?.length || 0) > 0 && (
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-1.5 py-0.2 rounded-full">
                    {filterState.mitra.length}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 text-slate-400" />
              </div>
            </summary>
            <div className="mt-2 space-y-1.5 pl-2">
              {(filterOptions?.mitra || []).map((item) => {
                const checked = (filterState?.mitra || []).includes(item);
                return (
                  <label
                    key={item}
                    className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleArrayFilter("mitra", item)}
                      className="border-slate-600 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          </details>

          <Separator className="bg-slate-800" />

          {/* 3. Area */}
          <details open className="group">
            <summary className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer list-none py-1 hover:text-white">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Area</span>
              </span>
              <div className="flex items-center gap-1.5">
                {filterState.area.length > 0 && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                    {filterState.area.length}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 text-slate-400" />
              </div>
            </summary>
            <div className="mt-2 space-y-1.5 pl-2">
              {filterOptions.area.map((item) => {
                const checked = filterState.area.includes(item);
                return (
                  <label
                    key={item}
                    className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleArrayFilter("area", item)}
                      className="border-slate-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          </details>

          <Separator className="bg-slate-800" />

          {/* 4. Regional (Cascaded) */}
          <details open className="group">
            <summary className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer list-none py-1 hover:text-white">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Regional</span>
              </span>
              <div className="flex items-center gap-1.5">
                {(filterState?.regional?.length || 0) > 0 && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full">
                    {filterState.regional.length}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 text-slate-400" />
              </div>
            </summary>
            <div className="mt-2 space-y-1.5 pl-2 max-h-40 overflow-y-auto">
              {(availableRegionals || []).map((item) => {
                const checked = (filterState?.regional || []).includes(item);
                return (
                  <label
                    key={item}
                    className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleArrayFilter("regional", item)}
                      className="border-slate-600 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                    />
                    <span className="truncate">{item}</span>
                  </label>
                );
              })}
            </div>
          </details>

          <Separator className="bg-slate-800" />

          {/* 5. Branch (Cascaded) */}
          <details open className="group">
            <summary className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer list-none py-1 hover:text-white">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Branch ({availableBranches.length})</span>
              </span>
              <div className="flex items-center gap-1.5">
                {filterState.branch.length > 0 && (
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded-full">
                    {filterState.branch.length}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 text-slate-400" />
              </div>
            </summary>

            <div className="mt-2 space-y-2 pl-2">
              <input
                type="text"
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                placeholder="Cari branch..."
                className="w-full text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {filteredBranchOptions.map((item) => {
                  const checked = filterState.branch.includes(item);
                  return (
                    <label
                      key={item}
                      className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleArrayFilter("branch", item)}
                        className="border-slate-600 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
                      />
                      <span className="truncate">{item}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </details>

          <Separator className="bg-slate-800" />

          {/* 6. Status Konstruksi */}
          <details open className="group">
            <summary className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer list-none py-1 hover:text-white">
              <span className="flex items-center gap-1.5">
                <HardHat className="w-3.5 h-3.5 text-orange-400" />
                <span>Status Konstruksi</span>
              </span>
              <div className="flex items-center gap-1.5">
                {filterState.statusKonstruksi.length > 0 && (
                  <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.2 rounded-full">
                    {filterState.statusKonstruksi.length}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 text-slate-400" />
              </div>
            </summary>
            <div className="mt-2 space-y-1.5 pl-2">
              {filterOptions.statusKonstruksi.map((item) => {
                const checked = filterState.statusKonstruksi.includes(item);
                return (
                  <label
                    key={item}
                    className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleArrayFilter("statusKonstruksi", item)}
                      className="border-slate-600 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                    />
                    <span className="truncate">{item}</span>
                  </label>
                );
              })}
            </div>
          </details>
        </div>
      </ScrollArea>
    </aside>
  );
}
