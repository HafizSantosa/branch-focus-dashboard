import { createHash } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import type { drive_v3 } from "googleapis";
import { settingsDb, type SheetSnapshot } from "@/lib/db";
import { syncSheetSnapshot } from "@/lib/data-sync";
import { buildDetailCsv } from "@/lib/detail-data";

const BACKUP_STATUS_KEY = "google_drive_backup_status";
const DEFAULT_BACKUP_TIME = "02:00";
const DEFAULT_TIME_ZONE = "Asia/Jakarta";
const RETRY_INTERVAL_SECONDS = 60 * 60;
const SCHEDULER_INTERVAL_MS = 60 * 1_000;

export interface DriveBackupConfig {
  enabled: boolean;
  configured: boolean;
  folderId: string;
  credentialsFile: string;
  dailyAt: string;
  timeZone: string;
}

export interface StoredDriveBackupStatus {
  outcome: "running" | "success" | "error";
  lastAttemptAt: number;
  lastSuccessAt?: number;
  lastSuccessDate?: string;
  fileId?: string;
  fileName?: string;
  webViewLink?: string;
  rowCount?: number;
  checksum?: string;
  error?: string;
}

export interface DriveBackupStatus extends StoredDriveBackupStatus {
  enabled: boolean;
  configured: boolean;
  dailyAt: string;
  timeZone: string;
  folderUrl?: string;
}

