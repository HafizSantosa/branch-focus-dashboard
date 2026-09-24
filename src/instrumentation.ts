export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ startRoutineDataSync }, { startRoutineDriveBackup }, { startRoutineLocalBackup }] =
      await Promise.all([
        import("@/lib/data-sync"),
        import("@/lib/drive-backup"),
        import("@/lib/local-backup"),
      ]);
    startRoutineDataSync();
    startRoutineDriveBackup();
    startRoutineLocalBackup();
  }
}
