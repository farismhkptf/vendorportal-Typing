import { Link } from "wouter";
import {
  ArrowRight, ChevronRight, Activity, CheckCircle2, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTableRow } from "@/components/ui/data-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackStatusIconsFromState } from "@/components/track-status-icons";
import { getPipelineInfo } from "@/lib/pipeline-stage";
import { toProperCase } from "@/lib/proper-case";
import type { WorkOrderEnriched } from "./types";

interface PipelineBreakdown {
  atVendor: number;
  scheduled: number;
  readyToSchedule: number;
  needsAttention: number;
  complete: number;
}

interface PipelineBreakdownCardProps {
  breakdown: PipelineBreakdown;
  isLoading: boolean;
}

export function PipelineBreakdownCard({ breakdown, isLoading }: PipelineBreakdownCardProps) {
  if (isLoading) return null;

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-1">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground tracking-tight">Pipeline Status Breakdown</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/20" data-testid="pipeline-stat-needs-attention">
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{breakdown.needsAttention}</p>
          <p className="text-xs text-muted-foreground">Needs Attention</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20" data-testid="pipeline-stat-at-vendor">
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{breakdown.atVendor}</p>
          <p className="text-xs text-muted-foreground">At Vendor</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20" data-testid="pipeline-stat-scheduled">
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{breakdown.scheduled}</p>
          <p className="text-xs text-muted-foreground">Scheduled</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20" data-testid="pipeline-stat-ready">
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{breakdown.readyToSchedule}</p>
          <p className="text-xs text-muted-foreground">Ready to Schedule</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/20" data-testid="pipeline-stat-complete">
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{breakdown.complete}</p>
          <p className="text-xs text-muted-foreground">Complete</p>
        </div>
      </div>
    </div>
  );
}

interface AttentionListProps {
  workOrders: WorkOrderEnriched[];
  companyMap: Record<string, string>;
  isLoading: boolean;
}

export function AttentionList({ workOrders, companyMap, isLoading }: AttentionListProps) {
  return (
    <div className="lg:col-span-2 space-y-3 opacity-0 animate-fade-in animate-delay-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground tracking-tight">Needs Attention</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground tabular-nums">({workOrders.length})</span>
          )}
        </div>
        <Link href="/work-orders">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-view-all-work-orders">
            All WOs
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
      <div className="space-y-2">
        {isLoading ? (
          <>{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</>
        ) : workOrders.length > 0 ? (
          workOrders.slice(0, 6).map((wo, i) => {
            const hasReturned = wo.typingJobs.some(j => j.status === "Returned" || j.status === "Rejected");
            const pi = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
            return (
              <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                <div className="opacity-0 animate-fade-in" style={{ animationDelay: `${i * 50 + 200}ms` }}>
                  <DataTableRow>
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm" data-testid={`text-wo-number-${wo.id}`}>{wo.woNumber}</span>
                          {pi.fourTrack && <TrackStatusIconsFromState tracks={pi.fourTrack} />}
                          {hasReturned && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 rounded-full">Returned</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate" data-testid={`text-wo-applicant-${wo.id}`}>{toProperCase(wo.applicantName)}</span>
                          {companyMap[wo.companyId] && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="truncate max-w-[100px]">{toProperCase(companyMap[wo.companyId])}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </DataTableRow>
                </div>
              </Link>
            );
          })
        ) : (
          <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="All clear" description="No work orders need attention right now." compact />
        )}
      </div>
    </div>
  );
}
