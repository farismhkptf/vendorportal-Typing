import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import {
  FileText,
  Stethoscope,
  CreditCard,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function ExpandedTypingJobCard({ job, woId, onRefresh }: { job: any; woId: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const { toast } = useToast();

  const { data: jobDetail } = useQuery<any>({
    queryKey: queryKeys.typingJob(job.id),
    enabled: expanded,
  });

  const abortMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/typing-jobs/${job.id}/abort`, { reason: "Cancelled from WO detail" }),
    onSuccess: () => {
      onRefresh();
      toast({ title: "Job cancelled" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const category = job.jobType?.category;
  const result = jobDetail?.result || job.result;
  const vendor = jobDetail?.vendor;
  const files = jobDetail?.files || [];
  const comments = jobDetail?.comments || [];

  const isReturned = job.status === "Returned";

  return (
    <Card className={cn("border", isReturned ? "border-amber-300 dark:border-amber-700" : "border-border/50")} data-testid={`typing-job-card-${job.id}`}>
      {isReturned && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Returned by Vendor — Action Required</p>
          <Link href={`/typing-jobs/${job.id}`}>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs text-amber-700 dark:text-amber-300 underline ml-auto" data-testid={`button-view-returned-job-${job.id}`}>
              View Job
            </Button>
          </Link>
        </div>
      )}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                category === "Medical" ? "bg-rose-50 dark:bg-rose-900/30" : "bg-cyan-50 dark:bg-cyan-900/30"
              )}>
                {category === "Medical" ? (
                  <Stethoscope className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                ) : (
                  <CreditCard className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {category === "Medical" ? "Medical" : category === "EID" ? "Emirates ID" : "Typing"}
                  </span>
                  {job.jobCode && <span className="text-xs text-muted-foreground font-mono">{job.jobCode}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {vendor && <span>Vendor: {vendor.name}</span>}
                  {!vendor && job.vendorId && <span>Assigned to vendor</span>}
                  {job.sentAt && <span>Sent {formatDate(job.sentAt)}</span>}
                  {!job.sentAt && <span>Created {formatDate(job.createdAt)}</span>}
                  {job.jobType?.cost > 0 && <span>AED {job.jobType.cost}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(job.status === "SubmittedToVendor" || job.status === "InProcess") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); setShowAbortConfirm(true); }}
                  disabled={abortMutation.isPending}
                  data-testid={`button-abort-${job.id}`}
                >
                  <XCircle className="h-3 w-3" />
                  Abort Job
                </Button>
              )}
              <StatusBadge status={job.status} />
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-expand-${job.id}`}>
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {result && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {result.applicationNumber && (
                  <div>
                    <span className="text-muted-foreground">Application No</span>
                    <p className="font-medium text-primary">{result.applicationNumber}</p>
                  </div>
                )}
                {result.centerName && (
                  <div>
                    <span className="text-muted-foreground">Center</span>
                    <p className="font-medium">{result.centerName}</p>
                  </div>
                )}
                {result.biometricsRequired && result.biometricsDate && (
                  <div>
                    <span className="text-muted-foreground">Biometrics</span>
                    <p className="font-medium">{formatDate(result.biometricsDate)}</p>
                  </div>
                )}
                {result.vendorNotes && (
                  <div className="col-span-full">
                    <span className="text-muted-foreground">Vendor Notes</span>
                    <p className="font-medium">{result.vendorNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {files.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Documents ({files.length})</p>
                <div className="grid grid-cols-2 gap-2">
                  {files.slice(0, 6).map((f: any) => (
                    <div key={f.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/50">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{f.originalName || f.filename}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{f.direction}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {comments.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Comments ({comments.length})</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {comments.slice(0, 3).map((c: any) => (
                    <div key={c.id} className="text-xs p-2 rounded-lg bg-muted/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{c.authorName || "Team"}</span>
                        <span className="text-muted-foreground">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-muted-foreground">{c.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-1">
              <Link href={`/typing-jobs/${job.id}`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs" data-testid={`button-view-full-${job.id}`}>
                  View Full Details
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      <ConfirmationDialog
        open={showAbortConfirm}
        onOpenChange={setShowAbortConfirm}
        title="Abort Typing Job"
        description="This will cancel the typing job permanently. The job can be re-assigned to a vendor later, but any in-progress work will be lost."
        confirmLabel="Abort Job"
        destructive
        onConfirm={async () => { await abortMutation.mutateAsync(); }}
      />
    </Card>
  );
}
