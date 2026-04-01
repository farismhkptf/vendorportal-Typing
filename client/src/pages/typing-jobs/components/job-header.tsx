import { Link } from "wouter";
import {
  ArrowLeft, Home, ChevronRight, AlertTriangle, XCircle
} from "lucide-react";
import { DOCUMENT_TYPE_LABELS } from "@/components/documents/document-types";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TypingJob, WorkOrder, Company, JobType, Vendor, TypingJobResult, TypingJobComment, File as FileType, User as SchemaUser } from "@shared/schema";

export interface TypingJobWithDetails extends TypingJob {
  workOrder?: WorkOrder & { company?: Company; serviceType?: { id: string; name: string; category?: string | null } };
  jobType?: JobType;
  vendor?: Vendor;
  result?: TypingJobResult;
  comments?: TypingJobComment[];
  files?: FileType[];
  approval?: {
    id: string;
    status: string;
    calculatedAmount: number;
    adjustedAmount: number | null;
    rejectedReason: string | null;
    approvedBy: string | null;
    createdAt: string;
    resolvedAt: string | null;
  };
}

interface JobHeaderProps {
  job: TypingJobWithDetails;
  staffUsers: Pick<SchemaUser, "id" | "name" | "email" | "role" | "active">[];
  missingDocumentTypes: string[];
  onDismissMissingDocs: () => void;
}

export function JobHeader({ job, staffUsers, missingDocumentTypes, onDismissMissingDocs }: JobHeaderProps) {
  return (
    <>
      <div className="mb-3">
        <PageBreadcrumb items={[
          { label: "Typing Jobs", href: "/typing-jobs" },
          { label: job.jobCode || job.jobType?.name || "Job" }
        ]} />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Link href="/typing-jobs">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-home">
              <Home className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="page-title">
              Typing Job
            </h1>
            <StatusBadge status={job.status} />
            {job.workOrder?.isVip && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                VIP
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-mono text-foreground" data-testid="text-job-code-header">{job.jobCode || "-"}</span> • {job.workOrder?.woNumber} • {job.jobType?.name || "Typing Job"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/work-orders/${job.woId}`}>
            <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-view-wo">
              View WO
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {job.status === "Returned" && (
        <Card className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700" data-testid="alert-job-returned">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Job Returned by Vendor — Action Required</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  This job was returned by the vendor. Review the documents and comments, then resolve or re-assign the job.
                </p>
                {job.rejectedReason && (
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1 font-medium">Reason: {job.rejectedReason}</p>
                )}
                {job.assignedToUserId && (() => {
                  const assigned = staffUsers.find(u => u.id === job.assignedToUserId);
                  return assigned ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Assigned to: <span className="font-medium">{assigned.name}</span></p>
                  ) : null;
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {missingDocumentTypes.length > 0 && job.status === "Draft" && (
        <Card className="border border-destructive/30 bg-destructive/5" data-testid="card-missing-docs-warning">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">Missing required documents</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  The following documents must be uploaded before this job can be submitted to a vendor:
                </p>
                <ul className="space-y-0.5" data-testid="list-missing-docs">
                  {missingDocumentTypes.map((docType) => (
                    <li key={docType} className="flex items-center gap-1.5 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                      <span data-testid={`missing-doc-${docType}`}>
                        {DOCUMENT_TYPE_LABELS[docType] || docType}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-7 w-7"
                onClick={onDismissMissingDocs}
                data-testid="button-dismiss-missing-docs"
              >
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
