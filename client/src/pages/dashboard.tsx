import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getGreeting } from "@/lib/greeting";
import { toProperCase } from "@/lib/proper-case";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { DashboardSwitcher } from "@/components/dashboard-switcher";

interface DashboardStats {
  totalWorkOrders: number;
  todayAppointments: number;
  pendingTypingJobs: number;
  walletBalance: number;
  lowBalanceWarning: boolean;
}

interface TypingJobItem {
  id: string;
  jobCode: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  vendorName: string;
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

interface TypingJobsSummary {
  unaccepted: TypingJobItem[];
  inProgress: TypingJobItem[];
  readyToSchedule: ReadyToScheduleJob[];
  counts: { unaccepted: number; inProgress: number; readyToSchedule: number };
}

interface AppointmentItem {
  id: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  type: "Medical" | "EID";
  time: string;
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

function TypeIcon({ type, className }: { type: "Medical" | "EID"; className?: string }) {
  return type === "Medical" 
    ? <Stethoscope className={cn("h-3.5 w-3.5 text-rose-500 dark:text-rose-400", className)} />
    : <CreditCard className={cn("h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400", className)} />;
}

function JobRow({ 
  item, 
  rightContent, 
  onClick 
}: { 
  item: { woNumber: string; applicantName: string; type: "Medical" | "EID"; urgent?: boolean }; 
  rightContent: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover-elevate"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
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
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
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

function TypingJobsLane({ data, isLoading }: { data?: TypingJobsSummary; isLoading: boolean }) {
  const [, navigate] = useLocation();
  const totalActive = (data?.counts.unaccepted || 0) + (data?.counts.inProgress || 0);

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-2" data-testid="lane-typing-jobs">
      <LaneHeader
        icon={<Send className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
        title="Typing Jobs"
        count={totalActive}
        color="bg-indigo-100 dark:bg-indigo-900/40"
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
      ) : !data || (totalActive === 0 && data.counts.readyToSchedule === 0) ? (
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
          <SubSection
            title="Waiting for Vendor"
            count={data.counts.unaccepted}
            icon={<Timer className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
            color="bg-amber-100 dark:bg-amber-900/40"
            testId="section-unaccepted"
          >
            {data.unaccepted.map((job) => (
              <JobRow
                key={job.id}
                item={job}
                onClick={() => navigate(`/typing-jobs/${job.id}`)}
                rightContent={
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{job.vendorName}</span>
                    <span className={cn(
                      "text-[11px] font-medium tabular-nums",
                      (job.hoursWaiting || 0) > 24 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                    )}>
                      {job.hoursWaiting}h waiting
                    </span>
                  </div>
                }
              />
            ))}
          </SubSection>

          <SubSection
            title="In Progress"
            count={data.counts.inProgress}
            icon={<Loader2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />}
            color="bg-blue-100 dark:bg-blue-900/40"
            testId="section-in-progress"
          >
            {data.inProgress.map((job) => (
              <JobRow
                key={job.id}
                item={job}
                onClick={() => navigate(`/typing-jobs/${job.id}`)}
                rightContent={
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{job.vendorName}</span>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium tabular-nums">
                      {job.hoursElapsed}h elapsed
                    </span>
                  </div>
                }
              />
            ))}
          </SubSection>

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
        </div>
      )}
    </div>
  );
}

function AppointmentsLane({ data, isLoading }: { data?: AppointmentsSummary; isLoading: boolean }) {
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

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: typingData, isLoading: typingLoading } = useQuery<TypingJobsSummary>({
    queryKey: ["/api/dashboard/typing-jobs-summary"],
  });

  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery<AppointmentsSummary>({
    queryKey: ["/api/dashboard/appointments-summary"],
  });

  const activeJobs = (typingData?.counts.unaccepted || 0) + (typingData?.counts.inProgress || 0);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-greeting">{getGreeting()}</p>
            <h1 className="text-xl font-semibold text-foreground">
              Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === "Admin" && <DashboardSwitcher active="admin" />}
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
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3">
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

        <div className="section-divider" />

        <div className="grid lg:grid-cols-2 gap-4">
          <TypingJobsLane data={typingData} isLoading={typingLoading} />
          <AppointmentsLane data={appointmentsData} isLoading={appointmentsLoading} />
        </div>
      </div>
    </AppLayout>
  );
}
