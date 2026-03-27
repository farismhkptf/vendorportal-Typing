import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnhancedUploader } from "@/components/enhanced-uploader";
import { GlassCard } from "@/components/vendor-v2/layout";
import type { File as FileType } from "@shared/schema";
import type { LightboxFile } from "@/components/image-lightbox";
import type { VendorJobDetails, EidCenter } from "./types";

interface CompletionStepProps {
  job: VendorJobDetails;
  isEid: boolean;
  isMedical: boolean;
  isTerminal: boolean;
  isInProgress: boolean;
  appRefNo: string;
  setAppRefNo: (v: string) => void;
  bioRequired: boolean;
  setBioRequired: (v: boolean) => void;
  bioDate: string;
  setBioDate: (v: string) => void;
  bioTime: string;
  setBioTime: (v: string) => void;
  bioCenter: string;
  setBioCenter: (v: string) => void;
  bioNotes: string;
  setBioNotes: (v: string) => void;
  outputFiles: FileType[];
  onUploadComplete: (file: { fileName: string; objectPath: string }) => void;
  onDeleteFile: (fileId: string) => void;
  onComplete: () => void;
  completePending: boolean;
  onShowResubmission: () => void;
  onOpenLightbox: (files: FileType[], index: number) => void;
}

export function CompletionStep({
  job, isEid, isMedical, isTerminal, isInProgress,
  appRefNo, setAppRefNo, bioRequired, setBioRequired,
  bioDate, setBioDate, bioTime, setBioTime, bioCenter, setBioCenter,
  bioNotes, setBioNotes, outputFiles,
  onUploadComplete, onDeleteFile, onComplete, completePending,
  onShowResubmission, onOpenLightbox,
}: CompletionStepProps) {
  const eidCentersFiltered = useMemo(() => {
    if (!job?.eidCenters) return [];
    if (job.workOrder?.isVip) return job.eidCenters.filter(c => c.tier === "VIP");
    return job.eidCenters.filter(c => c.tier === "Normal" || !c.tier);
  }, [job?.eidCenters, job?.workOrder?.isVip]);

  return (
    <div className="space-y-4" data-testid="v2-step-complete">
      <p className="text-sm text-slate-500 dark:text-white/50">
        {isTerminal
          ? "This job has been finalized. Review details below."
          : "Complete the fields, upload your work, and submit."}
      </p>

      {isTerminal && (
        <GlassCard accent={job.status === "ReadyForScheduling" || job.status === "Returned" ? "green" : undefined} className="p-4">
          <div className="flex items-start gap-3">
            {job.status === "ReadyForScheduling" || job.status === "Returned" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-slate-400 dark:text-white/50 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {job.status === "ReadyForScheduling" || job.status === "Returned" ? "Job Completed" :
                 job.status === "Aborted" ? "Job Aborted" :
                 job.status === "Rejected" ? "Job Rejected" :
                 job.status === "OnHold" ? "Job On Hold" : "Status: " + job.status}
              </p>
              <p className="text-xs text-slate-400 dark:text-white/40 mt-0.5">
                {job.status === "ReadyForScheduling" || job.status === "Returned"
                  ? "Your work has been submitted. Cost deducted from wallet."
                  : "No further actions required."}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-4 space-y-3">
        <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider">Application Reference Number</p>
        <input
          value={appRefNo}
          onChange={(e) => setAppRefNo(e.target.value)}
          placeholder="e.g. 201-2024-1234567"
          disabled={isTerminal}
          className="glass-input w-full px-3 py-2.5 text-sm"
          data-testid="v2-input-app-ref"
        />
      </GlassCard>

      {isMedical && job.preferredCenter && (
        <GlassCard className="p-4">
          <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-2">Medical Center</p>
          <p className="text-sm text-slate-900 dark:text-white font-medium">{job.preferredCenter.name}</p>
          {job.preferredCenter.area && <p className="text-xs text-slate-400 dark:text-white/40">{job.preferredCenter.area}</p>}
        </GlassCard>
      )}

      {isEid && (
        <GlassCard className="p-4 space-y-3">
          <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider">Biometrics Details</p>
          <div className="flex items-center gap-2">
            <Checkbox
              id="v2-bio-required"
              checked={bioRequired}
              onCheckedChange={(checked) => setBioRequired(!!checked)}
              disabled={isTerminal}
              data-testid="v2-checkbox-bio"
              className="border-slate-300 dark:border-white/30 data-[state=checked]:bg-amber-100 dark:data-[state=checked]:bg-white/20 data-[state=checked]:border-amber-300 dark:data-[state=checked]:border-white/40"
            />
            <label htmlFor="v2-bio-required" className="text-sm text-slate-700 dark:text-white/80">Biometrics appointment required</label>
          </div>
          {bioRequired && (
            <div className="space-y-3 pl-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 dark:text-white/40 mb-1 block">Date</label>
                  <input type="date" value={bioDate} onChange={(e) => setBioDate(e.target.value)} disabled={isTerminal} className="glass-input w-full px-3 py-2 text-sm" data-testid="v2-input-bio-date" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 dark:text-white/40 mb-1 block">Time</label>
                  <input type="time" value={bioTime} onChange={(e) => setBioTime(e.target.value)} disabled={isTerminal} className="glass-input w-full px-3 py-2 text-sm" data-testid="v2-input-bio-time" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-white/40 mb-1 block">EID Center</label>
                {eidCentersFiltered.length > 0 ? (
                  <Select value={bioCenter} onValueChange={setBioCenter} disabled={isTerminal}>
                    <SelectTrigger className="glass-input border-0" data-testid="v2-select-bio-center">
                      <SelectValue placeholder="Select a center..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eidCentersFiltered.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.area ? ` - ${c.area}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <input value={bioCenter} onChange={(e) => setBioCenter(e.target.value)} placeholder="EID center name" disabled={isTerminal} className="glass-input w-full px-3 py-2 text-sm" data-testid="v2-input-bio-center" />
                )}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-400 dark:text-white/40 mb-1 block">Notes</label>
            <textarea
              value={bioNotes}
              onChange={(e) => setBioNotes(e.target.value)}
              placeholder="Any notes about biometrics..."
              disabled={isTerminal}
              className="glass-input w-full px-3 py-2 text-sm min-h-[60px] resize-none"
              data-testid="v2-input-bio-notes"
            />
          </div>
          {!isTerminal && (
            <p className="text-[10px] text-slate-400 dark:text-white/40 italic">Biometrics are saved automatically when you complete the job.</p>
          )}
        </GlassCard>
      )}

      <GlassCard className="p-4 space-y-3">
        <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider">Upload Completed Work</p>
        <p className="text-xs text-slate-400 dark:text-white/30">Upload the completed application documents (up to 5 files).</p>
        <EnhancedUploader
          existingFiles={outputFiles.map(f => ({
            id: f.id, fileName: f.fileName || "File",
            fileUrl: f.workdriveLink || undefined, mimeType: f.mimeType,
            createdAt: f.createdAt ? String(f.createdAt) : undefined,
          }))}
          onUploadComplete={(file) => onUploadComplete(file)}
          onDelete={(fileId) => onDeleteFile(fileId)}
          maxFiles={5}
          disabled={isTerminal}
          onPreviewFile={(file) => {
            if (file.fileUrl) {
              const idx = outputFiles.findIndex(f => f.id === file.id);
              onOpenLightbox(outputFiles, idx >= 0 ? idx : 0);
            }
          }}
        />
      </GlassCard>

      {isInProgress && (
        <div className="flex gap-2 pt-2">
          <div className="flex-1 relative group">
            <button
              onClick={onComplete}
              disabled={completePending || outputFiles.length === 0}
              className="glass-btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="v2-button-complete-job"
            >
              {completePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {completePending ? "Submitting..." : "Mark as Completed"}
            </button>
            {outputFiles.length === 0 && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" data-testid="tooltip-upload-first">
                Upload results first
              </div>
            )}
          </div>
          <button
            onClick={onShowResubmission}
            className="glass-pill px-4 py-2.5 text-sm font-medium flex items-center gap-2"
            data-testid="v2-button-resubmit-step3"
          >
            <RotateCcw className="h-4 w-4" /> Resubmit
          </button>
        </div>
      )}
    </div>
  );
}
