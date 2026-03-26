import { Link } from "wouter";
import { Stethoscope, Fingerprint, Star, AlertTriangle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { toProperCase } from "@/lib/proper-case";
import { getInitials } from "@/lib/utils";
import { getMedicalStatus, getEidStatus, needsAttention, getCardBorderColor, getPipelineInfo } from "@/lib/pipeline-stage";
import { PipelineStageBadge, TypingStatusPill, AppointmentStatusPill } from "./status-pills";
import type { WorkOrderEnriched } from "./types";

interface WorkOrderCompactViewProps {
  items: WorkOrderEnriched[];
  photoMap?: Record<string, string>;
  density: "compact" | "comfortable";
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  renderContextMenu: (wo: WorkOrderEnriched, children: React.ReactNode) => React.ReactNode;
  renderMobileMenu: (wo: WorkOrderEnriched) => React.ReactNode;
}

export function WorkOrderCompactView({
  items, photoMap, density, selectedIds, toggleSelected,
  renderContextMenu, renderMobileMenu,
}: WorkOrderCompactViewProps) {
  return (
    <div className="space-y-1 stagger-children">
      {items.map((wo, index) => {
        const med = getMedicalStatus(wo);
        const eid = getEidStatus(wo);
        const attention = needsAttention(wo);
        const borderColor = getCardBorderColor(wo);
        const isSelected = selectedIds.has(wo.id);
        const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);

        return (
          <div key={wo.id} className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelected(wo.id)}
              aria-label={`Select ${wo.woNumber}`}
              data-testid={`checkbox-wo-compact-${wo.woNumber}`}
              className="hidden lg:flex"
            />
            {renderContextMenu(wo,
            <Link href={`/work-orders/${wo.id}`} className="flex-1 min-w-0">
              <div 
                className={`flex items-center justify-between gap-3 ${density === "comfortable" ? "py-2 px-3" : "py-1.5 px-2"} rounded-lg hover-elevate border-l-[3px] ${borderColor} opacity-0 animate-fade-in`}
                style={{ animationDelay: `${index * 0.02}s` }}
                data-testid={`work-order-compact-${wo.woNumber}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-wo-compact-${wo.woNumber}`}>
                    {photoMap?.[wo.id] ? (
                      <AvatarImage src={photoMap[wo.id]} alt={wo.applicantName} />
                    ) : null}
                    <AvatarFallback className="text-[9px] font-medium">{getInitials(wo.applicantName)}</AvatarFallback>
                  </Avatar>
                  <span className="font-mono text-sm font-medium text-foreground">{wo.woNumber}</span>
                  <span className="text-sm text-muted-foreground truncate">{toProperCase(wo.applicantName)}</span>
                  <PipelineStageBadge stage={wo.status === "Completed" ? "complete" : pipeline.overall} />
                  {wo.isVip && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                  {attention && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {med.hasMedical && (
                    <div className="flex items-center gap-1">
                      <Stethoscope className="h-3 w-3 text-muted-foreground" />
                      <TypingStatusPill status={med.typing} />
                      <AppointmentStatusPill status={med.appointment} />
                    </div>
                  )}
                  {eid.hasEid && (
                    <div className="flex items-center gap-1">
                      <Fingerprint className="h-3 w-3 text-muted-foreground" />
                      <TypingStatusPill status={eid.typing} />
                      <AppointmentStatusPill status={eid.appointment} />
                    </div>
                  )}
                </div>
              </div>
            </Link>
            )}
            {renderMobileMenu(wo)}
          </div>
        );
      })}
    </div>
  );
}
