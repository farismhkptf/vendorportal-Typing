import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  FileText, 
  Calendar, 
  Wallet, 
  AlertTriangle, 
  Clock,
  Plus,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Send,
  Stethoscope,
  CreditCard,
  CalendarDays,
  Loader2,
  Timer,
  Mail,
  Package,
  BarChart3,
  Activity,
  RotateCcw,
  XCircle,
  Hourglass,
} from "lucide-react";
import { VendorGroupedJobsView, type VendorJobItem } from "@/components/vendor-grouped-jobs-view";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getGreeting } from "@/lib/greeting";
import { toProperCase } from "@/lib/proper-case";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { DashboardSwitcher } from "@/components/dashboard-switcher";
import { CustodyDashboardWidget } from "@/components/custody/dashboard-widget";
import { ActivityTimeline, type ActivityItem } from "@/components/ui/activity-timeline";
import { getPipelineInfo, STAGE_CONFIG, PIPELINE_STEPS, type PipelineStage } from "@/lib/pipeline-stage";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface DashboardStats {
  totalWorkOrders: number;
  todayAppointments: number;
  pendingTypingJobs: number;
  walletBalance: number;
  lowBalanceWarning: boolean;
}

interface TypingJobStatusSummary {
  id: string;
  status: string;
  jobType?: { category: string } | null;
  returnedAt?: string | null;
  [key: string]: unknown;
}

interface AppointmentSummary {
  id: string;
  woId: string;
  type: string;
  status: string;
  [key: string]: unknown;
}

interface WorkOrderEnriched {
  id: string;
  woNumber: string;
  applicantName: string;
  status: string;
  companyId: string;
  typingJobs: TypingJobStatusSummary[];
  appointments: AppointmentSummary[];
  [key: string]: unknown;
}

interface TypingJobItem {
  id: string;
  jobCode: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  vendorId: string | null;
  vendorName: string;
  vendorLogoUrl?: string | null;
  type: "Medical" | "EID";
  sentAt: string | null;
  hoursWaiting?: number;
  hoursElapsed?: number;
  urgent: boolean;
}

interface ReadyToScheduleJob {
  id: string;
  jobCode: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  type: "Medical" | "EID";
  completedAt: string;
}

interface ReturnedTypingJobItem {
  id: string;
  jobCode: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  vendorId: string | null;
  vendorName: string;
  vendorLogoUrl?: string | null;
  type: "Medical" | "EID";
  returnedAt: string | null;
  status: string;
  urgent: boolean;
}

interface TypingJobsSummary {
  unaccepted: TypingJobItem[];
  inProgress: TypingJobItem[];
  readyToSchedule: ReadyToScheduleJob[];
  returned: ReturnedTypingJobItem[];
  counts: { unaccepted: number; inProgress: number; readyToSchedule: number; returned: number };
}

interface AppointmentItem {
  id: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  type: "Medical" | "EID";
  time: string;
  datetime?: string;
  center: string;
  status: string;
  date?: string;
  daysFromNow?: number;
}

interface NeedsSchedulingItem {
  woId: string;
  woNumber: string;
  applicantName: string;
  companyName: string;
  types: string[];
}

interface AppointmentsSummary {
  today: AppointmentItem[];
  upcoming: AppointmentItem[];
  needsScheduling: NeedsSchedulingItem[];
  counts: { today: number; upcoming: number; needsScheduling: number };
}

