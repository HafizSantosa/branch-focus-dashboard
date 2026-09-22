import { sheetSnapshotDb, type SheetSnapshot } from "@/lib/db";
import {
  getConfiguredSheetUrl,
  parseCsvData,
  validateGoogleSheetUrl,
} from "@/lib/parse-csv";

const DEFAULT_SYNC_INTERVAL_SECONDS = 5 * 60;
const MIN_SYNC_INTERVAL_SECONDS = 30;
const MAX_SYNC_INTERVAL_SECONDS = 24 * 60 * 60;

let activeSync: { sheetUrl: string; promise: Promise<SheetSnapshot> } | null = null;

function getSyncIntervalSeconds(): number {
  const configured = Number.parseInt(
    process.env.DATA_SYNC_INTERVAL_SECONDS ?? "",
    10
  );
  if (!Number.isFinite(configured)) return DEFAULT_SYNC_INTERVAL_SECONDS;
  return Math.min(
    MAX_SYNC_INTERVAL_SECONDS,
    Math.max(MIN_SYNC_INTERVAL_SECONDS, configured)
  );
}

export async function syncSheetSnapshot(
  rawUrl?: string,
  persistConfiguredSource = false
): Promise<SheetSnapshot> {
  const usesConfiguredSource = rawUrl === undefined;
  const sheetUrl = validateGoogleSheetUrl(rawUrl ?? getConfiguredSheetUrl());

  if (activeSync) {
    if (activeSync.sheetUrl === sheetUrl) {
      const snapshot = await activeSync.promise;
      if (persistConfiguredSource) sheetSnapshotDb.replace(snapshot, true);
      return snapshot;
    }
    try {
      await activeSync.promise;
    } catch {
      // A failed sync must not prevent a queued source change from running.
    }
    return syncSheetSnapshot(
      usesConfiguredSource ? undefined : sheetUrl,
      persistConfiguredSource
    );
  }

  const promise = (async () => {
    const data = await parseCsvData(sheetUrl);
    const snapshot: SheetSnapshot = {
      ...data,
      sheetUrl,
      syncedAt: Math.floor(Date.now() / 1000),
    };
    sheetSnapshotDb.replace(snapshot, persistConfiguredSource);
    return snapshot;
  })();
  activeSync = { sheetUrl, promise };

  try {
    return await promise;
  } finally {
    if (activeSync?.promise === promise) activeSync = null;
  }
}

export async function getSharedSheetSnapshot(): Promise<SheetSnapshot> {
  return sheetSnapshotDb.get() ?? syncSheetSnapshot();
}

export function startRoutineDataSync(): void {
  const runtime = globalThis as typeof globalThis & {
    __lopDataSyncTimer?: NodeJS.Timeout;
  };
  if (runtime.__lopDataSyncTimer) return;

  const run = () => {
    void syncSheetSnapshot().catch((error: unknown) => {
      console.error("[data-sync] Routine spreadsheet sync failed:", error);
    });
  };

  run();
  runtime.__lopDataSyncTimer = setInterval(
    run,
    getSyncIntervalSeconds() * 1_000
  );
  runtime.__lopDataSyncTimer.unref();
}
