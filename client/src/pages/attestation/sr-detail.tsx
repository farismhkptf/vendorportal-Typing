import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { CustodyTimeline } from "@/components/attestation/custody-timeline";
import { HandoverForm } from "@/components/attestation/handover-form";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, ChevronDown, ChevronUp, FileText, Package, 
  User, Building2, Clock
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import type { AttestationSr } from "@shared/schema";

const CUSTODY_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  WithClient: { label: "With Client", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  WithUs: { label: "With Our Team", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  WithVendor: { label: "With Vendor", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  ReturnedToClient: { label: "Returned to Client", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

const SR_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  SentToVendor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  AcceptedByVendor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  InProgress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function AttestationSrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isPro = user?.role === "PRO" || user?.role === "PRO - Temporary";
  const isOps = user?.role === "Admin" || user?.role === "Client Relationship Manager";
  const [custodyOpen, setCustodyOpen] = useState(true);

  const { data: sr, isLoading } = useQuery<AttestationSr>({
    queryKey: ["/api/attestation/sr", id],
    queryFn: async () => {
      const res = await fetch(`/api/attestation/sr/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load SR");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 py-6 space-y-4 max-w-2xl">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  if (!sr) {
    return (
      <AppLayout>
        <div className="px-4 py-8 text-center text-muted-foreground">SR not found</div>
      </AppLayout>
    );
  }

  const custodyLabel = CUSTODY_STATUS_LABELS[sr.physicalCustodyStatus] || { label: sr.physicalCustodyStatus, color: "" };
  const srStatusColor = SR_STATUS_COLORS[sr.status] || "";

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <Link href="/attestation/custody-queue">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-sr-number">{sr.srNumber}</h1>
            <p className="text-sm text-muted-foreground">Attestation Service Request</p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-8 space-y-4 max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <p className="font-semibold text-foreground" data-testid="text-applicant-name">{sr.applicantName}</p>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground" data-testid="text-document-name">{sr.documentName}</p>
              </div>
              {sr.externalWoNumber && (
                <p className="text-xs text-muted-foreground font-mono">WO: {sr.externalWoNumber}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", srStatusColor)}>
                {sr.status}
              </span>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", custodyLabel.color)}>
                {custodyLabel.label}
              </span>
            </div>
          </div>

          {sr.currentCustodian && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground border-t border-border pt-2">
              <Package className="h-4 w-4" />
              <span>Currently with: <strong className="text-foreground">{sr.currentCustodian}</strong></span>
            </div>
          )}
          {sr.notes && (
            <p className="text-sm text-muted-foreground italic border-t border-border pt-2">{sr.notes}</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setCustodyOpen(v => !v)}
            className="w-full flex items-center justify-between p-4 text-sm font-semibold text-foreground hover:bg-muted/20 transition-colors"
            data-testid="button-toggle-custody-section"
          >
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Document Custody
            </span>
            {custodyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {custodyOpen && (
            <div className="px-4 pb-4">
              <CustodyTimeline srId={sr.id} />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
