import { Link, useLocation } from "wouter";
import {
  Calendar, Stethoscope, CreditCard,
  CheckCircle2, Building2, User,
  RefreshCw, XCircle, MapPin,
  Mail, MessageCircle, Copy, Download, FileText,
  Eye, UserCheck, ExternalLink
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatTime } from "@/lib/format-date";
import { toProperCase } from "@/lib/proper-case";
import { getInitials } from "@/lib/utils";
import type { Staff } from "@shared/schema";
import type { AppointmentWithRelations, WoTypingStatus } from "./types";

interface AppointmentCardProps {
  apt: AppointmentWithRelations;
  showDate: boolean;
  showActions: boolean;
  isComfortable: boolean;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  staffList?: Staff[];
  woTypingStatusMap: Map<string, WoTypingStatus>;
  photoMap?: Record<string, string>;
  downloadingDraft: boolean;
  onConfirmDialog: (type: "complete" | "cancel" | "reschedule" | "follow_up", appointment: AppointmentWithRelations) => void;
  onViewEmailDraft: (apt: AppointmentWithRelations) => void;
  onViewMessages: (apt: AppointmentWithRelations) => void;
  onDownloadAsJpg: (apt: AppointmentWithRelations, type: "email" | "whatsapp") => void;
  onCopyDetails: (apt: AppointmentWithRelations) => void;
}

