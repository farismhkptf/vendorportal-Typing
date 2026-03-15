import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EnrichedApproval {
  id: string;
  typingJobId: string;
  vendorId: string;
  calculatedAmount: number;
  adjustedAmount: number | null;
  status: string;
  createdAt: string;
  job: { id: string; jobCode: string; status: string } | null;
  workOrder: { woNumber: string; applicantName: string } | null;
  vendor: { id: string; name: string } | null;
  jobType: { name: string; category: string } | null;
}

export default function AdminApprovals() {
  const { toast } = useToast();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");

  const { data: approvals, isLoading } = useQuery<EnrichedApproval[]>({
    queryKey: ["/api/admin/approvals"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, adjustedAmount }: { id: string; adjustedAmount?: number }) => {
      return apiRequest("POST", `/api/admin/approvals/${id}/approve`, 
        adjustedAmount !== undefined ? { adjustedAmount } : {}
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals"] });
      setAdjustId(null);
      setAdjustAmount("");
      toast({ title: "Approval processed successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to approve", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", `/api/admin/approvals/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals"] });
      setRejectId(null);
      setRejectReason("");
      toast({ title: "Approval rejected" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to reject", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!approvals || approvals.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="No pending approvals"
        description="All vendor submissions have been reviewed."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold tracking-tight" data-testid="text-approvals-heading">Pending Approvals</h2>
        <Badge variant="secondary">{approvals.length} pending</Badge>
      </div>

      {approvals.map((approval) => (
        <Card key={approval.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium" data-testid={`text-wo-${approval.id}`}>
                    {approval.workOrder?.woNumber || "N/A"}
                  </span>
                  {approval.job?.jobCode && (
                    <span className="text-sm font-mono text-muted-foreground">{approval.job.jobCode}</span>
                  )}
                  {approval.jobType && (
                    <Badge variant="outline" className="text-xs">{approval.jobType.category} - {approval.jobType.name}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {approval.workOrder?.applicantName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Vendor: {approval.vendor?.name || "Unknown"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-medium" data-testid={`text-amount-${approval.id}`}>
                    Amount: AED {approval.calculatedAmount.toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAdjustId(approval.id);
                    setAdjustAmount(String(approval.calculatedAmount));
                  }}
                  data-testid={`button-adjust-${approval.id}`}
                >
                  Adjust
                </Button>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate({ id: approval.id })}
                  disabled={approveMutation.isPending}
                  className="gap-1"
                  data-testid={`button-approve-${approval.id}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRejectId(approval.id)}
                  data-testid={`button-reject-${approval.id}`}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={adjustId !== null} onOpenChange={() => setAdjustId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Deduction Amount</DialogTitle>
            <DialogDescription>Change the amount to deduct from the vendor's wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount (AED)</label>
            <Input
              type="number"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              data-testid="input-adjust-amount"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustId(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (adjustId) {
                  approveMutation.mutate({ 
                    id: adjustId, 
                    adjustedAmount: parseInt(adjustAmount) || 0 
                  });
                }
              }}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-adjust"
            >
              Approve with Adjusted Amount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectId !== null} onOpenChange={() => setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>The job will be sent back to the vendor for corrections.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this submission is being rejected..."
              className="min-h-20 resize-none"
              data-testid="input-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectId) {
                  rejectMutation.mutate({ id: rejectId, reason: rejectReason });
                }
              }}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
