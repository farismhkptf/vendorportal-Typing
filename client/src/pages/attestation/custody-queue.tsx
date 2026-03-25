import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { HandoverForm } from "@/components/attestation/handover-form";
import { CustodyTimeline } from "@/components/attestation/custody-timeline";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, ArrowLeftRight,
  FileText, ChevronDown, ChevronUp, Package, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttestationSr } from "@shared/schema";

const CUSTODY_ACTIONS: Record<string, {
  action: string;
  label: string;
  direction: "ClientToUs" | "UsToVendor" | "VendorToUs" | "UsToClient";
  icon: any;
  color: string;
  badgeVariant: string;
}> = {
  WithClient_pending_collect: {
    action: "Collect from Client",
    label: "Collect from Client",
    direction: "ClientToUs",
    icon: ArrowDownToLine,
    color: "text-blue-600",
    badgeVariant: "secondary",
  },
  WithUs_send_vendor: {
    action: "Hand to Vendor",
    label: "Hand to Vendor",
    direction: "UsToVendor",
    icon: ArrowUpFromLine,
    color: "text-purple-600",
    badgeVariant: "secondary",
  },
  WithVendor_confirm_return: {
    action: "Confirm Return",
    label: "Confirm Return from Vendor",
    direction: "VendorToUs",
    icon: ArrowRightLeft,
    color: "text-amber-600",
    badgeVariant: "secondary",
  },
  WithUs_return_client: {
    action: "Return to Client",
    label: "Return to Client",
    direction: "UsToClient",
    icon: ArrowLeftRight,
    color: "text-green-600",
    badgeVariant: "secondary",
  },
};

function getNextAction(sr: AttestationSr): typeof CUSTODY_ACTIONS[string] | null {
  if (sr.status === "Cancelled" || sr.physicalCustodyStatus === "ReturnedToClient") return null;

  if (sr.physicalCustodyStatus === "WithClient") {
    return CUSTODY_ACTIONS.WithClient_pending_collect;
  }
  if (sr.physicalCustodyStatus === "WithUs" && sr.status !== "Completed") {
    return CUSTODY_ACTIONS.WithUs_send_vendor;
  }
  if (sr.physicalCustodyStatus === "WithVendor" && sr.status === "Completed") {
    return CUSTODY_ACTIONS.WithVendor_confirm_return;
  }
  if (sr.physicalCustodyStatus === "WithUs" && sr.status === "Completed") {
    return CUSTODY_ACTIONS.WithUs_return_client;
  }
  return null;
}

const CUSTODY_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  WithClient: { label: "With Client", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  WithUs: { label: "With Our Team", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  WithVendor: { label: "With Vendor", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  ReturnedToClient: { label: "Returned to Client", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

interface SrCardProps {
  sr: AttestationSr;
  staffName?: string;
}

function SrCard({ sr, staffName }: SrCardProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const nextAction = getNextAction(sr);
  const custodyLabel = CUSTODY_STATUS_LABELS[sr.physicalCustodyStatus] || { label: sr.physicalCustodyStatus, color: "" };
  const ActionIcon = nextAction?.icon;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden" data-testid={`sr-card-${sr.id}`}>
      {showForm && nextAction ? (
        <HandoverForm
          srId={sr.id}
          srNumber={sr.srNumber ?? ""}
          direction={nextAction.direction}
          defaultStaffName={staffName}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">{sr.srNumber}</span>
                {sr.externalWoNumber && (
                  <span className="text-xs text-muted-foreground">· {sr.externalWoNumber}</span>
                )}
              </div>
              <p className="font-semibold text-foreground mt-0.5" data-testid={`text-sr-applicant-${sr.id}`}>
                {sr.applicantName}
              </p>
              <p className="text-sm text-muted-foreground truncate" data-testid={`text-sr-doc-${sr.id}`}>
                {sr.documentName}
              </p>
            </div>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap", custodyLabel.color)}>
              {custodyLabel.label}
            </span>
          </div>

          {nextAction && (
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowForm(true)}
              data-testid={`button-action-${sr.id}`}
            >
              {ActionIcon && <ActionIcon className="h-4 w-4" />}
              {nextAction.label}
            </Button>
          )}

          <button
            onClick={() => setShowTimeline(prev => !prev)}
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
              <CustodyTimeline srId={sr.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CustodyQueuePage() {
  const { user } = useAuth();
  const staffName = user?.name || "";

  const { data: srs, isLoading } = useQuery<AttestationSr[]>({
    queryKey: ["/api/attestation/sr"],
  });

  const pendingSrs = srs?.filter(sr => getNextAction(sr) !== null) || [];

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight" data-testid="text-queue-title">
              Document Custody Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All pending document handover actions
            </p>
          </div>
          {!isLoading && (
            <Badge variant="outline" className="text-sm" data-testid="badge-queue-count">
              {pendingSrs.length} pending
            </Badge>
          )}
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-8">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : pendingSrs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4" data-testid="queue-empty">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">All clear</p>
              <p className="text-sm text-muted-foreground mt-1">No pending custody actions</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-w-xl">
            {pendingSrs.map(sr => (
              <SrCard key={sr.id} sr={sr} staffName={staffName} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
