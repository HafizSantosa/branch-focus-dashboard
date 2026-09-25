import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { getSharedSheetSnapshot } from "@/lib/data-sync";
import { getCurrentUser } from "@/lib/server-auth";
import type { FilterOptions, LopRecord } from "@/types/lop";

export const dynamic = "force-dynamic";

const EMPTY_FILTER_OPTIONS: FilterOptions = {
  prioFlag: [],
  pt: [],
  mitra: [],
  area: [],
  regional: [],
  branch: [],
  statusKonstruksi: [],
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let sheetUrl = "";
  let syncedAt = 0;
  let initialData: LopRecord[] = [];
  let initialFilterOptions = EMPTY_FILTER_OPTIONS;
  let initialError: string | undefined;

  try {
    const snapshot = await getSharedSheetSnapshot();
    sheetUrl = snapshot.sheetUrl;
    syncedAt = snapshot.syncedAt;
    initialData = snapshot.records;
    initialFilterOptions = snapshot.filterOptions;
  } catch (error) {
    console.error("[dashboard] Initial spreadsheet load failed:", error);
    initialError =
      error instanceof Error
        ? error.message
        : "Gagal mengambil data spreadsheet.";
  }

  return (
    <Dashboard
      initialData={initialData}
      initialFilterOptions={initialFilterOptions}
      initialSheetUrl={sheetUrl}
      initialSyncedAt={syncedAt}
      initialError={initialError}
    />
  );
}