interface WeeklyData {
  date: string;
  workOrders: number;
  appointments: number;
  typingJobs: number;
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function WeeklyOverviewChart({ data }: { data: WeeklyData[] }) {
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
          <span className="h-2 w-2 rounded-full bg-teal-600" />
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

function MyActivityPanel({ data, isLoading, photoMap }: { data?: ActivityItem[]; isLoading: boolean; photoMap?: Record<string, string> }) {
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

function TypeIcon({ type, className }: { type: "Medical" | "EID"; className?: string }) {
  return type === "Medical" 
    ? <Stethoscope className={cn("h-3.5 w-3.5 text-rose-500 dark:text-rose-400", className)} />
    : <CreditCard className={cn("h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400", className)} />;
}

function JobRow({ 
  item, 
  rightContent, 
  onClick,
  photoUrl,
}: { 
  item: { woNumber: string; applicantName: string; type: "Medical" | "EID"; urgent?: boolean; woId?: string }; 
  rightContent: React.ReactNode;
  onClick: () => void;
  photoUrl?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover-elevate"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-${item.woNumber}`}>
        {photoUrl && <AvatarImage src={photoUrl} alt={item.applicantName} />}
        <AvatarFallback className="text-[9px] font-medium">{getInitials(item.applicantName)}</AvatarFallback>
      </Avatar>
      <TypeIcon type={item.type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{item.woNumber}</span>
          {item.urgent && (
            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded-full">URGENT</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{toProperCase(item.applicantName)}</p>
      </div>
      <div className="shrink-0 text-right">
        {rightContent}
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
    </div>
  );
}

function LaneHeader({ 
  icon, 
  title, 
  count, 
  color,
  action,
}: { 
  icon: React.ReactNode; 
  title: string; 
  count?: number;
  color: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1">
      <div className="flex items-center gap-2.5">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", color)}>
          {icon}
        </div>
        <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full tabular-nums">{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}

function SubSection({ 
  title, 
  count, 
  icon, 
  color,
  children, 
  defaultOpen = true,
  testId,
}: { 
  title: string; 
  count: number; 
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div data-testid={testId}>
      <button
        className="flex items-center justify-between gap-2 w-full p-2 rounded-lg hover:bg-muted/30 transition-colors text-left"
        onClick={() => setOpen(!open)}
        data-testid={`toggle-${testId}`}
      >
        <div className="flex items-center gap-2">
          <div className={cn("h-5 w-5 rounded flex items-center justify-center", color)}>
            {icon}
          </div>
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs font-medium text-muted-foreground tabular-nums bg-muted/50 px-1.5 py-0.5 rounded-full">{count}</span>
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function PipelineOverview({ navigate }: { navigate: (path: string) => void }) {
  const { data: workOrders } = useQuery<WorkOrderEnriched[]>({
    queryKey: ["/api/work-orders"],
  });

  const counts = useMemo(() => {
    const result: Record<string, number> = {
      new: 0,
      at_vendor: 0,
      ready_to_schedule: 0,
      scheduled: 0,
      complete: 0,
      needs_attention: 0,
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
            scheduled: "bg-purple-500 dark:bg-purple-400",
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
                stage === "scheduled" && "bg-purple-500",
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

function TypingJobsLane({ data, isLoading, photoMap }: { data?: TypingJobsSummary; isLoading: boolean; photoMap?: Record<string, string> }) {
  const [, navigate] = useLocation();
  const totalActive = (data?.counts.unaccepted || 0) + (data?.counts.inProgress || 0) + (data?.counts.returned || 0);

  const vendorJobs: VendorJobItem[] = useMemo(() => {
    if (!data) return [];
    const jobs: VendorJobItem[] = [];
    for (const job of data.returned || []) {
      jobs.push({ ...job, status: "returned", jobStatus: job.status });
    }
    for (const job of data.inProgress) {
      jobs.push({ ...job, status: "inProgress" });
    }
    for (const job of data.unaccepted) {
      jobs.push({ ...job, status: "unaccepted" });
    }
    return jobs;
  }, [data]);

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-2" data-testid="lane-typing-jobs">
      <LaneHeader
        icon={<Send className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
        title="Typing Jobs by Vendor"
        count={totalActive}
        color="bg-amber-100 dark:bg-amber-900/40"
        action={
          <Link href="/typing-jobs">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7" data-testid="link-view-all-jobs">
              View All
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-2 mt-3">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : !data || (totalActive === 0 && data.counts.readyToSchedule === 0 && (data.counts.returned || 0) === 0) ? (
        <div className="mt-3">
          <EmptyState
            icon={<Send className="h-6 w-6" />}
            title="No active jobs"
            description="All typing jobs have been processed."
            action={
              <Link href="/work-orders/new">
                <Button size="sm" className="gap-2" data-testid="button-new-wo-from-jobs">
                  <Plus className="h-4 w-4" />
                  New Work Order
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <VendorGroupedJobsView jobs={vendorJobs} photoMap={photoMap} />

          {data.counts.readyToSchedule > 0 && (
            <SubSection
              title="Ready to Schedule"
              count={data.counts.readyToSchedule}
              icon={<CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
              color="bg-emerald-100 dark:bg-emerald-900/40"
              testId="section-ready-to-schedule-jobs"
            >
              {data.readyToSchedule.map((job) => (
                <JobRow
                  key={job.id}
                  item={job}
                  photoUrl={photoMap?.[job.woId]}
                  onClick={() => navigate(
                    job.type === "Medical" 
                      ? `/appointments/schedule-medical?woId=${job.woId}` 
                      : `/appointments/schedule-eid?woId=${job.woId}`
                  )}
                  rightContent={
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(
                          job.type === "Medical" 
                            ? `/appointments/schedule-medical?woId=${job.woId}` 
                            : `/appointments/schedule-eid?woId=${job.woId}`
                        );
                      }}
                      data-testid={`button-schedule-${job.id}`}
                    >
                      <Calendar className="h-3 w-3" />
                      Schedule
                    </Button>
                  }
                />
              ))}
            </SubSection>
          )}
        </div>
      )}
    </div>
  );
}

function AppointmentsLane({ data, isLoading, photoMap }: { data?: AppointmentsSummary; isLoading: boolean; photoMap?: Record<string, string> }) {
  const [, navigate] = useLocation();
  const [showUpcoming, setShowUpcoming] = useState(false);

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-3" data-testid="lane-appointments">
      <LaneHeader
        icon={<Calendar className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
        title="Appointments"
        count={data?.counts.today}
        color="bg-violet-100 dark:bg-violet-900/40"
        action={
          <Link href="/appointments">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7" data-testid="link-view-all-appointments">
              View All
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-2 mt-3">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div data-testid="section-today-appointments">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-5 rounded flex items-center justify-center bg-violet-100 dark:bg-violet-900/40">
                <CalendarDays className="h-3 w-3 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-sm font-medium text-foreground">Today's Schedule</span>
              <span className="text-xs font-medium text-muted-foreground tabular-nums bg-muted/50 px-1.5 py-0.5 rounded-full">{data?.counts.today || 0}</span>
            </div>
            {data && data.today.length > 0 ? (
              <div className="space-y-0.5">
                {data.today.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover-elevate"
                    onClick={() => navigate(`/work-orders/${apt.woId}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`/work-orders/${apt.woId}`); }}
                    data-testid={`appointment-today-${apt.id}`}
                  >
                    <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-appt-${apt.id}`}>
                      {photoMap?.[apt.woId] && <AvatarImage src={photoMap[apt.woId]} alt={apt.applicantName} />}
                      <AvatarFallback className="text-[9px] font-medium">{getInitials(apt.applicantName)}</AvatarFallback>
                    </Avatar>
                    <TypeIcon type={apt.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{apt.woNumber}</span>
                        <StatusBadge status={apt.type} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{toProperCase(apt.applicantName)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-foreground tabular-nums">{apt.time}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[100px]">{apt.center}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="No appointments today"
                description="Nothing scheduled for today."
              />
            )}
          </div>

          {data && data.upcoming.length > 0 && (
            <div data-testid="section-upcoming-appointments">
              <button
                className="flex items-center justify-between gap-2 w-full p-2 rounded-lg hover:bg-muted/30 transition-colors text-left"
                onClick={() => setShowUpcoming(!showUpcoming)}
                data-testid="toggle-upcoming"
              >
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded flex items-center justify-center bg-blue-100 dark:bg-blue-900/40">
                    <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Upcoming</span>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums bg-muted/50 px-1.5 py-0.5 rounded-full">{data.counts.upcoming}</span>
                </div>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", showUpcoming && "rotate-180")} />
              </button>
              {showUpcoming && (
                <div className="mt-1 space-y-0.5">
                  {data.upcoming.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover-elevate"
                      onClick={() => navigate(`/work-orders/${apt.woId}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/work-orders/${apt.woId}`); }}
                      data-testid={`appointment-upcoming-${apt.id}`}
                    >
                      <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-upcoming-${apt.id}`}>
                        {photoMap?.[apt.woId] && <AvatarImage src={photoMap[apt.woId]} alt={apt.applicantName} />}
                        <AvatarFallback className="text-[9px] font-medium">{getInitials(apt.applicantName)}</AvatarFallback>
                      </Avatar>
                      <TypeIcon type={apt.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{apt.woNumber}</span>
                          <StatusBadge status={apt.type} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{toProperCase(apt.applicantName)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-foreground">{apt.date}</p>
                        <p className="text-[11px] text-muted-foreground">{apt.time} · {apt.center}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {data && data.needsScheduling.length > 0 && (
            <SubSection
              title="Needs Scheduling"
              count={data.counts.needsScheduling}
              icon={<AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
              color="bg-amber-100 dark:bg-amber-900/40"
              testId="section-needs-scheduling"
            >
              {data.needsScheduling.map((item) => (
                <div
                  key={item.woId}
                  className="flex items-center gap-3 p-2.5 rounded-xl transition-all"
                  data-testid={`needs-scheduling-${item.woId}`}
                >
                  <div className="flex gap-1">
                    {item.types.includes("Medical") && <Stethoscope className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />}
                    {item.types.includes("EID") && <CreditCard className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.woNumber}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{toProperCase(item.applicantName)}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {item.types.includes("Medical") && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/appointments/schedule-medical?woId=${item.woId}`);
                        }}
                        data-testid={`button-schedule-medical-${item.woId}`}
                      >
                        <Stethoscope className="h-3 w-3" />
                        Medical
                      </Button>
                    )}
                    {item.types.includes("EID") && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/appointments/schedule-eid?woId=${item.woId}`);
                        }}
                        data-testid={`button-schedule-eid-${item.woId}`}
                      >
                        <CreditCard className="h-3 w-3" />
                        EID
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </SubSection>
          )}

          <div className="flex gap-2 pt-1">
            <Link href="/appointments/schedule-medical" className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" data-testid="button-schedule-medical">
                <Stethoscope className="h-3.5 w-3.5" />
                Schedule Medical
              </Button>
            </Link>
            <Link href="/appointments/schedule-eid" className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" data-testid="button-schedule-eid">
                <CreditCard className="h-3.5 w-3.5" />
                Schedule EID
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NeedsAttentionSection({ navigate }: { navigate: (path: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  const { data: workOrders } = useQuery<WorkOrderEnriched[]>({
    queryKey: ["/api/work-orders"],
  });

  const { data: appointmentsData } = useQuery<AppointmentsSummary>({
    queryKey: ["/api/dashboard/appointments-summary"],
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
      className="premium-card border-red-200/60 dark:border-red-800/30 bg-gradient-to-r from-red-50/80 to-orange-50/40 dark:from-red-950/20 dark:to-orange-950/10 opacity-0 animate-fade-in"
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

          {stalledWorkOrders.map((wo) => (
            <div
              key={wo.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white/60 dark:bg-black/10 cursor-pointer hover:bg-white/80 dark:hover:bg-black/20 transition-colors"
              onClick={() => navigate(`/work-orders/${wo.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/work-orders/${wo.id}`); }}
              data-testid={`needs-attention-stalled-${wo.id}`}
            >
              <XCircle className="h-4 w-4 text-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{wo.woNumber}</span>
                  <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-1.5 py-0.5 rounded-full">STALLED</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{toProperCase(wo.applicantName)}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
            </div>
          ))}

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

interface IdleDraftJob {
  id: string;
  woId: string;
  woNumber: string | null;
  applicantName: string | null;
  companyName: string | null;
  jobTypeName: string | null;
  jobTypeCategory: string | null;
  hoursIdle: number | null;
  createdAt: string | null;
}

function IdleDraftJobsPanel({ navigate }: { navigate: (path: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  const { data: idleJobs, isLoading } = useQuery<IdleDraftJob[]>({
    queryKey: ["/api/admin/idle-draft-jobs"],
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

function DelayedWorkOrdersAlert({ navigate }: { navigate: (path: string) => void }) {
  const { data: workOrders } = useQuery<WorkOrderEnriched[]>({
    queryKey: ["/api/work-orders"],
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

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Keystone Admin Dashboard";
    return () => { document.title = "Keystone"; };
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    staleTime: 30000,
  });

  const { data: typingData, isLoading: typingLoading } = useQuery<TypingJobsSummary>({
    queryKey: ["/api/dashboard/typing-jobs-summary"],
    staleTime: 30000,
  });

  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery<AppointmentsSummary>({
    queryKey: ["/api/dashboard/appointments-summary"],
    staleTime: 30000,
  });

  const { data: weeklyData } = useQuery<WeeklyData[]>({
    queryKey: ["/api/dashboard/weekly-overview"],
    staleTime: 60000,
  });

  const { data: myActivity, isLoading: activityLoading } = useQuery<ActivityItem[]>({
    queryKey: ["/api/activity/my"],
    staleTime: 30000,
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: ["/api/work-orders/photos"],
    staleTime: 60000,
  });

  const activeJobs = (typingData?.counts.unaccepted || 0) + (typingData?.counts.inProgress || 0);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-greeting">{getGreeting()}</p>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">
              Keystone Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {(user?.role === "Admin" || user?.role === "Client Relationship Manager") && <DashboardSwitcher active="admin" />}
            <Link href="/work-orders/new">
              <Button size="sm" className="gap-1.5" data-testid="button-new-work-order">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Work Order</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statsLoading ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                title="Active Jobs"
                value={activeJobs}
                icon={<Send className="h-4 w-4" />}
                animationDelay={1}
                onClick={() => navigate("/typing-jobs")}
              />
              <StatCard
                title="Ready to Schedule"
                value={typingData?.counts.readyToSchedule || 0}
                icon={<CheckCircle2 className="h-4 w-4" />}
                animationDelay={2}
                onClick={() => navigate("/appointments")}
              />
              <StatCard
                title="Today's Appts"
                value={stats?.todayAppointments || 0}
                icon={<Calendar className="h-4 w-4" />}
                animationDelay={3}
                onClick={() => navigate("/appointments")}
              />
              <StatCard
                title="Wallet"
                value={`AED ${(stats?.walletBalance || 0).toLocaleString()}`}
                icon={<Wallet className="h-4 w-4" />}
                animationDelay={4}
                onClick={() => navigate("/vendor-wallet")}
              />
            </>
          )}
        </div>

        <NeedsAttentionSection navigate={navigate} />

        <DelayedWorkOrdersAlert navigate={navigate} />

        {user?.role === "Admin" && <IdleDraftJobsPanel navigate={navigate} />}

        {stats?.lowBalanceWarning && (
          <div 
            className="premium-card p-3 border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 opacity-0 animate-fade-in"
            data-testid="alert-low-balance"
          >
            <div className="flex items-center gap-3">
              <div className="icon-container icon-container-sm !bg-amber-100 dark:!bg-amber-900/40 !text-amber-600 dark:!text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-amber-800 dark:text-amber-200">Low Wallet Balance</p>
              </div>
              <Link href="/vendor-wallet">
                <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-top-up">
                  Top Up
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        <PipelineOverview navigate={navigate} />

        <div className="section-divider" />

        <div className="grid xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 grid lg:grid-cols-2 gap-4">
            <TypingJobsLane data={typingData} isLoading={typingLoading} photoMap={photoMap} />
            <AppointmentsLane data={appointmentsData} isLoading={appointmentsLoading} photoMap={photoMap} />
          </div>
          <div className="space-y-4">
            {weeklyData && <WeeklyOverviewChart data={weeklyData} />}
            {(user?.role === "Admin" || user?.role === "Client Relationship Manager" || user?.role === "PRO" || user?.role === "PRO - Temporary") && (
              <CustodyDashboardWidget />
            )}
            <MyActivityPanel data={myActivity} isLoading={activityLoading} photoMap={photoMap} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