export function AppointmentCard({
  apt,
  showDate,
  showActions,
  isComfortable,
  selectedIds,
  toggleSelected,
  staffList,
  woTypingStatusMap,
  photoMap,
  downloadingDraft,
  onConfirmDialog,
  onViewEmailDraft,
  onViewMessages,
  onDownloadAsJpg,
  onCopyDetails,
}: AppointmentCardProps) {
  const [, navigate] = useLocation();

  const formatShortDate = (datetime: string | Date) => {
    const d = typeof datetime === "string" ? new Date(datetime) : datetime;
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  return (
    <ContextMenu key={apt.id}>
      <ContextMenuTrigger asChild>
        <div
          className="flex items-start gap-2"
          data-testid={`appointment-card-${apt.id}`}
        >
          <div className={isComfortable ? "pt-4" : "pt-2.5"}>
            <Checkbox
              checked={selectedIds.has(apt.id)}
              onCheckedChange={() => toggleSelected(apt.id)}
              aria-label={`Select appointment ${apt.workOrder?.applicantName || apt.id}`}
              data-testid={`checkbox-apt-${apt.id}`}
            />
          </div>
          <div
            className={`flex-1 min-w-0 ${isComfortable ? "p-4" : "p-2.5"} rounded-lg bg-muted/30 border border-border/30`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-[90px] sm:w-[110px] rounded-md bg-background border border-border/40 px-2 sm:px-3 py-2 text-center">
                {showDate && (
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight">{formatShortDate(apt.datetime)}</p>
                )}
                <p className="text-base sm:text-lg font-bold text-foreground leading-snug tracking-tight">{formatTime(apt.datetime)}</p>
              </div>

              <Avatar className="h-8 w-8 shrink-0 hidden sm:flex" data-testid={`avatar-apt-${apt.id}`}>
                {photoMap?.[apt.woId] ? (
                  <AvatarImage src={photoMap[apt.woId]} alt={apt.workOrder?.applicantName || "Applicant"} />
                ) : null}
                <AvatarFallback className="text-xs font-medium">
                  {getInitials(apt.workOrder?.applicantName || "?")}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground truncate">
                    {apt.workOrder?.applicantName ? toProperCase(apt.workOrder.applicantName) : "Unknown"}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {apt.type}
                  </Badge>
                  {apt.isVip && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                      VIP
                    </Badge>
                  )}
                  {!showActions && (
                    <Badge variant={
                      apt.status === "Completed" ? "secondary" :
                      apt.status === "Cancelled" ? "destructive" :
                      apt.status === "Rescheduled" ? "outline" :
                      apt.status === "FollowUpRequired" ? "destructive" :
                      apt.status === "FollowUpScheduled" ? "outline" :
                      apt.status === "FollowUpCompleted" ? "secondary" :
                      "default"
                    }>
                      {apt.status === "FollowUpRequired" ? "Follow-Up Required" :
                       apt.status === "FollowUpScheduled" ? "Follow-Up Scheduled" :
                       apt.status === "FollowUpCompleted" ? "Follow-Up Completed" :
                       apt.status}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                    {apt.workOrder?.company?.name ? toProperCase(apt.workOrder.company.name) : "Unknown Company"}
                  </span>
                </div>
                {apt.center?.name && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">
                      {apt.center.name}
                    </span>
                  </div>
                )}
                {apt.assignedStaffId && staffList && (() => {
                  const assignedStaff = staffList.find(s => s.id === apt.assignedStaffId);
                  if (!assignedStaff) return null;
                  return (
                    <div className="flex items-center gap-1.5" data-testid={`assigned-staff-${apt.id}`}>
                      <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground truncate">
                        {assignedStaff.name}
                      </span>
                    </div>
                  );
                })()}
                {apt.status === "Completed" && apt.datetime && (
                  <div className="flex items-center gap-1.5" data-testid={`completed-info-${apt.id}`}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      Completed · <RelativeTime date={apt.datetime} />
                    </span>
                  </div>
                )}
                {(() => {
                  const typingStatus = woTypingStatusMap.get(apt.woId);
                  const track = apt.type === "Medical" ? typingStatus?.medical : typingStatus?.eid;
                  if (!track && !typingStatus) {
                    return (
                      <div className="flex items-center gap-1.5" data-testid={`typing-status-${apt.id}`}>
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">Typing: Not Started</span>
                      </div>
                    );
                  }
                  if (!track) return null;
                  const statusColor = track.status === "Complete" ? "text-emerald-600 dark:text-emerald-400" :
                    track.status === "In Progress" ? "text-blue-600 dark:text-blue-400" :
                    track.status === "On Hold" || track.status === "Rejected" ? "text-destructive" :
                    "text-muted-foreground";
                  return (
                    <div className="flex items-center gap-1.5" data-testid={`typing-status-${apt.id}`}>
                      <FileText className={`h-3.5 w-3.5 shrink-0 ${statusColor}`} />
                      <span className={`text-xs ${statusColor}`}>Typing: {track.status}</span>
                      {track.status === "Complete" && track.completedAt && (
                        <span className="text-xs text-muted-foreground">
                          · <RelativeTime date={track.completedAt} />
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20 justify-end flex-wrap overflow-x-auto">
              {showActions && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onConfirmDialog("complete", apt)}
                    data-testid={`button-complete-${apt.id}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Done
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onConfirmDialog("reschedule", apt)}
                    data-testid={`button-reschedule-${apt.id}`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive"
                    onClick={() => onConfirmDialog("cancel", apt)}
                    data-testid={`button-cancel-${apt.id}`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </>
              )}
              {apt.emailDraft && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onViewEmailDraft(apt)}
                  data-testid={`button-view-email-draft-${apt.id}`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Email
                </Button>
              )}
              {!apt.emailDraft && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onViewMessages(apt)}
                  data-testid={`button-view-messages-${apt.id}`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Messages
                </Button>
              )}
              {apt.status === "Completed" && apt.type === "Medical" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/20"
                  onClick={() => onConfirmDialog("follow_up", apt)}
                  data-testid={`button-follow-up-${apt.id}`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Follow-Up Required
                </Button>
              )}
              {apt.status === "FollowUpRequired" && apt.type === "Medical" && (
                <Link href={`/appointments/schedule-medical?wo=${apt.woId}&followup=true`}>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    data-testid={`button-schedule-followup-${apt.id}`}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Schedule Follow-Up
                  </Button>
                </Link>
              )}
              <Link href={`/work-orders/${apt.woId}`}>
                <Button variant="ghost" size="sm" data-testid={`button-view-wo-${apt.id}`}>
                  View WO
                </Button>
              </Link>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={downloadingDraft}
                    data-testid={`button-download-drafts-${apt.id}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloadingDraft ? "Generating..." : "Download"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
                    onClick={() => onDownloadAsJpg(apt, "email")}
                    data-testid={`button-download-email-jpg-${apt.id}`}
                  >
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Email Draft (JPG)
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
                    onClick={() => onDownloadAsJpg(apt, "whatsapp")}
                    data-testid={`button-download-whatsapp-jpg-${apt.id}`}
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    WhatsApp Draft (JPG)
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => navigate(`/work-orders/${apt.woId}`)}
          data-testid={`ctx-apt-open-${apt.id}`}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onCopyDetails(apt)}
          data-testid={`ctx-apt-copy-${apt.id}`}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy Details
        </ContextMenuItem>
        <ContextMenuSeparator />
        {apt.status === "Scheduled" && (
          <>
            <ContextMenuItem
              onClick={() => onConfirmDialog("complete", apt)}
              data-testid={`ctx-apt-complete-${apt.id}`}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complete
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => onConfirmDialog("cancel", apt)}
              data-testid={`ctx-apt-cancel-${apt.id}`}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => onConfirmDialog("reschedule", apt)}
              data-testid={`ctx-apt-reschedule-${apt.id}`}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reschedule
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
