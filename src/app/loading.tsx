import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className="w-72 bg-slate-900 p-4 space-y-4 hidden lg:block shrink-0">
        <Skeleton className="h-8 w-3/4 bg-slate-800" />
        <Skeleton className="h-10 w-full bg-slate-800 rounded-xl" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-6 w-1/2 bg-slate-800" />
          <Skeleton className="h-4 w-full bg-slate-800" />
          <Skeleton className="h-4 w-5/6 bg-slate-800" />
          <Skeleton className="h-4 w-2/3 bg-slate-800" />
        </div>
        <div className="space-y-3 pt-4">
          <Skeleton className="h-6 w-1/2 bg-slate-800" />
          <Skeleton className="h-4 w-full bg-slate-800" />
          <Skeleton className="h-4 w-5/6 bg-slate-800" />
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-5 w-64 bg-slate-200" />
            <Skeleton className="h-3 w-48 bg-slate-100" />
          </div>
          <Skeleton className="h-9 w-60 bg-slate-100 rounded-lg" />
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* KPI Cards Skeleton (6 cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-16 bg-slate-200" />
                  <Skeleton className="h-7 w-7 rounded-lg bg-slate-100" />
                </div>
                <Skeleton className="h-7 w-20 bg-slate-200" />
                <Skeleton className="h-3 w-28 bg-slate-100" />
              </div>
            ))}
          </div>

          {/* Tabs List Skeleton */}
          <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-96 rounded-xl bg-slate-200" />
            <Skeleton className="h-4 w-32 bg-slate-100" />
          </div>

          {/* Tab Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[380px] rounded-2xl bg-white border border-slate-200/80 shadow-xs" />
            <Skeleton className="h-[380px] rounded-2xl bg-white border border-slate-200/80 shadow-xs" />
          </div>
        </div>
      </div>
    </div>
  );
}
