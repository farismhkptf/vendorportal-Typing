import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BarChart3, Activity, AlertTriangle, ArrowRight, ChevronDown, ChevronRight, Hourglass,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/lib/query-keys";
import { ActivityTimeline, type ActivityItem } from "@/components/ui/activity-timeline";
import { toProperCase } from "@/lib/proper-case";
import { cn } from "@/lib/utils";
import type { WeeklyData, IdleDraftJob, WorkOrderEnriched } from "./types";

export function WeeklyOverviewChart({ data }: { data: WeeklyData[] }) {
  const formatted = data.map(d => ({
    ...d,
    label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }),
  }));

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in" data-testid="weekly-overview-chart">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground tracking-tight">Weekly Overview</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradWO" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradAppt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradTJ" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Area type="monotone" dataKey="workOrders" name="Work Orders" stroke="hsl(var(--primary))" fill="url(#gradWO)" strokeWidth={2} />
          <Area type="monotone" dataKey="appointments" name="Appointments" stroke="#0d9488" fill="url(#gradAppt)" strokeWidth={2} />
          <Area type="monotone" dataKey="typingJobs" name="Typing Jobs" stroke="#10b981" fill="url(#gradTJ)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Work Orders
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Appointments
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Typing Jobs
        </div>
      </div>
    </div>
  );
}

export function MyActivityPanel({ data, isLoading, photoMap }: { data?: ActivityItem[]; isLoading: boolean; photoMap?: Record<string, string> }) {
  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in" data-testid="my-activity-panel">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground tracking-tight">Activity Timeline</span>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-5 w-5" />}
          title="No recent activity"
          description="Your actions will appear here."
        />
      ) : (
        <ActivityTimeline activities={data.slice(0, 10)} photoMap={photoMap} />
      )}
    </div>
  );
}

export function IdleDraftJobsPanel({ navigate }: { navigate: (path: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  const { data: idleJobs, isLoading } = useQuery<IdleDraftJob[]>({
    queryKey: queryKeys.adminIdleDraftJobs,
    staleTime: 60000,
  });

  if (isLoading) return null;
  if (!idleJobs || idleJobs.length === 0) return null;

  return (
    <div
      className="premium-card border-amber-200/60 dark:border-amber-800/30 bg-gradient-to-r from-amber-50/80 to-yellow-50/40 dark:from-amber-950/20 dark:to-yellow-950/10 opacity-0 animate-fade-in"
      data-testid="section-idle-draft-jobs"
    >
      <button
        className="flex items-center justify-between gap-3 w-full p-4 text-left"
        onClick={() => setCollapsed(!collapsed)}
        data-testid="toggle-idle-draft-jobs"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <Hourglass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Idle Draft Typing Jobs</p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
              {idleJobs.length} job{idleJobs.length !== 1 ? "s" : ""} stuck in Draft for over 24 hours
            </p>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-amber-500 transition-transform duration-200", collapsed && "rotate-180")} />
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {idleJobs.slice(0, 8).map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white/60 dark:bg-black/10 cursor-pointer hover:bg-white/80 dark:hover:bg-black/20 transition-colors"
              onClick={() => navigate(`/work-orders/${job.woId}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/work-orders/${job.woId}`); }}
              data-testid={`idle-draft-job-${job.id}`}
            >
              <Hourglass className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{job.woNumber || "—"}</span>
                  {job.jobTypeName && (
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                      {job.jobTypeName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{job.applicantName ? toProperCase(job.applicantName) : "—"}</span>
                  {job.companyName && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="truncate max-w-[100px]">{toProperCase(job.companyName)}</span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0" data-testid={`idle-hours-${job.id}`}>
                {job.hoursIdle != null ? `${job.hoursIdle}h idle` : "—"}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
            </div>
          ))}
          {idleJobs.length > 8 && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              +{idleJobs.length - 8} more — <button className="underline" onClick={() => navigate("/typing-jobs")}>view all</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function DelayedWorkOrdersAlert({ navigate }: { navigate: (path: string) => void }) {
  const { data: workOrders } = useQuery<WorkOrderEnriched[]>({
    queryKey: queryKeys.workOrders,
  });

  const delayedCount = useMemo(() => {
    if (!workOrders) return 0;
    return workOrders.filter((wo) => wo.isDelayed && wo.status !== "Completed" && wo.status !== "Cancelled").length;
  }, [workOrders]);

  if (delayedCount === 0) return null;

  return (
    <div
      className="premium-card p-3 border-red-300/50 dark:border-red-800/30 bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 opacity-0 animate-fade-in animate-pulse"
      data-testid="alert-delayed-work-orders"
    >
      <div className="flex items-center gap-3">
        <div className="icon-container icon-container-sm !bg-red-100 dark:!bg-red-900/40 !text-red-600 dark:!text-red-400">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-red-700 dark:text-red-300">
            {delayedCount} Delayed Work Order{delayedCount !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80">
            Vendor has exceeded the time threshold for completion
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
          onClick={() => navigate("/work-orders")}
          data-testid="button-view-delayed"
        >
          View
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
