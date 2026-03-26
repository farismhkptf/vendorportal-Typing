import { Link, useLocation } from "wouter";
import {
  Calendar, ArrowRight, ChevronRight, AlertCircle,
  TrendingUp, CheckCircle2, Users, Send, LayoutGrid, Activity,
} from "lucide-react";
import { VendorGroupedJobsView, VendorGroupedWorkOrdersView, type VendorJobItem, type VendorWorkOrderItem } from "@/components/vendor-grouped-jobs-view";
import { ActivityTimeline, type ActivityItem } from "@/components/ui/activity-timeline";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toProperCase } from "@/lib/proper-case";
import { formatTime } from "@/lib/format-date";
import { MyDeletionRequestsPanel } from "./deletion-requests";
import type { AppointmentWithDetails, CompanyEnriched, StaffMember } from "./types";

interface TodayAppointmentsPanelProps {
  appointments: AppointmentWithDetails[];
  isLoading: boolean;
}

export function TodayAppointmentsPanel({ appointments, isLoading }: TodayAppointmentsPanelProps) {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-3 opacity-0 animate-fade-in animate-delay-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground tracking-tight">Today's Appointments</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground tabular-nums">({appointments.length})</span>
          )}
        </div>
        <Link href="/appointments">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-view-all-appointments">
            View All
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : appointments.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {appointments.map((apt, i) => (
            <div
              key={apt.id}
              className="premium-card p-3 cursor-pointer hover-elevate opacity-0 animate-fade-in"
              style={{ animationDelay: `${i * 40 + 200}ms` }}
              onClick={() => navigate(`/work-orders/${apt.woId}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/work-orders/${apt.woId}`); }}
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
          ))}
        </div>
      ) : (
        <EmptyState icon={<Calendar className="h-6 w-6" />} title="No appointments today" description="No scheduled appointments for today across all staff." compact />
      )}
    </div>
  );
}

interface VendorJobsSectionProps {
  jobs: VendorJobItem[];
  isLoading: boolean;
}

export function VendorJobsSection({ jobs, isLoading }: VendorJobsSectionProps) {
  return (
    <div className="space-y-3 opacity-0 animate-fade-in animate-delay-4" data-testid="section-vendor-grouped-jobs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground tracking-tight">Typing Jobs by Vendor</h2>
          {!isLoading && jobs.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">({jobs.length})</span>
          )}
        </div>
        <Link href="/typing-jobs">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="link-vendor-jobs-all">
            View All
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : (
        <VendorGroupedJobsView jobs={jobs} />
      )}
    </div>
  );
}

interface BottomGridProps {
  activeWorkOrders: { length: number };
  vendorWorkOrders: VendorWorkOrderItem[];
  companiesNeedingAttention: CompanyEnriched[];
  staffList: StaffMember[];
  totalCompanies: number;
  totalWorkOrders: number;
  walletBalance: number;
  workOrdersLoading: boolean;
  companiesLoading: boolean;
}

export function BottomGrid({
  activeWorkOrders, vendorWorkOrders, companiesNeedingAttention, staffList,
  totalCompanies, totalWorkOrders, walletBalance, workOrdersLoading, companiesLoading,
}: BottomGridProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
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
            <>{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</>
          ) : (
            <VendorGroupedWorkOrdersView workOrders={vendorWorkOrders} />
          )}
        </div>
      </div>

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
            <>{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</>
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
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="All companies healthy" description="No companies require immediate attention." compact />
          )}
        </div>

        <MyDeletionRequestsPanel />

        <div className="premium-card p-4 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">System Overview</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Total Companies</p>
              <p className="text-lg font-bold text-foreground" data-testid="text-total-companies">{totalCompanies}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Total Work Orders</p>
              <p className="text-lg font-bold text-foreground" data-testid="text-total-work-orders">{totalWorkOrders}</p>
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
                AED {walletBalance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CrmActivityPanelProps {
  activities: ActivityItem[];
  isLoading: boolean;
}

export function CrmActivityPanel({ activities, isLoading }: CrmActivityPanelProps) {
  return (
    <div className="space-y-3 opacity-0 animate-fade-in animate-delay-4" data-testid="section-crm-activity">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground tracking-tight">Recent Activity</h2>
        {!isLoading && activities.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">({activities.length})</span>
        )}
      </div>
      <div className="premium-card p-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : activities.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-5 w-5" />}
            title="No recent activity"
            description="Actions on your managed work orders will appear here."
            compact
          />
        ) : (
          <ActivityTimeline activities={activities} />
        )}
      </div>
    </div>
  );
}
