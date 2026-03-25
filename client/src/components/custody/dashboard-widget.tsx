import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustodySummary {
  withUs: number;
  withVendor: number;
  returnedThisMonth: number;
  overdue: number;
}

export function CustodyDashboardWidget() {
  const { data: summary, isLoading } = useQuery<CustodySummary>({
    queryKey: ["/api/custody/records/summary"],
    queryFn: async () => {
      const res = await fetch("/api/custody/records/summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <Link href="/custody-queue">
      <div
        className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow cursor-pointer group"
        data-testid="custody-dashboard-widget"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-foreground">Document Custody</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2.5" data-testid="widget-with-us">
              <p className="text-xs text-blue-600 dark:text-blue-400">With Us</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{summary.withUs}</p>
            </div>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-2.5" data-testid="widget-with-vendor">
              <p className="text-xs text-purple-600 dark:text-purple-400">With Vendor</p>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{summary.withVendor}</p>
            </div>
            {summary.overdue > 0 && (
              <div className="col-span-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-2.5 flex items-center gap-2" data-testid="widget-overdue">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  {summary.overdue} overdue {summary.overdue === 1 ? "record" : "records"}
                </p>
              </div>
            )}
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-2.5" data-testid="widget-returned">
              <p className="text-xs text-green-600 dark:text-green-400">Returned (month)</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">{summary.returnedThisMonth}</p>
            </div>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
