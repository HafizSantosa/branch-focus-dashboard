import { createHash } from "node:crypto";
import {
  mkdir,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { settingsDb, type SheetSnapshot } from "@/lib/db";
import { syncSheetSnapshot } from "@/lib/data-sync";
import { getLocalBackupDateTime } from "@/lib/drive-backup";
import { buildDetailCsv } from "@/lib/detail-data";


const LOCAL_BACKUP_STATUS_KEY = "local_backup_status";
const DEFAULT_BACKUP_TIME = "02:00";
const DEFAULT_TIME_ZONE = "Asia/Jakarta";
const DEFAULT_KEEP_DAYS = 30;
const RETRY_INTERVAL_SECONDS = 60 * 60;
const SCHEDULER_INTERVAL_MS = 60 * 1_000;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface LocalBackupConfig {
  enabled: boolean;
  backupDir: string;
  dailyAt: string;
  timeZone: string;
  keepDays: number;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format();
    return true;
  } catch {
    return false;
  }
}

function normalizeDailyTime(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_BACKUP_TIME;
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(candidate)
    ? candidate
    : DEFAULT_BACKUP_TIME;
}

export function getLocalBackupConfig(
  env: NodeJS.ProcessEnv = process.env
): LocalBackupConfig {
  const dbPath =
    env.DB_PATH || path.join(process.cwd(), "data", "users.db");
  const backupDir =
    env.LOCAL_BACKUP_DIR?.trim() ||
    path.join(path.dirname(dbPath), "backups");

  const requestedTz =
    env.LOCAL_BACKUP_TIMEZONE?.trim() ||
    env.GOOGLE_DRIVE_BACKUP_TIMEZONE?.trim() ||
    DEFAULT_TIME_ZONE;
  const timeZone = isValidTimeZone(requestedTz) ? requestedTz : DEFAULT_TIME_ZONE;

  const keepDays = Math.max(
    1,
    parseInt(env.LOCAL_BACKUP_KEEP_DAYS ?? "30", 10) || DEFAULT_KEEP_DAYS
  );

  return {
    enabled: env.LOCAL_BACKUP_ENABLED !== "false",
    backupDir,
    dailyAt: normalizeDailyTime(
      env.LOCAL_BACKUP_DAILY_AT ?? env.GOOGLE_DRIVE_BACKUP_DAILY_AT
    ),
    timeZone,
    keepDays,
  };
}

// ---------------------------------------------------------------------------
// Status persistence (same settings SQLite as Drive backup)
// ---------------------------------------------------------------------------

export interface StoredLocalBackupStatus {
  outcome: "running" | "success" | "error";
  lastAttemptAt: number;
  lastSuccessAt?: number;
  lastSuccessDate?: string;
  fileName?: string;
  rowCount?: number;
  checksum?: string;
  error?: string;
}

export interface LocalBackupStatus extends StoredLocalBackupStatus {
  enabled: boolean;
  dailyAt: string;
  timeZone: string;
  keepDays: number;
}

function readStoredStatus(): StoredLocalBackupStatus | undefined {
  const raw = settingsDb.get(LOCAL_BACKUP_STATUS_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as StoredLocalBackupStatus;
  } catch {
    return undefined;
  }
}

function writeStoredStatus(status: StoredLocalBackupStatus): void {
  settingsDb.set(LOCAL_BACKUP_STATUS_KEY, JSON.stringify(status));
}

export function getLocalBackupStatus(): LocalBackupStatus {
  const config = getLocalBackupConfig();
  const stored = readStoredStatus();
  return {
    outcome: stored?.outcome ?? "error",
    lastAttemptAt: stored?.lastAttemptAt ?? 0,
    lastSuccessAt: stored?.lastSuccessAt,
    lastSuccessDate: stored?.lastSuccessDate,
    fileName: stored?.fileName,
    rowCount: stored?.rowCount,
    checksum: stored?.checksum,
    error: stored?.error,
    enabled: config.enabled,
    dailyAt: config.dailyAt,
    timeZone: config.timeZone,
    keepDays: config.keepDays,
  };
}

// ---------------------------------------------------------------------------
// File listing
// ---------------------------------------------------------------------------

export interface LocalBackupFile {
  fileName: string;
  date: string;
  sizeBytes: number;
  modifiedAt: number;
}

