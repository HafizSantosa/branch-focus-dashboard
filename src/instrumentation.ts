export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ startRoutineDataSync }, { startRoutineDriveBackup }] =
      await Promise.all([
        import("@/lib/data-sync"),
        import("@/lib/drive-backup"),
      ]);
    startRoutineDataSync();
    startRoutineDriveBackup();
  }
}
