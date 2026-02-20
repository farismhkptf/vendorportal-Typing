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
  Building2,
  ChevronRight,
  ChevronDown,
  CircleDot,
  CheckCircle2,
  Send,
  XCircle,
  Stethoscope,
  CreditCard,
  ShieldCheck,
  UserCheck,
  FileQuestion,
  AlertOctagon,
  Timer,
  FileWarning
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTableRow } from "@/components/ui/data-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getGreeting } from "@/lib/greeting";
import { toProperCase } from "@/lib/proper-case";
import { useCountUp } from "@/hooks/use-count-up";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { DashboardSwitcher } from "@/components/dashboard-switcher";
import { DevNotesDashboard } from "@/components/dev-notes-dashboard";

function getStatusSummary(typing: string | null, appt: string | null): { label: string; color: string } {
  if (appt === "Completed" && (typing === "SentToClient" || typing === "ReadyToSchedule" || typing === "Returned")) {
    return { label: "Done", color: "text-emerald-600 dark:text-emerald-400" };
  }
  if (appt === "Scheduled") {
    return { label: "Appt. Scheduled", color: "text-blue-600 dark:text-blue-400" };
  }
  if (typing === "SentToClient") {
    return { label: "Sent to Client", color: "text-emerald-600 dark:text-emerald-400" };
  }
  if (typing === "ReadyToSchedule") {
    return { label: "Ready to Schedule", color: "text-teal-600 dark:text-teal-400" };
  }
  if (typing === "Returned") {
    return { label: "Returned", color: "text-violet-600 dark:text-violet-400" };
  }
  if (typing === "SentToVendor") {
    return { label: "At Vendor", color: "text-indigo-600 dark:text-indigo-400" };
  }
  if (typing === "Draft") {
    return { label: "Typing", color: "text-slate-500 dark:text-slate-400" };
  }
  return { label: "--", color: "text-muted-foreground/50" };
}

function WoStatusPills({ wo }: { wo: RecentWorkOrder }) {
  const hasMed = wo.medicalTyping || wo.medicalAppt;
  const hasEid = wo.eidTyping || wo.eidAppt;

  if (!hasMed && !hasEid) {
    return <span className="text-[11px] text-muted-foreground/50">Draft</span>;
  }

  const med = hasMed ? getStatusSummary(wo.medicalTyping, wo.medicalAppt) : null;
  const eid = hasEid ? getStatusSummary(wo.eidTyping, wo.eidAppt) : null;

  return (
    <div className="flex flex-col gap-1 items-end">
      {med && (
        <div className="flex items-center gap-1.5" data-testid={`status-medical-${wo.id}`}>
          <Stethoscope className="h-3 w-3 text-rose-500 dark:text-rose-400 shrink-0" />
          <span className={cn("text-[11px] font-medium", med.color)}>{med.label}</span>
        </div>
      )}
      {eid && (
        <div className="flex items-center gap-1.5" data-testid={`status-eid-${wo.id}`}>
          <CreditCard className="h-3 w-3 text-cyan-500 dark:text-cyan-400 shrink-0" />
          <span className={cn("text-[11px] font-medium", eid.color)}>{eid.label}</span>
        </div>
      )}
    </div>
  );
}

interface DashboardStats {
  totalWorkOrders: number;
  todayAppointments: number;
  pendingTypingJobs: number;
  walletBalance: number;
  lowBalanceWarning: boolean;
}

interface TodayAppointment {
  id: string;
  woNumber: string;
  applicantName: string;
  type: "Medical" | "EID";
  time: string;
  center: string;
}

interface RecentWorkOrder {
  id: string;
  woNumber: string;
  applicantName: string;
  companyName: string;
  status: "Draft" | "Scheduled" | "Sent" | "Completed" | "Cancelled";
  createdAt: string;
  medicalTyping: string | null;
  medicalAppt: string | null;
  eidTyping: string | null;
  eidAppt: string | null;
}

interface ActionCenterData {
  pendingApprovals: number;
  unacceptedJobs: number;
  waitingForDocs: number;
  overdueItems: number;
}

interface PipelineData {
  draft: number;
  scheduled: number;
  sent: number;
  completed: number;
  cancelled: number;
  total: number;
}

interface NeedsAttentionItem {
  id: string;
  woNumber: string;
  applicantName: string;
  reason: string;
  severity: "warning" | "urgent";
  daysOld: number;
}

interface StaleJobsData {
  unacceptedOver24h: Array<{ id: string; jobCode: string; woNumber: string; applicantName: string; sentAt: string; hoursWaiting: number }>;
  waitingForDocsOver48h: Array<{ id: string; jobCode: string; woNumber: string; applicantName: string; lastStatusChange: string; hoursWaiting: number }>;
  inProgressOver72h: Array<{ id: string; jobCode: string; woNumber: string; applicantName: string; startedAt: string; hoursInProgress: number }>;
}

