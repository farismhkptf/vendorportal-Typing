import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { HandoverForm } from "@/components/attestation/handover-form";
import { CustodyTimeline } from "@/components/attestation/custody-timeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Package, ArrowDownToLine, ChevronDown, ChevronUp, Clock, CheckCircle2, LogOut,
  Play, Flag, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import type { AttestationSr } from "@shared/schema";

const CUSTODY_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  WithClient: { label: "With Client", color: "bg-slate-100 text-slate-600" },
  WithUs: { label: "With Keystone Team", color: "bg-blue-100 text-blue-700" },
  WithVendor: { label: "With Your Firm", color: "bg-purple-100 text-purple-700" },
  ReturnedToClient: { label: "Returned to Client", color: "bg-green-100 text-green-700" },
};

const SR_STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  SentToVendor: "Awaiting Acceptance",
  AcceptedByVendor: "Accepted",
  InProgress: "In Progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

function invalidateJobs() {
  queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/jobs"] });
  queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/dashboard"] });
}

function AttestationVendorJobCard({ sr }: { sr: AttestationSr }) {
  const { toast } = useToast();
  const [showTimeline, setShowTimeline] = useState(false);
  const [showCollectForm, setShowCollectForm] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/attestation-vendor/jobs/${sr.id}/accept`);
      return res.json();
    },
    onSuccess: () => {
      invalidateJobs();
      toast({ title: "Job accepted", description: "You have accepted this job." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to accept job", variant: "destructive" });
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/attestation-vendor/jobs/${sr.id}/start`);
      return res.json();
    },
    onSuccess: () => {
      invalidateJobs();
      toast({ title: "Work started", description: "Job is now in progress." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to start job", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/attestation-vendor/jobs/${sr.id}/complete`);
      return res.json();
    },
    onSuccess: () => {
      invalidateJobs();
      toast({ title: "Job marked complete", description: "PRO will be notified to confirm document return." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to complete job", variant: "destructive" });
    },
  });

  const custodyLabel = CUSTODY_STATUS_LABELS[sr.physicalCustodyStatus] || { label: sr.physicalCustodyStatus, color: "" };

  const canAccept = sr.status === "SentToVendor";
  const canStart = sr.status === "AcceptedByVendor" && sr.physicalCustodyStatus !== "WithUs";
  const canCollect = sr.status === "AcceptedByVendor" && sr.physicalCustodyStatus === "WithUs";
  const canComplete = sr.status === "InProgress" || (sr.status === "AcceptedByVendor" && sr.physicalCustodyStatus === "WithVendor");
  const readyForReturn = sr.status === "Completed" && sr.physicalCustodyStatus === "WithVendor";

  if (showCollectForm) {
    return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden" data-testid={`sr-card-${sr.id}`}>
        <HandoverForm
          srId={sr.id}
          srNumber={(sr as any).srNumber}
          direction="UsToVendor"
          defaultStaffName=""
          apiEndpoint={`/api/attestation-vendor/jobs/${sr.id}/custody`}
          onSuccess={() => {
            setShowCollectForm(false);
            invalidateJobs();
          }}
          onCancel={() => setShowCollectForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden" data-testid={`sr-card-${sr.id}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {(sr as any).srNumber && (
                <span className="font-mono text-xs text-muted-foreground">{(sr as any).srNumber}</span>
              )}
              {(sr as any).externalWoNumber && (
                <span className="text-xs text-muted-foreground">· {(sr as any).externalWoNumber}</span>
              )}
            </div>
            <p className="font-semibold text-foreground mt-0.5" data-testid={`text-sr-applicant-${sr.id}`}>
              {sr.applicantName || (sr as any).documentType}
            </p>
            <p className="text-sm text-muted-foreground" data-testid={`text-sr-doc-${sr.id}`}>
              {(sr as any).documentName || (sr as any).documentNameDescription}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap", custodyLabel.color)}>
              {custodyLabel.label}
            </span>
            <span className="text-xs text-muted-foreground">{SR_STATUS_LABELS[sr.status] || sr.status}</span>
          </div>
        </div>

        {readyForReturn && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Documents ready for return — your coordinator will come to collect
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canAccept && (
            <Button
              size="sm"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              data-testid={`button-accept-${sr.id}`}
            >
              {acceptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Accept Job
            </Button>
          )}
          {canStart && (
            <Button
              size="sm"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              data-testid={`button-start-${sr.id}`}
            >
              {startMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
              Start Work
            </Button>
          )}
          {canCollect && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCollectForm(true)}
              className="gap-1.5"
              data-testid={`button-collect-${sr.id}`}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Collect Documents
            </Button>
          )}
          {canComplete && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              data-testid={`button-complete-${sr.id}`}
            >
              {completeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Flag className="h-3.5 w-3.5 mr-1" />}
              Mark Complete
            </Button>
          )}
        </div>

        <button
          onClick={() => setShowTimeline(v => !v)}
          className="w-full flex items-center justify-between gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid={`button-toggle-timeline-${sr.id}`}
        >
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Custody Timeline
          </span>
          {showTimeline ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showTimeline && (
          <div className="border-t border-border pt-3">
            <CustodyTimeline
              srId={sr.id}
              queryEndpoint={`/api/attestation-vendor/jobs/${sr.id}/custody`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttestationVendorJobsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user } = useQuery<{ id: string; name: string; vendorId: string | null }>({
    queryKey: ["/api/attestation-vendor/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/attestation-vendor/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const { data: jobs, isLoading } = useQuery<AttestationSr[]>({
    queryKey: ["/api/attestation-vendor/jobs"],
    queryFn: async () => {
      const res = await fetch("/api/attestation-vendor/jobs", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/attestation-vendor/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/vendor-attestation/login");
    },
  });

  const activeJobs = jobs?.filter(j => j.status !== "Cancelled" && j.status !== "Completed") || [];
  const completedJobs = jobs?.filter(j => j.status === "Completed") || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 h-[60px] bg-background/90 backdrop-blur border-b border-border">
        <div className="flex h-full items-center justify-between px-4 max-w-2xl mx-auto">
          <div>
            <h1 className="font-bold text-foreground text-lg" data-testid="text-portal-title">Attestation Portal</h1>
            {user && (
              <p className="text-xs text-muted-foreground" data-testid="text-vendor-name">{user.name}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            className="gap-1.5 text-muted-foreground"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-8 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground" data-testid="text-active-title">Active Jobs</h2>
            {!isLoading && (
              <span className="text-sm text-muted-foreground">{activeJobs.length} active</span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
            </div>
          ) : activeJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4" data-testid="jobs-empty">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No active attestation jobs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeJobs.map(sr => (
                <AttestationVendorJobCard key={sr.id} sr={sr} />
              ))}
            </div>
          )}
        </div>

        {completedJobs.length > 0 && (
          <div>
            <h2 className="font-semibold text-foreground mb-3" data-testid="text-completed-title">Completed</h2>
            <div className="space-y-2">
              {completedJobs.map(sr => (
                <div
                  key={sr.id}
                  className="rounded-2xl border border-border bg-card p-4 opacity-70"
                  data-testid={`job-completed-${sr.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {sr.applicantName || (sr as any).documentType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(sr as any).documentName || (sr as any).documentNameDescription}
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0">
                      Done
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
