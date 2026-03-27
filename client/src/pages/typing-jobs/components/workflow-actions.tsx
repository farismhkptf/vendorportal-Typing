import {
  UserPlus, RotateCcw, Clock, AlertCircle, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TypingJobWithDetails } from "./job-header";

interface WorkflowActionsProps {
  job: TypingJobWithDetails;
  onSubmitToVendor: () => void;
  onResume: () => void;
  onOnHold: () => void;
  onAbort: () => void;
  onReassign: () => void;
  resumePending: boolean;
}

export function WorkflowActions({
  job,
  onSubmitToVendor,
  onResume,
  onOnHold,
  onAbort,
  onReassign,
  resumePending,
}: WorkflowActionsProps) {
  return (
    <Card className="border border-primary/20 bg-primary/5">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-3">
          {job.status === "Draft" && (
            <Button
              size="sm"
              className="gap-2"
              onClick={onSubmitToVendor}
              data-testid="button-submit-to-vendor"
            >
              <UserPlus className="h-4 w-4" />
              Submit to Vendor
            </Button>
          )}

          {job.status === "OnHold" && (
            <Button
              size="sm"
              className="gap-2"
              onClick={onResume}
              disabled={resumePending}
              data-testid="button-resume"
            >
              {resumePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Resume Job
            </Button>
          )}

          {["SubmittedToVendor", "InProcess"].includes(job.status) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onOnHold}
              data-testid="button-on-hold"
            >
              <Clock className="h-4 w-4" />
              On Hold
            </Button>
          )}

          {["Draft", "SubmittedToVendor", "InProcess", "OnHold"].includes(job.status) && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={onAbort}
              data-testid="button-abort"
            >
              <AlertCircle className="h-4 w-4" />
              Abort
            </Button>
          )}

          {(job.status === "Aborted" || job.status === "Rejected") && (
            <>
              <Badge variant="outline" className={job.status === "Rejected"
                ? "bg-orange-50 text-orange-700 border-orange-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
              }>
                {job.status === "Rejected" ? "Vendor Rejected" : "Job Aborted"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={onReassign}
                className="gap-2"
                data-testid="button-reassign-job"
              >
                <UserPlus className="h-4 w-4" />
                Re-assign to Vendor
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
