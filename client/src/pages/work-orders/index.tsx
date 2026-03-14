import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { 
  Plus, Search, FileText, Building2, Filter, ArrowUpDown, 
  List, LayoutGrid, Columns3, Table2, Star, Tag,
  Clock, AlertTriangle, CheckCircle2, CircleDot, 
  Stethoscope, Fingerprint, CalendarCheck, Send as SendIcon,
  Loader2, Download, Circle, ArrowRight
} from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { useDataTable, type SortState, type ColumnDef } from "@/hooks/use-data-table";
import { ColumnVisibilityDropdown } from "@/components/ui/column-visibility";
import { toProperCase } from "@/lib/proper-case";
import { getPipelineInfo, getNextAction, STAGE_CONFIG, PIPELINE_STEPS, type PipelineStage } from "@/lib/pipeline-stage";
import type { WorkOrder, Company, Appointment, TypingJob, JobType, ServiceType } from "@shared/schema";

interface TypingJobWithType extends TypingJob {
  jobType?: JobType | null;
}

interface WorkOrderEnriched extends WorkOrder {
  company?: Company;
  serviceType?: ServiceType;
  typingJobs?: TypingJobWithType[];
  appointments?: Appointment[];
}

type ViewMode = "compact" | "cards" | "table" | "kanban";
type SortByOption = "newest" | "oldest" | "wo_asc" | "wo_desc" | "applicant_asc" | "applicant_desc";
type SpecialFilter = "all" | "needs_attention" | "med_not_scheduled" | "eid_not_scheduled" | "med_typing_pending" | "eid_typing_pending" | "awaiting_typing" | "need_scheduling" | "vip" | "completed";

const STATUS_ORDER = ["Delayed", "Draft", "Scheduled", "Completed", "Cancelled"] as const;

type MedEidStatus = "not_started" | "typing_pending" | "typing_sent" | "typing_returned" | "typing_done" | "appt_scheduled" | "appt_done" | "complete";

