import { useState } from "react";
import { Link } from "wouter";
import {
  Calendar, Stethoscope, CreditCard,
  CheckCircle2, Building2, User,
  RefreshCw, XCircle, MapPin,
  Mail, MessageSquare, Copy,
  FileText, Eye, UserCheck, MoreHorizontal,
  Briefcase,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatTime } from "@/lib/format-date";
import { toProperCase } from "@/lib/proper-case";
import { getInitials } from "@/lib/utils";
import { ViewCardDialog } from "./view-card-dialog";
import { ViewWoSheet } from "./view-wo-sheet";
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
  onConfirmDialog: (type: "complete" | "cancel" | "reschedule" | "follow_up", appointment: AppointmentWithRelations, typingNotStarted?: boolean) => void;
  onViewCommunications: (apt: AppointmentWithRelations) => void;
  onCopyDetails: (apt: AppointmentWithRelations) => void;
  onResendEmail: (apt: AppointmentWithRelations) => void;
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
  onConfirmDialog,
  onViewCommunications,
  onCopyDetails,
  onResendEmail,
}: AppointmentCardProps) {
  const [viewCardOpen, setViewCardOpen] = useState(false);
  const [viewWoOpen, setViewWoOpen] = useState(false);

  const formatShortDate = (datetime: string | Date) => {
    const d = typeof datetime === "string" ? new Date(datetime) : datetime;
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  const typingStatus = woTypingStatusMap.get(apt.woId);
  const aptTrack = apt.type === "Medical" ? typingStatus?.medical : typingStatus?.eid;
  const typingNotStarted = !aptTrack || aptTrack.status === "Not Started";

  const copyLink = apt.rescheduleToken
    ? () => {
        navigator.clipboard.writeText(`${window.location.origin}/card/${apt.rescheduleToken}`);
      }
    : null;

  return (
    <>
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
                  {apt.status === "Cancelled" && apt.cancelReason && (
                    <div className="flex items-start gap-1.5" data-testid={`cancel-reason-${apt.id}`}>
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      <span className="text-xs text-muted-foreground italic">
                        Reason: {apt.cancelReason}
                      </span>
                    </div>
                  )}
                  {apt.status === "Rescheduled" && apt.rescheduleReason && (
                    <div className="flex items-start gap-1.5" data-testid={`reschedule-reason-${apt.id}`}>
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-xs text-muted-foreground italic">
                        Reason: {apt.rescheduleReason}
                      </span>
                    </div>
                  )}
                  {(() => {
                    if (typingNotStarted) {
                      return (
                        <div className="flex items-center gap-1.5" data-testid={`typing-status-${apt.id}`}>
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Typing: Not Started</span>
                        </div>
                      );
                    }
                    if (!aptTrack) return null;
                    const statusColor = aptTrack.status === "Complete" ? "text-emerald-600 dark:text-emerald-400" :
                      aptTrack.status === "In Progress" ? "text-blue-600 dark:text-blue-400" :
                      aptTrack.status === "On Hold" || aptTrack.status === "Rejected" ? "text-destructive" :
                      "text-muted-foreground";
                    return (
                      <div className="flex items-center gap-1.5" data-testid={`typing-status-${apt.id}`}>
                        <FileText className={`h-3.5 w-3.5 shrink-0 ${statusColor}`} />
                        <span className={`text-xs ${statusColor}`}>Typing: {aptTrack.status}</span>
                        {aptTrack.status === "Complete" && aptTrack.completedAt && (
                          <span className="text-xs text-muted-foreground">
                            · <RelativeTime date={aptTrack.completedAt} />
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
                      onClick={() => onConfirmDialog("complete", apt, typingNotStarted)}
                      data-testid={`button-complete-${apt.id}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Appointment Done
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

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onViewCommunications(apt)}
                  data-testid={`button-communications-${apt.id}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Communications
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onResendEmail(apt)}
                  data-testid={`button-resend-email-${apt.id}`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Resend Email
                </Button>

                {showActions && apt.status === "Completed" && apt.type === "Medical" && (
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

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setViewCardOpen(true)}
                  data-testid={`button-view-card-${apt.id}`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Card
                  {apt.cardViewedAt && (
                    <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" data-testid={`badge-card-viewed-btn-${apt.id}`}>
                      Viewed
                    </Badge>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setViewWoOpen(true)}
                  data-testid={`button-view-wo-${apt.id}`}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  View WO
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      data-testid={`button-more-${apt.id}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => setViewWoOpen(true)}
                      data-testid={`dropdown-open-wo-${apt.id}`}
                    >
                      <Briefcase className="h-4 w-4 mr-2" />
                      Open WO
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onCopyDetails(apt)}
                      data-testid={`dropdown-copy-details-${apt.id}`}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onResendEmail(apt)}
                      data-testid={`dropdown-resend-email-${apt.id}`}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Email
                    </DropdownMenuItem>
                    {showActions && apt.status === "Scheduled" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onConfirmDialog("complete", apt, typingNotStarted)}
                          data-testid={`dropdown-complete-${apt.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Appointment Done
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onConfirmDialog("reschedule", apt)}
                          data-testid={`dropdown-reschedule-${apt.id}`}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reschedule
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onConfirmDialog("cancel", apt)}
                          className="text-destructive focus:text-destructive"
                          data-testid={`dropdown-cancel-${apt.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => setViewWoOpen(true)}
            data-testid={`ctx-apt-open-${apt.id}`}
          >
            <Briefcase className="h-4 w-4 mr-2" />
            Open WO
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onCopyDetails(apt)}
            data-testid={`ctx-apt-copy-${apt.id}`}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Details
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onResendEmail(apt)}
            data-testid={`ctx-apt-resend-email-${apt.id}`}
          >
            <Mail className="h-4 w-4 mr-2" />
            Resend Email
          </ContextMenuItem>
          {apt.status === "Scheduled" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => onConfirmDialog("complete", apt, typingNotStarted)}
                data-testid={`ctx-apt-complete-${apt.id}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Appointment Done
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onConfirmDialog("reschedule", apt)}
                data-testid={`ctx-apt-reschedule-${apt.id}`}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reschedule
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onConfirmDialog("cancel", apt)}
                data-testid={`ctx-apt-cancel-${apt.id}`}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <ViewCardDialog
        apt={viewCardOpen ? apt : null}
        onClose={() => setViewCardOpen(false)}
      />
      <ViewWoSheet
        woId={viewWoOpen ? apt.woId : null}
        onClose={() => setViewWoOpen(false)}
      />
    </>
  );
}
