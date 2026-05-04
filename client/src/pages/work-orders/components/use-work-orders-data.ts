import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  getPipelineInfo, getMedicalStatus, getEidStatus, needsAttention,
  type PipelineStage,
} from "@/lib/pipeline-stage";
import { queryKeys } from "@/lib/query-keys";
import type { WorkOrder } from "@shared/schema";
import type { WorkOrderEnriched, SortByOption, SpecialFilter } from "./types";
import { type SortState } from "@/hooks/use-data-table";

const STATUS_ORDER = ["Draft", "AtVendor", "ReadyToSchedule", "Scheduled", "Completed", "Cancelled"] as const;
export { STATUS_ORDER };

export function useWorkOrdersData() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = urlParams.get("status") || "all";
  const initialPipeline = (urlParams.get("pipeline") || "all") as PipelineStage | "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [pipelineFilter, setPipelineFilter] = useState<PipelineStage | "all">(initialPipeline);
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>("all");
  const [sortBy, setSortBy] = useState<SortByOption>("newest");
  const [columnSort, setColumnSort] = useState<SortState>({ key: null, direction: null });
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const s = params.get("status");
    if (s) setStatusFilter(s);
    const p = params.get("pipeline");
    if (p) setPipelineFilter(p as PipelineStage | "all");
  }, [searchString]);

  const toggleColumnSort = useCallback((key: string) => {
    setColumnSort(prev => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" as const };
        if (prev.direction === "desc") return { key: null, direction: null };
      }
      return { key, direction: "asc" as const };
    });
  }, []);

  const { data: workOrders, isLoading, isError, refetch } = useQuery<WorkOrderEnriched[]>({
    queryKey: queryKeys.workOrders,
    staleTime: 0,
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: queryKeys.workOrderPhotos,
    staleTime: 60000,
  });

  const stats = useMemo(() => {
    if (!workOrders) return null;
    let awaitingTyping = 0, needScheduling = 0, attentionNeeded = 0, totalActive = 0, vipCount = 0;
    workOrders.forEach((wo) => {
      if (wo.status === "Cancelled") return;
      if (wo.status !== "Completed") totalActive++;
      if (wo.isVip && wo.status !== "Completed") vipCount++;
      const med = getMedicalStatus(wo);
      const eid = getEidStatus(wo);
      if ((med.hasMedical && (!med.typing || med.typing === "Draft" || med.typing === "SubmittedToVendor" || med.typing === "InProcess")) ||
          (eid.hasEid && (!eid.typing || eid.typing === "Draft" || eid.typing === "SubmittedToVendor" || eid.typing === "InProcess"))) awaitingTyping++;
      if ((med.hasMedical && (med.typing === "ReadyForScheduling" || med.typing === "Returned") && !med.appointment) ||
          (eid.hasEid && (eid.typing === "ReadyForScheduling" || eid.typing === "Returned") && !eid.appointment)) needScheduling++;
      if (needsAttention(wo)) attentionNeeded++;
    });
    return { awaitingTyping, needScheduling, attentionNeeded, totalActive, vipCount };
  }, [workOrders]);

  const pipelineCounts = useMemo(() => {
    if (!workOrders) return null;
    const counts: Record<PipelineStage | "all", number> = { all: 0, new: 0, at_vendor: 0, ready_to_schedule: 0, scheduled: 0, follow_up: 0, complete: 0, needs_attention: 0 };
    workOrders.forEach((wo) => {
      if (wo.status === "Cancelled") return;
      counts.all++;
      const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
      if (wo.status === "Completed") counts.complete++;
      else counts[pipeline.overall]++;
    });
    return counts;
  }, [workOrders]);

  const filteredAndSortedWorkOrders = useMemo(() => {
    let result = workOrders?.filter((wo) => {
      const matchesSearch = !search || wo.woNumber.toLowerCase().includes(search.toLowerCase()) || wo.applicantName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || wo.status === statusFilter;
      let matchesPipeline = true;
      if (pipelineFilter !== "all") {
        const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
        matchesPipeline = pipelineFilter === "complete"
          ? (wo.status === "Completed" || pipeline.overall === "complete")
          : (pipeline.overall === pipelineFilter && wo.status !== "Completed" && wo.status !== "Cancelled");
      }
      let matchesSpecial = true;
      if (specialFilter !== "all") {
        const med = getMedicalStatus(wo);
        const eid = getEidStatus(wo);
        switch (specialFilter) {
          case "needs_attention": matchesSpecial = needsAttention(wo); break;
          case "med_not_scheduled": matchesSpecial = med.hasMedical && !med.appointment && wo.status !== "Completed" && wo.status !== "Cancelled"; break;
          case "eid_not_scheduled": matchesSpecial = eid.hasEid && !eid.appointment && wo.status !== "Completed" && wo.status !== "Cancelled"; break;
          case "med_typing_pending": matchesSpecial = med.hasMedical && (!med.typing || med.typing === "Draft" || med.typing === "SubmittedToVendor"); break;
          case "eid_typing_pending": matchesSpecial = eid.hasEid && (!eid.typing || eid.typing === "Draft" || eid.typing === "SubmittedToVendor"); break;
          case "awaiting_typing": matchesSpecial = (med.hasMedical && (!med.typing || med.typing === "Draft" || med.typing === "SubmittedToVendor")) || (eid.hasEid && (!eid.typing || eid.typing === "Draft" || eid.typing === "SubmittedToVendor")); break;
          case "need_scheduling": matchesSpecial = (med.hasMedical && (med.typing === "ReadyForScheduling" || med.typing === "Returned") && !med.appointment) || (eid.hasEid && (eid.typing === "ReadyForScheduling" || eid.typing === "Returned") && !eid.appointment); break;
          case "vip": matchesSpecial = !!wo.isVip && wo.status !== "Completed" && wo.status !== "Cancelled"; break;
          case "completed": matchesSpecial = wo.status === "Completed"; break;
        }
      }
      let matchesDateRange = true;
      if (dateRangeFilter !== "all") {
        const now = new Date();
        const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0,0,0,0); return r; };
        const woDate = new Date(wo.createdAt);
        if (dateRangeFilter === "today") matchesDateRange = woDate >= startOfDay(now) && woDate < new Date(startOfDay(now).getTime() + 86400000);
        else if (dateRangeFilter === "week") { const wk = startOfDay(now); wk.setDate(wk.getDate() - wk.getDay()); matchesDateRange = woDate >= wk && woDate <= now; }
        else if (dateRangeFilter === "month") { const m = startOfDay(now); m.setDate(1); matchesDateRange = woDate >= m && woDate <= now; }
        else if (dateRangeFilter === "last_month") { const lmStart = startOfDay(now); lmStart.setDate(1); lmStart.setMonth(lmStart.getMonth() - 1); const lmEnd = startOfDay(now); lmEnd.setDate(0); lmEnd.setHours(23,59,59,999); matchesDateRange = woDate >= lmStart && woDate <= lmEnd; }
      }
      return matchesSearch && matchesStatus && matchesPipeline && matchesSpecial && matchesDateRange;
    });
    if (result) {
      result = [...result].sort((a, b) => {
        if (columnSort.key) {
          const dir = columnSort.direction === "desc" ? -1 : 1;
          switch (columnSort.key) {
            case "woNumber": return dir * a.woNumber.localeCompare(b.woNumber);
            case "applicant": return dir * a.applicantName.localeCompare(b.applicantName);
            case "company": return dir * (a.company?.name || "").localeCompare(b.company?.name || "");
            case "status": return dir * a.status.localeCompare(b.status);
            case "age": return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          }
        }
        switch (sortBy) {
          case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "wo_asc": return a.woNumber.localeCompare(b.woNumber);
          case "wo_desc": return b.woNumber.localeCompare(a.woNumber);
          case "applicant_asc": return a.applicantName.localeCompare(b.applicantName);
          case "applicant_desc": return b.applicantName.localeCompare(a.applicantName);
          default: return 0;
        }
      });
    }
    return result;
  }, [workOrders, search, statusFilter, dateRangeFilter, pipelineFilter, specialFilter, sortBy, columnSort]);

  const kanbanGroups = useMemo(() => {
    if (!filteredAndSortedWorkOrders) return null;
    const groups: Record<string, WorkOrderEnriched[]> = {};
    STATUS_ORDER.forEach(status => { groups[status] = []; });
    filteredAndSortedWorkOrders.forEach(wo => { if (groups[wo.status]) groups[wo.status].push(wo); });
    return groups;
  }, [filteredAndSortedWorkOrders]);

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[], status: string }) => {
      const res = await apiRequest("POST", "/api/work-orders/bulk-status", { ids, status });
      return res.json() as Promise<{ updated: number; failed: number; errors: string[] }>;
    },
    onMutate: async ({ ids, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workOrders });
      const previous = queryClient.getQueryData<WorkOrderEnriched[]>(queryKeys.workOrders);
      if (previous) {
        const idSet = new Set(ids);
        queryClient.setQueryData<WorkOrderEnriched[]>(queryKeys.workOrders, previous.map(wo => idSet.has(wo.id) ? { ...wo, status: status as WorkOrder["status"] } : wo));
      }
      return { previous };
    },
    onSuccess: (result) => {
      toast({ title: "Status updated", description: result.failed > 0 ? `${result.updated} updated, ${result.failed} failed.` : `${result.updated} work orders updated.`, variant: result.failed > 0 ? "destructive" : "default" });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.workOrders, context.previous);
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" });
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: queryKeys.workOrders }); },
  });

  const toggleVipMutation = useMutation({
    mutationFn: async ({ id, isVip }: { id: string; isVip: boolean }) => apiRequest("PUT", `/api/work-orders/${id}`, { isVip }),
    onSuccess: (_, variables) => { queryClient.invalidateQueries({ queryKey: queryKeys.workOrders }); toast({ title: variables.isVip ? "Marked as VIP" : "VIP removed" }); },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to update VIP status", variant: "destructive" }); },
  });

  const singleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => apiRequest("PUT", `/api/work-orders/${id}`, { status }),
    onSuccess: (_, variables) => { queryClient.invalidateQueries({ queryKey: queryKeys.workOrders }); toast({ title: "Status updated", description: `Work order set to ${variables.status}.` }); },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" }); },
  });

  const handleCopyWoNumber = useCallback((woNumber: string) => {
    navigator.clipboard.writeText(woNumber);
    toast({ title: "Copied", description: `${woNumber} copied to clipboard.` });
  }, [toast]);

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (specialFilter !== "all" ? 1 : 0) + (pipelineFilter !== "all" ? 1 : 0) + (dateRangeFilter !== "all" ? 1 : 0);
  const clearAllFilters = useCallback(() => { setStatusFilter("all"); setPipelineFilter("all"); setSpecialFilter("all"); setDateRangeFilter("all"); setSearch(""); }, []);

  return {
    search, setSearch, statusFilter, setStatusFilter, dateRangeFilter, setDateRangeFilter,
    pipelineFilter, setPipelineFilter, specialFilter, setSpecialFilter,
    sortBy, setSortBy, columnSort, toggleColumnSort,
    workOrders, isLoading, isError, refetch, photoMap,
    stats, pipelineCounts, filteredAndSortedWorkOrders, kanbanGroups,
    bulkStatusMutation, toggleVipMutation, singleStatusMutation,
    handleCopyWoNumber, activeFilterCount, clearAllFilters, toast,
  };
}
