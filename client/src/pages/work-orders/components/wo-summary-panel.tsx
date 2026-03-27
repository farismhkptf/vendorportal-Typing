import { toProperCase } from "@/lib/proper-case";
import { Building2, Mail, MapPin, User } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import type { WorkOrderDetail } from "./types";

interface WoSummaryPanelProps {
  workOrder: WorkOrderDetail;
}

export function WoSummaryPanel({ workOrder }: WoSummaryPanelProps) {
  return (
    <SectionCard title="Company Snapshot">
      {workOrder.company ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Company</p>
              <p className="font-medium text-foreground">{toProperCase(workOrder.company.name)}</p>
            </div>
          </div>

          {workOrder.company.emails && workOrder.company.emails.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Client Emails</p>
                <div className="space-y-1">
                  {workOrder.company.emails.filter(e => e.active).map((email, i) => (
                    <p key={i} className="text-sm text-foreground">
                      <span className="text-muted-foreground">{email.label}:</span> {email.email}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(workOrder.company.preferredMedicalCenter || workOrder.company.preferredEidCenter) && (
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Preferred Centers</p>
                {workOrder.company.preferredMedicalCenter && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Medical:</span> {workOrder.company.preferredMedicalCenter.name}
                  </p>
                )}
                {workOrder.company.preferredEidCenter && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">EID:</span> {workOrder.company.preferredEidCenter.name}
                  </p>
                )}
              </div>
            </div>
          )}

          {(workOrder.company.rmStaff || workOrder.company.assistStaff) && (
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assigned Staff</p>
                {workOrder.company.rmStaff && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">RM:</span> {workOrder.company.rmStaff.name}
                  </p>
                )}
                {workOrder.company.assistStaff && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Assist:</span> {workOrder.company.assistStaff.name}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Company information not available</p>
      )}
    </SectionCard>
  );
}
