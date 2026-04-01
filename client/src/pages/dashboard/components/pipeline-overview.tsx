import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPipelineInfo, STAGE_CONFIG, PIPELINE_STEPS, type PipelineStage } from "@/lib/pipeline-stage";
import { queryKeys } from "@/lib/query-keys";
import type { WorkOrderEnriched } from "./types";

export function PipelineOverview({ navigate }: { navigate: (path: string) => void }) {
  const { data: workOrders } = useQuery<WorkOrderEnriched[]>({
    queryKey: queryKeys.workOrders,
  });

  const counts = useMemo(() => {
    const result: Record<string, number> = {
      new: 0, at_vendor: 0, ready_to_schedule: 0, scheduled: 0, complete: 0, needs_attention: 0,
    };
    if (!workOrders) return result;
    for (const wo of workOrders) {
      if (wo.status === "Cancelled") continue;
      const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
      result[pipeline.overall]++;
    }
    return result;
  }, [workOrders]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const activeStages = [...PIPELINE_STEPS, "needs_attention" as const].filter(s => counts[s] > 0);

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in" data-testid="pipeline-overview">
      <div className="flex items-center gap-2 mb-3">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground tracking-tight">Work Order Pipeline</span>
        <span className="text-xs text-muted-foreground ml-auto">{total} active</span>
      </div>

      <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3" data-testid="pipeline-bar">
        {PIPELINE_STEPS.map((stage) => {
          const count = counts[stage];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          const colors: Record<string, string> = {
            new: "bg-slate-400 dark:bg-slate-500",
            at_vendor: "bg-blue-500 dark:bg-blue-400",
            ready_to_schedule: "bg-amber-500 dark:bg-amber-400",
            scheduled: "bg-blue-500 dark:bg-blue-400",
            complete: "bg-emerald-500 dark:bg-emerald-400",
          };
          return (
            <button
              key={stage}
              className={cn("transition-all hover:opacity-80 cursor-pointer", colors[stage])}
              style={{ width: `${Math.max(pct, 4)}%` }}
              onClick={() => navigate(`/work-orders?pipeline=${stage}`)}
              title={`${STAGE_CONFIG[stage].label}: ${count}`}
              data-testid={`pipeline-segment-${stage}`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {activeStages.map((stage) => {
          const config = STAGE_CONFIG[stage as PipelineStage];
          const count = counts[stage];
          return (
            <button
              key={stage}
              className="flex items-center gap-1.5 text-xs hover:underline cursor-pointer transition-colors"
              onClick={() => navigate(`/work-orders?pipeline=${stage}`)}
              data-testid={`pipeline-label-${stage}`}
            >
              <span className={cn(
                "h-2 w-2 rounded-full",
                stage === "new" && "bg-slate-400",
                stage === "at_vendor" && "bg-blue-500",
                stage === "ready_to_schedule" && "bg-amber-500",
                stage === "scheduled" && "bg-blue-500",
                stage === "complete" && "bg-emerald-500",
                stage === "needs_attention" && "bg-red-500",
              )} />
              <span className="text-muted-foreground">{config.label}</span>
              <span className="font-semibold text-foreground tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
