export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRoutineDataSync } = await import("@/lib/data-sync");
    startRoutineDataSync();
  }
}
