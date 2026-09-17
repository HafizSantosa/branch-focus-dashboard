"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { LopRecord } from "@/types/lop";
import { formatNumber, getStatusBadgeVariant } from "@/lib/utils";
import {
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Layers,
  Calendar,
  Search,
} from "lucide-react";

interface DetailTabProps {
  data: LopRecord[];
}

export function DetailTab({ data }: DetailTabProps) {
  const [sortField, setSortField] = useState<keyof LopRecord>("ihldLopId");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedRecord, setSelectedRecord] = useState<LopRecord | null>(null);
  const [tableSearch, setTableSearch] = useState("");

  // Table local filtering
  const tableFilteredData = useMemo(() => {
    if (!tableSearch.trim()) return data;
    const q = tableSearch.toLowerCase();
    return data.filter(
      (r) =>
        r.ihldLopId.toLowerCase().includes(q) ||
        r.namaProyek.toLowerCase().includes(q) ||
        r.branch.toLowerCase().includes(q) ||
        r.mitra.toLowerCase().includes(q) ||
        r.groupingKendala.toLowerCase().includes(q)
    );
  }, [data, tableSearch]);

  // Sorting
  const sortedData = useMemo(() => {
    return [...tableFilteredData].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (valA === null || valA === undefined) return sortDir === "asc" ? 1 : -1;
      if (valB === null || valB === undefined) return sortDir === "asc" ? -1 : 1;

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDir === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [tableFilteredData, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedData = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (field: keyof LopRecord) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // CSV Export with UTF-8 BOM
  const handleExportCsv = () => {
    if (data.length === 0) return;

    const headers = [
      "iHLD LoP ID",
      "Nama Proyek",
      "Area",
      "Regional",
      "Branch",
      "PT",
      "Mitra",
      "Prioritas Branch",
      "Cek WO",
      "Program Flag",
      "Status Konstruksi",
      "Status Material",
      "Status GD TA",
      "Status GL",
      "Plan GL",
      "Plan GL xl",
      "Port Plan",
      "Port Real",
      "Grouping Kendala",
      "Keterangan",
    ];

    const escapeCsv = (str: string | number | null | undefined) => {
      if (str === null || str === undefined) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const rows = data.map((r) => [
      escapeCsv(r.ihldLopId),
      escapeCsv(r.namaProyek),
      escapeCsv(r.area),
      escapeCsv(r.regional),
      escapeCsv(r.branch),
      escapeCsv(r.pt),
      escapeCsv(r.mitra),
      escapeCsv(r.prioritasPerBranch),
      escapeCsv(r.cekWo),
      escapeCsv(r.prioFlag),
      escapeCsv(r.statusKonstruksi),
      escapeCsv(r.statusMaterial),
      escapeCsv(r.statusGdTa),
      escapeCsv(r.statusGL),
      escapeCsv(r.planGL),
      escapeCsv(r.planGLxl),
      r.portPlan,
      r.portReal,
      escapeCsv(r.groupingKendala),
      escapeCsv(r.keterangan),
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LOP_Priority_Filtered_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIcon = (field: keyof LopRecord) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40 group-hover:opacity-100 transition-opacity inline" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 ml-1 text-blue-600 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 ml-1 text-blue-600 inline" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur border border-slate-200/80 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari dalam tabel..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setPage(0);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-slate-500">
            {formatNumber(sortedData.length)} baris
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-2">
            <span>Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-8 text-xs bg-white text-slate-700 hover:bg-slate-50 border-slate-300 font-medium flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Unduh CSV (Filtered)</span>
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <Card className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b border-slate-200">
              <TableRow className="hover:bg-transparent">
                <TableHead
                  onClick={() => handleSort("ihldLopId")}
                  className="cursor-pointer text-xs font-semibold text-slate-700 group w-[110px]"
                >
                  iHLD LoP ID {renderSortIcon("ihldLopId")}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("namaProyek")}
                  className="cursor-pointer text-xs font-semibold text-slate-700 group min-w-[220px]"
                >
                  Nama Proyek {renderSortIcon("namaProyek")}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("branch")}
                  className="cursor-pointer text-xs font-semibold text-slate-700 group"
                >
                  Branch {renderSortIcon("branch")}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("area")}
                  className="cursor-pointer text-xs font-semibold text-slate-700 group"
                >
                  Area {renderSortIcon("area")}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("pt")}
                  className="cursor-pointer text-xs font-semibold text-slate-700 group w-[60px]"
                >
                  PT {renderSortIcon("pt")}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("statusKonstruksi")}
                  className="cursor-pointer text-xs font-semibold text-slate-700 group min-w-[150px]"
                >
                  Status Konstruksi {renderSortIcon("statusKonstruksi")}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("statusGL")}
                  className="cursor-pointer text-xs font-semibold text-slate-700 group min-w-[130px]"
                >
                  Status GL {renderSortIcon("statusGL")}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("portPlan")}
                  className="cursor-pointer text-xs font-semibold text-slate-700 text-right group w-[90px]"
                >
                  Port Plan {renderSortIcon("portPlan")}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("portReal")}
                  className="cursor-pointer text-xs font-semibold text-slate-700 text-right group w-[90px]"
                >
                  Port Real {renderSortIcon("portReal")}
                </TableHead>
                <TableHead
                  onClick={() => handleSort("planGL")}
                  className="cursor-pointer text-xs font-semibold text-slate-700 group w-[100px]"
                >
                  Plan GL {renderSortIcon("planGL")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-slate-500 text-xs">
                    Tidak ada data yang sesuai dengan filter atau pencarian.
                  </TableCell>
                </TableRow>
              ) : (
                pagedData.map((row) => (
                  <TableRow
                    key={row.ihldLopId}
                    onClick={() => setSelectedRecord(row)}
                    className="cursor-pointer hover:bg-blue-50/50 transition-colors text-xs border-b border-slate-100"
                  >
                    <TableCell className="font-mono font-semibold text-blue-700">
                      {row.ihldLopId}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800 max-w-xs truncate" title={row.namaProyek}>
                      {row.namaProyek}
                    </TableCell>
                    <TableCell className="text-slate-700 whitespace-nowrap">
                      {row.branch}
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {row.area}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.pt === "PT3"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }
                      >
                        {row.pt}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeVariant(row.statusKonstruksi)}>
                        {row.statusKonstruksi}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.statusGL ? (
                        <Badge variant="outline" className={getStatusBadgeVariant(row.statusGL)}>
                          {row.statusGL}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-slate-700">
                      {formatNumber(row.portPlan)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-emerald-700">
                      {formatNumber(row.portReal)}
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap font-mono text-[11px]">
                      {row.planGL || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-3 border-t border-slate-200 bg-white/60 gap-3">
          <div className="text-xs text-slate-500">
            Menampilkan{" "}
            <strong>
              {sortedData.length === 0 ? 0 : currentPage * pageSize + 1} -{" "}
              {Math.min((currentPage + 1) * pageSize, sortedData.length)}
            </strong>{" "}
            dari <strong>{formatNumber(sortedData.length)}</strong> data
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(0)}
              disabled={currentPage === 0}
              title="Halaman Pertama"
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              title="Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="text-xs px-3 text-slate-600 font-medium">
              Hal {currentPage + 1} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              title="Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
              title="Halaman Terakhir"
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Record Detail Sheet Drawer */}
      <Sheet open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6 bg-white">
          {selectedRecord && (
            <div className="space-y-6">
              <SheetHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    ID {selectedRecord.ihldLopId}
                  </Badge>
                  <Badge variant="outline" className={selectedRecord.pt === "PT3" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}>
                    {selectedRecord.pt}
                  </Badge>
                  <Badge variant="outline" className={getStatusBadgeVariant(selectedRecord.statusKonstruksi)}>
                    {selectedRecord.statusKonstruksi}
                  </Badge>
                </div>
                <SheetTitle className="text-base font-bold text-slate-900 mt-2">
                  {selectedRecord.namaProyek}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500">
                  Detail informasi operasional proyek dan status lapangan
                </SheetDescription>
              </SheetHeader>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-1">Wilayah / Regional</span>
                  <div className="font-semibold text-slate-800">{selectedRecord.branch}</div>
                  <div className="text-slate-500">{selectedRecord.regional} ({selectedRecord.area})</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-1">Mitra Lapangan</span>
                  <div className="font-semibold text-slate-800">{selectedRecord.mitra || "-"}</div>
                  <div className="text-slate-500">Prioritas: {selectedRecord.prioritasPerBranch || "-"}</div>
                </div>

                <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                  <span className="text-blue-600 block mb-1">Port Plan</span>
                  <div className="text-lg font-bold text-blue-900">{formatNumber(selectedRecord.portPlan)}</div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <span className="text-emerald-600 block mb-1">Port Realisasi</span>
                  <div className="text-lg font-bold text-emerald-900">{formatNumber(selectedRecord.portReal)}</div>
                </div>
              </div>

              {/* Status Section */}
              <div className="space-y-3 text-xs">
                <h4 className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-500" />
                  Status Konstruksi & Material
                </h4>
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Status Material:</span>
                    <span className="font-medium text-slate-800">{selectedRecord.statusMaterial || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Status GD TA:</span>
                    <span className="font-medium text-slate-800">{selectedRecord.statusGdTa || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Status Go-Live:</span>
                    <span className="font-medium text-slate-800">{selectedRecord.statusGL || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Cek WO:</span>
                    <span className="font-medium text-slate-800">{selectedRecord.cekWo || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Program:</span>
                    <span className="font-medium text-slate-800">{selectedRecord.prioFlag || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Schedule Section */}
              <div className="space-y-3 text-xs">
                <h4 className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  Jadwal & Target Go-Live
                </h4>
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Target Plan GL:</span>
                    <span className="font-mono font-medium text-slate-800">{selectedRecord.planGL || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Plan GL xl:</span>
                    <span className="font-mono font-medium text-slate-800">{selectedRecord.planGLxl || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Kendala & Keterangan */}
              {(selectedRecord.groupingKendala || selectedRecord.keterangan) && (
                <div className="space-y-3 text-xs">
                  <h4 className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-500" />
                    Catatan & Kendala Lapangan
                  </h4>
                  <div className="space-y-2 bg-amber-50/40 p-3 rounded-lg border border-amber-200/60">
                    {selectedRecord.groupingKendala && (
                      <div>
                        <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block mb-1">
                          Grouping Kendala:
                        </span>
                        <p className="font-medium text-slate-800">{selectedRecord.groupingKendala}</p>
                      </div>
                    )}
                    {selectedRecord.keterangan && (
                      <div className="pt-2 border-t border-amber-200/50">
                        <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block mb-1">
                          Log Keterangan / Progress:
                        </span>
                        <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-[11px]">
                          {selectedRecord.keterangan}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