interface BackupDependencies {
  now?: Date;
  syncSnapshot?: () => Promise<SheetSnapshot>;
  drive?: drive_v3.Drive;
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
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

export function getManagedCredentialPath(): string {
  const dbPath =
    process.env.DB_PATH || path.join(process.cwd(), "data", "users.db");
  return path.join(
    path.dirname(dbPath),
    "secrets",
    "google-drive-service-account.json"
  );
}

export function getDriveBackupConfig(
  env: NodeJS.ProcessEnv = process.env
): DriveBackupConfig {
  const folderId = env.GOOGLE_DRIVE_BACKUP_FOLDER_ID?.trim() || "";
  const credentialsFile =
    env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    getManagedCredentialPath();
  const requestedTimeZone =
    env.GOOGLE_DRIVE_BACKUP_TIMEZONE?.trim() || DEFAULT_TIME_ZONE;
  const timeZone = isValidTimeZone(requestedTimeZone)
    ? requestedTimeZone
    : DEFAULT_TIME_ZONE;
  const enabled = env.GOOGLE_DRIVE_BACKUP_ENABLED === "true";

  return {
    enabled,
    configured:
      enabled && /^[A-Za-z0-9_-]+$/.test(folderId) && Boolean(credentialsFile),
    folderId,
    credentialsFile,
    dailyAt: normalizeDailyTime(env.GOOGLE_DRIVE_BACKUP_DAILY_AT),
    timeZone,
  };
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

export function shouldRunDriveBackup(
  now: Date,
  config: DriveBackupConfig,
  status?: StoredDriveBackupStatus
): boolean {
  if (!config.configured) return false;

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

function readStoredStatus(): StoredDriveBackupStatus | undefined {
  const raw = settingsDb.get(BACKUP_STATUS_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as StoredDriveBackupStatus;
  } catch {
    return undefined;
  }
}

function writeStoredStatus(status: StoredDriveBackupStatus): void {
  settingsDb.set(BACKUP_STATUS_KEY, JSON.stringify(status));
}

export function getDriveBackupStatus(): DriveBackupStatus {
  const config = getDriveBackupConfig();
  const stored = readStoredStatus();

  return {
    outcome: stored?.outcome ?? "error",
    lastAttemptAt: stored?.lastAttemptAt ?? 0,
    lastSuccessAt: stored?.lastSuccessAt,
    lastSuccessDate: stored?.lastSuccessDate,
    fileId: stored?.fileId,
    fileName: stored?.fileName,
    webViewLink: stored?.webViewLink,
    rowCount: stored?.rowCount,
    checksum: stored?.checksum,
    error: stored?.error,
    enabled: config.enabled,
    configured: config.configured,
    dailyAt: config.dailyAt,
    timeZone: config.timeZone,
    folderUrl: config.folderId
      ? `https://drive.google.com/drive/folders/${config.folderId}`
      : undefined,
  };
}

async function createDriveClient(
  config: DriveBackupConfig
): Promise<drive_v3.Drive> {
  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({
    keyFile: config.credentialsFile,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findExistingBackup(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string
): Promise<drive_v3.Schema$File | undefined> {
  const result = await drive.files.list({
    q: `'${escapeDriveQueryValue(folderId)}' in parents and name = '${escapeDriveQueryValue(fileName)}' and trashed = false`,
    fields: "files(id,name,webViewLink)",
    pageSize: 1,
    spaces: "drive",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  return result.data.files?.[0];
}

async function uploadBackup(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  backupDate: string,
  csv: string
): Promise<drive_v3.Schema$File> {
  const result = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "text/csv",
      appProperties: {
        source: "lop-priority-daily-backup",
        backupDate,
      },
    },
    media: {
      mimeType: "text/csv",
      body: Readable.from([csv]),
    },
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });
  return result.data;
}

let activeBackup: Promise<StoredDriveBackupStatus> | null = null;

export async function runDriveBackup(
  dependencies: BackupDependencies = {}
): Promise<StoredDriveBackupStatus> {
  if (activeBackup) return activeBackup;

  const operation = (async () => {
    const config = getDriveBackupConfig();
    if (!config.configured) {
      throw new Error(
        "Google Drive backup is disabled or missing folder/credential configuration."
      );
    }

    const now = dependencies.now ?? new Date();
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
      const snapshot = await (dependencies.syncSnapshot ?? syncSheetSnapshot)();
      const csv = buildDetailCsv(snapshot.records);
      const checksum = createHash("sha256").update(csv).digest("hex");
      const fileName = `LOP_Detail_Unfiltered_${local.date}.csv`;
      const drive = dependencies.drive ?? (await createDriveClient(config));
      const file =
        (await findExistingBackup(drive, config.folderId, fileName)) ??
        (await uploadBackup(
          drive,
          config.folderId,
          fileName,
          local.date,
          csv
        ));
      const status: StoredDriveBackupStatus = {
        outcome: "success",
        lastAttemptAt: nowSeconds,
        lastSuccessAt: nowSeconds,
        lastSuccessDate: local.date,
        fileId: file.id ?? undefined,
        fileName,
        webViewLink: file.webViewLink ?? undefined,
        rowCount: snapshot.records.length,
        checksum,
      };
      writeStoredStatus(status);
      console.info(
        `[drive-backup] Uploaded ${fileName} (${snapshot.records.length} rows).`
      );
      return status;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
      const status: StoredDriveBackupStatus = {
        ...previous,
        outcome: "error",
        lastAttemptAt: nowSeconds,
        error: message,
      };
      writeStoredStatus(status);
      console.error("[drive-backup] Daily CSV backup failed:", error);
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

export async function runDriveBackupIfDue(now = new Date()): Promise<boolean> {
  const config = getDriveBackupConfig();
  if (!shouldRunDriveBackup(now, config, readStoredStatus())) return false;
  await runDriveBackup({ now });
  return true;
}

export function startRoutineDriveBackup(): void {
  const config = getDriveBackupConfig();
  if (!config.enabled) return;
  if (!config.configured) {
    console.error(
      "[drive-backup] Backup is enabled but folder or credential configuration is invalid."
    );
    return;
  }

  const runtime = globalThis as typeof globalThis & {
    __lopDriveBackupTimer?: NodeJS.Timeout;
  };
  if (runtime.__lopDriveBackupTimer) return;

  const check = () => {
    void runDriveBackupIfDue().catch(() => {
      // runDriveBackup already persists and logs the failure.
    });
  };
  check();
  runtime.__lopDriveBackupTimer = setInterval(check, SCHEDULER_INTERVAL_MS);
  runtime.__lopDriveBackupTimer.unref();
}
