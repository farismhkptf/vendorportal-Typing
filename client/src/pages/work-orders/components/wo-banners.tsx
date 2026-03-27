import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WoDocument } from "@shared/schema";
import type { WorkOrderDetail } from "./types";

interface WoBannersProps {
  workOrder: WorkOrderDetail;
  expiringOrExpiredDocs: WoDocument[];
  setActiveTab: (tab: string) => void;
}

export function WoBanners({ workOrder, expiringOrExpiredDocs, setActiveTab }: WoBannersProps) {
  return (
    <>
      {!!workOrder.isDelayed && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 animate-pulse" data-testid="delayed-banner">
          <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700 dark:text-red-300">DELAYED — Vendor Has Not Completed</p>
            <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-0.5">
              This work order is delayed — vendor has not completed the typing job within the expected timeframe. Immediate follow-up is recommended.
            </p>
          </div>
        </div>
      )}

      {expiringOrExpiredDocs.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700" data-testid="document-expiry-banner">
          <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
              {expiringOrExpiredDocs.some((d) => d.expiresAt && new Date(d.expiresAt) <= new Date())
                ? "Document(s) Expired"
                : "Document(s) Expiring Soon"}
            </p>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-0.5">
              {expiringOrExpiredDocs.length} document{expiringOrExpiredDocs.length !== 1 ? "s" : ""}{" "}
              {expiringOrExpiredDocs.some((d) => d.expiresAt && new Date(d.expiresAt) <= new Date()) ? "expired or expiring" : "expiring"}{" "}
              within 30 days. Check the Documents tab for details.
            </p>
          </div>
        </div>
      )}

      {(() => {
        const st = workOrder.serviceType;
        if (!st || workOrder.status === "Completed" || workOrder.status === "Cancelled") return null;
        const allJobs = workOrder.typingJobs || [];
        const activeJobs = allJobs.filter(j => j.status !== "Aborted");
        const hasMedicalJob = activeJobs.some(j => j.jobType?.category === "Medical");
        const hasEidJob = activeJobs.some(j => j.jobType?.category === "EID");

        const missingLabels: string[] = [];
        if (st.requiresMedicalTyping && !hasMedicalJob) missingLabels.push("Medical Typing");
        if (st.requiresIdTyping2Years && !hasEidJob) missingLabels.push("EID Typing (2 Years)");
        if (st.requiresIdTyping1Year && !hasEidJob) missingLabels.push("EID Typing (1 Year)");
        if (st.requiresIdTyping10Years && !hasEidJob) missingLabels.push("EID Typing (10 Years)");

        if (missingLabels.length === 0) return null;

        return (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-700" data-testid="missing-jobs-banner">
            <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-orange-700 dark:text-orange-300">Missing Required Typing Job{missingLabels.length > 1 ? "s" : ""}</p>
              <p className="text-sm text-orange-600/80 dark:text-orange-400/80 mt-0.5">
                {missingLabels.join(" and ")} {missingLabels.length > 1 ? "are" : "is"} required by this service type but not yet created.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0 border-orange-400 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
              onClick={() => {
                setActiveTab("typing");
              }}
              data-testid="button-create-missing-job"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Missing Job{missingLabels.length > 1 ? "s" : ""}
            </Button>
          </div>
        );
      })()}
    </>
  );
}
