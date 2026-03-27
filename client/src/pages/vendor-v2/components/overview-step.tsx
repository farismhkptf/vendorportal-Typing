import { Phone, Mail, MapPin, MapPinned, UserCheck, Zap, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/vendor-v2/layout";
import dhaLogo from "@assets/dha-logo.svg";
import type { VendorJobDetails } from "./types";
import { toProperCase } from "./types";

interface OverviewStepProps {
  job: VendorJobDetails;
  isEid: boolean;
  isMedical: boolean;
  isSentToVendor: boolean;
  onStartWork: () => void;
  startWorkPending: boolean;
}

export function OverviewStep({ job, isEid, isMedical, isSentToVendor, onStartWork, startWorkPending }: OverviewStepProps) {
  const sent = job.sentAt ? new Date(String(job.sentAt)) : null;
  const sentDate = sent ? sent.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Not sent";
  const sentTime = sent ? sent.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";

  return (
    <div className="space-y-4" data-testid="v2-step-overview">
      <GlassCard className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">Company</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate" data-testid="text-v2-company">{toProperCase(job.company?.name)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">Service Type</p>
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate" data-testid="text-v2-service">{toProperCase(job.serviceType?.name)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">Job Type</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white" data-testid="text-v2-job-type">{job.jobType?.name || "N/A"}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">Received</p>
            <p className="text-sm text-slate-900 dark:text-white">{sentDate}</p>
            {sentTime && <p className="text-xs text-slate-400 dark:text-white/40">{sentTime}</p>}
          </div>
        </div>
      </GlassCard>

      {(job.workOrder?.applicantPhone || job.workOrder?.applicantEmail || job.company?.coordinatorMobile || job.company?.coordinatorEmail) && (
        <GlassCard className="p-4">
          <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">Contact Information</p>
          <div className="space-y-2">
            {job.workOrder?.applicantPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-white/30" />
                <span className="text-slate-500 dark:text-white/50">Applicant:</span>
                <span className="text-slate-900 dark:text-white font-medium">{job.workOrder.applicantPhone}</span>
              </div>
            )}
            {job.workOrder?.applicantEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-white/30" />
                <span className="text-slate-500 dark:text-white/50">Email:</span>
                <span className="text-slate-900 dark:text-white font-medium truncate">{job.workOrder.applicantEmail}</span>
              </div>
            )}
            {job.company?.coordinatorMobile && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-white/30" />
                <span className="text-slate-500 dark:text-white/50">Company:</span>
                <span className="text-slate-900 dark:text-white font-medium">{job.company.coordinatorMobile}</span>
              </div>
            )}
            {job.company?.coordinatorEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-white/30" />
                <span className="text-slate-500 dark:text-white/50">Client:</span>
                <span className="text-slate-900 dark:text-white font-medium truncate">{job.company.coordinatorEmail}</span>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {isEid && job.company?.deliveryAddress && (
        <GlassCard className="p-4">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-slate-400 dark:text-white/30 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">Delivery Address</p>
              <p className="text-sm text-slate-900 dark:text-white">{job.company.deliveryAddress}</p>
            </div>
          </div>
        </GlassCard>
      )}

      {job.preferredCenter && (
        <GlassCard className="p-4">
          <div className="flex items-start gap-2">
            <MapPinned className="h-4 w-4 text-slate-400 dark:text-white/30 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-0.5">
                {isMedical ? "Preferred Medical Center" : "Preferred Biometrics Center"}
              </p>
              <p className="text-sm text-slate-900 dark:text-white font-medium">{job.preferredCenter.name}</p>
              {job.preferredCenter.area && <p className="text-xs text-slate-400 dark:text-white/40">{job.preferredCenter.area}</p>}
            </div>
          </div>
        </GlassCard>
      )}

      {isSentToVendor && (
        <div className="pt-2">
          <button
            onClick={onStartWork}
            disabled={startWorkPending}
            className="glass-btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
            data-testid="v2-button-accept-step1"
          >
            {startWorkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {startWorkPending ? "Accepting..." : "Accept Job"}
          </button>
        </div>
      )}

      {job.sentByStaffName && (
        <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-white/40 px-1">
          <UserCheck className="h-3.5 w-3.5" />
          <span>Sent by:</span>
          <span className="text-slate-600 dark:text-white/60 font-medium">{toProperCase(job.sentByStaffName)}</span>
        </div>
      )}

      {job.workOrder?.notes && (
        <GlassCard accent="blue" className="p-4">
          <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-1">Special Instructions</p>
          <p className="text-sm text-slate-700 dark:text-white/80">{job.workOrder.notes}</p>
        </GlassCard>
      )}

      {isMedical && (
        <div className="flex items-center gap-2 px-1">
          <img
            src={dhaLogo}
            alt="Dubai Health Authority"
            className="h-7 w-auto object-contain"
            data-testid="v2-img-dha-logo"
          />
        </div>
      )}
    </div>
  );
}
