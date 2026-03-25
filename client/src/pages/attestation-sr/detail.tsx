import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AttestationSrStep } from "@shared/schema";

interface SRDetail {
  id: string;
  externalWoNumber: string;
  companyId: string;
  companyName: string | null;
  vendorId: string;
  vendorName: string | null;
  attestationServiceId: string;
  serviceName: string | null;
  serviceCategory: string | null;
  serviceVariantId?: string | null;
  variantLabel?: string | null;
  applicantName?: string | null;
  documentType: string;
  documentNameDescription: string;
  documentClass: string;
  homeCountry?: string | null;
  originalDocumentInvolved: boolean;
  status: string;
  physicalCustodyStatus: string;
  currentCustodian?: string | null;
  currentResponsibleStaffId?: string | null;
  responsibleStaffName?: string | null;
  serviceFeeAed?: string | null;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  steps: AttestationSrStep[];
}

const SR_STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  SentToVendor: "Sent to Vendor",
  AcceptedByVendor: "Accepted by Vendor",
  InProgress: "In Progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

const SR_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  SentToVendor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  AcceptedByVendor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  InProgress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const CUSTODY_LABELS: Record<string, string> = {
  WithClient: "With Client",
  WithUs: "With Us (CRM)",
  WithVendor: "With Vendor",
  ReturnedToClient: "Returned to Client",
};

const STEP_STATUS_LABELS: Record<string, string> = {
  Pending: "Pending",
  InProgress: "In Progress",
  Done: "Done",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  Draft: ["SentToVendor", "Cancelled"],
  SentToVendor: ["AcceptedByVendor", "Cancelled"],
  AcceptedByVendor: ["InProgress", "Cancelled"],
  InProgress: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

function StepRow({ step }: { step: AttestationSrStep }) {
  const icon = step.status === "Done"
    ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
    : step.status === "InProgress"
    ? <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
    : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0" data-testid={`step-row-${step.id}`}>
      <span className="mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{step.stepOrder}. {step.stepName}</span>
          <Badge variant="outline" className="text-xs">{step.stepType}</Badge>
          <Badge variant="secondary" className="text-xs" data-testid={`status-step-${step.id}`}>
            {STEP_STATUS_LABELS[step.status] || step.status}
          </Badge>
        </div>
        {step.notes && (
          <p className="text-xs text-muted-foreground mt-1 italic" data-testid={`notes-step-${step.id}`}>{step.notes}</p>
        )}
      </div>
    </div>
  );
}

