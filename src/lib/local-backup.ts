import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { settingsDb, type SheetSnapshot } from "@/lib/db";
import { getSharedSheetSnapshot } from "@/lib/data-sync";
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

export function getLocalBackupDateTime(
  now: Date,
  timeZone: string
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function getLocalBackupConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env
): LocalBackupConfig {
  const dbPath =
    env.DB_PATH || path.join(process.cwd(), "data", "users.db");
  const backupDir =
    env.LOCAL_BACKUP_DIR?.trim() ||
    path.join(path.dirname(dbPath), "backups");

  const requestedTz = env.LOCAL_BACKUP_TIMEZONE?.trim() || DEFAULT_TIME_ZONE;
  const timeZone = isValidTimeZone(requestedTz) ? requestedTz : DEFAULT_TIME_ZONE;

  const keepDays = Math.max(
    1,
    parseInt(env.LOCAL_BACKUP_KEEP_DAYS ?? "30", 10) || DEFAULT_KEEP_DAYS
  );

  return {
    enabled: env.LOCAL_BACKUP_ENABLED !== "false",
    backupDir,
    dailyAt: normalizeDailyTime(env.LOCAL_BACKUP_DAILY_AT),
    timeZone,
    keepDays,
  };
}

// Status persistence

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
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const csvFiles = entries.filter((f) =>
    /^LOP_Detail_Unfiltered_\d{4}-\d{2}-\d{2}\.csv$/.test(f)
  );
  const results: LocalBackupFile[] = [];
  for (const fileName of csvFiles) {
    try {
      const info = await stat(path.join(config.backupDir, fileName));
      if (!info.isFile()) continue;
      results.push({
        fileName,
        date: fileName.slice("LOP_Detail_Unfiltered_".length, -".csv".length),
        sizeBytes: info.size,
        modifiedAt: Math.floor(info.mtimeMs / 1_000),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
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
    await unlink(path.join(config.backupDir, f.fileName)).catch(
      (error: NodeJS.ErrnoException) => {
        // ENOENT: already gone. EBUSY/EPERM: Windows file lock — skip silently.
        if (error.code !== "ENOENT" && error.code !== "EBUSY" && error.code !== "EPERM")
          throw error;
      }
    );
  }
}

async function statusForExistingFile(
  filePath: string,
  fileName: string,
  date: string,
  attemptedAt: number,
  previous?: StoredLocalBackupStatus
): Promise<StoredLocalBackupStatus | undefined> {
  let info;
  try {
    info = await stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  if (!info.isFile() || info.size === 0) {
    throw new Error(`Existing backup is not a valid file: ${fileName}`);
  }
  const content = await readFile(filePath, "utf8");
  const dataLines = content.split("\n").filter((l) => l.trim()).length - 1; // subtract header
  return {
    outcome: "success",
    lastAttemptAt: attemptedAt,
    lastSuccessAt:
      previous?.fileName === fileName && previous.lastSuccessAt
        ? previous.lastSuccessAt
        : Math.floor(info.mtimeMs / 1_000),
    lastSuccessDate: date,
    fileName,
    rowCount: previous?.fileName === fileName && previous.rowCount != null
      ? previous.rowCount
      : Math.max(0, dataLines),
    checksum: createHash("sha256").update(content).digest("hex"),
  };
}

// ---------------------------------------------------------------------------
// Run backup
// ---------------------------------------------------------------------------

async function publishBackup(filePath: string, csv: string): Promise<void> {
  const temporary = path.join(path.dirname(filePath), `.backup-${randomUUID()}.tmp`);
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(csv, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    // Try an atomic hard-link first; fall back to rename on filesystems that
    // do not support links (FAT32, exFAT, ReFS, network shares).
    try {
      await link(temporary, filePath);
    } catch (linkError) {
      if (
        (linkError as NodeJS.ErrnoException).code !== "EXDEV" &&
        (linkError as NodeJS.ErrnoException).code !== "ENOTSUP" &&
        (linkError as NodeJS.ErrnoException).code !== "EPERM"
      ) {
        throw linkError;
      }
      // Atomic rename works on same filesystem even without hard-link support.
      await rename(temporary, filePath);
      return; // tmp is gone — skip unlink in finally
    }
  } finally {
    // Tolerate Windows EBUSY/EPERM from antivirus/indexer holding the tmp handle.
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT" && error.code !== "EBUSY" && error.code !== "EPERM")
        throw error;
    });
  }
}

type LocalBackupResult = StoredLocalBackupStatus & { alreadyExists?: boolean };

interface BackupDeps {
  now?: Date;
  syncSnapshot?: () => Promise<SheetSnapshot>;
}

let activeBackup: Promise<LocalBackupResult> | null = null;

export async function runLocalBackup(
  deps: BackupDeps = {}
): Promise<LocalBackupResult> {
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
      const fileName = `LOP_Detail_Unfiltered_${local.date}.csv`;
      const filePath = path.join(config.backupDir, fileName);
      const existing = await statusForExistingFile(
        filePath, fileName, local.date, nowSeconds, previous
      );
      if (existing) {
        await pruneOldBackups(config).catch((e) => {
          console.warn("[local-backup] Pruning old backups failed (non-fatal):", e);
        });
        writeStoredStatus(existing);
        return { ...existing, alreadyExists: true };
      }

      const snapshot = await (deps.syncSnapshot ?? getSharedSheetSnapshot)();
      const csv = buildDetailCsv(snapshot.records);
      const checksum = createHash("sha256").update(csv).digest("hex");
      try {
        await publishBackup(filePath, csv);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const concurrent = await statusForExistingFile(
          filePath, fileName, local.date, nowSeconds, previous
        );
        if (!concurrent) throw error;
        await pruneOldBackups(config).catch((e) => {
          console.warn("[local-backup] Pruning old backups failed (non-fatal):", e);
        });
        writeStoredStatus(concurrent);
        return { ...concurrent, alreadyExists: true };
      }

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

      // Prune AFTER persisting success status so a prune failure does not
      // overwrite the success record in the catch block below.
      await pruneOldBackups(config).catch((pruneError) => {
        console.warn("[local-backup] Pruning old backups failed (non-fatal):", pruneError);
      });

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
  const previousScheduledDate = new Date(`${local.date}T00:00:00Z`);
  previousScheduledDate.setUTCDate(previousScheduledDate.getUTCDate() - 1);
  const scheduledDate = local.time >= config.dailyAt
    ? local.date : previousScheduledDate.toISOString().slice(0, 10);
  if (status?.lastSuccessDate && status.lastSuccessDate >= scheduledDate) return false;
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
