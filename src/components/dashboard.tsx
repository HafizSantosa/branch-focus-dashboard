"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Menu,
  Search,
  X,
  BarChart3,
  Layers,
  Database,
  Compass,
  SlidersHorizontal,
  RefreshCw,
  Settings,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Table as TableIcon,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { LopRecord, FilterState, FilterOptions } from "@/types/lop";
import { Sidebar } from "@/components/sidebar";
import { KpiCards } from "@/components/kpi-cards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KonstruksiTab } from "@/components/tabs/konstruksi-tab";
import { GoLiveTab } from "@/components/tabs/golive-tab";
import { PortTab } from "@/components/tabs/port-tab";
import { DetailTab } from "@/components/tabs/detail-tab";
import { RekapTab } from "@/components/tabs/rekap-tab";
import { parseCsvString, normalizeGoogleSheetUrl } from "@/lib/parse-csv-pure";
import { formatNumber } from "@/lib/utils";

export const DEFAULT_GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1-gPTbg9lJpow7Ir5iU7OGNFQIHoZ0Mja5IuLpGpIW0g/edit?usp=sharing";

export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  prioFlag: [],
  pt: [],
  mitra: [],
  area: [],
  regional: [],
  branch: [],
  statusKonstruksi: [],
};

function getSheetMetadata(url: string) {
  if (!url) return null;
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = match ? match[1] : null;
  const gidMatch = url.match(/[?&#]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : null;
  return { sheetId, gid };
}

interface DashboardProps {
  initialData?: LopRecord[];
  initialFilterOptions?: FilterOptions;
}

export function Dashboard({ initialData, initialFilterOptions }: DashboardProps) {
  // Live Google Sheet Data State
  const [records, setRecords] = useState<LopRecord[]>(() =>
    Array.isArray(initialData) ? initialData : []
  );
  const [activeFilterOptions, setActiveFilterOptions] = useState<FilterOptions>(() => ({
    prioFlag: initialFilterOptions?.prioFlag || [],
    pt: initialFilterOptions?.pt || [],
    mitra: initialFilterOptions?.mitra || [],
    area: initialFilterOptions?.area || [],
    regional: initialFilterOptions?.regional || [],
    branch: initialFilterOptions?.branch || [],
    statusKonstruksi: initialFilterOptions?.statusKonstruksi || [],
  }));

  const [sheetUrl, setSheetUrl] = useState<string>(DEFAULT_GOOGLE_SHEET_URL);
  const [inputUrl, setInputUrl] = useState<string>(DEFAULT_GOOGLE_SHEET_URL);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Filter State
  const [filterState, setFilterState] = useState<FilterState>({
    prioFlag: [],
    pt: [],
    area: [],
    mitra: [],
    regional: [],
    branch: [],
    statusKonstruksi: [],
    branchFokus: true,
    search: "",
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore saved URL & cached data on client mount
  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem("lop_sheet_csv_url");
      if (savedUrl) {
        setSheetUrl(savedUrl);
        setInputUrl(savedUrl);
      }

      const savedTime = localStorage.getItem("lop_sheet_last_sync");
      if (savedTime) {
        setLastSyncTime(savedTime);
      }

      const cachedCsv = localStorage.getItem("lop_sheet_cached_csv");
      if (cachedCsv) {
        try {
          const parsed = parseCsvString(cachedCsv);
          if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
            setRecords(parsed.records);
            if (parsed.filterOptions) {
              setActiveFilterOptions({
                prioFlag: parsed.filterOptions.prioFlag || [],
                pt: parsed.filterOptions.pt || [],
                mitra: parsed.filterOptions.mitra || [],
                area: parsed.filterOptions.area || [],
                regional: parsed.filterOptions.regional || [],
                branch: parsed.filterOptions.branch || [],
                statusKonstruksi: parsed.filterOptions.statusKonstruksi || [],
              });
            }
          }
        } catch (e) {
          console.warn("Could not parse cached CSV, clearing cache", e);
          localStorage.removeItem("lop_sheet_cached_csv");
        }
      }
    } catch (e) {
      console.warn("Could not read from localStorage", e);
    }
  }, []);

  // Sync with Google Sheet
  const handleSync = useCallback(async (targetUrl?: string) => {
    const rawUrl = (targetUrl ?? sheetUrl).trim();
    if (!rawUrl) {
      setSyncError("Masukkan URL Google Sheets terlebih dahulu.");
      setIsSettingsOpen(true);
      return;
    }

    const urlToFetch = normalizeGoogleSheetUrl(rawUrl);

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      if (!urlToFetch.startsWith("http://") && !urlToFetch.startsWith("https://")) {
        throw new Error("URL harus diawali dengan https:// atau http://");
      }

      const res = await fetch(urlToFetch, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Gagal mengambil data: HTTP ${res.status} (${res.statusText || "Error koneksi"})`);
      }

      const csvText = await res.text();
      if (!csvText || csvText.trim().length === 0) {
        throw new Error("Konten spreadsheet yang diunduh kosong.");
      }

      const parsed = parseCsvString(csvText);
      if (!parsed || !Array.isArray(parsed.records) || parsed.records.length === 0) {
        throw new Error("Tidak ada data LOP yang berhasil diproses. Pastikan format kolom sesuai.");
      }

      // Update active state
      setRecords(parsed.records);
      setActiveFilterOptions({
        prioFlag: parsed.filterOptions?.prioFlag || [],
        pt: parsed.filterOptions?.pt || [],
        mitra: parsed.filterOptions?.mitra || [],
        area: parsed.filterOptions?.area || [],
        regional: parsed.filterOptions?.regional || [],
        branch: parsed.filterOptions?.branch || [],
        statusKonstruksi: parsed.filterOptions?.statusKonstruksi || [],
      });
      setSheetUrl(rawUrl);

      const nowStr = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLastSyncTime(nowStr);

      // Save to localStorage
      try {
        localStorage.setItem("lop_sheet_csv_url", rawUrl);
        localStorage.setItem("lop_sheet_last_sync", nowStr);
        localStorage.setItem("lop_sheet_cached_csv", csvText);
      } catch (storageErr) {
        console.warn("Storage quota exceeded, cache skipped", storageErr);
      }

      setSyncSuccess(`Berhasil sinkronisasi ${formatNumber(parsed.records.length)} data LOP dari Google Sheet!`);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal menghubungkan ke Google Sheets. Pastikan Spreadsheet dapat diakses publik atau melalui tautan bagikan.";
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  }, [sheetUrl]);

  // Cascaded Regionals
  const availableRegionals = useMemo(() => {
    const defaultList = activeFilterOptions?.regional || [];
    if (!filterState?.area || filterState.area.length === 0) return defaultList;
    const set = new Set<string>();
    for (const r of records || []) {
      if (r && r.area && filterState.area.includes(r.area) && r.regional) {
        set.add(r.regional);
      }
    }
    return Array.from(set).sort();
  }, [records, activeFilterOptions, filterState?.area]);

  // Cascaded Branches
  const availableBranches = useMemo(() => {
    const defaultList = activeFilterOptions?.branch || [];
    if (filterState?.regional && filterState.regional.length > 0) {
      const set = new Set<string>();
      for (const r of records || []) {
        if (r && r.regional && filterState.regional.includes(r.regional) && r.branch) {
          set.add(r.branch);
        }
      }
      return Array.from(set).sort();
    }
    if (filterState?.area && filterState.area.length > 0) {
      const set = new Set<string>();
      for (const r of records || []) {
        if (r && r.area && filterState.area.includes(r.area) && r.branch) {
          set.add(r.branch);
        }
      }
      return Array.from(set).sort();
    }
    return defaultList;
  }, [records, activeFilterOptions, filterState?.area, filterState?.regional]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return (records || []).filter((r) => {
      if (!r) return false;
      if (filterState?.branchFokus && !r.branchFokus) return false;
      if (filterState?.prioFlag && filterState.prioFlag.length > 0 && !filterState.prioFlag.includes(r.prioFlag))
        return false;
      if (filterState?.pt && filterState.pt.length > 0 && !filterState.pt.includes(r.pt)) return false;
      if (filterState?.mitra && filterState.mitra.length > 0 && !filterState.mitra.includes(r.mitra)) return false;
      if (filterState?.area && filterState.area.length > 0 && !filterState.area.includes(r.area)) return false;
      if (filterState?.regional && filterState.regional.length > 0 && !filterState.regional.includes(r.regional))
        return false;
      if (filterState?.branch && filterState.branch.length > 0 && !filterState.branch.includes(r.branch))
        return false;
      if (
        filterState?.statusKonstruksi &&
        filterState.statusKonstruksi.length > 0 &&
        !filterState.statusKonstruksi.includes(r.statusKonstruksi)
      )
        return false;

      if (filterState?.search?.trim()) {
        const q = filterState.search.toLowerCase();
        const matchId = (r.ihldLopId || "").toLowerCase().includes(q);
        const matchName = (r.namaProyek || "").toLowerCase().includes(q);
        const matchBranch = (r.branch || "").toLowerCase().includes(q);
        const matchReg = (r.regional || "").toLowerCase().includes(q);
        if (!matchId && !matchName && !matchBranch && !matchReg) return false;
      }

      return true;
    });
  }, [records, filterState]);

  const handleResetFilter = () => {
    setFilterState({
      prioFlag: [],
      pt: [],
      area: [],
      mitra: [],
      regional: [],
      branch: [],
      statusKonstruksi: [],
      branchFokus: true,
      search: "",
    });
  };

  const removeFilterItem = (key: keyof Omit<FilterState, "branchFokus" | "search">, val: string) => {
    setFilterState((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((item) => item !== val),
    }));
  };

  const activeChips = useMemo(() => {
    const chips: {
      label: string;
      key: keyof Omit<FilterState, "branchFokus" | "search">;
      val: string;
    }[] = [];
    (filterState?.prioFlag || []).forEach((v) => chips.push({ label: v, key: "prioFlag", val: v }));
    (filterState?.pt || []).forEach((v) => chips.push({ label: v, key: "pt", val: v }));
    (filterState?.mitra || []).forEach((v) => chips.push({ label: v, key: "mitra", val: v }));
    (filterState?.area || []).forEach((v) => chips.push({ label: v, key: "area", val: v }));
    (filterState?.regional || []).forEach((v) => chips.push({ label: v, key: "regional", val: v }));
    (filterState?.branch || []).forEach((v) => chips.push({ label: v, key: "branch", val: v }));
    (filterState?.statusKonstruksi || []).forEach((v) =>
      chips.push({ label: v, key: "statusKonstruksi", val: v })
    );
    return chips;
  }, [filterState]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:block h-full shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          isSidebarCollapsed ? "w-0 border-r-0" : "w-72"
        }`}
      >
        <div className="w-72 h-full">
          <Sidebar
            filterOptions={activeFilterOptions}
            filterState={filterState}
            onFilterChange={setFilterState}
            onResetFilter={handleResetFilter}
            availableRegionals={availableRegionals}
            availableBranches={availableBranches}
            totalCount={records.length}
            filteredCount={filteredData.length}
            onCollapse={() => setIsSidebarCollapsed(true)}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 px-6 bg-white/80 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Sidebar Toggle Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="hidden lg:flex h-9 w-9 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs"
              title={isSidebarCollapsed ? "Buka Sidebar Filter" : "Tutup Sidebar Filter"}
            >
              {isSidebarCollapsed ? (
                <PanelLeft className="w-4 h-4 text-slate-700" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-slate-700" />
              )}
            </Button>

            {/* Mobile Sheet Trigger */}
            <div className="lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Menu className="w-5 h-5 text-slate-700" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72 bg-slate-900 border-r-slate-800">
                  <Sidebar
                    filterOptions={activeFilterOptions}
                    filterState={filterState}
                    onFilterChange={setFilterState}
                    onResetFilter={handleResetFilter}
                    availableRegionals={availableRegionals}
                    availableBranches={availableBranches}
                    totalCount={records.length}
                    filteredCount={filteredData.length}
                  />
                </SheetContent>
              </Sheet>
            </div>

            <div>
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-sm sm:text-base lg:text-lg font-bold tracking-tight text-slate-800 whitespace-nowrap">
                  Fokus Prioritas 20 Branch
                </h1>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Monitoring Status Konstruksi, Status Go-Live, & Port Plan vs Realisasi
              </p>
            </div>
          </div>

          {/* Right Action Bar: Live Sync & Search */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Google Sheet Status Badge */}
            <div className="hidden md:flex items-center">
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px] font-medium py-1 px-2.5 flex items-center gap-1.5 shadow-2xs"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Google Sheet {lastSyncTime && `(${lastSyncTime})`}</span>
              </Badge>
            </div>

            {/* Sync Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync()}
              disabled={isSyncing}
              className="h-8 text-xs font-medium bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-xs flex items-center gap-1.5"
              title="Perbarui data langsung dari Google Sheet"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">
                {isSyncing ? "Menyinkronkan..." : "Sync Sheet"}
              </span>
            </Button>

            {/* Settings Dialog Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setInputUrl(sheetUrl);
                setSyncError(null);
                setSyncSuccess(null);
                setIsSettingsOpen(true);
              }}
              className="h-8 w-8 bg-white border-slate-300 text-slate-600 hover:text-slate-900"
              title="Pengaturan Google Spreadsheet"
            >
              <Settings className="w-4 h-4" />
            </Button>

            {/* Search Bar */}
            <div className="relative w-36 sm:w-60">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari LOP, Branch..."
                value={filterState.search}
                onChange={(e) => setFilterState((prev) => ({ ...prev, search: e.target.value }))}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {filterState.search && (
                <button
                  onClick={() => setFilterState((prev) => ({ ...prev, search: "" }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Dashboard Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Active Filter Chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-white/60 backdrop-blur border border-slate-200/60 rounded-xl shadow-xs">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-1">
                <SlidersHorizontal className="w-3 h-3" />
                Filter Aktif:
              </span>
              {activeChips.map((chip, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-normal pl-2 pr-1 py-0.5 flex items-center gap-1"
                >
                  <span>{chip.label}</span>
                  <button
                    onClick={() => removeFilterItem(chip.key, chip.val)}
                    className="hover:bg-slate-300 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilter}
                className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-800"
              >
                Hapus Semua
              </Button>
            </div>
          )}

          {/* KPI Summary Cards */}
          <KpiCards data={filteredData} />

          {/* Main Tabs Section */}
          <Tabs defaultValue="konstruksi" className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList className="bg-white/80 backdrop-blur border border-slate-200/80 p-1 shadow-xs rounded-xl h-auto flex-wrap">
                <TabsTrigger
                  value="konstruksi"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-3.5 py-1.5 text-xs font-medium flex items-center gap-2 transition-all"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Status Konstruksi</span>
                </TabsTrigger>

                <TabsTrigger
                  value="rekap"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-3.5 py-1.5 text-xs font-medium flex items-center gap-2 transition-all"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Tabel Rekapitulasi</span>
                </TabsTrigger>

                <TabsTrigger
                  value="golive"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-3.5 py-1.5 text-xs font-medium flex items-center gap-2 transition-all"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Status Go-Live</span>
                </TabsTrigger>

                <TabsTrigger
                  value="port"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-3.5 py-1.5 text-xs font-medium flex items-center gap-2 transition-all"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Port Plan vs Real</span>
                </TabsTrigger>

                <TabsTrigger
                  value="detail"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-3.5 py-1.5 text-xs font-medium flex items-center gap-2 transition-all"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Detail Data</span>
                </TabsTrigger>
              </TabsList>

              <div className="text-xs text-slate-500 hidden md:block">
                Menampilkan <strong className="text-slate-700">{filteredData.length}</strong> dari{" "}
                <strong className="text-slate-700">{records.length}</strong> LOP
              </div>
            </div>
            <TabsContent value="konstruksi" className="mt-0 focus-visible:outline-none">
              <KonstruksiTab data={filteredData} />
            </TabsContent>

            <TabsContent value="rekap" className="mt-0 focus-visible:outline-none">
              <RekapTab data={filteredData} />
            </TabsContent>
            <TabsContent value="golive" className="mt-0 focus-visible:outline-none">
              <GoLiveTab data={filteredData} />
            </TabsContent>

            <TabsContent value="port" className="mt-0 focus-visible:outline-none">
              <PortTab data={filteredData} />
            </TabsContent>

            <TabsContent value="detail" className="mt-0 focus-visible:outline-none">
              <DetailTab data={filteredData} />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Google Spreadsheet Sync Dialog Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <span>Sumber Data Google Spreadsheet</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Semua data dashboard diambil langsung dari Google Spreadsheet berikut.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            {/* Input URL */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                URL Google Spreadsheet / Tautan Berbagi:
              </label>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Detected Sheet & Tab Info */}
            {(() => {
              const meta = getSheetMetadata(inputUrl || sheetUrl);
              if (!meta || !meta.sheetId) return null;
              return (
                <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200/80 space-y-1.5 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-900 text-xs">Informasi Spreadsheet Terdeteksi:</span>
                    <a
                      href={inputUrl || sheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 hover:underline"
                    >
                      <span>Buka Sheet di Tab Baru</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-blue-200/60">
                    <div>
                      <span className="text-slate-500 block">Spreadsheet ID:</span>
                      <span className="font-mono text-slate-800 truncate block font-medium" title={meta.sheetId}>
                        {meta.sheetId}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tab / Sheet ID (gid):</span>
                      <span className="font-mono text-slate-800 font-semibold">
                        {meta.gid ? `gid: ${meta.gid}` : "Tab Pertama (Default)"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    Tip: Untuk memilih tab/sheet tertentu, klik tab tersebut di Google Sheets lalu salin URL yang memiliki <code className="bg-white px-1 py-0.5 rounded border border-blue-200">#gid=...</code>.
                  </p>
                </div>
              );
            })()}

            {/* Error Banner */}
            {syncError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">Gagal Melakukan Sinkronisasi:</span>
                  <p className="text-[11px] leading-relaxed">{syncError}</p>
                </div>
              </div>
            )}

            {/* Success Banner */}
            {syncSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{syncSuccess}</span>
              </div>
            )}

            {/* Instructions Guide */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-slate-600">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Petunjuk Sinkronisasi:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed pl-1">
                <li>Anda dapat menggunakan tautan berbagi biasa (misal: <em>.../edit?usp=sharing</em>) atau tautan publikasi CSV.</li>
                <li>Pastikan akses spreadsheet minimal <strong>Siapa saja yang memiliki tautan (Anyone with the link)</strong> dapat melihat (Viewer).</li>
                <li>Setiap kali data di Spreadsheet diubah, klik tombol <strong>Sync Sheet</strong> di pojok kanan atas untuk memperbarui dashboard secara langsung.</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(false)}
              className="text-xs h-8"
            >
              Tutup
            </Button>
            <Button
              size="sm"
              disabled={isSyncing || !inputUrl.trim()}
              onClick={() => handleSync(inputUrl)}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Menyinkronkan..." : "Simpan & Sinkronkan"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
