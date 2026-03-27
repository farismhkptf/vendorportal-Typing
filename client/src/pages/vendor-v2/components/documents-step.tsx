import { useMemo } from "react";
import { FileText, Download, Check, Eye, Zap, RotateCcw, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/vendor-v2/layout";
import type { File as FileType } from "@shared/schema";
import type { LightboxFile } from "@/components/image-lightbox";
import type { VendorJobDetails } from "./types";
import { DOCUMENT_TYPE_LABELS } from "./types";

interface DocumentsStepProps {
  job: VendorJobDetails;
  inputFiles: FileType[];
  isSentToVendor: boolean;
  onStartWork: () => void;
  startWorkPending: boolean;
  onShowResubmission: () => void;
  onOpenLightbox: (files: (FileType | { id: string; fileName: string; fileUrl: string; mimeType: string | null })[], index: number) => void;
}

export function DocumentsStep({ job, inputFiles, isSentToVendor, onStartWork, startWorkPending, onShowResubmission, onOpenLightbox }: DocumentsStepProps) {
  const filteredRequirements = useMemo(() => {
    if (!job?.documentRequirements) return [];
    return job.documentRequirements.filter(req => {
      if (job.jobType?.category === "Medical" && !req.appliesToMedical) return false;
      if (job.jobType?.category === "EID" && !req.appliesToEid) return false;
      return true;
    });
  }, [job?.documentRequirements, job?.jobType?.category]);

  const allDownloadableFiles = useMemo(() => {
    const docs: { url: string; name: string }[] = [];
    job?.woDocuments?.forEach(d => { if (d.fileUrl) docs.push({ url: d.fileUrl, name: d.fileName }); });
    inputFiles.forEach(f => { if (f.workdriveLink) docs.push({ url: f.workdriveLink, name: f.fileName || "document" }); });
    return docs;
  }, [job?.woDocuments, inputFiles]);

  return (
    <div className="space-y-4" data-testid="v2-step-documents">
      <p className="text-sm text-slate-500 dark:text-white/50">Review the uploaded documents. Verify everything is correct before proceeding.</p>

      {allDownloadableFiles.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              allDownloadableFiles.forEach((file, i) => {
                setTimeout(() => {
                  const a = document.createElement("a");
                  a.href = file.url; a.download = file.name; a.target = "_blank"; a.rel = "noopener noreferrer";
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                }, i * 300);
              });
            }}
            className="glass-pill px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
            data-testid="v2-button-download-all"
          >
            <Download className="h-3.5 w-3.5" /> Download All ({allDownloadableFiles.length})
          </button>
        </div>
      )}

      {filteredRequirements.length > 0 && (
        <GlassCard className="p-4">
          <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">Document Checklist</p>
          <p className="text-xs text-slate-400 dark:text-white/40 mb-3">
            Documents marked with * are required and must be uploaded by the team before you proceed.
          </p>
          <div className="space-y-2">
            {filteredRequirements.map(req => {
              const label = DOCUMENT_TYPE_LABELS[req.documentType] || req.documentType;
              const matchingDoc = job.woDocuments?.find(d => d.documentType === req.documentType);
              const isImage = matchingDoc?.mimeType?.startsWith("image/");
              return (
                <div key={req.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-white/5" data-testid={`v2-docreq-${req.documentType}`}>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${matchingDoc ? "bg-emerald-500/20" : "bg-slate-100 dark:bg-white/10"}`}>
                    {matchingDoc ? <Check className="h-4 w-4 text-emerald-400" /> : <FileText className="h-4 w-4 text-slate-400 dark:text-white/30" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-white/80">{label}{req.isRequired ? " *" : ""}</p>
                    {matchingDoc && <p className="text-[11px] text-slate-400 dark:text-white/30 truncate">{matchingDoc.fileName}</p>}
                  </div>
                  {matchingDoc?.fileUrl && (
                    <a href={matchingDoc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" onClick={(e) => e.stopPropagation()}>
                      {isImage ? (
                        <img src={matchingDoc.fileUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <Download className="h-4 w-4 text-slate-400 dark:text-white/40" />
                      )}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {inputFiles.length > 0 && (
        <GlassCard className="p-4">
          <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3">Additional Files</p>
          <div className="space-y-2">
            {inputFiles.map((f, idx) => (
              <div key={f.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/5" data-testid={`v2-input-file-${f.id}`}>
                <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-sm text-slate-600 dark:text-white/70 flex-1 truncate">{f.fileName || "File"}</span>
                {f.workdriveLink && (
                  <button onClick={() => onOpenLightbox(inputFiles, idx)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                    <Eye className="h-4 w-4 text-slate-400 dark:text-white/40" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {isSentToVendor && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={onStartWork}
            disabled={startWorkPending}
            className="glass-btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
            data-testid="v2-button-start-work"
          >
            {startWorkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {startWorkPending ? "Starting..." : "Accept & Start Work"}
          </button>
          <button
            onClick={onShowResubmission}
            className="glass-pill px-4 py-2.5 text-sm font-medium flex items-center gap-2"
            data-testid="v2-button-resubmit-step2"
          >
            <RotateCcw className="h-4 w-4" /> Resubmit
          </button>
        </div>
      )}
    </div>
  );
}
