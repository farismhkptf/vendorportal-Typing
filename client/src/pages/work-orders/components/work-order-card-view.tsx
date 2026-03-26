import { Link } from "wouter";
import { 
  Building2, Star, Tag, Clock, AlertTriangle, ArrowUpDown,
  ArrowRight, Stethoscope, Fingerprint, MoreHorizontal,
  ExternalLink, Copy, StarOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toProperCase } from "@/lib/proper-case";
import { getInitials } from "@/lib/utils";
import {
  getMedicalStatus, getEidStatus, needsAttention, getProgressPercent,
  getCardBorderColor, getDelayedElapsedText, getDaysOld,
  getPipelineInfo, getNextAction,
} from "@/lib/pipeline-stage";
import { PipelineStageBadge, NextActionIndicator, MedEidStatusRow, ProgressBar } from "./status-pills";
import type { WorkOrderEnriched } from "./types";

interface WorkOrderCardViewProps {
  items: WorkOrderEnriched[];
  photoMap?: Record<string, string>;
  density: "compact" | "comfortable";
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  navigate: (path: string) => void;
  renderContextMenu: (wo: WorkOrderEnriched, children: React.ReactNode) => React.ReactNode;
  renderMobileMenu: (wo: WorkOrderEnriched) => React.ReactNode;
}

export function WorkOrderCardView({
  items, photoMap, density, selectedIds, toggleSelected,
  navigate, renderContextMenu, renderMobileMenu,
}: WorkOrderCardViewProps) {
  return (
    <div className="space-y-2 stagger-children">
      {items.map((wo, index) => {
        const med = getMedicalStatus(wo);
        const eid = getEidStatus(wo);
        const daysOld = getDaysOld(wo.createdAt);
        const attention = needsAttention(wo);
        const progress = getProgressPercent(wo);
        const borderColor = getCardBorderColor(wo);
        const pipeline = getPipelineInfo(wo.typingJobs || [], wo.appointments || []);
        const nextAction = getNextAction(wo.typingJobs || [], wo.appointments || [], pipeline);
        const delayedText = getDelayedElapsedText(wo);
        const isDelayed = !!wo.isDelayed;
        const isComfortable = density === "comfortable";

        const st = wo.serviceType;
        const showMed = med.hasMedical || (st && (st.requiresMedicalTyping || st.requiresMedicalScheduling));
        const showEid = eid.hasEid || (st && (st.requiresIdTyping2Years || st.requiresIdTyping1Year || st.requiresIdTyping10Years || st.requiresIdBiometrics));

        const medLabel = showMed
          ? (med.hasMedical ? (med.appointment === "Completed" ? "Done" : med.appointment ? "Scheduled" : med.typing ? (med.typing === "ReadyForScheduling" || med.typing === "Returned" ? "Ready" : "Typing") : "Pending") : "Not started")
          : null;
        const eidLabel = showEid
          ? (eid.hasEid ? (eid.appointment === "Completed" ? "Done" : eid.appointment ? "Scheduled" : eid.typing ? (eid.typing === "ReadyForScheduling" || eid.typing === "Returned" ? "Ready" : "Typing") : "Pending") : "Not started")
          : null;

        const isSelected = selectedIds.has(wo.id);

        return (
          <div key={wo.id} className="flex items-start gap-2">
            <div className="pt-4 shrink-0 hidden lg:block">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelected(wo.id)}
                aria-label={`Select ${wo.woNumber}`}
                data-testid={`checkbox-wo-${wo.woNumber}`}
              />
            </div>
            {renderContextMenu(wo,
            <Link href={`/work-orders/${wo.id}`} className="flex-1 min-w-0">
              <div 
                className={`premium-card ${isComfortable ? "p-4" : "p-2.5"} border-l-[3px] ${borderColor} opacity-0 animate-fade-in ${isDelayed ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
                style={{ animationDelay: `${index * 0.03}s` }}
                data-testid={`work-order-card-${wo.woNumber}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Avatar className="h-9 w-9 shrink-0" data-testid={`avatar-wo-${wo.woNumber}`}>
                    {photoMap?.[wo.id] ? (
                      <AvatarImage src={photoMap[wo.id]} alt={wo.applicantName} />
                    ) : null}
                    <AvatarFallback className="text-xs font-medium">{getInitials(wo.applicantName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm text-foreground">{wo.woNumber}</span>
                      <PipelineStageBadge stage={wo.status === "Completed" ? "complete" : pipeline.overall} />
                      {wo.isVip && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 rounded-full px-1.5 py-0 text-[10px]">
                          <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                          VIP
                        </Badge>
                      )}
                      {attention && !isDelayed && (
                        <Badge variant="secondary" className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 rounded-full px-1.5 py-0 text-[10px]">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          Action needed
                        </Badge>
                      )}
                      {isDelayed && (
                        <Badge variant="secondary" className="bg-red-600 text-white dark:bg-red-700 dark:text-red-100 rounded-full px-1.5 py-0 text-[10px] animate-pulse">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          DELAYED
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{toProperCase(wo.applicantName)}</p>
                    <div className="flex items-center gap-3 flex-wrap mt-0.5">
                      {wo.company && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{toProperCase(wo.company.name)}</span>
                        </div>
                      )}
                      {st && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground/70" data-testid={`wo-service-type-${wo.woNumber}`}>
                          <Tag className="h-3 w-3" />
                          <span className="truncate">{st.name}</span>
                        </div>
                      )}
                    </div>
                    {isDelayed && delayedText && (
                      <div className="flex items-center gap-1 mt-1" data-testid={`delayed-indicator-${wo.woNumber}`}>
                        <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400 shrink-0" />
                        <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">{delayedText}</span>
                      </div>
                    )}
                    {!isDelayed && nextAction.variant !== "success" && (
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <NextActionIndicator message={nextAction.message} variant={nextAction.variant} />
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                      <Clock className="h-3 w-3" />
                      <span>{daysOld === 0 ? "Today" : `${daysOld}d`}</span>
                    </div>
                  </div>
                </div>

                {isComfortable && (showMed || showEid) && (
                  <div className="mt-3 pt-2.5 border-t border-border/30 space-y-1.5">
                    {showMed && (
                      <MedEidStatusRow
                        icon={Stethoscope}
                        label="Med"
                        typing={med.typing}
                        appointment={med.appointment}
                        hasData={med.hasMedical}
                        summaryLabel={medLabel}
                      />
                    )}
                    {showEid && (
                      <MedEidStatusRow
                        icon={Fingerprint}
                        label="EID"
                        typing={eid.typing}
                        appointment={eid.appointment}
                        hasData={eid.hasEid}
                        summaryLabel={eidLabel}
                      />
                    )}
                    <ProgressBar percent={progress} />
                  </div>
                )}
              </div>
            </Link>
            )}
            <div className="pt-4 lg:hidden shrink-0">
              {renderMobileMenu(wo)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
