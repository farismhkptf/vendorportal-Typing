import { useState } from "react";
import { Link } from "wouter";
import { formatDate, formatDateWithWeekday } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  Stethoscope,
  CreditCard,
  MapPin,
  Mail,
  Star,
  CheckCircle2,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Appointment, Center, Staff } from "@shared/schema";

function AppointmentStatusTimeline({ apt }: { apt: Appointment }) {
  const statusSteps = [
    { label: "Scheduled", date: apt.createdAt, active: true },
  ];

  if (apt.status === "Rescheduled") {
    statusSteps.push({ label: "Rescheduled", date: apt.createdAt, active: true });
  } else if (apt.status === "Cancelled") {
    statusSteps.push({ label: "Cancelled", date: apt.createdAt, active: true });
  } else if (apt.status === "Completed") {
    statusSteps.push({ label: "Completed", date: apt.createdAt, active: true });
  } else if (apt.status === "FollowUpRequired") {
    statusSteps.push({ label: "Follow-Up Required", date: apt.createdAt, active: true });
  } else if (apt.status === "FollowUpScheduled") {
    statusSteps.push({ label: "Follow-Up Required", date: apt.createdAt, active: true });
    statusSteps.push({ label: "Follow-Up Scheduled", date: apt.createdAt, active: true });
  } else if (apt.status === "FollowUpCompleted") {
    statusSteps.push({ label: "Follow-Up Required", date: apt.createdAt, active: true });
    statusSteps.push({ label: "Follow-Up Scheduled", date: apt.createdAt, active: true });
    statusSteps.push({ label: "Follow-Up Completed", date: apt.createdAt, active: true });
  }

  if (apt.status === "Scheduled") {
    statusSteps.push({ label: "Completed", date: null as any, active: false });
  }

  return (
    <div className="flex items-center gap-1" data-testid={`apt-status-timeline-${apt.id}`}>
      {statusSteps.map((step, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <div className={cn(
            "h-2 w-2 rounded-full shrink-0",
            step.active ? "bg-primary" : "bg-muted"
          )} />
          <span className={cn(
            "text-[10px]",
            step.active ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            {step.label}
          </span>
          {idx < statusSteps.length - 1 && (
            <div className={cn(
              "h-px w-4",
              step.active ? "bg-primary" : "bg-muted"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

export function ExpandedAppointmentCard({ 
  apt, 
  centers, 
  staffList,
  onComplete,
  onReschedule,
  onCancel,
  onResendEmail,
}: { 
  apt: Appointment; 
  centers: Center[];
  staffList: Staff[];
  onComplete: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onResendEmail?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [emailDraftOpen, setEmailDraftOpen] = useState(false);
  const [cardLinkCopied, setCardLinkCopied] = useState(false);

  const center = apt.centerId ? centers.find(c => c.id === apt.centerId) : null;
  const assignedStaff = apt.assignedStaffId ? staffList.find(s => s.id === apt.assignedStaffId) : null;

  const handleCopyCardLink = async () => {
    if (!apt.rescheduleToken) return;
    const appBaseUrl = import.meta.env.VITE_APP_BASE_URL ?? window.location.origin;
    const url = `${appBaseUrl}/card/${apt.rescheduleToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCardLinkCopied(true);
      setTimeout(() => setCardLinkCopied(false), 2000);
    } catch {}
  };

  return (
    <>
      <Card className="border border-border/50" data-testid={`appointment-card-${apt.id}`}>
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  apt.type === "Medical" ? "bg-red-50 dark:bg-red-900/30" : "bg-blue-50 dark:bg-blue-900/30"
                )}>
                  {apt.type === "Medical" ? (
                    <Stethoscope className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{apt.type === "Medical" ? "Medical" : "Emirates ID"}</span>
                    <StatusBadge status={apt.status} />
                  </div>
                  <p className="text-sm text-foreground">
                    {formatDateWithWeekday(apt.datetime)} at{" "}
                    {new Date(apt.datetime).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}
                  </p>
                  {center && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {center.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {apt.status === "Scheduled" && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1.5"
                      onClick={onComplete}
                      data-testid={`button-wo-apt-done-${apt.id}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Done
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={onReschedule}
                      data-testid={`button-wo-apt-reschedule-${apt.id}`}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reschedule
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive"
                      onClick={onCancel}
                      data-testid={`button-wo-apt-cancel-${apt.id}`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                    <Link href={`/appointments?viewMessages=${apt.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-wo-view-messages-${apt.id}`}>
                        <Mail className="h-3.5 w-3.5" />
                        Messages
                      </Button>
                    </Link>
                  </>
                )}
                {apt.rescheduleToken && (
                  <>
                    <a href={`${import.meta.env.VITE_APP_BASE_URL ?? window.location.origin}/card/${apt.rescheduleToken}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-view-card-${apt.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        View Card
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleCopyCardLink}
                      data-testid={`button-copy-card-link-${apt.id}`}
                    >
                      {cardLinkCopied ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {cardLinkCopied ? "Copied!" : "Copy Link"}
                    </Button>
                  </>
                )}
                {apt.emailDraft && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setEmailDraftOpen(true)}
                    data-testid={`button-view-email-${apt.id}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Email
                  </Button>
                )}
                {onResendEmail && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={onResendEmail}
                    data-testid={`button-resend-email-${apt.id}`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Resend Email
                  </Button>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-expand-apt-${apt.id}`}>
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardContent>

          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
              <AppointmentStatusTimeline apt={apt} />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium">{apt.type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Scheduled Date</span>
                  <p className="font-medium">{formatDateWithWeekday(apt.datetime)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Time</span>
                  <p className="font-medium">{new Date(apt.datetime).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}</p>
                </div>
                {center && (
                  <div>
                    <span className="text-muted-foreground">Center</span>
                    <p className="font-medium">{center.name}</p>
                    {center.area && <p className="text-muted-foreground">{center.area}</p>}
                  </div>
                )}
                {assignedStaff && (
                  <div>
                    <span className="text-muted-foreground">Assigned Staff</span>
                    <p className="font-medium">{assignedStaff.name}</p>
                  </div>
                )}
                {apt.applicationNumber && (
                  <div>
                    <span className="text-muted-foreground">Application No</span>
                    <p className="font-medium text-primary">{apt.applicationNumber}</p>
                  </div>
                )}
                {apt.isVip && (
                  <div>
                    <span className="text-muted-foreground">Priority</span>
                    <p className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      VIP
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium">{apt.status}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p className="font-medium">{formatDate(apt.createdAt)}</p>
                </div>
                {apt.messageSentAt && (
                  <div>
                    <span className="text-muted-foreground">Message Sent</span>
                    <p className="font-medium">{formatDate(apt.messageSentAt)}</p>
                  </div>
                )}
              </div>
              {apt.notes && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Notes</span>
                  <p className="font-medium mt-0.5">{apt.notes}</p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Dialog open={emailDraftOpen} onOpenChange={setEmailDraftOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl" data-testid={`dialog-email-draft-${apt.id}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Draft — {apt.type} Appointment
            </DialogTitle>
            <DialogDescription>
              Original email generated when this appointment was scheduled.
            </DialogDescription>
          </DialogHeader>
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <div
              className="p-4 bg-white text-black"
              dangerouslySetInnerHTML={{ __html: apt.emailDraft || "" }}
              data-testid={`email-draft-content-${apt.id}`}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
