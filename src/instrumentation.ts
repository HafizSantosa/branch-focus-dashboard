export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ startRoutineDataSync }, { startRoutineLocalBackup }] =
      await Promise.all([
        import("@/lib/data-sync"),
        import("@/lib/local-backup"),
      ]);
    startRoutineDataSync();
    startRoutineLocalBackup();
  }
}
