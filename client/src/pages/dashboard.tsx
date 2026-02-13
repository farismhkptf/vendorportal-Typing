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
  CircleDot,
  CheckCircle2,
  Send,
  XCircle,
  Stethoscope,
  CreditCard
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

function getStatusSummary(typing: string | null, appt: string | null): { label: string; color: string } {
  if (appt === "Completed" && (typing === "SentToClient" || typing === "Returned")) {
    return { label: "Done", color: "text-emerald-600 dark:text-emerald-400" };
  }
  if (appt === "Scheduled") {
    return { label: "Appt. Scheduled", color: "text-blue-600 dark:text-blue-400" };
  }
  if (typing === "SentToClient") {
    return { label: "Sent to Client", color: "text-emerald-600 dark:text-emerald-400" };
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

export default function Dashboard() {
  const [, navigate] = useLocation();
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

  const { data: needsAttention } = useQuery<NeedsAttentionItem[]>({
    queryKey: ["/api/dashboard/needs-attention"],
  });

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-greeting">{getGreeting()}</p>
            <h1 className="text-xl font-semibold text-foreground">
              Dashboard
            </h1>
          </div>
          <Link href="/work-orders/new">
            <Button size="sm" className="gap-1.5" data-testid="button-new-work-order">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Work Order</span>
            </Button>
          </Link>
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

        {pipelineLoading ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : pipeline ? (
          <Pipeline data={pipeline} />
        ) : null}

        {needsAttention && needsAttention.length > 0 && (
          <NeedsAttention items={needsAttention} />
        )}

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
      </div>
    </AppLayout>
  );
}
