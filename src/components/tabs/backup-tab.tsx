"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Database,
  Download,
  RefreshCw,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Loader2,
} from "lucide-react";

interface BackupFile {
  fileName: string;
  date: string;
  sizeBytes: number;
  modifiedAt: number;
}

interface BackupStatusResponse {
  enabled: boolean;
  outcome: "running" | "success" | "error";
  dailyAt: string;
  timeZone: string;
  keepDays: number;
  lastAttemptAt: number;
  lastSuccessAt?: number;
  lastSuccessDate?: string;
  fileName?: string;
  rowCount?: number;
  error?: string;
  alreadyExists?: boolean;
  files: BackupFile[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTs(unixSeconds: number, timeZone: string): string {
  return new Date(unixSeconds * 1_000).toLocaleString("id-ID", { timeZone });
}

async function fetchBackupStatus(): Promise<BackupStatusResponse> {
  const res = await fetch("/api/admin/backup/local", { cache: "no-store" });
  const payload = await res.json() as BackupStatusResponse | { error?: string };
  if (!res.ok) {
    throw new Error(
      "error" in payload && payload.error ? payload.error : "Gagal memuat status backup."
    );
  }
  return payload as BackupStatusResponse;
}

export function BackupTab() {
  const [status, setStatus] = useState<BackupStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const refresh = useCallback((signal?: AbortSignal) => {
    fetchBackupStatus()
      .then((s) => {
        if (signal?.aborted) return;
        setError(null);
        setStatus(s);
      })
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Gagal memuat status.");
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const handleRunNow = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setRunMessage(null);
    setRunError(null);
    try {
      const res = await fetch("/api/admin/backup/local", { method: "POST" });
      const payload = await res.json() as BackupStatusResponse | { error?: string };
      if (!res.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Backup gagal.");
      }
      const result = payload as BackupStatusResponse;
      if (result.alreadyExists) {
        setRunMessage(`already:Backup untuk tanggal ini sudah ada: ${result.fileName ?? result.lastSuccessDate ?? "hari ini"}.`);
      } else {
        setRunMessage(`Backup selesai: ${result.fileName ?? ""} (${result.rowCount ?? 0} baris).`);
      }
      refresh();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Backup gagal.");
    } finally {
      setIsRunning(false);
    }
  };

  if (!status) {
    return error ? (
      <div role="alert" className="flex flex-wrap items-center gap-2 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          Coba Lagi
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-2 p-4 text-slate-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Memuat data backup...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Backup CSV Harian — Penyimpanan Lokal VPS
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => refresh()}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Muat Ulang
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            disabled={isRunning}
            onClick={() => void handleRunNow()}
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlayCircle className="w-3.5 h-3.5" />
            )}
            {isRunning ? "Memproses..." : "Backup Sekarang"}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          Gagal memperbarui status: {error}. Daftar terakhir tetap tersedia.
        </p>
      )}

      {/* Schedule info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
          <p className="text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Jadwal
          </p>
          <p className="font-semibold text-slate-800">
            {status.dailyAt} {status.timeZone}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
          <p className="text-slate-500">Retensi</p>
          <p className="font-semibold text-slate-800">{status.keepDays} backup terakhir</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
          <p className="text-slate-500">Status terakhir</p>
          {status.lastSuccessAt ? (
            <p className="font-semibold text-emerald-700">
              {formatTs(status.lastSuccessAt, status.timeZone)}
            </p>
          ) : (
            <p className="text-slate-400 italic">Belum ada backup</p>
          )}
        </div>
      </div>

      {/* Last error */}
      {status.outcome === "error" && status.lastAttemptAt > 0 && status.error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Percobaan terakhir gagal: {status.error}</span>
        </div>
      )}

      {/* Run now feedback */}
      {runMessage && (
        runMessage.startsWith("already:") ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{runMessage.slice("already:".length)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{runMessage}</span>
          </div>
        )
      )}
      {runError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{runError}</span>
        </div>
      )}

      {/* File list */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">
            File Tersimpan ({status.files.length})
          </span>
        </div>
        {status.files.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">
            Belum ada file backup. Klik &ldquo;Backup Sekarang&rdquo; untuk membuat backup pertama.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {status.files.map((f) => (
              <div
                key={f.fileName}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-mono text-slate-800 truncate">
                    {f.fileName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatBytes(f.sizeBytes)} &middot;{" "}
                    {formatTs(f.modifiedAt, status.timeZone)}
                  </p>
                </div>
                <a
                  href={`/api/admin/backup/local/${encodeURIComponent(f.fileName)}`}
                  download={f.fileName}
                  className="ml-3 shrink-0 inline-flex items-center gap-1 h-7 px-2 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Unduh
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        File disimpan di volume Docker pada VPS. Tersedia hanya untuk administrator dan tidak dapat
        diakses publik. Backup lama dihapus otomatis setelah melewati batas retensi.
      </p>
    </div>
  );
}
