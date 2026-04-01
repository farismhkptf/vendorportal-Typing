import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Building2, FileText, CheckCircle2, XCircle,
  Clock, AlertCircle, ExternalLink, Loader2, Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLayout } from "@/components/layout/app-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  QuoteReceived: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  Converted: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

interface InquiryDetail {
  id: string;
  companyId: string;
  companyName: string | null;
  vendorId: string;
  vendorName: string | null;
  applicantName: string | null;
  documentType: string;
  documentNameDescription: string;
  documentClass: string;
  homeCountry: string | null;
  descriptionOfNeed: string;
  externalWoNumber: string | null;
  status: string;
  rejectionReason: string | null;
  convertedToSrId: string | null;
  createdAt: string;
  latestQuote: {
    id: string;
    quoteVersion: number;
    amountAed: number;
    timelineDays: number;
    notes: string | null;
    submittedAt: string;
  } | null;
  quotes: Array<{
    id: string;
    quoteVersion: number;
    amountAed: number;
    timelineDays: number;
    notes: string | null;
    submittedAt: string;
  }>;
  linkedSr: {
    id: string;
    externalWoNumber: string;
    status: string;
  } | null;
}

export default function InquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acceptData, setAcceptData] = useState({
    externalWoNumber: "",
    serviceName: "",
    serviceNotes: "",
  });

  const { data: inquiry, isLoading } = useQuery<InquiryDetail>({
    queryKey: ["/api/attestation/inquiries", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/attestation/inquiries/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load inquiry");
      return res.json();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/attestation/inquiries/${params.id}/reject`, { reason: rejectReason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/inquiries"] });
      toast({ title: "Inquiry rejected", description: "The inquiry has been closed as rejected." });
      setShowRejectForm(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to reject inquiry", variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/attestation/inquiries/${params.id}/accept`, acceptData);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/inquiries"] });
      toast({ title: "Inquiry accepted", description: "A Service Request has been created and sent to the vendor." });
      setShowAcceptForm(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to accept inquiry", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!inquiry) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-6 py-8 text-center">
          <p className="text-muted-foreground">Inquiry not found</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/attestation/inquiries")}>
            Back to Inquiries
          </Button>
        </div>
      </AppLayout>
    );
  }

  const canAct = inquiry.status === "Open" || inquiry.status === "QuoteReceived";

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/attestation/inquiries")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground" data-testid="page-title-inquiry-detail">
                {inquiry.documentType}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inquiry.status] || ""}`} data-testid="badge-inquiry-status">
                {inquiry.status === "QuoteReceived" ? "Quote Received" : inquiry.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{inquiry.companyName} · {inquiry.vendorName}</p>
          </div>
        </div>

        {inquiry.linkedSr && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Converted to Service Request</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">WO: {inquiry.linkedSr.externalWoNumber} · {inquiry.linkedSr.status}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => setLocation(`/work-orders/${inquiry.linkedSr!.id}`)} data-testid="link-converted-sr">
                <ExternalLink className="h-3.5 w-3.5" />
                View SR
              </Button>
            </CardContent>
          </Card>
        )}

        {inquiry.convertedToSrId && !inquiry.linkedSr && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Converted to Service Request</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => setLocation(`/work-orders/${inquiry.convertedToSrId}`)} data-testid="link-converted-sr">
                <ExternalLink className="h-3.5 w-3.5" />
                View SR
              </Button>
            </CardContent>
          </Card>
        )}

        {inquiry.rejectionReason && (
          <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-200">Rejection Reason</p>
                <p className="text-xs text-red-600 dark:text-red-400">{inquiry.rejectionReason}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Inquiry Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="text-sm font-medium text-foreground" data-testid="text-company-name">{inquiry.companyName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendor</p>
                <p className="text-sm font-medium text-foreground" data-testid="text-vendor-name">{inquiry.vendorName || "—"}</p>
              </div>
              {inquiry.applicantName && (
                <div>
                  <p className="text-xs text-muted-foreground">Applicant</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-applicant-name">{inquiry.applicantName}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Document Class</p>
                <p className="text-sm font-medium text-foreground">{inquiry.documentClass}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Document Name</p>
                <p className="text-sm font-medium text-foreground">{inquiry.documentNameDescription}</p>
              </div>
              {inquiry.homeCountry && (
                <div>
                  <p className="text-xs text-muted-foreground">Home Country</p>
                  <p className="text-sm font-medium text-foreground">{inquiry.homeCountry}</p>
                </div>
              )}
              {inquiry.externalWoNumber && (
                <div>
                  <p className="text-xs text-muted-foreground">External WO #</p>
                  <p className="text-sm font-mono font-medium text-foreground">{inquiry.externalWoNumber}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description of Need</p>
              <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">{inquiry.descriptionOfNeed}</p>
            </div>
          </CardContent>
        </Card>

        {inquiry.latestQuote && (
          <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-900/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Receipt className="h-4 w-4 text-amber-600" />
                Vendor Quote
                {inquiry.quotes.length > 1 && (
                  <span className="text-xs text-muted-foreground font-normal">(v{inquiry.latestQuote.quoteVersion} of {inquiry.quotes.length})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Quoted Fee</p>
                  <p className="text-lg font-bold text-foreground" data-testid="text-quote-amount">
                    {inquiry.latestQuote.amountAed.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">AED</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Timeline</p>
                  <p className="text-lg font-bold text-foreground" data-testid="text-quote-timeline">
                    {inquiry.latestQuote.timelineDays} <span className="text-sm font-normal text-muted-foreground">days</span>
                  </p>
                </div>
              </div>
              {inquiry.latestQuote.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{inquiry.latestQuote.notes}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Submitted {new Date(inquiry.latestQuote.submittedAt).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        )}

        {canAct && (
          <div className="space-y-3">
            {showAcceptForm ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-foreground">Accept Inquiry — Create Service Request</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="accept-wo">External WO Number *</Label>
                    <Input
                      id="accept-wo"
                      placeholder="Required before saving"
                      value={acceptData.externalWoNumber}
                      onChange={e => setAcceptData(d => ({ ...d, externalWoNumber: e.target.value }))}
                      data-testid="input-accept-wo-number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="accept-service">Service Name *</Label>
                    <Input
                      id="accept-service"
                      placeholder="e.g. UAE MOFA Attestation"
                      value={acceptData.serviceName}
                      onChange={e => setAcceptData(d => ({ ...d, serviceName: e.target.value }))}
                      data-testid="input-accept-service-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="accept-notes">Service Notes (optional)</Label>
                    <Textarea
                      id="accept-notes"
                      placeholder="Any additional notes for the vendor..."
                      rows={2}
                      value={acceptData.serviceNotes}
                      onChange={e => setAcceptData(d => ({ ...d, serviceNotes: e.target.value }))}
                      data-testid="textarea-accept-notes"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => acceptMutation.mutate()}
                      disabled={!acceptData.externalWoNumber || !acceptData.serviceName || acceptMutation.isPending}
                      data-testid="button-confirm-accept"
                    >
                      {acceptMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Service Request
                    </Button>
                    <Button variant="outline" onClick={() => setShowAcceptForm(false)} data-testid="button-cancel-accept">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : showRejectForm ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-foreground">Reject Inquiry</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="reject-reason">Rejection Reason *</Label>
                    <Textarea
                      id="reject-reason"
                      placeholder="Provide a reason for rejection..."
                      rows={3}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      data-testid="textarea-reject-reason"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => rejectMutation.mutate()}
                      disabled={!rejectReason.trim() || rejectMutation.isPending}
                      data-testid="button-confirm-reject"
                    >
                      {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Reject Inquiry
                    </Button>
                    <Button variant="outline" onClick={() => setShowRejectForm(false)} data-testid="button-cancel-reject">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowAcceptForm(true)}
                  className="flex-1"
                  data-testid="button-accept-inquiry"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept & Create SR
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowRejectForm(true)}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  data-testid="button-reject-inquiry"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
