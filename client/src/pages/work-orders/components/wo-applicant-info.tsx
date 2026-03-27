import { toProperCase } from "@/lib/proper-case";
import { FileText, User, Phone, Star } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { CopyableText } from "@/components/ui/copy-button";
import type { ServiceType } from "@shared/schema";
import type { WorkOrderDetail } from "./types";

interface WoApplicantInfoProps {
  workOrder: WorkOrderDetail;
  serviceTypes?: ServiceType[];
}

export function WoApplicantInfo({ workOrder, serviceTypes }: WoApplicantInfoProps) {
  return (
    <SectionCard title="Work Order Summary">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Work Order Number</p>
              <CopyableText value={workOrder.woNumber} className="font-medium text-foreground" testId={`copy-wo-${workOrder.id}`}>
                {workOrder.woNumber}
              </CopyableText>
            </div>
            {workOrder.isVip && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
                <Star className="h-3 w-3 fill-current" />
                VIP
              </span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Applicant Name</p>
            <p className="font-medium text-foreground">{toProperCase(workOrder.applicantName)}</p>
          </div>
        </div>
        {(workOrder.applicantPhone || workOrder.applicantEmail) && (
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Applicant Contact</p>
              {workOrder.applicantPhone && (
                <CopyableText value={workOrder.applicantPhone} className="text-sm text-foreground" testId={`copy-phone-${workOrder.id}`}>
                  {workOrder.applicantPhone}
                </CopyableText>
              )}
              {workOrder.applicantEmail && (
                <CopyableText value={workOrder.applicantEmail} className="text-sm text-foreground" testId={`copy-email-${workOrder.id}`}>
                  {workOrder.applicantEmail}
                </CopyableText>
              )}
            </div>
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Service Type</p>
            <p className="font-medium text-foreground">
              {workOrder.serviceTypeId 
                ? serviceTypes?.find(st => st.id === workOrder.serviceTypeId)?.name || "Unknown"
                : "Not specified"}
            </p>
          </div>
        </div>
        {workOrder.notes && (
          <div className="pt-3 border-t border-border">
            <p className="text-sm text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-foreground">{workOrder.notes}</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
