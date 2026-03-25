import { useQuery, useMutation } from "@tanstack/react-query";
import { Briefcase, CheckCircle2, Play, Flag, Loader2, FileText } from "lucide-react";
import { GlassCard, GlassSection, GlassSkeleton, GlassEmpty } from "@/components/vendor-v2/layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/format-date";

interface VendorJob {
  id: string;
  externalWoNumber: string;
  documentType: string;
  documentNameDescription: string;
  documentClass: string;
  serviceName: string;
  homeCountry: string | null;
  status: string;
  createdAt: string;
  feeLabel: string;
  feeAmount: number | null;
  serviceNotes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  SentToVendor: { label: "Pending Acceptance", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  AcceptedByVendor: { label: "Accepted", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  InProgress: { label: "In Progress", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  Completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  Cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/40" },
};

export default function AttestationVendorJobs() {
  const { toast } = useToast();

  const { data: jobs = [], isLoading } = useQuery<VendorJob[]>({
    queryKey: ["/api/attestation-vendor/jobs"],
    queryFn: async () => {
      const res = await fetch("/api/attestation-vendor/jobs", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load jobs");
      return res.json();
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/attestation-vendor/jobs/${jobId}/accept`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/dashboard"] });
      toast({ title: "Job accepted", description: "You have accepted the job." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to accept job", variant: "destructive" });
    },
  });

  const startMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/attestation-vendor/jobs/${jobId}/start`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/dashboard"] });
      toast({ title: "Work started", description: "Job is now in progress." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to start job", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/attestation-vendor/jobs/${jobId}/complete`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/dashboard"] });
      toast({ title: "Job completed", description: "Job marked as completed." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to complete job", variant: "destructive" });
    },
  });

  const activeJobs = jobs.filter(j => j.status !== "Completed" && j.status !== "Cancelled");
  const completedJobs = jobs.filter(j => j.status === "Completed");
  const cancelledJobs = jobs.filter(j => j.status === "Cancelled");

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pt-4">
        {[1, 2, 3].map(i => <GlassSkeleton key={i} className="h-36" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pt-2 pb-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="page-title-attest-jobs">Jobs</h1>
        <p className="text-slate-500 dark:text-white/50 text-sm">Attestation service requests assigned to you</p>
      </div>

      {jobs.length === 0 ? (
        <GlassEmpty
          icon={<Briefcase className="h-8 w-8" />}
          title="No jobs yet"
          description="Service requests assigned to you will appear here"
        />
      ) : (
        <>
          {activeJobs.length > 0 && (
            <GlassSection title="Active">
              <div className="space-y-3">
                {activeJobs.map(job => {
                  const config = STATUS_CONFIG[job.status] || { label: job.status, color: "" };
                  return (
                    <GlassCard key={job.id} className="p-4" data-testid={`job-card-${job.id}`}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400 dark:text-white/50">{job.externalWoNumber}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`} data-testid={`job-status-${job.id}`}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{job.documentType}</p>
                          <p className="text-xs text-slate-500 dark:text-white/50">{job.documentNameDescription}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-white/40 mb-3">
                        <span>{job.documentClass}</span>
                        {job.homeCountry && <span>· {job.homeCountry}</span>}
                        <span>· {job.serviceName}</span>
                      </div>

                      {job.feeAmount !== null && (
                        <div className="mb-3 flex items-center gap-2">
                          <span className="text-xs text-slate-400 dark:text-white/40">{job.feeLabel}:</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {job.feeAmount.toLocaleString()} AED
                          </span>
                        </div>
                      )}

                      {job.feeAmount === null && (
                        <div className="mb-3">
                          <span className="text-xs text-slate-400 dark:text-white/40">Fee TBD</span>
                        </div>
                      )}

                      {job.serviceNotes && (
                        <p className="text-xs text-slate-500 dark:text-white/50 mb-3 italic">{job.serviceNotes}</p>
                      )}

                      <div className="flex gap-2">
                        {job.status === "SentToVendor" && (
                          <button
                            onClick={() => acceptMutation.mutate(job.id)}
                            disabled={acceptMutation.isPending}
                            className="flex-1 glass-btn-primary text-sm py-2 flex items-center justify-center gap-1.5"
                            data-testid={`button-accept-job-${job.id}`}
                          >
                            {acceptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Accept Job
                          </button>
                        )}
                        {job.status === "AcceptedByVendor" && (
                          <button
                            onClick={() => startMutation.mutate(job.id)}
                            disabled={startMutation.isPending}
                            className="flex-1 glass-btn-primary text-sm py-2 flex items-center justify-center gap-1.5"
                            data-testid={`button-start-job-${job.id}`}
                          >
                            {startMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                            Start Work
                          </button>
                        )}
                        {job.status === "InProgress" && (
                          <button
                            onClick={() => completeMutation.mutate(job.id)}
                            disabled={completeMutation.isPending}
                            className="flex-1 glass-btn-primary text-sm py-2 flex items-center justify-center gap-1.5"
                            data-testid={`button-complete-job-${job.id}`}
                          >
                            {completeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                            Mark Complete
                          </button>
                        )}
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </GlassSection>
          )}

          {completedJobs.length > 0 && (
            <GlassSection title="Completed">
              <div className="space-y-2">
                {completedJobs.map(job => (
                  <GlassCard key={job.id} className="p-4 opacity-70" data-testid={`job-completed-${job.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400 dark:text-white/40">{job.externalWoNumber}</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{job.documentType}</span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-white/40">{job.serviceName} · {job.documentClass}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Done
                        </span>
                        {job.feeAmount !== null && (
                          <p className="text-xs text-slate-400 dark:text-white/40 mt-1">
                            {job.feeLabel}: {job.feeAmount.toLocaleString()} AED
                          </p>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </GlassSection>
          )}
        </>
      )}
    </div>
  );
}
