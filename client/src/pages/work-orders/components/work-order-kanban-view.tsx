import { Link } from "wouter";
import { Building2, Star, AlertTriangle, ArrowRight, Stethoscope, Fingerprint } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { toProperCase } from "@/lib/proper-case";
import { getInitials } from "@/lib/utils";
import { getMedicalStatus, getEidStatus, needsAttention, getCardBorderColor, getPipelineInfo, getNextAction } from "@/lib/pipeline-stage";
import { PipelineStageBadge, NextActionIndicator, MedEidStatusRow } from "./status-pills";
import type { WorkOrderEnriched } from "./types";

const STATUS_ORDER = ["Draft", "AtVendor", "ReadyToSchedule", "Scheduled", "Completed", "Cancelled"] as const;

interface WorkOrderKanbanViewProps {
  groups: Record<string, WorkOrderEnriched[]>;
  photoMap?: Record<string, string>;
  renderContextMenu: (wo: WorkOrderEnriched, children: React.ReactNode) => React.ReactNode;
}

export function WorkOrderKanbanView({ groups, photoMap, renderContextMenu }: WorkOrderKanbanViewProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUS_ORDER.map((status) => (
        <div key={status} className="flex-shrink-0 w-72">
          <div className="flex items-center justify-between gap-2 mb-3 px-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-xs text-muted-foreground">({groups[status]?.length || 0})</span>
            </div>
          </div>
          <div className="space-y-2 min-h-[200px] p-2 rounded-xl bg-muted/30">
            {groups[status]?.map((wo, index) => {
              const med = getMedicalStatus(wo);
              const eid = getEidStatus(wo);
              const borderColor = getCardBorderColor(wo);
              const attention = needsAttention(wo);
              const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
              const nextAction = getNextAction(wo.typingJobs || [], wo.appointments || [], pipeline);
              return (
                <div key={wo.id}>
                {renderContextMenu(wo,
                <Link href={`/work-orders/${wo.id}`}>
                  <div 
                    className={`premium-card p-3 border-l-[3px] ${borderColor} opacity-0 animate-fade-in`}
                    style={{ animationDelay: `${index * 0.03}s` }}
                    data-testid={`work-order-kanban-${wo.woNumber}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="font-mono text-sm font-medium text-foreground">{wo.woNumber}</span>
                      <PipelineStageBadge stage={wo.status === "Completed" ? "complete" : pipeline.overall} />
                      {wo.isVip && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                      {attention && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-wo-kanban-${wo.woNumber}`}>
                        {photoMap?.[wo.id] ? (
                          <AvatarImage src={photoMap[wo.id]} alt={wo.applicantName} />
                        ) : null}
                        <AvatarFallback className="text-[9px] font-medium">{getInitials(wo.applicantName)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground truncate">{toProperCase(wo.applicantName)}</span>
                    </div>
                    {wo.company && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{toProperCase(wo.company.name)}</span>
                      </div>
                    )}
                    {(med.hasMedical || eid.hasEid) && (
                      <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                        <MedEidStatusRow icon={Stethoscope} label="Med" typing={med.typing} appointment={med.appointment} hasData={med.hasMedical} />
                        <MedEidStatusRow icon={Fingerprint} label="EID" typing={eid.typing} appointment={eid.appointment} hasData={eid.hasEid} />
                      </div>
                    )}
                    {nextAction.variant !== "success" && (
                      <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-border/20">
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <NextActionIndicator message={nextAction.message} variant={nextAction.variant} />
                      </div>
                    )}
                  </div>
                </Link>
                )}
                </div>
              );
            })}
            {(!groups[status] || groups[status].length === 0) && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No items
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