export async function listLocalBackups(
  config: LocalBackupConfig = getLocalBackupConfig()
): Promise<LocalBackupFile[]> {
  let entries: string[];
  try {
    entries = await readdir(config.backupDir);
  } catch {
    return [];
  }
  const csvFiles = entries.filter(
    (f) => f.startsWith("LOP_Detail_Unfiltered_") && f.endsWith(".csv")
  );
  const results: LocalBackupFile[] = [];
  for (const fileName of csvFiles) {
    try {
      const info = await stat(path.join(config.backupDir, fileName));
      const dateMatch = /(\d{4}-\d{2}-\d{2})\.csv$/.exec(fileName);
      results.push({
        fileName,
        date: dateMatch?.[1] ?? "",
        sizeBytes: info.size,
        modifiedAt: Math.floor(info.mtimeMs / 1_000),
      });
    } catch {
      // skip unreadable entries
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

async function pruneOldBackups(config: LocalBackupConfig): Promise<void> {
  const files = await listLocalBackups(config);
  const toDelete = files.slice(config.keepDays);
  for (const f of toDelete) {
    await unlink(path.join(config.backupDir, f.fileName)).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Run backup
// ---------------------------------------------------------------------------

interface BackupDeps {
  now?: Date;
  syncSnapshot?: () => Promise<SheetSnapshot>;
}

let activeBackup: Promise<StoredLocalBackupStatus> | null = null;

export async function runLocalBackup(
  deps: BackupDeps = {}
): Promise<StoredLocalBackupStatus> {
  if (activeBackup) return activeBackup;

  const operation = (async () => {
    const config = getLocalBackupConfig();
    const now = deps.now ?? new Date();
    const nowSeconds = Math.floor(now.getTime() / 1_000);
    const local = getLocalBackupDateTime(now, config.timeZone);
    const previous = readStoredStatus();

    writeStoredStatus({
      ...previous,
      outcome: "running",
      lastAttemptAt: nowSeconds,
      error: undefined,
    });

    try {
      await mkdir(config.backupDir, { recursive: true });

      const snapshot = await (deps.syncSnapshot ?? syncSheetSnapshot)();
      const csv = buildDetailCsv(snapshot.records);
      const checksum = createHash("sha256").update(csv).digest("hex");
      const fileName = `LOP_Detail_Unfiltered_${local.date}.csv`;
      const filePath = path.join(config.backupDir, fileName);

      await writeFile(filePath, csv, "utf8");

      const status: StoredLocalBackupStatus = {
        outcome: "success",
        lastAttemptAt: nowSeconds,
        lastSuccessAt: nowSeconds,
        lastSuccessDate: local.date,
        fileName,
        rowCount: snapshot.records.length,
        checksum,
      };
      writeStoredStatus(status);

      await pruneOldBackups(config);

      console.info(
        `[local-backup] Saved ${fileName} (${snapshot.records.length} rows).`
      );
      return status;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
      const status: StoredLocalBackupStatus = {
        ...previous,
        outcome: "error",
        lastAttemptAt: nowSeconds,
        error: message,
      };
      writeStoredStatus(status);
      console.error("[local-backup] Daily CSV backup failed:", error);
      throw error;
    }
  })();

  activeBackup = operation;
  try {
    return await operation;
  } finally {
    activeBackup = null;
  }
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export function shouldRunLocalBackup(
  now: Date,
  config: LocalBackupConfig,
  status?: StoredLocalBackupStatus
): boolean {
  if (!config.enabled) return false;
  const local = getLocalBackupDateTime(now, config.timeZone);
  if (local.time < config.dailyAt) return false;
  if (status?.lastSuccessDate === local.date) return false;
  if (
    status?.lastAttemptAt &&
    Math.floor(now.getTime() / 1_000) - status.lastAttemptAt <
      RETRY_INTERVAL_SECONDS
  ) {
    return false;
  }
  return true;
}

export async function runLocalBackupIfDue(now = new Date()): Promise<boolean> {
  const config = getLocalBackupConfig();
  if (!shouldRunLocalBackup(now, config, readStoredStatus())) return false;
  await runLocalBackup({ now });
  return true;
}

export function startRoutineLocalBackup(): void {
  const config = getLocalBackupConfig();
  if (!config.enabled) return;

  const runtime = globalThis as typeof globalThis & {
    __lopLocalBackupTimer?: NodeJS.Timeout;
  };
  if (runtime.__lopLocalBackupTimer) return;

  const check = () => {
    void runLocalBackupIfDue().catch(() => {});
  };
  check();
  runtime.__lopLocalBackupTimer = setInterval(check, SCHEDULER_INTERVAL_MS);
  runtime.__lopLocalBackupTimer.unref();
}
