import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Calendar, RotateCcw, XCircle } from "lucide-react";
import { toProperCase } from "@/lib/proper-case";
import { cn } from "@/lib/utils";
import { getPipelineInfo } from "@/lib/pipeline-stage";
import { TrackStatusIconsFromState } from "@/components/track-status-icons";
import { queryKeys } from "@/lib/query-keys";
import type { WorkOrderEnriched, AppointmentsSummary } from "./types";

export function NeedsAttentionSection({ navigate }: { navigate: (path: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  const { data: workOrders } = useQuery<WorkOrderEnriched[]>({
    queryKey: queryKeys.workOrders,
  });

  const { data: appointmentsData } = useQuery<AppointmentsSummary>({
    queryKey: queryKeys.dashboardAppointmentsSummary,
    staleTime: 30000,
  });

  const returnedJobs = useMemo(() => {
    if (!workOrders) return [];
    const returned: { id: string; woId: string; woNumber: string; applicantName: string; returnedAt: string | null }[] = [];
    for (const wo of workOrders) {
      if (!wo.typingJobs) continue;
      for (const job of wo.typingJobs) {
        if (job.status === "Returned" || job.status === "Rejected") {
          returned.push({
            id: job.id,
            woId: wo.id,
            woNumber: wo.woNumber,
            applicantName: wo.applicantName,
            returnedAt: job.returnedAt || null,
          });
        }
      }
    }
    return returned.sort((a, b) => {
      const aTime = a.returnedAt ? new Date(a.returnedAt).getTime() : 0;
      const bTime = b.returnedAt ? new Date(b.returnedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [workOrders]);

  const stalledWorkOrders = useMemo(() => {
    if (!workOrders) return [];
    return workOrders.filter((wo) => {
      const pipeline = getPipelineInfo(wo.typingJobs, wo.appointments);
      return pipeline.overall === "needs_attention";
    });
  }, [workOrders]);

  const missedAppointments = useMemo(() => {
    if (!appointmentsData?.today) return [];
    const now = new Date();
    return appointmentsData.today.filter((apt) => {
      if (apt.status !== "Scheduled") return false;
      if (!apt.datetime) return false;
      return new Date(apt.datetime) < now;
    });
  }, [appointmentsData]);

  const totalItems = returnedJobs.length + stalledWorkOrders.length + missedAppointments.length;

  if (totalItems === 0) return null;

  return (
    <div
      className="premium-card border-red-200/60 dark:border-red-800/30 bg-gradient-to-r from-red-50/80 to-amber-50/40 dark:from-red-950/20 dark:to-amber-950/10 opacity-0 animate-fade-in"
      data-testid="section-needs-attention"
    >
      <button
        className="flex items-center justify-between gap-3 w-full p-4 text-left"
        onClick={() => setCollapsed(!collapsed)}
        data-testid="toggle-needs-attention"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Needs Attention</p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">
              {totalItems} item{totalItems !== 1 ? "s" : ""} require action
            </p>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-red-500 transition-transform duration-200", collapsed && "rotate-180")} />
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {returnedJobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white/60 dark:bg-black/10 cursor-pointer hover:bg-white/80 dark:hover:bg-black/20 transition-colors"
              onClick={() => navigate(`/typing-jobs/${job.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/typing-jobs/${job.id}`); }}
              data-testid={`needs-attention-returned-${job.id}`}
            >
              <RotateCcw className="h-4 w-4 text-red-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{job.woNumber}</span>
                  <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">RETURNED</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{toProperCase(job.applicantName)}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
            </div>
          ))}

          {stalledWorkOrders.map((wo) => {
            const pi = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
            return (
              <div
                key={wo.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/60 dark:bg-black/10 cursor-pointer hover:bg-white/80 dark:hover:bg-black/20 transition-colors"
                onClick={() => navigate(`/work-orders/${wo.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") navigate(`/work-orders/${wo.id}`); }}
                data-testid={`needs-attention-stalled-${wo.id}`}
              >
                <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{wo.woNumber}</span>
                    {pi.fourTrack && <TrackStatusIconsFromState tracks={pi.fourTrack} />}
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">STALLED</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{toProperCase(wo.applicantName)}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
              </div>
            );
          })}

          {missedAppointments.map((apt) => (
            <div
              key={apt.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white/60 dark:bg-black/10 cursor-pointer hover:bg-white/80 dark:hover:bg-black/20 transition-colors"
              onClick={() => navigate(`/work-orders/${apt.woId}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/work-orders/${apt.woId}`); }}
              data-testid={`needs-attention-missed-${apt.id}`}
            >
              <Calendar className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{apt.woNumber}</span>
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">OVERDUE</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{toProperCase(apt.applicantName)}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
