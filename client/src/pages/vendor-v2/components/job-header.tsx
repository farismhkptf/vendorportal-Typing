import { User } from "lucide-react";
import type { VendorJobDetails } from "./types";

function toProperCase(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function getStatusClass(status: string): string {
  switch (status) {
    case "SubmittedToVendor": return "v2-status-new";
    case "InProcess": return "v2-status-inprogress";
    case "ReadyForScheduling":
    case "Returned": return "v2-status-completed";
    default: return "v2-status-default";
  }
}

function getDisplayStatus(status: string): string {
  switch (status) {
    case "SubmittedToVendor": return "New";
    case "InProcess": return "In Progress";
    case "ReadyForScheduling": return "Completed";
    case "Returned": return "Returned";
    case "Aborted": return "Aborted";
    case "Rejected": return "Rejected";
    case "OnHold": return "On Hold";
    default: return status;
  }
}

interface JobHeaderProps {
  job: VendorJobDetails;
  isEid: boolean;
  isVip: boolean | undefined;
  isUrgent: boolean | undefined;
}

export function JobHeader({ job, isEid, isVip, isUrgent }: JobHeaderProps) {
  const applicantPhoto = job.woDocuments?.find((d: any) => d.documentType === "Photo" && d.fileUrl);

  return (
    <div className="flex items-start gap-3 mb-4">
      {applicantPhoto ? (
        <div className="h-12 w-12 rounded-xl overflow-hidden border border-slate-200 dark:border-white/20 shrink-0">
          <img src={applicantPhoto.fileUrl} alt="Applicant" className="h-full w-full object-cover" data-testid="img-applicant-photo" />
        </div>
      ) : (
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${isEid ? "bg-amber-500/15" : "bg-teal-500/15"}`}>
          <User className="h-5 w-5 text-slate-400 dark:text-white/50" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white" data-testid="text-v2-wo-number">{job.workOrder?.woNumber || "N/A"}</h1>
          <span className={`${getStatusClass(job.status)} v2-status-badge`}>{getDisplayStatus(job.status)}</span>
          {isVip && <span className="v2-status-badge bg-amber-500/30 text-amber-300 border border-amber-500/40">VIP</span>}
          {isUrgent && <span className="v2-status-badge v2-status-urgent">Urgent</span>}
        </div>
        <p className="text-sm text-slate-500 dark:text-white/50 truncate" data-testid="text-v2-applicant">{toProperCase(job.workOrder?.applicantName)}</p>
      </div>
    </div>
  );
}
