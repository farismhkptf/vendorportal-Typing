import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type VendorJobItem, type VendorWorkOrderItem } from "@/components/vendor-grouped-jobs-view";
import { type ActivityItem } from "@/components/ui/activity-timeline";
import { getPipelineInfo } from "@/lib/pipeline-stage";
import { isToday } from "@/lib/format-date";
import { queryKeys } from "@/lib/query-keys";
import type {
  WorkOrderEnriched, CompanyEnriched, AppointmentWithDetails,
  StaffMember, Vendor, DashStats, DeletionRequest,
} from "./types";

export function useCrmDashboardData() {
  const { data: companies, isLoading: companiesLoading, isError: companiesError, refetch: refetchCompanies } = useQuery<CompanyEnriched[]>({
    queryKey: queryKeys.companies,
  });

  const { data: workOrders, isLoading: workOrdersLoading, isError: workOrdersError, refetch: refetchWorkOrders } = useQuery<WorkOrderEnriched[]>({
    queryKey: queryKeys.workOrders,
  });

  const { data: allAppointments, isLoading: appointmentsLoading, isError: appointmentsError, refetch: refetchAppointments } = useQuery<AppointmentWithDetails[]>({
    queryKey: queryKeys.appointments,
  });

  const { data: dashStats } = useQuery<DashStats>({
    queryKey: queryKeys.dashboardStats,
    staleTime: 30000,
  });

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: queryKeys.staff,
  });

  const { data: deletionRequests = [] } = useQuery<DeletionRequest[]>({
    queryKey: queryKeys.deletionRequests,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: queryKeys.vendors,
  });

  const { data: allActivity = [], isLoading: activityLoading } = useQuery<ActivityItem[]>({
    queryKey: queryKeys.activity,
    staleTime: 30000,
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
    return deletionRequests.filter((r) => r.status === "pending");
  }, [deletionRequests]);

  const vendorTypingStats = useMemo(() => {
    if (!workOrders || !vendors.length) return [];
    const activeVendors = vendors.filter(v => v.status === "Active");
    return activeVendors.map(vendor => {
      const pending = workOrders.reduce((count, wo) => {
        return count + wo.typingJobs.filter((j) =>
          j.vendorId === vendor.id && (j.status === "SubmittedToVendor" || j.status === "InProcess")
        ).length;
      }, 0);
      return { vendor, pending };
    }).filter(v => v.pending > 0).sort((a, b) => b.pending - a.pending).slice(0, 5);
  }, [workOrders, vendors]);

  const companyMap = useMemo(() => {
    const map: Record<string, string> = {};
    (companies || []).forEach(c => { map[c.id] = c.name; });
    return map;
  }, [companies]);

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
            id: wo.id, woNumber: wo.woNumber, applicantName: wo.applicantName,
            status: woStatus, companyName: companyMap[wo.companyId],
            hasIssue, vendorId: null, vendorName: "Unassigned", vendorLogoUrl: null,
          });
        }
      } else {
        for (const vendorId of activeVendorIds) {
          const key = `${wo.id}::${vendorId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const vendor = vendorMap.get(vendorId);
          items.push({
            id: wo.id, woNumber: wo.woNumber, applicantName: wo.applicantName,
            status: woStatus, companyName: companyMap[wo.companyId],
            hasIssue, vendorId: vendor?.id ?? null,
            vendorName: vendor?.name ?? "Unassigned", vendorLogoUrl: vendor?.logoUrl ?? null,
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

  const walletBalance = dashStats?.walletBalance ?? 0;

  const recentActivity = useMemo(() => {
    if (!allActivity.length || !workOrders) return [];
    const woIds = new Set(workOrders.map(wo => wo.id));
    const tjIds = new Set(workOrders.flatMap(wo => wo.typingJobs.map(tj => tj.id)));
    const aptIds = new Set(
      workOrders.flatMap(wo => (wo.appointments || []).map(a => a.id))
    );
    return allActivity
      .filter(a => {
        if (!a.entityId) return false;
        if (a.entityType === "work_order") return woIds.has(a.entityId);
        if (a.entityType === "typing_job") return tjIds.has(a.entityId);
        if (a.entityType === "appointment") return aptIds.has(a.entityId);
        return false;
      })
      .slice(0, 15);
  }, [allActivity, workOrders]);

  return {
    companies, companiesLoading, companiesError, refetchCompanies,
    workOrders, workOrdersLoading, workOrdersError, refetchWorkOrders,
    appointmentsLoading, appointmentsError, refetchAppointments,
    staffList, vendors, walletBalance,
    activeWorkOrders, todayAppointments, attentionWorkOrders,
    pendingTypingJobs, companiesNeedingAttention, pendingDeletionRequests,
    vendorTypingStats, companyMap, vendorJobItems, vendorWorkOrders,
    pipelineBreakdown,
    recentActivity, activityLoading,
    isLoading: companiesLoading || workOrdersLoading || appointmentsLoading,
  };
}