function getMedicalStatus(wo: WorkOrderEnriched): { typing: string | null; appointment: string | null; hasMedical: boolean } {
  const medTypingJobs = (wo.typingJobs || []).filter(j => j.jobType?.category === "Medical");
  const medAppointments = (wo.appointments || []).filter(a => a.type === "Medical" && a.status !== "Cancelled" && a.status !== "Rescheduled");
  
  const hasMedical = medTypingJobs.length > 0 || medAppointments.length > 0;
  
  let typing: string | null = null;
  if (medTypingJobs.length > 0) {
    const sorted = [...medTypingJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    typing = sorted[0].status;
  }

  let appointment: string | null = null;
  if (medAppointments.length > 0) {
    const sorted = [...medAppointments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    appointment = sorted[0].status;
  }

  return { typing, appointment, hasMedical };
}

function getEidStatus(wo: WorkOrderEnriched): { typing: string | null; appointment: string | null; hasEid: boolean } {
  const eidTypingJobs = (wo.typingJobs || []).filter(j => j.jobType?.category === "EID");
  const eidAppointments = (wo.appointments || []).filter(a => a.type === "EID" && a.status !== "Cancelled" && a.status !== "Rescheduled");
  
  const hasEid = eidTypingJobs.length > 0 || eidAppointments.length > 0;
  
  let typing: string | null = null;
  if (eidTypingJobs.length > 0) {
    const sorted = [...eidTypingJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    typing = sorted[0].status;
  }

  let appointment: string | null = null;
  if (eidAppointments.length > 0) {
    const sorted = [...eidAppointments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    appointment = sorted[0].status;
  }

  return { typing, appointment, hasEid };
}

function getScheduledDisplayStatus(wo: WorkOrderEnriched): string {
  if (wo.status === "Delayed") return "Delayed";
  if (wo.status !== "Scheduled") return wo.status;
  const med = getMedicalStatus(wo);
  const eid = getEidStatus(wo);
  const medScheduled = med.hasMedical && (med.appointment === "Scheduled" || med.appointment === "Completed");
  const eidScheduled = eid.hasEid && (eid.appointment === "Scheduled" || eid.appointment === "Completed");
  if (medScheduled && eidScheduled) return "BothScheduled";
  if (medScheduled) return "MedScheduled";
  if (eidScheduled) return "EIDScheduled";
  const st = wo.serviceType;
  const hasMedService = st && (st.requiresMedicalTyping || st.requiresMedicalScheduling);
  const hasEidService = st && (st.requiresIdTyping2Years || st.requiresIdTyping1Year || st.requiresIdTyping10Years || st.requiresIdBiometrics);
  if (hasMedService && hasEidService) return "BothScheduled";
  if (hasMedService) return "MedScheduled";
  if (hasEidService) return "EIDScheduled";
  return "Scheduled";
}

function needsAttention(wo: WorkOrderEnriched): boolean {
  if (wo.status === "Completed" || wo.status === "Cancelled") return false;
  const med = getMedicalStatus(wo);
  const eid = getEidStatus(wo);
  if (med.hasMedical && (med.typing === "ReadyForScheduling" || med.typing === "Returned") && !med.appointment) return true;
  if (eid.hasEid && (eid.typing === "ReadyForScheduling" || eid.typing === "Returned") && !eid.appointment) return true;
  const daysOld = Math.floor((Date.now() - new Date(wo.createdAt).getTime()) / 86400000);
  if (daysOld > 7 && wo.status === "Draft") return true;
  return false;
}

function getProgressPercent(wo: WorkOrderEnriched): number {
  const med = getMedicalStatus(wo);
  const eid = getEidStatus(wo);
  let total = 0;
  let done = 0;
  if (med.hasMedical) {
    total += 2;
    if (med.typing === "ReadyForScheduling" || med.typing === "Returned") done += 1;
    if (med.appointment === "Completed") done += 1;
    else if (med.appointment === "Scheduled") done += 0.5;
  }
  if (eid.hasEid) {
    total += 2;
    if (eid.typing === "ReadyForScheduling" || eid.typing === "Returned") done += 1;
    if (eid.appointment === "Completed") done += 1;
    else if (eid.appointment === "Scheduled") done += 0.5;
  }
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

function getCardBorderColor(wo: WorkOrderEnriched): string {
  if (wo.status === "Delayed") return "border-l-red-600 dark:border-l-red-500";
  if (wo.status === "Completed") return "border-l-emerald-500";
  if (wo.status === "Cancelled") return "border-l-gray-300 dark:border-l-gray-600";
  if (needsAttention(wo)) return "border-l-red-500";
  const progress = getProgressPercent(wo);
  if (progress > 0) return "border-l-blue-500";
  return "border-l-slate-300 dark:border-l-slate-600";
}

function getDelayedElapsedText(wo: WorkOrderEnriched): string | null {
  if (wo.status !== "Delayed") return null;
  const jobs = (wo.typingJobs || []).filter(
    (j: any) => (j.status === "SubmittedToVendor" || j.status === "InProcess") && j.sentAt
  );
  if (jobs.length === 0) return "Vendor overdue";
  const firstSentAt = new Date(String(jobs[0].sentAt));
  const oldest = jobs.reduce((min: Date, j: any) => {
    const d = new Date(String(j.sentAt));
    return d < min ? d : min;
  }, firstSentAt);
  const hoursElapsed = Math.floor((Date.now() - oldest.getTime()) / (1000 * 60 * 60));
  if (hoursElapsed < 48) return `Vendor overdue (${hoursElapsed}h)`;
  const days = Math.floor(hoursElapsed / 24);
  return `Vendor overdue (${days}d ${hoursElapsed % 24}h)`;
}

function getDaysOld(date: string | Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function TypingStatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-muted-foreground/50">--</span>;
  const styles: Record<string, { bg: string; label: string }> = {
    Draft: { bg: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", label: "Draft" },
    SubmittedToVendor: { bg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300", label: "At Vendor" },
    InProcess: { bg: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300", label: "In Process" },
    ReadyForScheduling: { bg: "bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-300", label: "Ready for Scheduling" },
    Returned: { bg: "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300", label: "Returned" },
    Aborted: { bg: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", label: "Aborted" },
  };
  const s = styles[status] || { bg: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", label: status };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg}`} data-testid={`pill-typing-${status.toLowerCase()}`}>
      {s.label}
    </span>
  );
}

function AppointmentStatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-muted-foreground/50">--</span>;
  const styles: Record<string, { bg: string; label: string }> = {
    Scheduled: { bg: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300", label: "Scheduled" },
    Completed: { bg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300", label: "Done" },
    Cancelled: { bg: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", label: "Cancelled" },
  };
  const s = styles[status] || { bg: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", label: status };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg}`} data-testid={`pill-appt-${status.toLowerCase()}`}>
      {s.label}
    </span>
  );
}

function PipelineStageBadge({ stage }: { stage: PipelineStage }) {
  const config = STAGE_CONFIG[stage];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${config.bgColor} ${config.color}`}
      data-testid={`badge-pipeline-${stage}`}
    >
      {config.label}
    </span>
  );
}

function NextActionIndicator({ message, variant }: { message: string; variant: string }) {
  const variantStyles: Record<string, string> = {
    action: "text-blue-600 dark:text-blue-400",
    warning: "text-red-600 dark:text-red-400",
    success: "text-emerald-600 dark:text-emerald-400",
    info: "text-muted-foreground",
  };
  return (
    <span className={`text-[10px] ${variantStyles[variant] || variantStyles.info} truncate`} data-testid="text-next-action">
      {message}
    </span>
  );
}

function MedEidStatusRow({ icon: Icon, label, typing, appointment, hasData, summaryLabel }: {
  icon: typeof Stethoscope;
  label: string;
  typing: string | null;
  appointment: string | null;
  hasData: boolean;
  summaryLabel?: string | null;
}) {
  if (!hasData && !summaryLabel) return null;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-10 shrink-0">{label}</span>
      {hasData ? (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground/60 text-[9px]">T:</span>
          <TypingStatusPill status={typing} />
          <span className="text-muted-foreground/60 text-[9px] ml-1">A:</span>
          <AppointmentStatusPill status={appointment} />
        </div>
      ) : summaryLabel ? (
        <span className="text-muted-foreground/60 italic">{summaryLabel}</span>
      ) : null}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  if (percent === 0) return null;
  return (
    <div className="w-full h-1 bg-muted/50 rounded-full overflow-hidden" data-testid="progress-bar">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          percent >= 100 ? "bg-emerald-500" : percent > 50 ? "bg-blue-500" : "bg-amber-500"
        }`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function WorkOrdersList() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = urlParams.get("status") || "all";
  const initialPipeline = (urlParams.get("pipeline") || "all") as PipelineStage | "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const s = params.get("status");
    if (s) setStatusFilter(s);
    const p = params.get("pipeline");
    if (p) setPipelineFilter(p as PipelineStage | "all");
  }, [searchString]);
  const [pipelineFilter, setPipelineFilter] = useState<PipelineStage | "all">(initialPipeline);
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>("all");
  const [sortBy, setSortBy] = useState<SortByOption>("newest");
  const [columnSort, setColumnSort] = useState<SortState>({ key: null, direction: null });
  const toggleColumnSort = useCallback((key: string) => {
    setColumnSort(prev => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" as const };
        if (prev.direction === "desc") return { key: null, direction: null };
      }
      return { key, direction: "asc" as const };
    });
  }, []);
  const { toast } = useToast();

  const { data: workOrders, isLoading } = useQuery<WorkOrderEnriched[]>({
    queryKey: ["/api/work-orders"],
    staleTime: 0,
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: ["/api/work-orders/photos"],
    staleTime: 60000,
  });

  const stats = useMemo(() => {
    if (!workOrders) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let awaitingTyping = 0;
    let needScheduling = 0;
    let attentionNeeded = 0;
    let totalActive = 0;
    let vipCount = 0;

    workOrders.forEach((wo) => {
      const woStatus = wo.status as string;
      if (woStatus === "Cancelled") return;
      if (woStatus !== "Completed") totalActive++;
      if (wo.isVip && woStatus !== "Completed" && woStatus !== "Cancelled") vipCount++;

      const med = getMedicalStatus(wo);
      const eid = getEidStatus(wo);

      if (med.hasMedical && (!med.typing || med.typing === "Draft" || med.typing === "SubmittedToVendor")) awaitingTyping++;
      if (eid.hasEid && (!eid.typing || eid.typing === "Draft" || eid.typing === "SubmittedToVendor")) awaitingTyping++;

      if (med.hasMedical && (med.typing === "ReadyForScheduling" || med.typing === "Returned") && !med.appointment) needScheduling++;
      if (eid.hasEid && (eid.typing === "ReadyForScheduling" || eid.typing === "Returned") && !eid.appointment) needScheduling++;

      if (needsAttention(wo)) attentionNeeded++;
    });

    return { awaitingTyping, needScheduling, attentionNeeded, totalActive, vipCount };
  }, [workOrders]);

  const pipelineCounts = useMemo(() => {
    if (!workOrders) return null;
    const counts: Record<PipelineStage | "all", number> = {
      all: 0,
      new: 0,
      at_vendor: 0,
      ready_to_schedule: 0,
      scheduled: 0,
      follow_up: 0,
      complete: 0,
      needs_attention: 0,
    };
    workOrders.forEach((wo) => {
      if (wo.status === "Cancelled") return;
      counts.all++;
      const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
      if (wo.status === "Completed") {
        counts.complete++;
      } else {
        counts[pipeline.overall]++;
      }
    });
    return counts;
  }, [workOrders]);

  const filteredAndSortedWorkOrders = useMemo(() => {
    let result = workOrders?.filter((wo) => {
      const matchesSearch = !search || 
        wo.woNumber.toLowerCase().includes(search.toLowerCase()) ||
        wo.applicantName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || wo.status === statusFilter;

      let matchesPipeline = true;
      if (pipelineFilter !== "all") {
        const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
        if (pipelineFilter === "complete") {
          matchesPipeline = wo.status === "Completed" || pipeline.overall === "complete";
        } else {
          matchesPipeline = pipeline.overall === pipelineFilter && wo.status !== "Completed" && wo.status !== "Cancelled";
        }
      }

      let matchesSpecial = true;
      if (specialFilter !== "all") {
        const med = getMedicalStatus(wo);
        const eid = getEidStatus(wo);
        switch (specialFilter) {
          case "needs_attention":
            matchesSpecial = needsAttention(wo);
            break;
          case "med_not_scheduled":
            matchesSpecial = med.hasMedical && !med.appointment && wo.status !== "Completed" && wo.status !== "Cancelled";
            break;
          case "eid_not_scheduled":
            matchesSpecial = eid.hasEid && !eid.appointment && wo.status !== "Completed" && wo.status !== "Cancelled";
            break;
          case "med_typing_pending":
            matchesSpecial = med.hasMedical && (!med.typing || med.typing === "Draft" || med.typing === "SubmittedToVendor");
            break;
          case "eid_typing_pending":
            matchesSpecial = eid.hasEid && (!eid.typing || eid.typing === "Draft" || eid.typing === "SubmittedToVendor");
            break;
          case "awaiting_typing":
            matchesSpecial = 
              (med.hasMedical && (!med.typing || med.typing === "Draft" || med.typing === "SubmittedToVendor")) ||
              (eid.hasEid && (!eid.typing || eid.typing === "Draft" || eid.typing === "SubmittedToVendor"));
            break;
          case "need_scheduling":
            matchesSpecial = 
              (med.hasMedical && (med.typing === "ReadyForScheduling" || med.typing === "Returned") && !med.appointment) ||
              (eid.hasEid && (eid.typing === "ReadyForScheduling" || eid.typing === "Returned") && !eid.appointment);
            break;
          case "vip":
            matchesSpecial = !!wo.isVip && wo.status !== "Completed" && wo.status !== "Cancelled";
            break;
          case "completed":
            matchesSpecial = wo.status === "Completed";
            break;
        }
      }

      let matchesDateRange = true;
      if (dateRangeFilter !== "all") {
        const now = new Date();
        const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0,0,0,0); return r; };
        const woDate = new Date(wo.createdAt);
        if (dateRangeFilter === "today") {
          matchesDateRange = woDate >= startOfDay(now) && woDate < new Date(startOfDay(now).getTime() + 86400000);
        } else if (dateRangeFilter === "week") {
          const wk = startOfDay(now); wk.setDate(wk.getDate() - wk.getDay());
          matchesDateRange = woDate >= wk && woDate <= now;
        } else if (dateRangeFilter === "month") {
          const m = startOfDay(now); m.setDate(1);
          matchesDateRange = woDate >= m && woDate <= now;
        } else if (dateRangeFilter === "last_month") {
          const lmStart = startOfDay(now); lmStart.setDate(1); lmStart.setMonth(lmStart.getMonth() - 1);
          const lmEnd = startOfDay(now); lmEnd.setDate(0); lmEnd.setHours(23,59,59,999);
          matchesDateRange = woDate >= lmStart && woDate <= lmEnd;
        }
      }

      return matchesSearch && matchesStatus && matchesPipeline && matchesSpecial && matchesDateRange;
    });
    
    if (result) {
      result = [...result].sort((a, b) => {
        if (columnSort.key) {
          const dir = columnSort.direction === "desc" ? -1 : 1;
          switch (columnSort.key) {
            case "woNumber":
              return dir * a.woNumber.localeCompare(b.woNumber);
            case "applicant":
              return dir * a.applicantName.localeCompare(b.applicantName);
            case "company":
              return dir * ((a as any).company?.name || "").localeCompare((b as any).company?.name || "");
            case "status":
              return dir * a.status.localeCompare(b.status);
            case "age":
              return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          }
        }
        switch (sortBy) {
          case "newest":
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case "oldest":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "wo_asc":
            return a.woNumber.localeCompare(b.woNumber);
          case "wo_desc":
            return b.woNumber.localeCompare(a.woNumber);
          case "applicant_asc":
            return a.applicantName.localeCompare(b.applicantName);
          case "applicant_desc":
            return b.applicantName.localeCompare(a.applicantName);
          default:
            return 0;
        }
      });
    }
    
    return result;
  }, [workOrders, search, statusFilter, dateRangeFilter, pipelineFilter, specialFilter, sortBy, columnSort]);

  const getId = useCallback((wo: WorkOrderEnriched) => wo.id, []);

  const woColumns: ColumnDef[] = useMemo(() => [
    { id: "woNumber", label: "WO #" },
    { id: "applicant", label: "Applicant" },
    { id: "company", label: "Company" },
    { id: "service", label: "Service" },
    { id: "pipeline", label: "Pipeline" },
    { id: "status", label: "Status" },
    { id: "medical", label: "Medical" },
    { id: "eid", label: "EID" },
    { id: "age", label: "Age" },
    { id: "nextAction", label: "Next Action" },
  ], []);

  const dt = useDataTable(filteredAndSortedWorkOrders, {
    storageKey: "wo_list",
    defaultPageSize: 25,
    defaultViewMode: "cards",
    getId,
    columns: woColumns,
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[], status: string }) => {
      const res = await apiRequest("POST", "/api/work-orders/bulk-status", { ids, status });
      return res.json() as Promise<{ updated: number; failed: number; errors: string[] }>;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      dt.clearSelection();
      const desc = result.failed > 0
        ? `${result.updated} updated to ${variables.status}, ${result.failed} failed.`
        : `${result.updated} work orders updated to ${variables.status}.`;
      toast({ title: "Status updated", description: desc, variant: result.failed > 0 ? "destructive" : "default" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update work orders", variant: "destructive" });
    },
  });

  const viewMode = dt.viewMode as ViewMode;

  const isKanban = viewMode === "kanban";
  const displayItems = isKanban ? (filteredAndSortedWorkOrders || []) : dt.paginatedData;

  const kanbanGroups = useMemo(() => {
    if (!filteredAndSortedWorkOrders) return null;
    const groups: Record<string, WorkOrderEnriched[]> = {};
    STATUS_ORDER.forEach(status => { groups[status] = []; });
    filteredAndSortedWorkOrders.forEach(wo => {
      if (groups[wo.status]) {
        groups[wo.status].push(wo);
      }
    });
    return groups;
  }, [filteredAndSortedWorkOrders]);

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (specialFilter !== "all" ? 1 : 0) + (pipelineFilter !== "all" ? 1 : 0) + (dateRangeFilter !== "all" ? 1 : 0);

  const clearAllFilters = useCallback(() => {
    setStatusFilter("all");
    setPipelineFilter("all");
    setSpecialFilter("all");
    setDateRangeFilter("all");
    setSearch("");
  }, []);

  const renderPipelineButtons = () => {
    if (!pipelineCounts) return null;
    const stages: { key: PipelineStage | "all"; label: string; icon: typeof Circle; color: string; bgColor: string }[] = [
      { key: "all", label: "All", icon: FileText, color: "text-foreground", bgColor: "bg-muted" },
      { key: "new", label: "New", icon: Circle, color: STAGE_CONFIG.new.color, bgColor: STAGE_CONFIG.new.bgColor },
      { key: "at_vendor", label: "At Vendor", icon: SendIcon, color: STAGE_CONFIG.at_vendor.color, bgColor: STAGE_CONFIG.at_vendor.bgColor },
      { key: "ready_to_schedule", label: "Ready to Schedule", icon: CalendarCheck, color: STAGE_CONFIG.ready_to_schedule.color, bgColor: STAGE_CONFIG.ready_to_schedule.bgColor },
      { key: "scheduled", label: "Scheduled", icon: CheckCircle2, color: STAGE_CONFIG.scheduled.color, bgColor: STAGE_CONFIG.scheduled.bgColor },
      { key: "complete", label: "Complete", icon: CheckCircle2, color: STAGE_CONFIG.complete.color, bgColor: STAGE_CONFIG.complete.bgColor },
      { key: "needs_attention", label: "Attention", icon: AlertTriangle, color: STAGE_CONFIG.needs_attention.color, bgColor: STAGE_CONFIG.needs_attention.bgColor },
    ];

    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="pipeline-filter-buttons">
        {stages.map((s) => {
          const count = pipelineCounts[s.key];
          const isActive = pipelineFilter === s.key;
          return (
            <Button
              key={s.key}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              className={`gap-1.5 shrink-0 ${isActive ? "ring-1 ring-primary/20" : ""}`}
              onClick={() => setPipelineFilter(isActive ? "all" : s.key)}
              data-testid={`button-pipeline-${s.key}`}
            >
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              <span>{s.label}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? s.bgColor : "bg-muted"}`}>
                {count}
              </span>
            </Button>
          );
        })}
      </div>
    );
  };

  const renderStatTiles = () => {
    if (!stats) return null;
    const tiles = [
      { 
        label: "Active", 
        value: stats.totalActive, 
        icon: FileText, 
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-900/30",
        filter: "all" as SpecialFilter
      },
      { 
        label: "Needs Action", 
        value: stats.attentionNeeded, 
        icon: AlertTriangle, 
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-900/30",
        filter: "needs_attention" as SpecialFilter
      },
      { 
        label: "Awaiting Typing", 
        value: stats.awaitingTyping, 
        icon: SendIcon, 
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-50 dark:bg-indigo-900/30",
        filter: "awaiting_typing" as SpecialFilter
      },
      { 
        label: "Need Scheduling", 
        value: stats.needScheduling, 
        icon: CalendarCheck, 
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-900/30",
        filter: "need_scheduling" as SpecialFilter
      },
      { 
        label: "VIP Cases", 
        value: stats.vipCount, 
        icon: Star, 
        color: "text-yellow-600 dark:text-yellow-400",
        bg: "bg-yellow-50 dark:bg-yellow-900/30",
        filter: "vip" as SpecialFilter
      },
    ];

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((tile) => (
          <Card
            key={tile.label}
            className={`p-3 cursor-pointer hover-elevate border border-border/50 ${
              specialFilter === tile.filter && tile.filter !== "all" ? "ring-2 ring-primary/30" : ""
            }`}
            onClick={() => {
              if (tile.filter === "all") {
                setSpecialFilter("all");
              } else {
                setSpecialFilter(specialFilter === tile.filter ? "all" : tile.filter);
              }
            }}
            data-testid={`stat-tile-${tile.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${tile.bg}`}>
                <tile.icon className={`h-3.5 w-3.5 ${tile.color}`} />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground leading-none">{tile.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{tile.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderCardItem = (wo: WorkOrderEnriched, index: number) => {
    const med = getMedicalStatus(wo);
    const eid = getEidStatus(wo);
    const daysOld = getDaysOld(wo.createdAt);
    const attention = needsAttention(wo);
    const progress = getProgressPercent(wo);
    const borderColor = getCardBorderColor(wo);
    const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
    const nextAction = getNextAction(wo.typingJobs || [], wo.appointments || [], pipeline);
    const delayedText = getDelayedElapsedText(wo);
    const isDelayed = wo.status === "Delayed";

    const st = wo.serviceType;
    const showMed = med.hasMedical || (st && (st.requiresMedicalTyping || st.requiresMedicalScheduling));
    const showEid = eid.hasEid || (st && (st.requiresIdTyping2Years || st.requiresIdTyping1Year || st.requiresIdTyping10Years || st.requiresIdBiometrics));

    const medLabel = showMed
      ? (med.hasMedical ? (med.appointment === "Completed" ? "Done" : med.appointment ? "Scheduled" : med.typing ? (med.typing === "ReadyForScheduling" || med.typing === "Returned" ? "Ready" : "Typing") : "Pending") : "Not started")
      : null;
    const eidLabel = showEid
      ? (eid.hasEid ? (eid.appointment === "Completed" ? "Done" : eid.appointment ? "Scheduled" : eid.typing ? (eid.typing === "ReadyForScheduling" || eid.typing === "Returned" ? "Ready" : "Typing") : "Pending") : "Not started")
      : null;

    const isSelected = dt.selectedIds.has(wo.id);
    const isComfortable = dt.density === "comfortable";

    return (
      <div key={wo.id} className="flex items-start gap-2">
        <div className="pt-4 shrink-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => dt.toggleSelected(wo.id)}
            aria-label={`Select ${wo.woNumber}`}
            data-testid={`checkbox-wo-${wo.woNumber}`}
          />
        </div>
        <Link href={`/work-orders/${wo.id}`} className="flex-1 min-w-0">
          <div 
            className={`premium-card ${isComfortable ? "p-4" : "p-2.5"} border-l-[3px] ${borderColor} opacity-0 animate-fade-in ${isDelayed ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
            style={{ animationDelay: `${index * 0.03}s` }}
            data-testid={`work-order-card-${wo.woNumber}`}
          >
            <div className="flex items-start justify-between gap-3">
              <Avatar className="h-9 w-9 shrink-0" data-testid={`avatar-wo-${wo.woNumber}`}>
                {photoMap?.[wo.id] ? (
                  <AvatarImage src={photoMap[wo.id]} alt={wo.applicantName} />
                ) : null}
                <AvatarFallback className="text-xs font-medium">{getInitials(wo.applicantName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold text-sm text-foreground">{wo.woNumber}</span>
                  <PipelineStageBadge stage={wo.status === "Completed" ? "complete" : pipeline.overall} />
                  {wo.isVip && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 rounded-full px-1.5 py-0 text-[10px]">
                      <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                      VIP
                    </Badge>
                  )}
                  {attention && !isDelayed && (
                    <Badge variant="secondary" className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 rounded-full px-1.5 py-0 text-[10px]">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      Action needed
                    </Badge>
                  )}
                  {isDelayed && (
                    <Badge variant="secondary" className="bg-red-600 text-white dark:bg-red-700 dark:text-red-100 rounded-full px-1.5 py-0 text-[10px] animate-pulse">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      DELAYED
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">{toProperCase(wo.applicantName)}</p>
                <div className="flex items-center gap-3 flex-wrap mt-0.5">
                  {wo.company && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{toProperCase(wo.company.name)}</span>
                    </div>
                  )}
                  {st && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground/70" data-testid={`wo-service-type-${wo.woNumber}`}>
                      <Tag className="h-3 w-3" />
                      <span className="truncate">{st.name}</span>
                    </div>
                  )}
                </div>
                {isDelayed && delayedText && (
                  <div className="flex items-center gap-1 mt-1" data-testid={`delayed-indicator-${wo.woNumber}`}>
                    <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400 shrink-0" />
                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">{delayedText}</span>
                  </div>
                )}
                {!isDelayed && nextAction.variant !== "success" && (
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <NextActionIndicator message={nextAction.message} variant={nextAction.variant} />
                  </div>
                )}
              </div>
              <div className="text-right shrink-0 space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                  <Clock className="h-3 w-3" />
                  <span>{daysOld === 0 ? "Today" : `${daysOld}d`}</span>
                </div>
              </div>
            </div>

            {isComfortable && (showMed || showEid) && (
              <div className="mt-3 pt-2.5 border-t border-border/30 space-y-1.5">
                {showMed && (
                  <MedEidStatusRow
                    icon={Stethoscope}
                    label="Med"
                    typing={med.typing}
                    appointment={med.appointment}
                    hasData={med.hasMedical}
                    summaryLabel={medLabel}
                  />
                )}
                {showEid && (
                  <MedEidStatusRow
                    icon={Fingerprint}
                    label="EID"
                    typing={eid.typing}
                    appointment={eid.appointment}
                    hasData={eid.hasEid}
                    summaryLabel={eidLabel}
                  />
                )}
                <ProgressBar percent={progress} />
              </div>
            )}
          </div>
        </Link>
      </div>
    );
  };

  const renderCards = (items: WorkOrderEnriched[]) => (
    <div className="space-y-2 stagger-children">
      {items.map((wo, index) => renderCardItem(wo, index))}
    </div>
  );

  const renderCompactList = (items: WorkOrderEnriched[]) => (
    <div className="space-y-1 stagger-children">
      {items.map((wo, index) => {
        const med = getMedicalStatus(wo);
        const eid = getEidStatus(wo);
        const attention = needsAttention(wo);
        const borderColor = getCardBorderColor(wo);
        const isSelected = dt.selectedIds.has(wo.id);
        const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
        return (
          <div key={wo.id} className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => dt.toggleSelected(wo.id)}
              aria-label={`Select ${wo.woNumber}`}
              data-testid={`checkbox-wo-compact-${wo.woNumber}`}
            />
            <Link href={`/work-orders/${wo.id}`} className="flex-1 min-w-0">
              <div 
                className={`flex items-center justify-between gap-3 ${dt.density === "comfortable" ? "py-2 px-3" : "py-1.5 px-2"} rounded-lg hover-elevate border-l-[3px] ${borderColor} opacity-0 animate-fade-in`}
                style={{ animationDelay: `${index * 0.02}s` }}
                data-testid={`work-order-compact-${wo.woNumber}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-wo-compact-${wo.woNumber}`}>
                    {photoMap?.[wo.id] ? (
                      <AvatarImage src={photoMap[wo.id]} alt={wo.applicantName} />
                    ) : null}
                    <AvatarFallback className="text-[9px] font-medium">{getInitials(wo.applicantName)}</AvatarFallback>
                  </Avatar>
                  <span className="font-mono text-sm font-medium text-foreground">{wo.woNumber}</span>
                  <span className="text-sm text-muted-foreground truncate">{toProperCase(wo.applicantName)}</span>
                  <PipelineStageBadge stage={wo.status === "Completed" ? "complete" : pipeline.overall} />
                  {wo.isVip && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                  {attention && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {med.hasMedical && (
                    <div className="flex items-center gap-1">
                      <Stethoscope className="h-3 w-3 text-muted-foreground" />
                      <TypingStatusPill status={med.typing} />
                      <AppointmentStatusPill status={med.appointment} />
                    </div>
                  )}
                  {eid.hasEid && (
                    <div className="flex items-center gap-1">
                      <Fingerprint className="h-3 w-3 text-muted-foreground" />
                      <TypingStatusPill status={eid.typing} />
                      <AppointmentStatusPill status={eid.appointment} />
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );

  const cv = dt.isColumnVisible;

  const renderTable = (items: WorkOrderEnriched[]) => (
    <div className="premium-card overflow-hidden">
      <Table>
        <TableHeader className="sticky top-0 z-[9999] bg-background">
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={dt.isAllSelected}
                onCheckedChange={() => dt.toggleSelectAll()}
                aria-label="Select all"
                data-testid="checkbox-select-all"
                {...(dt.isPartiallySelected ? { "data-state": "indeterminate" } : {})}
              />
            </TableHead>
            {cv("woNumber") && <SortableHeader sortKey="woNumber" sort={columnSort} onToggle={toggleColumnSort} className="w-28">WO #</SortableHeader>}
            {cv("applicant") && <SortableHeader sortKey="applicant" sort={columnSort} onToggle={toggleColumnSort}>Applicant</SortableHeader>}
            {cv("company") && <SortableHeader sortKey="company" sort={columnSort} onToggle={toggleColumnSort} className="hidden sm:table-cell">Company</SortableHeader>}
            {cv("service") && <TableHead className="hidden lg:table-cell">Service</TableHead>}
            {cv("pipeline") && <TableHead className="w-32">Pipeline</TableHead>}
            {cv("status") && <SortableHeader sortKey="status" sort={columnSort} onToggle={toggleColumnSort} className="w-20">Status</SortableHeader>}
            {cv("medical") && <TableHead className="hidden md:table-cell w-40">Medical</TableHead>}
            {cv("eid") && <TableHead className="hidden md:table-cell w-40">EID</TableHead>}
            {cv("age") && <SortableHeader sortKey="age" sort={columnSort} onToggle={toggleColumnSort} className="w-16 text-right">Age</SortableHeader>}
            {cv("nextAction") && <TableHead className="hidden lg:table-cell w-48">Next Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((wo) => {
            const med = getMedicalStatus(wo);
            const eid = getEidStatus(wo);
            const daysOld = getDaysOld(wo.createdAt);
            const attention = needsAttention(wo);
            const isSelected = dt.selectedIds.has(wo.id);
            const cellPadding = dt.density === "compact" ? "py-1.5" : "";
            const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
            const nextAction = getNextAction(wo.typingJobs || [], wo.appointments || [], pipeline);
            return (
              <TableRow 
                key={wo.id} 
                className={`cursor-pointer hover-elevate ${isSelected ? "bg-primary/5" : ""}`}
                data-state={isSelected ? "selected" : undefined}
                data-testid={`work-order-table-${wo.woNumber}`}
              >
                <TableCell className={cellPadding}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => dt.toggleSelected(wo.id)}
                    aria-label={`Select ${wo.woNumber}`}
                    data-testid={`checkbox-wo-table-${wo.woNumber}`}
                  />
                </TableCell>
                {cv("woNumber") && <TableCell className={cellPadding} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-medium text-primary">{wo.woNumber}</span>
                    {wo.isVip && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                    {attention && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  </div>
                </TableCell>}
                {cv("applicant") && <TableCell className={`${cellPadding} max-w-[200px]`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-wo-table-${wo.woNumber}`}>
                      {photoMap?.[wo.id] ? (
                        <AvatarImage src={photoMap[wo.id]} alt={wo.applicantName} />
                      ) : null}
                      <AvatarFallback className="text-[9px] font-medium">{getInitials(wo.applicantName)}</AvatarFallback>
                    </Avatar>
                    <span className="block truncate">{toProperCase(wo.applicantName)}</span>
                  </div>
                </TableCell>}
                {cv("company") && <TableCell className={`hidden sm:table-cell text-muted-foreground text-xs ${cellPadding}`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  {wo.company?.name ? toProperCase(wo.company.name) : "-"}
                </TableCell>}
                {cv("service") && <TableCell className={`hidden lg:table-cell text-muted-foreground text-xs ${cellPadding}`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  {wo.serviceType?.name || "-"}
                </TableCell>}
                {cv("pipeline") && <TableCell className={cellPadding} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  <PipelineStageBadge stage={wo.status === "Completed" ? "complete" : pipeline.overall} />
                </TableCell>}
                {cv("status") && <TableCell className={cellPadding} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  <StatusBadge status={getScheduledDisplayStatus(wo) as any} />
                </TableCell>}
                {cv("medical") && <TableCell className={`hidden md:table-cell ${cellPadding}`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  {med.hasMedical ? (
                    <div className="flex items-center gap-1">
                      <TypingStatusPill status={med.typing} />
                      <AppointmentStatusPill status={med.appointment} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">--</span>
                  )}
                </TableCell>}
                {cv("eid") && <TableCell className={`hidden md:table-cell ${cellPadding}`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  {eid.hasEid ? (
                    <div className="flex items-center gap-1">
                      <TypingStatusPill status={eid.typing} />
                      <AppointmentStatusPill status={eid.appointment} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">--</span>
                  )}
                </TableCell>}
                {cv("age") && <TableCell className={`text-right text-xs text-muted-foreground ${cellPadding}`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  {daysOld === 0 ? "Today" : `${daysOld}d`}
                </TableCell>}
                {cv("nextAction") && <TableCell className={`hidden lg:table-cell ${cellPadding}`} onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  <NextActionIndicator message={nextAction.message} variant={nextAction.variant} />
                </TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderKanban = () => {
    if (!kanbanGroups) return null;
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="flex-shrink-0 w-72">
            <div className="flex items-center justify-between gap-2 mb-3 px-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="text-xs text-muted-foreground">({kanbanGroups[status]?.length || 0})</span>
              </div>
            </div>
            <div className="space-y-2 min-h-[200px] p-2 rounded-xl bg-muted/30">
              {kanbanGroups[status]?.map((wo, index) => {
                const med = getMedicalStatus(wo);
                const eid = getEidStatus(wo);
                const borderColor = getCardBorderColor(wo);
                const attention = needsAttention(wo);
                const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
                const nextAction = getNextAction(wo.typingJobs || [], wo.appointments || [], pipeline);
                return (
                  <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                    <div 
                      className={`premium-card p-3 border-l-[3px] ${borderColor} opacity-0 animate-fade-in`}
                      style={{ animationDelay: `${index * 0.03}s` }}
                      data-testid={`work-order-kanban-${wo.woNumber}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="font-mono text-sm font-medium text-foreground">{wo.woNumber}</span>
                        <PipelineStageBadge stage={wo.status === "Completed" ? "complete" : pipeline.overall} />
                        {wo.isVip && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                        {attention && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-wo-kanban-${wo.woNumber}`}>
                          {photoMap?.[wo.id] ? (
                            <AvatarImage src={photoMap[wo.id]} alt={wo.applicantName} />
                          ) : null}
                          <AvatarFallback className="text-[9px] font-medium">{getInitials(wo.applicantName)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground truncate">{toProperCase(wo.applicantName)}</span>
                      </div>
                      {wo.company && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-0.5">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{toProperCase(wo.company.name)}</span>
                        </div>
                      )}
                      {(med.hasMedical || eid.hasEid) && (
                        <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                          <MedEidStatusRow icon={Stethoscope} label="Med" typing={med.typing} appointment={med.appointment} hasData={med.hasMedical} />
                          <MedEidStatusRow icon={Fingerprint} label="EID" typing={eid.typing} appointment={eid.appointment} hasData={eid.hasEid} />
                        </div>
                      )}
                      {nextAction.variant !== "success" && (
                        <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-border/20">
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <NextActionIndicator message={nextAction.message} variant={nextAction.variant} />
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
              {(!kanbanGroups[status] || kanbanGroups[status].length === 0) && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No items
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const viewModeToggle = (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
      <Button
        size="icon"
        variant={viewMode === "compact" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("compact")}
        data-testid="button-view-compact"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewMode === "cards" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("cards")}
        data-testid="button-view-cards"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewMode === "table" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("table")}
        data-testid="button-view-table"
      >
        <Table2 className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewMode === "kanban" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("kanban")}
        data-testid="button-view-kanban"
      >
        <Columns3 className="h-4 w-4" />
      </Button>
    </div>
  );

  const filterControls = (
    <>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-32 h-9 rounded-lg" data-testid="select-status-filter">
          <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="Delayed">Delayed</SelectItem>
          <SelectItem value="Inactive">Inactive</SelectItem>
          <SelectItem value="Draft">Draft</SelectItem>
          <SelectItem value="Scheduled">Scheduled</SelectItem>
          <SelectItem value="Completed">Completed</SelectItem>
          <SelectItem value="Cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <Select value={specialFilter} onValueChange={(v) => setSpecialFilter(v as SpecialFilter)}>
        <SelectTrigger className="w-44 h-9 rounded-lg" data-testid="select-special-filter">
          <CircleDot className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Quick Filter" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">All Work Orders</SelectItem>
          <SelectItem value="needs_attention">Needs Attention</SelectItem>
          <SelectItem value="awaiting_typing">Awaiting Typing</SelectItem>
          <SelectItem value="need_scheduling">Need Scheduling</SelectItem>
          <SelectItem value="vip">VIP Cases</SelectItem>
          <SelectItem value="med_not_scheduled">Medical Not Scheduled</SelectItem>
          <SelectItem value="eid_not_scheduled">EID Not Scheduled</SelectItem>
          <SelectItem value="med_typing_pending">Medical Typing Pending</SelectItem>
          <SelectItem value="eid_typing_pending">EID Typing Pending</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
        <SelectTrigger className="w-36 h-9 rounded-lg" data-testid="select-date-range-filter">
          <SelectValue placeholder="Date Range" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all">All Dates</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
          <SelectItem value="last_month">Last Month</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortByOption)}>
        <SelectTrigger className="w-36 h-9 rounded-lg" data-testid="select-sort-by">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="newest">Newest First</SelectItem>
          <SelectItem value="oldest">Oldest First</SelectItem>
          <SelectItem value="wo_asc">WO # A-Z</SelectItem>
          <SelectItem value="wo_desc">WO # Z-A</SelectItem>
          <SelectItem value="applicant_asc">Applicant A-Z</SelectItem>
          <SelectItem value="applicant_desc">Applicant Z-A</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">
              Work Orders
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Track and manage all applicant work orders</p>
          </div>
          <Link href="/work-orders/new">
            <Button size="sm" className="gap-1.5" data-testid="button-new-work-order">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Work Order</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-20 md:pb-6 space-y-4">
        {!isLoading && renderPipelineButtons()}
        {!isLoading && renderStatTiles()}

        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by work order number or applicant..."
          density={dt.density}
          onDensityChange={dt.setDensity}
          totalItems={dt.totalItems}
          selectedCount={dt.selectedCount}
          onClearSelection={dt.clearSelection}
          selectionActions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={bulkStatusMutation.isPending} data-testid="button-bulk-status">
                    {bulkStatusMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
                    Change Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {["Draft", "Scheduled", "Completed", "Cancelled"].map(status => (
                    <DropdownMenuItem key={status} onClick={() => bulkStatusMutation.mutate({ ids: Array.from(dt.selectedIds).map(String), status })} data-testid={`menu-bulk-status-${status.toLowerCase()}`}>
                      {status}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                data-testid="button-export-csv"
                onClick={() => {
                  const selected = (filteredAndSortedWorkOrders || []).filter(wo => dt.selectedIds.has(wo.id));
                  exportToCsv(selected, [
                    { header: "WO Number", accessor: (wo: WorkOrderEnriched) => wo.woNumber },
                    { header: "Applicant", accessor: (wo: WorkOrderEnriched) => wo.applicantName },
                    { header: "Company", accessor: (wo: WorkOrderEnriched) => wo.company?.name || "" },
                    { header: "Service Type", accessor: (wo: WorkOrderEnriched) => wo.serviceType?.name || "" },
                    { header: "Status", accessor: (wo: WorkOrderEnriched) => wo.status },
                    { header: "Created", accessor: (wo: WorkOrderEnriched) => wo.createdAt ? new Date(wo.createdAt).toLocaleDateString() : "" },
                  ], "work-orders-export");
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </>
          }
          filters={filterControls}
          viewModeToggle={viewModeToggle}
          actions={
            <ColumnVisibilityDropdown
              columns={dt.columns}
              isColumnVisible={dt.isColumnVisible}
              toggleColumn={dt.toggleColumn}
              resetColumns={dt.resetColumns}
            />
          }
          activeFilterCount={activeFilterCount}
          onClearFilters={clearAllFilters}
        />

        <div>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse border border-border/50 rounded-xl p-4 border-l-[3px] border-l-muted" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted/80 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/5 rounded bg-muted/80" />
                      <div className="h-3 w-4/5 rounded bg-muted/60" />
                      <div className="h-3 w-3/5 rounded bg-muted/50" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-muted/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayItems && displayItems.length > 0 ? (
            <>
              {viewMode === "compact" && renderCompactList(displayItems)}
              {viewMode === "cards" && renderCards(displayItems)}
              {viewMode === "table" && renderTable(displayItems)}
              {viewMode === "kanban" && renderKanban()}
            </>
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No work orders found"
              description={search || activeFilterCount > 0 ? "Try adjusting your search or filters" : "Create your first work order to get started."}
              action={
                search || activeFilterCount > 0 ? (
                  <Button size="sm" variant="outline" className="gap-2 rounded-lg" onClick={clearAllFilters} data-testid="button-clear-all-filters">
                    Clear filters
                  </Button>
                ) : (
                  <Link href="/work-orders/new">
                    <Button size="sm" className="gap-2 rounded-lg">
                      <Plus className="h-4 w-4" />
                      New Work Order
                    </Button>
                  </Link>
                )
              }
            />
          )}
        </div>

        {!isKanban && !isLoading && dt.totalItems > 0 && (
          <DataTablePagination
            page={dt.page}
            pageSize={dt.pageSize}
            totalPages={dt.totalPages}
            totalItems={dt.totalItems}
            onPageChange={dt.setPage}
            onPageSizeChange={dt.setPageSize}
            selectedCount={dt.selectedCount}
          />
        )}
      </div>
      <FloatingActionButton href="/work-orders/new" label="New Work Order" testId="fab-new-work-order" />
    </AppLayout>
  );
}
