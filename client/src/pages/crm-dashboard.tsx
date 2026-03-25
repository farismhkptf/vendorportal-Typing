import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Building2,
  FileText,
  Calendar,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  Briefcase,
  Wallet,
  Activity,
  Clock,
  CheckCircle2,
  Zap,
  Users,
  TrendingUp,
  AlertTriangle,
  Plus,
  LayoutGrid,
  Inbox,
  Trash2,
  BanIcon,
  Send,
} from "lucide-react";
import { VendorGroupedJobsView, VendorGroupedWorkOrdersView, type VendorJobItem, type VendorWorkOrderItem } from "@/components/vendor-grouped-jobs-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTableRow } from "@/components/ui/data-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getGreeting } from "@/lib/greeting";
import { toProperCase } from "@/lib/proper-case";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { DashboardSwitcher } from "@/components/dashboard-switcher";
import { getPipelineInfo } from "@/lib/pipeline-stage";
import type { Company, WorkOrder, Appointment } from "@shared/schema";

interface DeletionRequest {
  id: string;
  entityType: string;
  entityLabel: string;
  reason: string;
  status: string;
  reviewNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

interface TypingJobSummary {
  id: string;
  status: string;
  vendorId?: string | null;
  sentAt?: string | null;
  returnedAt?: string | null;
  urgent?: boolean;
  jobCode?: string;
  jobType?: { category?: string } | null;
  [key: string]: unknown;
}

interface WorkOrderEnriched extends WorkOrder {
  typingJobs: TypingJobSummary[];
  appointments: Appointment[];
  company?: Company;
}

interface CompanyEnriched extends Company {
  hasExpiringDocs: boolean;
}

interface AppointmentWithDetails extends Appointment {
  workOrder?: {
    woNumber: string;
    applicantName: string;
    companyId: string;
    assignedStaffId?: string;
  };
  center?: {
    name: string;
  };
  assignedStaff?: {
    name: string;
  };
}

interface StaffMember {
  id: string;
  name: string;
  roleTitle: string;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
  status: string;
  logoUrl?: string | null;
}

interface DashStats {
  walletBalance?: number;
}

function formatTime(datetime: string | Date): string {
  const d = new Date(datetime);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function isToday(datetime: string | Date): boolean {
  const d = new Date(datetime);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

export default function CrmDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  useEffect(() => {
    document.title = "Keystone Client Relation Manager Dashboard";
    return () => { document.title = "Keystone"; };
  }, []);

  const { data: companies, isLoading: companiesLoading } = useQuery<CompanyEnriched[]>({
    queryKey: ["/api/companies"],
  });

  const { data: workOrders, isLoading: workOrdersLoading } = useQuery<WorkOrderEnriched[]>({
    queryKey: ["/api/work-orders"],
  });

  const { data: allAppointments, isLoading: appointmentsLoading } = useQuery<AppointmentWithDetails[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: dashStats } = useQuery<DashStats>({
    queryKey: ["/api/dashboard/stats"],
    staleTime: 30000,
  });

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
  });