export default function AttestationSRDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const srId = params.id;

  const [editingNotes, setEditingNotes] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [editingFee, setEditingFee] = useState(false);
  const [serviceFeeAed, setServiceFeeAed] = useState("");

  const { data: sr, isLoading } = useQuery<SRDetail>({
    queryKey: ["/api/attestation/service-requests", srId],
    queryFn: async () => {
      const res = await fetch(`/api/attestation/service-requests/${srId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load service request");
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) =>
      apiRequest("PATCH", `/api/attestation/service-requests/${srId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/service-requests", srId] });
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/service-requests"] });
      toast({ title: "Status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSrMutation = useMutation({
    mutationFn: async (data: Record<string, string>) =>
      apiRequest("PATCH", `/api/attestation/service-requests/${srId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/service-requests", srId] });
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/service-requests"] });
      toast({ title: "Service request updated" });
      setEditingNotes(false);
      setEditingFee(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!sr) {
    return (
      <AppLayout>
        <div className="p-4 text-center text-muted-foreground">Service request not found.</div>
      </AppLayout>
    );
  }

  const nextStatuses = VALID_TRANSITIONS[sr.status] ?? [];
  const isClosed = sr.status === "Cancelled" || sr.status === "Completed";

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/attestation-sr")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight" data-testid="heading-sr-detail">
                SR — {sr.externalWoNumber}
              </h1>
              <Badge className={`text-xs ${SR_STATUS_COLORS[sr.status] || ""}`} data-testid="status-badge">
                {SR_STATUS_LABELS[sr.status] || sr.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-created-at">
              Created {new Date(sr.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {nextStatuses.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3 px-4 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">Advance status:</span>
              {nextStatuses.map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "Cancelled" ? "destructive" : "default"}
                  onClick={() => updateStatusMutation.mutate(s)}
                  disabled={updateStatusMutation.isPending}
                  data-testid={`button-status-${s}`}
                >
                  {updateStatusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  → {SR_STATUS_LABELS[s] || s}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow label="Company" value={sr.companyName} testId="text-company" />
              <InfoRow label="Applicant" value={sr.applicantName} testId="text-applicant" />
              <InfoRow label="External WO #" value={sr.externalWoNumber} testId="text-wo-number" mono />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Service Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow label="Service" value={sr.serviceName} testId="text-service" />
              <InfoRow label="Category" value={sr.serviceCategory} testId="text-category" />
              {sr.variantLabel && <InfoRow label="Variant" value={sr.variantLabel} testId="text-variant" />}
              <InfoRow label="Vendor" value={sr.vendorName} testId="text-vendor" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Fee (AED)</span>
                {editingFee ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="border border-border rounded px-2 py-1 text-sm w-24"
                      value={serviceFeeAed}
                      onChange={e => setServiceFeeAed(e.target.value)}
                      step="0.01"
                      min="0"
                      data-testid="input-edit-fee"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => updateSrMutation.mutate({ serviceFeeAed })}
                      disabled={updateSrMutation.isPending || isClosed}
                      data-testid="button-save-fee"
                    >Save</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => { setEditingFee(false); setServiceFeeAed(sr.serviceFeeAed || ""); }}
                      data-testid="button-cancel-fee"
                    >Cancel</Button>
                  </div>
                ) : (
                  <button
                    className="text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => { if (!isClosed) { setServiceFeeAed(sr.serviceFeeAed || ""); setEditingFee(true); } }}
                    disabled={isClosed}
                    data-testid="button-edit-fee"
                  >
                    {sr.serviceFeeAed ? `AED ${Number(sr.serviceFeeAed).toFixed(2)}` : "—"}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow label="Type" value={sr.documentType} testId="text-doc-type" />
              <InfoRow label="Description" value={sr.documentNameDescription} testId="text-doc-desc" />
              <InfoRow label="Class" value={sr.documentClass} testId="text-doc-class" />
              {sr.homeCountry && <InfoRow label="Home Country" value={sr.homeCountry} testId="text-home-country" />}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Original Involved</span>
                <span className="text-sm font-medium" data-testid="text-original-involved">
                  {sr.originalDocumentInvolved ? "Yes" : "No"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Physical Custody &amp; Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow
                label="Custody Status"
                value={CUSTODY_LABELS[sr.physicalCustodyStatus] || sr.physicalCustodyStatus}
                testId="text-custody-status"
              />
              {sr.currentCustodian && (
                <InfoRow label="Custodian" value={sr.currentCustodian} testId="text-custodian" />
              )}
              <InfoRow
                label="Responsible Staff"
                value={sr.responsibleStaffName ?? null}
                testId="text-responsible-staff"
              />
            </CardContent>
          </Card>
        </div>

        {sr.steps && sr.steps.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Process Steps</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {sr.steps.map(step => (
                <StepRow key={step.id} step={step} />
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="activity-log">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Service Request Created</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sr.createdAt).toLocaleString()} — by {sr.responsibleStaffName || "Staff"}
                  </p>
                  <p className="text-xs text-muted-foreground">Status set to: Draft</p>
                </div>
              </div>
              {sr.status !== "Draft" && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Status Updated</p>
                    <p className="text-xs text-muted-foreground">{new Date(sr.updatedAt).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Current status: {SR_STATUS_LABELS[sr.status] || sr.status}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Internal Notes</CardTitle>
            {!isClosed && !editingNotes && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => { setInternalNotes(sr.internalNotes || ""); setEditingNotes(true); }}
                data-testid="button-edit-notes"
              >
                {sr.internalNotes ? "Edit" : "Add"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  rows={3}
                  placeholder="Internal notes (not visible to vendor)"
                  data-testid="textarea-internal-notes"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => updateSrMutation.mutate({ internalNotes })}
                    disabled={updateSrMutation.isPending}
                    data-testid="button-save-notes"
                  >
                    {updateSrMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setEditingNotes(false)}
                    data-testid="button-cancel-notes"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic" data-testid="text-internal-notes">
                {sr.internalNotes || "No internal notes."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function InfoRow({ label, value, testId, mono }: { label: string; value?: string | null; testId: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-sm font-medium text-right truncate ${mono ? "font-mono" : ""}`}
        data-testid={testId}
      >
        {value || <span className="text-muted-foreground italic font-normal">—</span>}
      </span>
    </div>
  );
}
