import { parseCsvData } from "@/lib/parse-csv";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-static";

export default async function Page() {
  const data = await parseCsvData();
  const records = data?.records || [];
  const filterOptions = data?.filterOptions || {
    prioFlag: [],
    pt: [],
    area: [],
    regional: [],
    branch: [],
    statusKonstruksi: [],
  };

  return <Dashboard initialData={records} initialFilterOptions={filterOptions} />;
}