interface ExpiringDocsData {
  expiringMedical: Array<{ jobId: string; jobCode: string; woNumber: string; applicantName: string; completedAt: string; daysRemaining: number }>;
  expiringEid: Array<{ jobId: string; jobCode: string; woNumber: string; applicantName: string; completedAt: string; daysRemaining: number }>;
}

const PIPELINE_STAGES = [
  { key: "draft" as const, label: "Draft", icon: CircleDot, color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800/60" },
  { key: "scheduled" as const, label: "Scheduled", icon: Calendar, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
  { key: "sent" as const, label: "Sent", icon: Send, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
  { key: "completed" as const, label: "Completed", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
];

function PipelineStage({ stage, count, total, index }: { 
  stage: typeof PIPELINE_STAGES[number]; 
  count: number; 
  total: number;
  index: number;
}) {
  const animatedCount = useCountUp(count, 600, index * 100);
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div 
      className={cn(
        "flex-1 min-w-0 p-3 rounded-xl transition-all duration-300",
        stage.bg,
        "opacity-0 animate-fade-in"
      )}
      style={{ animationDelay: `${index * 80 + 200}ms` }}
      data-testid={`pipeline-${stage.key}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <stage.icon className={cn("h-3.5 w-3.5 shrink-0", stage.color)} />
        <span className="text-xs font-medium text-muted-foreground truncate">{stage.label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-lg font-semibold tabular-nums", stage.color)}>
          {animatedCount}
        </span>
        {total > 0 && (
          <span className="text-[10px] text-muted-foreground/60 font-medium">{percentage}%</span>
        )}
      </div>
    </div>
  );
}

function Pipeline({ data }: { data: PipelineData }) {
  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-2" data-testid="section-pipeline">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground">Work Order Pipeline</h2>
        <Link href="/work-orders">
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7">
            View All
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
      <div className="flex gap-2">
        {PIPELINE_STAGES.map((stage, i) => (
          <PipelineStage
            key={stage.key}
            stage={stage}
            count={data[stage.key]}
            total={data.total}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

const ACTION_CENTER_ITEMS = [
  { key: "pendingApprovals" as const, label: "Pending Approvals", icon: ShieldCheck, href: "/admin", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/40" },
  { key: "unacceptedJobs" as const, label: "Unaccepted Jobs", icon: UserCheck, href: "/typing-jobs?status=SentToVendor", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40" },
  { key: "waitingForDocs" as const, label: "Waiting for Docs", icon: FileQuestion, href: "/typing-jobs?status=WaitingForDocs", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40" },
  { key: "overdueItems" as const, label: "Overdue Items", icon: AlertOctagon, href: "/work-orders", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/40" },
];

function ActionCenter({ data }: { data: ActionCenterData }) {
  const [, navigate] = useLocation();

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-1" data-testid="section-action-center">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
        <h2 className="text-sm font-semibold text-foreground">Action Center</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ACTION_CENTER_ITEMS.map((item, i) => {
          const count = data[item.key];
          return (
            <div
              key={item.key}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer transition-all hover-elevate",
                "opacity-0 animate-fade-in"
              )}
              style={{ animationDelay: `${i * 80 + 200}ms` }}
              onClick={() => navigate(item.href)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") navigate(item.href); }}
              data-testid={`action-${item.key}`}
            >
              <div className="relative">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", item.bg)}>
                  <item.icon className={cn("h-4 w-4", item.color)} />
                </div>
                {count > 0 && (
                  <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                )}
              </div>
              <ActionCenterCount count={count} delay={i * 100} color={item.color} />
              <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionCenterCount({ count, delay, color }: { count: number; delay: number; color: string }) {
  const animated = useCountUp(count, 600, delay);
  return <span className={cn("text-lg font-semibold tabular-nums", color)}>{animated}</span>;
}

function NeedsAttention({ items }: { items: NeedsAttentionItem[] }) {
  const [, navigate] = useLocation();

  if (items.length === 0) return null;

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-3" data-testid="section-needs-attention">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-sm font-semibold text-foreground">Needs Attention</h2>
          <span className="text-xs text-muted-foreground tabular-nums">({items.length})</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover-elevate",
              item.severity === "urgent" 
                ? "bg-rose-50/50 dark:bg-rose-950/20" 
                : "bg-amber-50/50 dark:bg-amber-950/20",
              "opacity-0 animate-fade-in"
            )}
            style={{ animationDelay: `${i * 60 + 300}ms` }}
            onClick={() => navigate(`/work-orders/${item.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") navigate(`/work-orders/${item.id}`); }}
            data-testid={`attention-item-${item.woNumber}`}
          >
            <div className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
              item.severity === "urgent" 
                ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                : "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
            )}>
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{item.woNumber}</span>
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                  {toProperCase(item.applicantName)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{item.reason}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StaleJobAlerts({ data }: { data: StaleJobsData }) {
  const [, navigate] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const totalCount = data.unacceptedOver24h.length + data.waitingForDocsOver48h.length + data.inProgressOver72h.length;
  if (totalCount === 0) return null;

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const sections = [
    { key: "unaccepted", label: "Unaccepted Over 24h", items: data.unacceptedOver24h, getHours: (i: any) => i.hoursWaiting },
    { key: "waitingDocs", label: "Waiting for Docs Over 48h", items: data.waitingForDocsOver48h, getHours: (i: any) => i.hoursWaiting },
    { key: "inProgress", label: "In Progress Over 72h", items: data.inProgressOver72h, getHours: (i: any) => i.hoursInProgress },
  ].filter(s => s.items.length > 0);

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-2" data-testid="section-stale-jobs">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-amber-100 dark:bg-amber-900/40">
          <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Stale Job Alerts</h2>
        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium tabular-nums">({totalCount})</span>
      </div>
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.key}>
            <button
              className="flex items-center justify-between gap-2 w-full p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 text-left"
              onClick={() => toggleSection(section.key)}
              data-testid={`stale-toggle-${section.key}`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm font-medium text-foreground">{section.label}</span>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium tabular-nums">{section.items.length}</span>
              </div>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expandedSections[section.key] && "rotate-180")} />
            </button>
            {expandedSections[section.key] && (
              <div className="mt-1 space-y-1 pl-2">
                {section.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer hover-elevate"
                    onClick={() => navigate(`/typing-jobs/${item.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`/typing-jobs/${item.id}`); }}
                    data-testid={`stale-job-${item.id}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{item.woNumber}</span>
                        {item.jobCode && <span className="text-xs text-muted-foreground">{item.jobCode}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{toProperCase(item.applicantName)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium tabular-nums">{section.getHours(item)}h</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpiringDocuments({ data }: { data: ExpiringDocsData }) {
  const [, navigate] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const totalCount = data.expiringMedical.length + data.expiringEid.length;
  if (totalCount === 0) return null;

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const sections = [
    { key: "medical", label: "Medical (30-day window)", items: data.expiringMedical, icon: Stethoscope },
    { key: "eid", label: "EID (60-day window)", items: data.expiringEid, icon: CreditCard },
  ].filter(s => s.items.length > 0);

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-3" data-testid="section-expiring-documents">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-rose-100 dark:bg-rose-900/40">
          <FileWarning className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Expiring Documents</h2>
        <span className="text-xs text-rose-600 dark:text-rose-400 font-medium tabular-nums">({totalCount})</span>
      </div>
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.key}>
            <button
              className="flex items-center justify-between gap-2 w-full p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 text-left"
              onClick={() => toggleSection(section.key)}
              data-testid={`expiry-toggle-${section.key}`}
            >
              <div className="flex items-center gap-2">
                <section.icon className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                <span className="text-sm font-medium text-foreground">{section.label}</span>
                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium tabular-nums">{section.items.length}</span>
              </div>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expandedSections[section.key] && "rotate-180")} />
            </button>
            {expandedSections[section.key] && (
              <div className="mt-1 space-y-1 pl-2">
                {section.items.map((item) => (
                  <div
                    key={item.jobId}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer hover-elevate"
                    onClick={() => navigate(`/typing-jobs/${item.jobId}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`/typing-jobs/${item.jobId}`); }}
                    data-testid={`expiring-doc-${item.jobId}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{item.woNumber}</span>
                        {item.jobCode && <span className="text-xs text-muted-foreground">{item.jobCode}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{toProperCase(item.applicantName)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={cn(
                        "text-xs font-medium tabular-nums",
                        item.daysRemaining <= 2 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                      )}>
                        {item.daysRemaining}d left
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: todayAppointments, isLoading: appointmentsLoading } = useQuery<TodayAppointment[]>({
    queryKey: ["/api/dashboard/today-appointments"],
  });

  const { data: recentWorkOrders, isLoading: workOrdersLoading } = useQuery<RecentWorkOrder[]>({
    queryKey: ["/api/dashboard/recent-work-orders"],
  });

  const { data: pipeline, isLoading: pipelineLoading } = useQuery<PipelineData>({
    queryKey: ["/api/dashboard/pipeline"],
  });

  const { data: actionCenterData } = useQuery<ActionCenterData>({
    queryKey: ["/api/dashboard/action-center"],
  });

  const { data: needsAttention } = useQuery<NeedsAttentionItem[]>({
    queryKey: ["/api/dashboard/needs-attention"],
  });

  const { data: staleJobs } = useQuery<StaleJobsData>({
    queryKey: ["/api/dashboard/stale-jobs"],
  });

  const { data: expiringDocs } = useQuery<ExpiringDocsData>({
    queryKey: ["/api/dashboard/expiring-documents"],
  });

  const hasActions = actionCenterData && (
    actionCenterData.pendingApprovals > 0 ||
    actionCenterData.unacceptedJobs > 0 ||
    actionCenterData.waitingForDocs > 0 ||
    actionCenterData.overdueItems > 0
  );

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
                title="Work Orders"
                value={stats?.totalWorkOrders || 0}
                icon={<FileText className="h-4 w-4" />}
                animationDelay={1}
                onClick={() => navigate("/work-orders")}
              />
              <StatCard
                title="Today's Appts"
                value={stats?.todayAppointments || 0}
                icon={<Calendar className="h-4 w-4" />}
                animationDelay={2}
                onClick={() => navigate("/appointments")}
              />
              <StatCard
                title="Pending Jobs"
                value={stats?.pendingTypingJobs || 0}
                icon={<Clock className="h-4 w-4" />}
                animationDelay={3}
                onClick={() => navigate("/typing-jobs")}
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

        {actionCenterData && hasActions && (
          <>
            <div className="section-divider" />
            <ActionCenter data={actionCenterData} />
          </>
        )}

        {staleJobs && (data => {
          const total = data.unacceptedOver24h.length + data.waitingForDocsOver48h.length + data.inProgressOver72h.length;
          return total > 0 ? (
            <>
              <div className="section-divider" />
              <StaleJobAlerts data={data} />
            </>
          ) : null;
        })(staleJobs)}

        {expiringDocs && (data => {
          const total = data.expiringMedical.length + data.expiringEid.length;
          return total > 0 ? (
            <>
              <div className="section-divider" />
              <ExpiringDocuments data={data} />
            </>
          ) : null;
        })(expiringDocs)}

        {pipelineLoading ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : pipeline ? (
          <Pipeline data={pipeline} />
        ) : null}

        {needsAttention && needsAttention.length > 0 && (
          <>
            <div className="section-divider" />
            <NeedsAttention items={needsAttention} />
          </>
        )}

        <div className="section-divider" />

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Today's Appointments</h2>
              <Link href="/appointments">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                  View All
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            
            <div className="space-y-2">
              {appointmentsLoading ? (
                <>
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </>
              ) : todayAppointments && todayAppointments.length > 0 ? (
                todayAppointments.map((apt, i) => (
                  <Link key={apt.id} href={`/work-orders/${apt.id}`}>
                    <div
                      className="opacity-0 animate-fade-in"
                      style={{ animationDelay: `${i * 60 + 200}ms` }}
                    >
                      <DataTableRow>
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2.5">
                              <span className="font-medium text-foreground">{apt.woNumber}</span>
                              <StatusBadge status={apt.type} />
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{toProperCase(apt.applicantName)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-medium text-foreground">{apt.time}</p>
                            <p className="text-sm text-muted-foreground">{apt.center}</p>
                          </div>
                        </div>
                      </DataTableRow>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={<Calendar className="h-6 w-6" />}
                  title="No appointments today"
                  description="There are no scheduled appointments for today."
                />
              )}
            </div>
          </div>

          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Recent Work Orders</h2>
              <Link href="/work-orders">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                  View All
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            
            <div className="space-y-3">
              {workOrdersLoading ? (
                <>
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </>
              ) : recentWorkOrders && recentWorkOrders.length > 0 ? (
                recentWorkOrders.map((wo, i) => (
                  <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                    <div
                      className="opacity-0 animate-fade-in"
                      style={{ animationDelay: `${i * 60 + 250}ms` }}
                    >
                      <DataTableRow>
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-medium text-foreground">{wo.woNumber}</span>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{toProperCase(wo.companyName)}</span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{toProperCase(wo.applicantName)}</p>
                          </div>
                          <div className="shrink-0">
                            <WoStatusPills wo={wo} />
                          </div>
                        </div>
                      </DataTableRow>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No work orders yet"
                  description="Create your first work order to get started."
                  action={
                    <Link href="/work-orders/new">
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        New Work Order
                      </Button>
                    </Link>
                  }
                />
              )}
            </div>
          </div>
        </div>

        <DevNotesDashboard />
      </div>
    </AppLayout>
  );
}