  const { data: deletionRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/deletion-requests"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const activeWorkOrders = useMemo(() => {
    if (!workOrders) return [];
    return workOrders.filter(wo => wo.status !== "Completed" && wo.status !== "Cancelled");
  }, [workOrders]);

  const todayAppointments = useMemo(() => {
    if (!allAppointments) return [];
    return allAppointments
      .filter(apt => isToday(apt.datetime) && apt.status !== "Cancelled")
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [allAppointments]);

  const attentionWorkOrders = useMemo(() => {
    if (!workOrders) return [];
    return workOrders.filter(wo => {
      if (wo.status === "Completed" || wo.status === "Cancelled") return false;
      const hasReturnedJob = wo.typingJobs.some(j => j.status === "Returned" || j.status === "Rejected");
      const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
      return hasReturnedJob || pipeline.overall === "needs_attention";
    });
  }, [workOrders]);

  const pendingTypingJobs = useMemo(() => {
    if (!workOrders) return 0;
    return workOrders.reduce((count, wo) => {
      return count + wo.typingJobs.filter(j =>
        j.status === "SubmittedToVendor" || j.status === "InProcess"
      ).length;
    }, 0);
  }, [workOrders]);

  const companiesNeedingAttention = useMemo(() => {
    if (!companies || !workOrders) return [];
    const urgentCompanyIds = new Set<string>();
    for (const wo of workOrders) {
      if (wo.status === "Completed" || wo.status === "Cancelled") continue;
      const hasReturnedJob = wo.typingJobs.some(j => j.status === "Returned" || j.status === "Rejected");
      const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
      if (hasReturnedJob || pipeline.overall === "needs_attention") {
        urgentCompanyIds.add(wo.companyId);
      }
    }
    for (const co of companies) {
      if (co.hasExpiringDocs) urgentCompanyIds.add(co.id);
    }
    return companies.filter(c => urgentCompanyIds.has(c.id)).slice(0, 6);
  }, [companies, workOrders]);

  const pendingDeletionRequests = useMemo(() => {
    return deletionRequests.filter((r: any) => r.status === "pending");
  }, [deletionRequests]);

  const vendorTypingStats = useMemo(() => {
    if (!workOrders || !vendors.length) return [];
    const activeVendors = vendors.filter(v => v.status === "Active");
    return activeVendors.map(vendor => {
      const pending = workOrders.reduce((count, wo) => {
        return count + wo.typingJobs.filter((j: any) =>
          j.vendorId === vendor.id && (j.status === "SubmittedToVendor" || j.status === "InProcess")
        ).length;
      }, 0);
      return { vendor, pending };
    }).filter(v => v.pending > 0).sort((a, b) => b.pending - a.pending).slice(0, 5);
  }, [workOrders, vendors]);

  const vendorJobItems = useMemo((): VendorJobItem[] => {
    if (!workOrders || !vendors) return [];
    const vendorMap = new Map(vendors.map(v => [v.id, v]));
    const now = Date.now();
    const jobs: VendorJobItem[] = [];

    for (const wo of activeWorkOrders) {
      for (const job of wo.typingJobs) {
        const isActive = job.status === "SubmittedToVendor" || job.status === "InProcess";
        const isReturned = job.status === "Returned" || job.status === "Rejected";
        if (!isActive && !isReturned) continue;

        const vendor = job.vendorId ? vendorMap.get(job.vendorId) : undefined;
        const category = job.jobType?.category || (
          (job.jobCode || "").startsWith("M") ? "Medical" : "EID"
        );
        const statusKey: VendorJobItem["status"] = isReturned
          ? "returned"
          : job.status === "InProcess"
          ? "inProgress"
          : "unaccepted";

        jobs.push({
          id: job.id,
          woId: wo.id,
          woNumber: wo.woNumber,
          applicantName: wo.applicantName,
          type: (category === "Medical" ? "Medical" : "EID") as "Medical" | "EID",
          urgent: job.urgent ?? false,
          vendorId: vendor?.id ?? null,
          vendorName: vendor?.name ?? "Unassigned",
          vendorLogoUrl: vendor?.logoUrl ?? null,
          status: statusKey,
          jobStatus: isReturned ? job.status : undefined,
          hoursWaiting: statusKey === "unaccepted" && job.sentAt
            ? Math.round((now - new Date(job.sentAt).getTime()) / 3600000)
            : undefined,
          hoursElapsed: statusKey === "inProgress" && job.sentAt
            ? Math.round((now - new Date(job.sentAt).getTime()) / 3600000)
            : undefined,
          returnedAt: job.returnedAt ?? null,
        });
      }
    }

    return jobs;
  }, [activeWorkOrders, vendors]);

  const prioritizedWorkOrders = useMemo(() => {
    const priority = (wo: WorkOrderEnriched) => {
      const pipeline = getPipelineInfo(wo.typingJobs, wo.appointments);
      const hasReturned = wo.typingJobs.some(j => j.status === "Returned" || j.status === "Rejected");
      if (hasReturned || pipeline.overall === "needs_attention") return 0;
      if (pipeline.overall === "at_vendor" || pipeline.overall === "ready_to_schedule" || pipeline.overall === "scheduled") return 1;
      if (pipeline.overall === "complete") return 2;
      return 3;
    };
    return [...activeWorkOrders].sort((a, b) => priority(a) - priority(b)).slice(0, 8);
  }, [activeWorkOrders]);

  const companyMap = useMemo(() => {
    const map: Record<string, string> = {};
    (companies || []).forEach(c => { map[c.id] = c.name; });
    return map;
  }, [companies]);

  const vendorWorkOrders = useMemo((): VendorWorkOrderItem[] => {
    if (!activeWorkOrders || !vendors) return [];
    const vendorMap = new Map(vendors.map(v => [v.id, v]));

    const items: VendorWorkOrderItem[] = [];
    const seen = new Set<string>();

    for (const wo of activeWorkOrders) {
      const hasIssue = wo.typingJobs.some(j => j.status === "Returned" || j.status === "Rejected") ||
        getPipelineInfo(wo.typingJobs, wo.appointments).overall === "needs_attention";

      const activeVendorIds = Array.from(
        new Set(
          wo.typingJobs
            .filter(j => j.status === "SubmittedToVendor" || j.status === "InProcess" ||
                         j.status === "Returned" || j.status === "Rejected")
            .map(j => j.vendorId)
            .filter((id): id is string => !!id)
        )
      );

      const woStatus = wo.status satisfies VendorWorkOrderItem["status"];

      if (activeVendorIds.length === 0) {
        const key = `${wo.id}::__unassigned__`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            id: wo.id,
            woNumber: wo.woNumber,
            applicantName: wo.applicantName,
            status: woStatus,
            companyName: companyMap[wo.companyId],
            hasIssue,
            vendorId: null,
            vendorName: "Unassigned",
            vendorLogoUrl: null,
          });
        }
      } else {
        for (const vendorId of activeVendorIds) {
          const key = `${wo.id}::${vendorId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const vendor = vendorMap.get(vendorId);
          items.push({
            id: wo.id,
            woNumber: wo.woNumber,
            applicantName: wo.applicantName,
            status: woStatus,
            companyName: companyMap[wo.companyId],
            hasIssue,
            vendorId: vendor?.id ?? null,
            vendorName: vendor?.name ?? "Unassigned",
            vendorLogoUrl: vendor?.logoUrl ?? null,
          });
        }
      }
    }

    return items.sort((a, b) => {
      if (a.hasIssue !== b.hasIssue) return a.hasIssue ? -1 : 1;
      return 0;
    });
  }, [activeWorkOrders, vendors, companyMap]);

  const pipelineBreakdown = useMemo(() => {
    if (!workOrders) return { atVendor: 0, scheduled: 0, readyToSchedule: 0, needsAttention: 0, complete: 0 };
    let atVendor = 0, scheduled = 0, readyToSchedule = 0, needsAttention = 0, complete = 0;
    for (const wo of activeWorkOrders) {
      const pipeline = getPipelineInfo(wo.typingJobs, wo.appointments);
      const hasReturned = wo.typingJobs.some(j => j.status === "Returned" || j.status === "Rejected");
      if (hasReturned || pipeline.overall === "needs_attention") needsAttention++;
      else if (pipeline.overall === "at_vendor") atVendor++;
      else if (pipeline.overall === "scheduled") scheduled++;
      else if (pipeline.overall === "ready_to_schedule") readyToSchedule++;
      else if (pipeline.overall === "complete") complete++;
    }
    return { atVendor, scheduled, readyToSchedule, needsAttention, complete };
  }, [activeWorkOrders, workOrders]);

  const isLoading = companiesLoading || workOrdersLoading || appointmentsLoading;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-greeting">{getGreeting()}</p>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight" data-testid="text-user-greeting">
              Keystone Client Relation Manager Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <DashboardSwitcher active="crm" />}
            <Link href="/work-orders/new">
              <Button size="sm" className="gap-1.5" data-testid="button-new-work-order">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Work Order</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-5">

        {/* System-wide stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {isLoading ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                title="Active Work Orders"
                value={activeWorkOrders.length}
                icon={<Briefcase className="h-4 w-4" />}
                animationDelay={1}
                onClick={() => navigate("/work-orders")}
                data-testid="stat-active-work-orders"
              />
              <StatCard
                title="Today's Appointments"
                value={todayAppointments.length}
                icon={<Calendar className="h-4 w-4" />}
                animationDelay={2}
                onClick={() => navigate("/appointments")}
                data-testid="stat-today-appointments"
              />
              <StatCard
                title="Needs Attention"
                value={attentionWorkOrders.length}
                icon={<AlertTriangle className="h-4 w-4" />}
                animationDelay={3}
                data-testid="stat-attention-work-orders"
              />
              <StatCard
                title="Pending Typing Jobs"
                value={pendingTypingJobs}
                icon={<Clock className="h-4 w-4" />}
                animationDelay={4}
                onClick={() => navigate("/typing-jobs")}
                data-testid="stat-pending-typing-jobs"
              />
              <StatCard
                title="Vendor Wallet"
                value={`AED ${(dashStats?.walletBalance ?? 0).toLocaleString()}`}
                icon={<Wallet className="h-4 w-4" />}
                animationDelay={5}
                onClick={() => navigate("/vendor-wallet")}
                data-testid="stat-wallet-balance"
              />
            </>
          )}
        </div>

        {/* Pipeline Status Breakdown */}
        {!workOrdersLoading && (
          <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-1">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground tracking-tight">Pipeline Status Breakdown</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/20" data-testid="pipeline-stat-needs-attention">
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{pipelineBreakdown.needsAttention}</p>
                <p className="text-xs text-muted-foreground">Needs Attention</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20" data-testid="pipeline-stat-at-vendor">
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{pipelineBreakdown.atVendor}</p>
                <p className="text-xs text-muted-foreground">At Vendor</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20" data-testid="pipeline-stat-scheduled">
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{pipelineBreakdown.scheduled}</p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20" data-testid="pipeline-stat-ready">
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{pipelineBreakdown.readyToSchedule}</p>
                <p className="text-xs text-muted-foreground">Ready to Schedule</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/20" data-testid="pipeline-stat-complete">
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{pipelineBreakdown.complete}</p>
                <p className="text-xs text-muted-foreground">Complete</p>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Health + Quick Actions */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Pipeline Health */}
          <div className="lg:col-span-2 space-y-3 opacity-0 animate-fade-in animate-delay-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground tracking-tight">Needs Attention</h2>
                {!workOrdersLoading && (
                  <span className="text-xs text-muted-foreground tabular-nums">({attentionWorkOrders.length})</span>
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
              {workOrdersLoading ? (
                <>
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </>
              ) : attentionWorkOrders.length > 0 ? (
                attentionWorkOrders.slice(0, 6).map((wo, i) => {
                  const hasReturned = wo.typingJobs.some(j => j.status === "Returned" || j.status === "Rejected");
                  return (
                    <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                      <div
                        className="opacity-0 animate-fade-in"
                        style={{ animationDelay: `${i * 50 + 200}ms` }}
                      >
                        <DataTableRow>
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground text-sm" data-testid={`text-wo-number-${wo.id}`}>
                                  {wo.woNumber}
                                </span>
                                <StatusBadge status={wo.status} />
                                {hasReturned && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 rounded-full">
                                    Returned
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="truncate" data-testid={`text-wo-applicant-${wo.id}`}>
                                  {toProperCase(wo.applicantName)}
                                </span>
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
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  title="All clear"
                  description="No work orders need attention right now."
                  compact
                />
              )}
            </div>
          </div>

          {/* Quick Actions + Deletion Requests summary */}
          <div className="space-y-4 opacity-0 animate-fade-in animate-delay-3">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground tracking-tight">Quick Actions</h2>
              </div>
              <div className="space-y-2">
                <Link href="/work-orders/new">
                  <div className="premium-card p-3 cursor-pointer hover-elevate flex items-center gap-3" data-testid="quick-action-new-wo">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">New Work Order</p>
                      <p className="text-xs text-muted-foreground">Create for a client</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0" />
                  </div>
                </Link>
                <Link href="/appointments">
                  <div className="premium-card p-3 cursor-pointer hover-elevate flex items-center gap-3" data-testid="quick-action-appointments">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Appointments</p>
                      <p className="text-xs text-muted-foreground">Schedule & manage</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0" />
                  </div>
                </Link>
                <Link href="/companies">
                  <div className="premium-card p-3 cursor-pointer hover-elevate flex items-center gap-3" data-testid="quick-action-companies">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Companies</p>
                      <p className="text-xs text-muted-foreground">{companies?.length || 0} total</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0" />
                  </div>
                </Link>
                <Link href="/vendor-wallet">
                  <div className="premium-card p-3 cursor-pointer hover-elevate flex items-center gap-3" data-testid="quick-action-wallet">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Wallet className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Vendor Wallet</p>
                      <p className="text-xs text-muted-foreground">
                        AED {(dashStats?.walletBalance ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0" />
                  </div>
                </Link>
              </div>
            </div>

            {/* My deletion requests (CRM view) or pending queue (Admin view) */}
            {isAdmin && pendingDeletionRequests.length > 0 && (
              <div className="premium-card p-4 border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
                <div className="flex items-center gap-2 mb-2">
                  <Inbox className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-foreground">Deletion Requests</span>
                  <Badge className="text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0">
                    {pendingDeletionRequests.length} pending
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Awaiting your review in Admin panel.</p>
                <Link href="/admin?tab=deletionrequests">
                  <Button variant="outline" size="sm" className="w-full rounded-lg text-xs gap-1.5" data-testid="link-deletion-requests">
                    Review Requests
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}

            {/* Vendor Health — pending typing jobs per vendor + wallet status */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-foreground tracking-tight">Vendor Health</h2>
                </div>
                <Link href="/vendor-wallet">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" data-testid="link-vendor-wallet">
                    Wallet
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {/* Wallet balance summary */}
              <div className={cn(
                "premium-card p-3 mb-2 flex items-center justify-between gap-2",
                (dashStats?.walletBalance ?? 0) < 1000 && "border-red-200/50 bg-red-50/30 dark:bg-red-950/10"
              )} data-testid="card-wallet-balance">
                <div>
                  <p className="text-xs text-muted-foreground">Vendor Wallet Balance</p>
                  <p className={cn(
                    "text-lg font-bold",
                    (dashStats?.walletBalance ?? 0) < 1000 ? "text-red-600 dark:text-red-400" : "text-foreground"
                  )} data-testid="text-vendor-wallet-balance">
                    AED {(dashStats?.walletBalance ?? 0).toLocaleString()}
                  </p>
                </div>
                {(dashStats?.walletBalance ?? 0) < 1000 && (
                  <Badge variant="destructive" className="text-xs shrink-0">
                    <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                    Low Balance
                  </Badge>
                )}
              </div>
              {vendorTypingStats.length > 0 ? (
                <div className="space-y-2">
                  {vendorTypingStats.map(({ vendor, pending }) => (
                    <div
                      key={vendor.id}
                      className="premium-card p-3 flex items-center justify-between gap-3"
                      data-testid={`card-vendor-health-${vendor.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{vendor.name}</p>
                        <p className="text-xs text-muted-foreground">Active vendor</p>
                      </div>
                      <Badge
                        variant={pending >= 5 ? "destructive" : "secondary"}
                        className="text-xs shrink-0"
                        data-testid={`badge-vendor-pending-${vendor.id}`}
                      >
                        {pending} pending
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">No pending jobs at vendors</p>
              )}
            </div>
          </div>
        </div>

        {/* Today's All-Staff Appointments */}
        <div className="space-y-3 opacity-0 animate-fade-in animate-delay-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground tracking-tight">Today's Appointments</h2>
              {!appointmentsLoading && (
                <span className="text-xs text-muted-foreground tabular-nums">({todayAppointments.length})</span>
              )}
            </div>
            <Link href="/appointments">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-view-all-appointments">
                View All
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {appointmentsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : todayAppointments.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {todayAppointments.map((apt, i) => (
                <Link key={apt.id} href={`/work-orders/${apt.woId}`}>
                  <div
                    className="premium-card p-3 cursor-pointer hover-elevate opacity-0 animate-fade-in"
                    style={{ animationDelay: `${i * 40 + 200}ms` }}
                    data-testid={`card-apt-${apt.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-foreground" data-testid={`text-apt-time-${apt.id}`}>
                            {formatTime(apt.datetime)}
                          </span>
                          <StatusBadge status={apt.type} />
                        </div>
                        <p className="text-xs font-medium text-foreground truncate" data-testid={`text-apt-applicant-${apt.id}`}>
                          {toProperCase(apt.workOrder?.applicantName || "")}
                        </p>
                        <p className="text-xs text-muted-foreground truncate" data-testid={`text-apt-center-${apt.id}`}>
                          {apt.center?.name || apt.workOrder?.woNumber || "--"}
                        </p>
                        {apt.assignedStaff?.name && (
                          <p className="text-xs text-muted-foreground/70 truncate flex items-center gap-1" data-testid={`text-apt-staff-${apt.id}`}>
                            <Users className="h-2.5 w-2.5 shrink-0" />
                            {apt.assignedStaff.name}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Calendar className="h-6 w-6" />}
              title="No appointments today"
              description="No scheduled appointments for today across all staff."
              compact
            />
          )}
        </div>

        {/* Typing Jobs Grouped by Vendor */}
        <div className="space-y-3 opacity-0 animate-fade-in animate-delay-4" data-testid="section-vendor-grouped-jobs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground tracking-tight">Typing Jobs by Vendor</h2>
              {!workOrdersLoading && vendorJobItems.length > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">({vendorJobItems.length})</span>
              )}
            </div>
            <Link href="/typing-jobs">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-vendor-jobs-all">
                View All
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          {workOrdersLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          ) : (
            <VendorGroupedJobsView jobs={vendorJobItems} />
          )}
        </div>

        {/* Work Orders Pipeline + Companies Needing Attention */}
        <div className="grid lg:grid-cols-2 gap-4">

          {/* Active Work Orders — grouped by vendor */}
          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground tracking-tight">Active Pipeline</h2>
                {!workOrdersLoading && (
                  <span className="text-xs text-muted-foreground tabular-nums">({activeWorkOrders.length})</span>
                )}
              </div>
              <Link href="/work-orders">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-pipeline-all">
                  View All
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {workOrdersLoading ? (
                <>
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                </>
              ) : (
                <VendorGroupedWorkOrdersView workOrders={vendorWorkOrders} />
              )}
            </div>
          </div>

          {/* Companies Needing Attention */}
          <div className="space-y-3 opacity-0 animate-fade-in animate-delay-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground tracking-tight">Companies — Attention</h2>
                {!companiesLoading && (
                  <span className="text-xs text-muted-foreground tabular-nums">({companiesNeedingAttention.length})</span>
                )}
              </div>
              <Link href="/companies">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-view-all-companies">
                  All Companies
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {companiesLoading ? (
                <>
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </>
              ) : companiesNeedingAttention.length > 0 ? (
                companiesNeedingAttention.map((company, i) => (
                  <Link key={company.id} href={`/companies/${company.id}`}>
                    <div
                      className="premium-card p-3 cursor-pointer hover-elevate opacity-0 animate-fade-in border-red-200/60 dark:border-red-800/30"
                      style={{ animationDelay: `${i * 60 + 200}ms` }}
                      data-testid={`card-urgent-company-${company.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate" data-testid={`text-urgent-company-name-${company.id}`}>
                              {toProperCase(company.name)}
                            </p>
                            {company.hasExpiringDocs && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">Expiring documents</p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  title="All companies healthy"
                  description="No companies require immediate attention."
                  compact
                />
              )}
            </div>

            {/* My Deletion Requests */}
            <MyDeletionRequestsPanel />

            {/* System overview row */}
            <div className="premium-card p-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">System Overview</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Total Companies</p>
                  <p className="text-lg font-bold text-foreground" data-testid="text-total-companies">{companies?.length || 0}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Total Work Orders</p>
                  <p className="text-lg font-bold text-foreground" data-testid="text-total-work-orders">{workOrders?.length || 0}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Active Staff</p>
                  <p className="text-lg font-bold text-foreground" data-testid="text-active-staff">
                    {staffList.filter(s => s.status === "Active" || s.status === "TempActive").length}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Wallet Balance</p>
                  <p className="text-lg font-bold text-foreground" data-testid="text-wallet-balance">
                    AED {(dashStats?.walletBalance ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

function MyDeletionRequestsPanel() {
  const { data: requests = [], isLoading } = useQuery<DeletionRequest[]>({
    queryKey: ["/api/deletion-requests"],
  });

  if (isLoading) {
    return (
      <div className="premium-card p-4 mt-2">
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">My Deletion Requests</h3>
        </div>
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (requests.length === 0) return null;

  const pending = requests.filter(r => r.status === "pending");
  const reviewed = requests.filter(r => r.status !== "pending").slice(0, 5);

  return (
    <div className="premium-card p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Trash2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">My Deletion Requests</h3>
        {pending.length > 0 && (
          <Badge variant="secondary" className="text-xs">{pending.length} pending</Badge>
        )}
      </div>
      <div className="space-y-2">
        {[...pending, ...reviewed].map((req) => (
          <div
            key={req.id}
            className="p-3 rounded-lg bg-muted/30 border border-border/20 flex items-start justify-between gap-3"
            data-testid={`row-my-deletion-request-${req.id}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <Badge variant="outline" className="text-xs">{req.entityType}</Badge>
                <span className="text-xs text-muted-foreground truncate">{req.entityLabel}</span>
              </div>
              <p className="text-xs text-muted-foreground">Reason: {req.reason}</p>
              {req.reviewNote && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium">Admin note:</span> {req.reviewNote}
                </p>
              )}
            </div>
            <div className="shrink-0">
              {req.status === "pending" && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                  <Clock className="h-2.5 w-2.5 mr-1" />
                  Pending
                </Badge>
              )}
              {req.status === "approved" && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                  Approved
                </Badge>
              )}
              {req.status === "denied" && (
                <Badge variant="outline" className="text-xs text-destructive border-destructive/20 bg-destructive/5">
                  <BanIcon className="h-2.5 w-2.5 mr-1" />
                  Denied
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
