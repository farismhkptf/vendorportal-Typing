import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Shield, Search, FileText, MessageCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/format-date";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GlassCard, GlassSection, GlassSkeleton, GlassEmpty } from "@/components/vendor-v2/layout";

interface Job {
  id: string;
  woId: string;
  woNumber: string;
  applicantName: string;
  category: string;
  status: string;
  jobTypeName: string;
  sentAt: string | null;
  costSnapshot: number | null;
  priority: string;
  urgent: boolean;
  inputDocumentCount: number;
  commentCount: number;
}

function getStatusClass(status: string): string {
  switch (status) {
    case "SubmittedToVendor": return "v2-status-new";
    case "InProcess": return "v2-status-inprogress";
    case "ReadyForScheduling":
    case "Returned": return "v2-status-completed";
    default: return "v2-status-default";
  }
}

function getDisplayStatus(status: string): string {
  switch (status) {
    case "SubmittedToVendor": return "New";
    case "InProcess": return "In Progress";
    case "ReadyForScheduling": return "Completed";
    case "Returned": return "Returned";
    case "OnHold": return "On Hold";
    case "Rejected": return "Rejected";
    default: return status;
  }
}

type FilterType = "all" | "needsAction" | "new" | "active" | "completed";

export default function V2EidJobs() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/vendor/jobs"],
  });

  const { toast } = useToast();

  const acceptMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiRequest("POST", `/api/vendor/jobs/${jobId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/dashboard"] });
      toast({ title: "Job accepted" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to accept job", variant: "destructive" });
    },
  });

  const eidJobs = (jobs || []).filter(j => j.category === "EID");

  const newCount = eidJobs.filter(j => j.status === "SubmittedToVendor").length;
  const activeCount = eidJobs.filter(j => j.status === "InProcess").length;
  const doneCount = eidJobs.filter(j => j.status === "ReadyForScheduling" || j.status === "Returned").length;

  const filtered = eidJobs
    .filter(j => {
      if (filter === "needsAction") return j.status === "SubmittedToVendor" || j.urgent;
      if (filter === "new") return j.status === "SubmittedToVendor";
      if (filter === "active") return j.status === "InProcess";
      if (filter === "completed") return j.status === "ReadyForScheduling" || j.status === "Returned";
      return true;
    })
    .filter(j => {
      if (!search) return true;
      const q = search.toLowerCase();
      return j.woNumber.toLowerCase().includes(q) || j.applicantName.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      if (a.status === "SubmittedToVendor" && b.status !== "SubmittedToVendor") return -1;
      if (a.status !== "SubmittedToVendor" && b.status === "SubmittedToVendor") return 1;
      return 0;
    });

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "needsAction", label: "Needs Action" },
    { key: "new", label: "New" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
  ];

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto pt-4 space-y-3">
        <GlassSkeleton className="h-10 w-full" />
        <div className="flex gap-2"><GlassSkeleton className="h-8 w-20" /><GlassSkeleton className="h-8 w-24" /></div>
        {[1, 2, 3].map(i => <GlassSkeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pt-2 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-amber-500 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white" data-testid="text-eid-title">Emirates ID Jobs</h1>
          <p className="text-xs text-slate-400 dark:text-white/40">{eidJobs.length} total</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-white/30" />
        <input
          type="search"
          placeholder="Search by WO# or applicant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="glass-input w-full pl-10 pr-4 py-2.5 text-sm"
          data-testid="input-search-eid"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`glass-pill px-3.5 py-1.5 text-xs font-medium whitespace-nowrap ${filter === f.key ? "glass-pill-active" : ""}`}
            data-testid={`filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <GlassCard className="p-3 text-center" data-testid="stat-new">
          <p className="text-lg font-bold text-blue-500 dark:text-blue-400">{newCount}</p>
          <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider">New</p>
        </GlassCard>
        <GlassCard className="p-3 text-center" data-testid="stat-active">
          <p className="text-lg font-bold text-amber-500 dark:text-amber-400">{activeCount}</p>
          <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider">In Progress</p>
        </GlassCard>
        <GlassCard className="p-3 text-center" data-testid="stat-done">
          <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400">{doneCount}</p>
          <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider">Completed</p>
        </GlassCard>
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(job => (
            <GlassCard
              key={job.id}
              accent={job.urgent ? "red" : "amber"}
              className="p-4"
              onClick={() => setLocation(`/eid/${job.id}`)}
              data-testid={`job-card-${job.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-400 dark:text-white/40">{job.woNumber}</span>
                    {job.urgent && <span className="v2-status-badge v2-status-urgent">Urgent</span>}
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{job.applicantName}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`${getStatusClass(job.status)} v2-status-badge`}>
                      {getDisplayStatus(job.status)}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-white/30">{job.jobTypeName}</span>
                    {job.sentAt && (
                      <span className="text-[11px] text-slate-300 dark:text-white/25">{formatRelativeTime(job.sentAt)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {job.status === "SubmittedToVendor" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); acceptMutation.mutate(job.id); }}
                      className="glass-btn-primary text-xs px-4 py-1.5"
                      disabled={acceptMutation.isPending}
                      data-testid={`button-accept-${job.id}`}
                    >
                      Accept
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    {job.inputDocumentCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-slate-300 dark:text-white/25">
                        <FileText className="h-3 w-3" /> {job.inputDocumentCount}
                      </span>
                    )}
                    {job.commentCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-slate-300 dark:text-white/25">
                        <MessageCircle className="h-3 w-3" /> {job.commentCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassEmpty
          icon={<Shield className="h-8 w-8" />}
          title="No jobs found"
          description={search || filter !== "all" ? "Try adjusting your search or filters" : "EID jobs will appear here when assigned"}
        />
      )}
    </div>
  );
}
