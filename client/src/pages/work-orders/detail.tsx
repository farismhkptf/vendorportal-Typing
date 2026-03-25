import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toProperCase } from "@/lib/proper-case";
import { formatDate, formatDateWithWeekday } from "@/lib/format-date";
import { getPipelineInfo, getNextAction, STAGE_CONFIG, PIPELINE_STEPS, type PipelineInfo } from "@/lib/pipeline-stage";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, 
  Building2, 
  Calendar, 
  FileText, 
  StickyNote,
  History,
  Send,
  User,
  MapPin,
  Mail,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Star,
  Loader2,
  ClipboardList,
  Home,
  CheckCircle2,
  RefreshCw,
  XCircle,
  PauseCircle,
  PlayCircle,
  Stethoscope,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  Package,
  Clock,
  Copy,
  TriangleAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { useScrollToError } from "@/hooks/use-scroll-to-error";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ActivityTimeline, type ActivityItem } from "@/components/ui/activity-timeline";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { WorkOrder, Company, Appointment, TypingJob, Staff, Center, ServiceType, AuditLog, JobType, WoNote, Vendor, WoDocument } from "@shared/schema";
import { DocumentPanel } from "@/components/documents/document-panel";
import { MedicalSchedulingTab } from "@/components/medical-scheduling/MedicalSchedulingTab";
import { BiometricsSchedulingTab } from "@/components/biometrics-scheduling/BiometricsSchedulingTab";
import type { ServiceCategory } from "@/components/documents/document-types";
import { CopyableText } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { SaveStatusIndicator } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Eye } from "lucide-react";

function PipelineBar({ pipeline, serviceType, isMinor, onTrackClick }: { pipeline: PipelineInfo; serviceType?: ServiceType; isMinor?: boolean; onTrackClick?: (track: "medical" | "eid") => void }) {
  const medRequired = !isMinor && serviceType && (serviceType.requiresMedicalTyping || serviceType.requiresMedicalScheduling);
  const eidRequired = serviceType && (serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year || serviceType.requiresIdTyping10Years || serviceType.requiresIdBiometrics);

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm" data-testid="pipeline-bar">
      <div className="flex items-center gap-2 mb-3">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Workflow Progress</span>
      </div>
      {pipeline.medical.exists ? (
        <TrackRow label="Medical" icon={<Stethoscope className="h-3.5 w-3.5" />} track={pipeline.medical} onClick={() => onTrackClick?.("medical")} />
      ) : medRequired ? (
        <div className="flex items-center gap-3 py-2" data-testid="track-medical-not-started">
          <div className="flex items-center gap-1.5 w-24 shrink-0">
            <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Medical</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-muted/50" />
          <Badge variant="outline" className="text-xs shrink-0 min-w-[90px] justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 border-blue-200 dark:border-blue-800" data-testid="badge-medical-not-started">
            Not Started
          </Badge>
        </div>
      ) : (
        <div className="flex items-center gap-3 py-2" data-testid="track-medical-not-required">
          <div className="flex items-center gap-1.5 w-24 shrink-0">
            <Stethoscope className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-xs font-medium text-muted-foreground/60">Medical</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-muted/50" />
          <Badge variant="outline" className="text-xs shrink-0 min-w-[90px] justify-center bg-muted/30 text-muted-foreground/60 border-border/30" data-testid="badge-medical-not-required">
            Not Required
          </Badge>
        </div>
      )}
      {pipeline.eid.exists ? (
        <TrackRow label="Emirates ID" icon={<CreditCard className="h-3.5 w-3.5" />} track={pipeline.eid} onClick={() => onTrackClick?.("eid")} />
      ) : eidRequired ? (
        <div className="flex items-center gap-3 py-2" data-testid="track-eid-not-started">
          <div className="flex items-center gap-1.5 w-24 shrink-0">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Emirates ID</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-muted/50" />
          <Badge variant="outline" className="text-xs shrink-0 min-w-[90px] justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 border-blue-200 dark:border-blue-800" data-testid="badge-eid-not-started">
            Not Started
          </Badge>
        </div>
      ) : (
        <div className="flex items-center gap-3 py-2" data-testid="track-eid-not-required">
          <div className="flex items-center gap-1.5 w-24 shrink-0">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-xs font-medium text-muted-foreground/60">Emirates ID</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-muted/50" />
          <Badge variant="outline" className="text-xs shrink-0 min-w-[90px] justify-center bg-muted/30 text-muted-foreground/60 border-border/30" data-testid="badge-eid-not-required">
            Not Required
          </Badge>
        </div>
      )}
    </div>
  );
}

function TrackRow({ label, icon, track, onClick }: { label: string; icon: React.ReactNode; track: import("@/lib/pipeline-stage").TrackStatus; onClick?: () => void }) {
  const currentIdx = PIPELINE_STEPS.indexOf(track.stage as any);
  const isAttention = track.stage === "needs_attention";

  return (
    <div
      className={cn("flex items-center gap-3 py-2 rounded-lg px-1 -mx-1 transition-colors", onClick && "cursor-pointer hover:bg-muted/50")}
      onClick={onClick}
      data-testid={`track-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="flex items-center gap-1.5 w-24 shrink-0">
        {icon}
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1 flex-1">
        {PIPELINE_STEPS.map((step, idx) => {
          const config = STAGE_CONFIG[step];
          const isComplete = !isAttention && idx <= currentIdx;
          const isCurrent = !isAttention && idx === currentIdx;
          return (
            <div key={step} className="flex items-center flex-1">
              <div className={cn(
                "h-2 rounded-full flex-1 transition-all",
                isComplete ? "bg-primary" : "bg-muted",
                isCurrent && "ring-1 ring-primary/50 ring-offset-1 ring-offset-background"
              )} />
              {idx < PIPELINE_STEPS.length - 1 && <div className="w-0.5" />}
            </div>
          );
        })}
      </div>
      <Badge
        variant="outline"
        className={cn(
          "text-xs shrink-0 min-w-[90px] justify-center",
          isAttention
            ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
            : track.stage === "complete"
              ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
              : "bg-primary/5 text-primary border-primary/20"
        )}
        data-testid={`badge-track-${label.toLowerCase().replace(/\s/g, "-")}`}
      >
        {track.label}
      </Badge>
    </div>
  );
}

function NextActionBanner({ 
  pipeline, typingJobs, appointments, onAction 
}: { 
  pipeline: PipelineInfo; 
  typingJobs: any[]; 
  appointments: any[]; 
  onAction: (type: string) => void;
}) {
  const action = getNextAction(typingJobs, appointments, pipeline);

  const variantStyles = {
    info: "bg-blue-50/80 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
    action: "bg-amber-50/80 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
    warning: "bg-red-50/80 border-red-200 dark:bg-red-900/20 dark:border-red-800",
    success: "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
  };

  const iconStyles = {
    info: "text-blue-600 dark:text-blue-400",
    action: "text-amber-600 dark:text-amber-400",
    warning: "text-red-600 dark:text-red-400",
    success: "text-emerald-600 dark:text-emerald-400",
  };

  const icons = {
    info: <Clock className="h-4 w-4" />,
    action: <ArrowRight className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    success: <CheckCircle2 className="h-4 w-4" />,
  };

  return (
    <div className={cn("rounded-xl border px-4 py-3 flex items-center justify-between gap-3", variantStyles[action.variant])} data-testid="next-action-banner">
      <div className="flex items-center gap-3 min-w-0">
        <span className={iconStyles[action.variant]}>{icons[action.variant]}</span>
        <span className="text-sm font-medium text-foreground">{action.message}</span>
      </div>
      {action.actionLabel && action.actionType && (
        <Button
          size="sm"
          variant={action.variant === "warning" ? "destructive" : "default"}
          className="gap-1.5 shrink-0"
          onClick={() => onAction(action.actionType!)}
          data-testid="button-next-action"
        >
          {action.actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function ExpandedTypingJobCard({ job, woId, onRefresh }: { job: any; woId: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const { data: jobDetail } = useQuery<any>({
    queryKey: ["/api/typing-jobs", job.id],
    enabled: expanded,
  });

  const abortMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/typing-jobs/${job.id}/abort`, { reason: "Cancelled from WO detail" }),
    onSuccess: () => {
      onRefresh();
      toast({ title: "Job cancelled" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const category = job.jobType?.category;
  const result = jobDetail?.result || job.result;
  const vendor = jobDetail?.vendor;
  const files = jobDetail?.files || [];
  const comments = jobDetail?.comments || [];

  const isReturned = job.status === "Returned";

  return (
    <Card className={cn("border", isReturned ? "border-amber-300 dark:border-amber-700" : "border-border/50")} data-testid={`typing-job-card-${job.id}`}>
      {isReturned && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Returned by Vendor — Action Required</p>
          <Link href={`/typing-jobs/${job.id}`}>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs text-amber-700 dark:text-amber-300 underline ml-auto" data-testid={`button-view-returned-job-${job.id}`}>
              View Job
            </Button>
          </Link>
        </div>
      )}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                category === "Medical" ? "bg-rose-50 dark:bg-rose-900/30" : "bg-cyan-50 dark:bg-cyan-900/30"
              )}>
                {category === "Medical" ? (
                  <Stethoscope className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                ) : (
                  <CreditCard className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {category === "Medical" ? "Medical" : category === "EID" ? "Emirates ID" : "Typing"}
                  </span>
                  {job.jobCode && <span className="text-xs text-muted-foreground font-mono">{job.jobCode}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {vendor && <span>Vendor: {vendor.name}</span>}
                  {!vendor && job.vendorId && <span>Assigned to vendor</span>}
                  {job.sentAt && <span>Sent {formatDate(job.sentAt)}</span>}
                  {!job.sentAt && <span>Created {formatDate(job.createdAt)}</span>}
                  {job.jobType?.cost > 0 && <span>AED {job.jobType.cost}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(job.status === "SubmittedToVendor" || job.status === "InProcess") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); abortMutation.mutate(); }}
                  disabled={abortMutation.isPending}
                  data-testid={`button-abort-${job.id}`}
                >
                  <XCircle className="h-3 w-3" />
                  Abort
                </Button>
              )}
              <StatusBadge status={job.status} />
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-expand-${job.id}`}>
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {result && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {result.applicationNumber && (
                  <div>
                    <span className="text-muted-foreground">Application No</span>
                    <p className="font-medium text-primary">{result.applicationNumber}</p>
                  </div>
                )}
                {result.centerName && (
                  <div>
                    <span className="text-muted-foreground">Center</span>
                    <p className="font-medium">{result.centerName}</p>
                  </div>
                )}
                {result.biometricsRequired && result.biometricsDate && (
                  <div>
                    <span className="text-muted-foreground">Biometrics</span>
                    <p className="font-medium">{formatDate(result.biometricsDate)}</p>
                  </div>
                )}
                {result.vendorNotes && (
                  <div className="col-span-full">
                    <span className="text-muted-foreground">Vendor Notes</span>
                    <p className="font-medium">{result.vendorNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {files.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Documents ({files.length})</p>
                <div className="grid grid-cols-2 gap-2">
                  {files.slice(0, 6).map((f: any) => (
                    <div key={f.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/50">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{f.originalName || f.filename}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{f.direction}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {comments.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Comments ({comments.length})</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {comments.slice(0, 3).map((c: any) => (
                    <div key={c.id} className="text-xs p-2 rounded-lg bg-muted/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{c.authorName || "Team"}</span>
                        <span className="text-muted-foreground">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-muted-foreground">{c.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-1">
              <Link href={`/typing-jobs/${job.id}`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs" data-testid={`button-view-full-${job.id}`}>
                  View Full Details
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

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

function ExpandedAppointmentCard({ 
  apt, 
  centers, 
  staffList,
  onComplete,
  onReschedule,
  onCancel,
}: { 
  apt: Appointment; 
  centers: Center[];
  staffList: Staff[];
  onComplete: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [emailDraftOpen, setEmailDraftOpen] = useState(false);
  const [cardLinkCopied, setCardLinkCopied] = useState(false);

  const center = apt.centerId ? centers.find(c => c.id === apt.centerId) : null;
  const assignedStaff = apt.assignedStaffId ? staffList.find(s => s.id === apt.assignedStaffId) : null;

  const handleCopyCardLink = async () => {
    if (!apt.rescheduleToken) return;
    const url = `${window.location.origin}/card/${apt.rescheduleToken}`;
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
                  apt.type === "Medical" ? "bg-rose-50 dark:bg-rose-900/30" : "bg-cyan-50 dark:bg-cyan-900/30"
                )}>
                  {apt.type === "Medical" ? (
                    <Stethoscope className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <CreditCard className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
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
                    <a href={`/card/${apt.rescheduleToken}`} target="_blank" rel="noopener noreferrer">
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

const editWorkOrderSchema = z.object({
  woNumber: z.string().min(1, "Work order number is required").regex(/^[A-Z]\d{5,6}$/, "Format: Letter + 5-6 digits"),
  applicantName: z.string().min(1, "Applicant name is required"),
  applicantPhone: z.string().optional(),
  applicantEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  isVip: z.boolean().default(false),
  companyId: z.string().min(1, "Company is required"),
  serviceTypeId: z.string().optional(),
  status: z.string(),
  notes: z.string().optional(),
});

type EditWorkOrderForm = z.infer<typeof editWorkOrderSchema>;

interface TypingJobWithType extends TypingJob {
  jobType?: JobType;
}

interface WorkOrderDetail extends WorkOrder {
  company?: Company & {
    rmStaff?: Staff;
    assistStaff?: Staff;
    emails?: Array<{ label: string; email: string; active: boolean }>;
    preferredMedicalCenter?: Center;
    preferredEidCenter?: Center;
  };
  appointments?: Appointment[];
  typingJobs?: TypingJobWithType[];
  serviceType?: ServiceType;
}

function InternalNotesSection({ workOrderId }: { workOrderId: string }) {
  const [noteText, setNoteText] = useState("");
  const [deletionRequestNote, setDeletionRequestNote] = useState<{ id: string; content: string } | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const isCrm = user?.role === "Client Relationship Manager";
  const { data: notes, isLoading } = useQuery<WoNote[]>({
    queryKey: ["/api/wo-notes", workOrderId],
    enabled: !!workOrderId,
  });

  const addNoteMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/wo-notes", { woId: workOrderId, content: noteText }),
    onSuccess: () => {
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["/api/wo-notes", workOrderId] });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => apiRequest("DELETE", `/api/wo-notes/${noteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wo-notes", workOrderId] });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    },
  });

  const requestNoteDeletionMutation = useMutation({
    mutationFn: async ({ entityId, entityLabel, reason }: { entityId: string; entityLabel: string; reason: string }) => {
      const res = await apiRequest("POST", "/api/deletion-requests", {
        entityType: "wo_note",
        entityId,
        entityLabel,
        reason,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deletion request submitted", description: "Your request has been sent to Admin for review." });
      setDeletionRequestNote(null);
      setDeletionReason("");
    },
    onError: () => {
      toast({ title: "Failed to submit request", variant: "destructive" });
    },
  });

  const handleDeleteNote = (noteId: string, content: string) => {
    if (isCrm) {
      setDeletionRequestNote({ id: noteId, content });
      return;
    }
    deleteNoteMutation.mutate(noteId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addNoteMutation.mutate();
  };

  const formatNoteDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2" data-testid="form-add-note">
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add an internal note..."
          className="min-h-[80px] resize-none flex-1"
          data-testid="input-note-text"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!noteText.trim() || addNoteMutation.isPending}
          className="self-end shrink-0"
          data-testid="button-add-note"
        >
          {addNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notes && notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group relative p-3 rounded-lg bg-muted/50 border border-border/30"
              data-testid={`note-item-${note.id}`}
            >
              <p className="text-sm text-foreground whitespace-pre-wrap pr-8">{note.content}</p>
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-xs text-muted-foreground" title={new Date(note.createdAt).toLocaleString()}>
                  {formatNoteDate(note.createdAt)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-opacity text-muted-foreground"
                  onClick={() => handleDeleteNote(note.id, note.content)}
                  data-testid={`button-delete-note-${note.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<StickyNote className="h-6 w-6" />}
          title="No notes yet"
          description="Add internal notes for team communication about this work order."
        />
      )}
      {/* CRM Note Deletion Request Dialog */}
      <Dialog
        open={!!deletionRequestNote}
        onOpenChange={(open) => { if (!open) { setDeletionRequestNote(null); setDeletionReason(""); } }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Request Note Deletion</DialogTitle>
            <DialogDescription>Submit a request to Admin to delete this note.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Note content</p>
              <p className="text-sm text-foreground bg-muted/40 rounded-lg p-2 line-clamp-3">{deletionRequestNote?.content}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Reason *</p>
              <Input
                placeholder="Why should this note be deleted?"
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                data-testid="input-note-deletion-reason"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => { setDeletionRequestNote(null); setDeletionReason(""); }} data-testid="button-cancel-note-deletion">Cancel</Button>
            <Button
              disabled={!deletionReason.trim() || requestNoteDeletionMutation.isPending}
              onClick={() => {
                if (!deletionRequestNote || !deletionReason.trim()) return;
                requestNoteDeletionMutation.mutate({
                  entityId: deletionRequestNote.id,
                  entityLabel: `Note: "${deletionRequestNote.content.slice(0, 60)}${deletionRequestNote.content.length > 60 ? "..." : ""}"`,
                  reason: deletionReason.trim(),
                });
              }}
              data-testid="button-submit-note-deletion"
            >
              {requestNoteDeletionMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityTimelineSection({ workOrderId }: { workOrderId: string }) {
  const { data: auditLogs, isLoading } = useQuery<(AuditLog & { userName?: string })[]>({
    queryKey: ["/api/audit-logs", "work_order", workOrderId],
    enabled: !!workOrderId,
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: ["/api/work-orders/photos"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const activities: ActivityItem[] = (auditLogs || []).map(log => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    userId: log.userId,
    details: log.details as Record<string, unknown> | null,
    createdAt: log.createdAt,
    userName: log.userName,
  }));

  return <ActivityTimeline activities={activities} photoMap={photoMap} />;
}

export default function WorkOrderDetail() {
  const [, params] = useRoute("/work-orders/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { toast } = useToast();
  const { user } = useAuth();
  const isCrm = user?.role === "Client Relationship Manager";
  const [woDeletionRequest, setWoDeletionRequest] = useState<{ reason: string } | null>(null);
  const [woDeletionReason, setWoDeletionReason] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showNewTypingJobForm, setShowNewTypingJobForm] = useState(false);
  const [typeMedical, setTypeMedical] = useState(true);
  const [typeEid, setTypeEid] = useState(true);
  const [aptConfirmDialog, setAptConfirmDialog] = useState<{
    open: boolean;
    type: "complete" | "cancel" | "reschedule";
    appointment: Appointment | null;
  }>({ open: false, type: "complete", appointment: null });

  const updateAptStatusMutation = useMutation({
    mutationFn: async ({ aptId, status }: { aptId: string; status: string }) => {
      return apiRequest("PATCH", `/api/appointments/${aptId}`, { status });
    },
    onMutate: async ({ aptId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/work-orders", id] });
      await queryClient.cancelQueries({ queryKey: ["/api/appointments"] });
      const previousWo = queryClient.getQueryData<WorkOrderDetail>(["/api/work-orders", id]);
      const previousApts = queryClient.getQueryData<Appointment[]>(["/api/appointments"]);
      if (previousWo?.appointments) {
        queryClient.setQueryData<WorkOrderDetail>(
          ["/api/work-orders", id],
          { ...previousWo, appointments: previousWo.appointments.map(a => a.id === aptId ? { ...a, status: status as Appointment["status"] } : a) },
        );
      }
      if (previousApts) {
        queryClient.setQueryData<Appointment[]>(["/api/appointments"], previousApts.map(a => a.id === aptId ? { ...a, status: status as Appointment["status"] } : a));
      }
      return { previousWo, previousApts };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousWo) queryClient.setQueryData(["/api/work-orders", id], context.previousWo);
      if (context?.previousApts) queryClient.setQueryData(["/api/appointments"], context.previousApts);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
  });

  const handleAptConfirmAction = async () => {
    const { type, appointment } = aptConfirmDialog;
    if (!appointment) return;
    try {
      if (type === "reschedule") {
        await updateAptStatusMutation.mutateAsync({ aptId: appointment.id, status: "Rescheduled" });
        toast({ title: "Appointment marked as rescheduled", description: "Redirecting to schedule a new appointment..." });
        setAptConfirmDialog({ open: false, type: "complete", appointment: null });
        const scheduleUrl = appointment.type === "Medical"
          ? `/appointments/schedule-medical?wo=${appointment.woId}`
          : `/appointments/schedule-eid?wo=${appointment.woId}`;
        setLocation(scheduleUrl);
        return;
      }
      const status = type === "complete" ? "Completed" : "Cancelled";
      await updateAptStatusMutation.mutateAsync({ aptId: appointment.id, status });
      toast({
        title: `Appointment ${status.toLowerCase()}`,
        description: `The appointment has been marked as ${status.toLowerCase()}.`,
      });
      setAptConfirmDialog({ open: false, type: "complete", appointment: null });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update appointment",
        variant: "destructive",
      });
    }
  };

  const { data: workOrder, isLoading } = useQuery<WorkOrderDetail>({
    queryKey: ["/api/work-orders", id],
    enabled: !!id,
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: jobTypes } = useQuery<JobType[]>({
    queryKey: ["/api/job-types"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: allCenters = [] } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
  });

  const { data: allStaff = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: woDocuments = [] } = useQuery<WoDocument[]>({
    queryKey: ["/api/work-orders", id, "documents"],
    queryFn: async () => {
      const r = await fetch(`/api/work-orders/${id}/documents`);
      if (!r.ok) throw new Error("Failed to fetch documents");
      return r.json();
    },
    enabled: !!id,
  });

  const expiringOrExpiredDocs = Array.isArray(woDocuments) ? woDocuments.filter((d) => {
    if (!d.expiresAt) return false;
    const now = new Date();
    const expiryDate = new Date(d.expiresAt);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiryDate <= thirtyDaysFromNow;
  }) : [];

  const medicalJobType = jobTypes?.find(jt => jt.category === "Medical") || null;
  const eidJobType = jobTypes?.find(jt => jt.category === "EID") || null;

  const [isCreatingJobs, setIsCreatingJobs] = useState(false);
  const [showSendToVendorDialog, setShowSendToVendorDialog] = useState(false);
  const [sendVendorId, setSendVendorId] = useState("");
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showDeliverDialog, setShowDeliverDialog] = useState(false);
  const [activateEntryPermit, setActivateEntryPermit] = useState(false);
  const [activateChangeStatus, setActivateChangeStatus] = useState(false);
  const [activateIsMinor, setActivateIsMinor] = useState<"adult" | "minor">("adult");

  const draftTypingJobs = workOrder?.typingJobs?.filter(j => j.status === "Draft") || [];
  const existingMedicalJob = workOrder?.typingJobs?.find(j => j.jobType?.category === "Medical" && j.status !== "Aborted") || null;
  const existingEidJob = workOrder?.typingJobs?.find(j => j.jobType?.category === "EID" && j.status !== "Aborted") || null;
  const canCreateNewJob = !existingMedicalJob || !existingEidJob;

  const effectiveTypingJobs = workOrder
    ? workOrder.isMinor
      ? (workOrder.typingJobs || []).filter(j => j.jobType?.category !== "Medical")
      : workOrder.typingJobs || []
    : [];
  const pipeline = workOrder ? getPipelineInfo(effectiveTypingJobs, workOrder.appointments || []) : null;

  const [activeTab, setActiveTab] = useState("typing");

  const handleNextAction = (actionType: string) => {
    switch (actionType) {
      case "create_typing":
        setActiveTab("typing");
        setTypeMedical(!existingMedicalJob);
        setTypeEid(!existingEidJob);
        setShowNewTypingJobForm(true);
        break;
      case "send_vendor":
        setActiveTab("typing");
        setShowSendToVendorDialog(true);
        break;
      case "schedule_medical":
        setActiveTab("appointments");
        setLocation(`/appointments/schedule-medical?wo=${id}`);
        break;
      case "schedule_eid":
        setActiveTab("appointments");
        setLocation(`/appointments/schedule-eid?wo=${id}`);
        break;
      case "deliver":
        setShowDeliverDialog(true);
        break;
      case "attention":
        setActiveTab("typing");
        break;
    }
  };

  const handleRefreshWo = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs"] });
  };

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/work-orders/${id}/activate`, {
        isMinor: activateIsMinor === "minor",
      });
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/work-orders", id] });
      await queryClient.cancelQueries({ queryKey: ["/api/work-orders"] });
      const previousDetail = queryClient.getQueryData<WorkOrderDetail>(["/api/work-orders", id]);
      const previousList = queryClient.getQueryData<WorkOrder[]>(["/api/work-orders"]);
      if (previousDetail) {
        queryClient.setQueryData<WorkOrderDetail>(["/api/work-orders", id], { ...previousDetail, status: "Scheduled" });
      }
      if (previousList) {
        queryClient.setQueryData<WorkOrder[]>(["/api/work-orders"], previousList.map(wo => wo.id === id ? { ...wo, status: "Scheduled" } : wo));
      }
      return { previousDetail, previousList };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setShowActivateDialog(false);
      setActivateEntryPermit(false);
      setActivateChangeStatus(false);
      setActivateIsMinor("adult");
      toast({ title: "Work order activated", description: "The work order is now active and ready for processing.", variant: "success" });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousDetail) queryClient.setQueryData(["/api/work-orders", id], context.previousDetail);
      if (context?.previousList) queryClient.setQueryData(["/api/work-orders"], context.previousList);
      toast({ title: "Failed to activate", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    },
  });

  const deliverMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/work-orders/${id}`, { status: "Completed" });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/work-orders", id] });
      await queryClient.cancelQueries({ queryKey: ["/api/work-orders"] });
      const previousDetail = queryClient.getQueryData<WorkOrderDetail>(["/api/work-orders", id]);
      const previousList = queryClient.getQueryData<WorkOrder[]>(["/api/work-orders"]);
      if (previousDetail) {
        queryClient.setQueryData<WorkOrderDetail>(["/api/work-orders", id], { ...previousDetail, status: "Completed" });
      }
      if (previousList) {
        queryClient.setQueryData<WorkOrder[]>(["/api/work-orders"], previousList.map(wo => wo.id === id ? { ...wo, status: "Completed" } : wo));
      }
      return { previousDetail, previousList };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setShowDeliverDialog(false);
      toast({ title: "Work order completed", description: "The work order has been marked as completed and delivered.", variant: "success" });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousDetail) queryClient.setQueryData(["/api/work-orders", id], context.previousDetail);
      if (context?.previousList) queryClient.setQueryData(["/api/work-orders"], context.previousList);
      toast({ title: "Failed to complete", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    },
  });

  const sendToVendorMutation = useMutation({
    mutationFn: async () => {
      const ids = draftTypingJobs.map(j => j.id);
      return apiRequest("POST", "/api/typing-jobs/bulk-assign-vendor", {
        ids,
        vendorId: sendVendorId,
      });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/work-orders", id] });
      const previousWo = queryClient.getQueryData<WorkOrderDetail>(["/api/work-orders", id]);
      const jobIds = new Set(draftTypingJobs.map(j => j.id));
      if (previousWo?.typingJobs) {
        queryClient.setQueryData<WorkOrderDetail>(
          ["/api/work-orders", id],
          { ...previousWo, typingJobs: previousWo.typingJobs.map(j => jobIds.has(j.id) ? { ...j, status: "SubmittedToVendor" } : j) },
        );
      }
      return { previousWo };
    },
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setShowSendToVendorDialog(false);
      setSendVendorId("");
      if (result.failed > 0) {
        toast({
          title: `${result.updated} job${result.updated !== 1 ? 's' : ''} sent, ${result.failed} failed`,
          description: result.errors?.join(". "),
          variant: "destructive",
        });
      } else {
        toast({ title: `${result.updated} job${result.updated !== 1 ? 's' : ''} sent to vendor`, variant: "success" });
      }
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousWo) queryClient.setQueryData(["/api/work-orders", id], context.previousWo);
      toast({ title: "Failed to send jobs", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs"] });
    },
  });

  const jobOnHoldMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("POST", `/api/typing-jobs/${jobId}/on-hold`);
    },
    onMutate: async (jobId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/work-orders", id] });
      const previousWo = queryClient.getQueryData<WorkOrderDetail>(["/api/work-orders", id]);
      if (previousWo?.typingJobs) {
        queryClient.setQueryData<WorkOrderDetail>(
          ["/api/work-orders", id],
          { ...previousWo, typingJobs: previousWo.typingJobs.map(j => j.id === jobId ? { ...j, status: "OnHold" } : j) },
        );
      }
      return { previousWo };
    },
    onSuccess: () => {
      toast({ title: "Job placed on hold" });
    },
    onError: (error: Error, _jobId, context) => {
      if (context?.previousWo) queryClient.setQueryData(["/api/work-orders", id], context.previousWo);
      toast({ title: "Failed to put job on hold", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
    },
  });

  const jobResumeMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("POST", `/api/typing-jobs/${jobId}/resume`);
    },
    onMutate: async (jobId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/work-orders", id] });
      const previousWo = queryClient.getQueryData<WorkOrderDetail>(["/api/work-orders", id]);
      if (previousWo?.typingJobs) {
        queryClient.setQueryData<WorkOrderDetail>(
          ["/api/work-orders", id],
          { ...previousWo, typingJobs: previousWo.typingJobs.map(j => j.id === jobId ? { ...j, status: "SubmittedToVendor" } : j) },
        );
      }
      return { previousWo };
    },
    onSuccess: () => {
      toast({ title: "Job resumed" });
    },
    onError: (error: Error, _jobId, context) => {
      if (context?.previousWo) queryClient.setQueryData(["/api/work-orders", id], context.previousWo);
      toast({ title: "Failed to resume job", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
    },
  });

  const handleCreateTypingJobs = async () => {
    if (!id) return;
    
    const jobsToCreate: Array<{ woId: string; jobTypeId: string; name: string }> = [];
    
    if (typeMedical && medicalJobType) {
      jobsToCreate.push({ woId: id, jobTypeId: medicalJobType.id, name: "Medical" });
    }
    
    if (typeEid && eidJobType) {
      jobsToCreate.push({ woId: id, jobTypeId: eidJobType.id, name: "EID" });
    }
    
    if (jobsToCreate.length === 0) {
      toast({ title: "Please select at least one job type", variant: "destructive" });
      return;
    }
    
    setIsCreatingJobs(true);
    const results = { success: 0, failed: 0 };
    
    for (const job of jobsToCreate) {
      try {
        await apiRequest("POST", "/api/typing-jobs", {
          woId: job.woId,
          jobTypeId: job.jobTypeId,
          status: "Draft",
        });
        results.success++;
      } catch (error) {
        results.failed++;
        console.error(`Failed to create ${job.name} typing job:`, error);
      }
    }
    
    // Invalidate all typing jobs queries (with or without filters)
    queryClient.invalidateQueries({ queryKey: ["/api/typing-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
    
    setIsCreatingJobs(false);
    
    if (results.failed === 0) {
      toast({ title: `${results.success} typing job${results.success > 1 ? 's' : ''} created successfully` });
      setShowNewTypingJobForm(false);
      setTypeMedical(true);
      setTypeEid(true);
    } else if (results.success > 0) {
      toast({ 
        title: "Partial success", 
        description: `Created ${results.success} job(s), ${results.failed} failed`,
        variant: "destructive" 
      });
      setShowNewTypingJobForm(false);
    } else {
      toast({ title: "Failed to create typing jobs", variant: "destructive" });
    }
  };

  const form = useForm<EditWorkOrderForm>({
    resolver: zodResolver(editWorkOrderSchema),
    defaultValues: {
      woNumber: "",
      applicantName: "",
      applicantPhone: "",
      applicantEmail: "",
      isVip: false,
      companyId: "",
      serviceTypeId: "",
      status: "Draft",
      notes: "",
    },
  });

  const watchedValues = useWatch({ control: form.control });

  const handleAutosave = useCallback(async (data: EditWorkOrderForm) => {
    const valid = editWorkOrderSchema.safeParse(data);
    if (!valid.success) throw new Error("Validation failed");
    await apiRequest("PUT", `/api/work-orders/${id}`, valid.data);
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
  }, [id]);

  const { status: autosaveStatus, retry: autosaveRetry, resetBaseline: resetAutosaveBaseline, flush: flushAutosave } = useAutosave({
    data: watchedValues as EditWorkOrderForm,
    onSave: handleAutosave,
    debounceMs: 1500,
    enabled: editDialogOpen,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditWorkOrderForm) => {
      return apiRequest("PUT", `/api/work-orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setEditDialogOpen(false);
      toast({ title: "Work order updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/work-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({ title: "Work order deleted" });
      setLocation("/work-orders");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const requestWoDeletionMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      const res = await apiRequest("POST", "/api/deletion-requests", {
        entityType: "work_order",
        entityId: id,
        entityLabel: workOrder ? `WO ${workOrder.woNumber} — ${workOrder.applicantName}` : id,
        reason,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deletion request submitted", description: "Admin will review your request." });
      setWoDeletionRequest(null);
      setWoDeletionReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit request", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenEdit = () => {
    if (workOrder) {
      const values = {
        woNumber: workOrder.woNumber,
        applicantName: workOrder.applicantName,
        applicantPhone: workOrder.applicantPhone || "",
        applicantEmail: workOrder.applicantEmail || "",
        isVip: workOrder.isVip || false,
        companyId: workOrder.companyId,
        serviceTypeId: workOrder.serviceTypeId || "",
        status: workOrder.status,
        notes: workOrder.notes || "",
      };
      form.reset(values);
      resetAutosaveBaseline(values);
      setEditDialogOpen(true);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader
          title="Loading work order…"
          breadcrumbs={[{ label: "Work Orders", href: "/work-orders" }]}
        />
        <div className="p-4 lg:p-8 space-y-6">
          <div className="premium-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-12 rounded-xl" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="premium-card p-5 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
            <div className="premium-card p-5 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!workOrder) {
    return (
      <AppLayout>
        <PageHeader
          title="Work Order Not Found"
          actions={
            <div className="flex items-center gap-1">
              <Link href="/work-orders">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-home">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          }
        />
        <div className="p-4 lg:p-8">
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Work order not found"
            description="The work order you're looking for doesn't exist or has been deleted."
            action={
              <Link href="/work-orders">
                <Button>View All Work Orders</Button>
              </Link>
            }
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={workOrder.woNumber}
        subtitle={toProperCase(workOrder.applicantName)}
        breadcrumbs={[
          { label: "Work Orders", href: "/work-orders" },
          { label: workOrder.woNumber }
        ]}
        actions={
          <div className="flex items-center flex-wrap gap-2">
            <StatusBadge status={workOrder.status} isDelayed={!!workOrder.isDelayed} />
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5" 
              onClick={handleOpenEdit}
              data-testid="button-edit-wo"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            {isCrm ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive"
                  onClick={() => setWoDeletionRequest({ reason: "" })}
                  data-testid="button-delete-wo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Request Deletion
                </Button>
                <Dialog
                  open={!!woDeletionRequest}
                  onOpenChange={(open) => { if (!open) { setWoDeletionRequest(null); setWoDeletionReason(""); } }}
                >
                  <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Request Work Order Deletion</DialogTitle>
                      <DialogDescription>As CRM, deletions require Admin approval. Submit a request with a reason.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Work Order</p>
                        <p className="text-sm font-medium">{workOrder.woNumber} — {workOrder.applicantName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Reason *</p>
                        <Input
                          placeholder="Why should this work order be deleted?"
                          value={woDeletionReason}
                          onChange={(e) => setWoDeletionReason(e.target.value)}
                          data-testid="input-wo-deletion-reason"
                        />
                      </div>
                    </div>
                    <DialogFooter className="gap-2 mt-2">
                      <Button variant="outline" onClick={() => { setWoDeletionRequest(null); setWoDeletionReason(""); }} data-testid="button-cancel-wo-deletion">Cancel</Button>
                      <Button
                        disabled={!woDeletionReason.trim() || requestWoDeletionMutation.isPending}
                        onClick={() => {
                          if (!woDeletionReason.trim()) return;
                          requestWoDeletionMutation.mutate({ reason: woDeletionReason.trim() });
                        }}
                        data-testid="button-submit-wo-deletion"
                      >
                        {requestWoDeletionMutation.isPending ? "Submitting..." : "Submit Request"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive" data-testid="button-delete-wo">
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Work Order</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2">
                        <p>Are you sure you want to delete work order <strong>{workOrder.woNumber}</strong>? This action cannot be undone.</p>
                        {((workOrder.typingJobs?.length || 0) > 0 || (workOrder.appointments?.length || 0) > 0) && (
                          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm space-y-1">
                            <p className="font-medium text-destructive">The following will also be deleted:</p>
                            {(workOrder.typingJobs?.length || 0) > 0 && (
                              <p>• {workOrder.typingJobs!.length} typing job{workOrder.typingJobs!.length > 1 ? "s" : ""}</p>
                            )}
                            {(workOrder.appointments?.length || 0) > 0 && (
                              <p>• {workOrder.appointments!.length} appointment{workOrder.appointments!.length > 1 ? "s" : ""}</p>
                            )}
                            <p>• All associated documents, notes, and files</p>
                          </div>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      className="rounded-xl bg-destructive text-destructive-foreground"
                      onClick={() => deleteMutation.mutate()}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex items-center gap-1">
              <Link href="/work-orders">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-home">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
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
                  setTypeMedical(missingLabels.includes("Medical Typing"));
                  setTypeEid(missingLabels.some(l => l.startsWith("EID Typing")));
                  setShowNewTypingJobForm(true);
                }}
                data-testid="button-create-missing-job"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Missing Job{missingLabels.length > 1 ? "s" : ""}
              </Button>
            </div>
          );
        })()}

        {pipeline && (
          <div className="space-y-3">
            <PipelineBar
              pipeline={pipeline}
              serviceType={workOrder.serviceType}
              isMinor={workOrder.isMinor}
              onTrackClick={(track) => {
                const stage = track === "medical" ? pipeline.medical.stage : pipeline.eid.stage;
                if (stage === "at_vendor" || stage === "new" || stage === "needs_attention") {
                  setActiveTab("typing");
                } else {
                  setActiveTab("appointments");
                }
              }}
            />
            <NextActionBanner
              pipeline={pipeline}
              typingJobs={effectiveTypingJobs}
              appointments={workOrder.appointments || []}
              onAction={handleNextAction}
            />
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Work Order Summary */}
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

          {/* Company Snapshot */}
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
        </div>

        {/* Tabs */}
        <Card className="border border-border/50 shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto overflow-x-auto">
              <TabsTrigger 
                value="typing" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
                data-testid="tab-typing"
              >
                <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Create </span>Typing
              </TabsTrigger>
              <TabsTrigger 
                value="appointments" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
                data-testid="tab-appointments"
              >
                <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Schedule </span>Appt
              </TabsTrigger>
              <TabsTrigger 
                value="notes" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
                data-testid="tab-notes"
              >
                <StickyNote className="h-4 w-4 mr-1 sm:mr-2" />
                Notes
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
                data-testid="tab-activity"
              >
                <History className="h-4 w-4 mr-1 sm:mr-2" />
                Timeline
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
                data-testid="tab-documents"
              >
                <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                Docs
              </TabsTrigger>
              <TabsTrigger 
                value="medical-scheduling" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
                data-testid="tab-medical-scheduling"
              >
                <Stethoscope className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Medical </span>Sched
              </TabsTrigger>
              <TabsTrigger 
                value="biometrics-scheduling" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
                data-testid="tab-biometrics-scheduling"
              >
                <CreditCard className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">EID </span>Biometrics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appointments" className="p-3 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-medium text-foreground">Scheduled Appointments</h3>
                <div className="flex gap-2">
                  <Link href={`/appointments/schedule-medical?wo=${id}`}>
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-schedule-medical">
                      <Plus className="h-4 w-4" />
                      Medical
                    </Button>
                  </Link>
                  <Link href={`/appointments/schedule-eid?wo=${id}`}>
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-schedule-eid">
                      <Plus className="h-4 w-4" />
                      Emirates ID
                    </Button>
                  </Link>
                </div>
              </div>

              {workOrder.appointments && workOrder.appointments.length > 0 ? (
                <div className="space-y-3">
                  {workOrder.appointments.map((apt) => (
                    <ExpandedAppointmentCard
                      key={apt.id}
                      apt={apt}
                      centers={allCenters}
                      staffList={allStaff}
                      onComplete={() => setAptConfirmDialog({ open: true, type: "complete", appointment: apt })}
                      onReschedule={() => setAptConfirmDialog({ open: true, type: "reschedule", appointment: apt })}
                      onCancel={() => setAptConfirmDialog({ open: true, type: "cancel", appointment: apt })}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Calendar className="h-6 w-6" />}
                  title="No appointments scheduled"
                  description="Schedule a medical or Emirates ID appointment for this work order."
                />
              )}
            </TabsContent>

            <TabsContent value="typing" className="p-3 sm:p-6">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
                <h3 className="font-medium text-foreground">Typing Jobs</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {draftTypingJobs.length > 0 && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="gap-2" 
                      onClick={() => setShowSendToVendorDialog(true)}
                      data-testid="button-send-to-vendor"
                    >
                      <Send className="h-4 w-4" />
                      Send {draftTypingJobs.length > 1 ? `${draftTypingJobs.length} Jobs` : "to Vendor"}
                    </Button>
                  )}
                  {canCreateNewJob && !showNewTypingJobForm && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2" 
                      onClick={() => {
                        setTypeMedical(!existingMedicalJob);
                        setTypeEid(!existingEidJob);
                        setShowNewTypingJobForm(true);
                      }}
                      data-testid="button-new-typing-job"
                    >
                      <Plus className="h-4 w-4" />
                      New Typing Job
                    </Button>
                  )}
                </div>
              </div>

              {showNewTypingJobForm && (
                <Card className="border border-border/50 mb-4">
                  <CardContent className="p-4 space-y-4">
                    <h4 className="font-medium text-foreground">Create Typing Job</h4>
                    <p className="text-sm text-muted-foreground">
                      Select the types of applications to submit for typing:
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="typeMedical"
                          checked={typeMedical}
                          onCheckedChange={(checked) => setTypeMedical(checked === true)}
                          disabled={!!existingMedicalJob}
                          data-testid="checkbox-type-medical"
                        />
                        <Label htmlFor="typeMedical" className={`text-sm font-medium ${existingMedicalJob ? "text-muted-foreground" : "cursor-pointer"}`}>
                          Medical Application
                        </Label>
                        {existingMedicalJob ? (
                          <Link href={`/typing-jobs/${existingMedicalJob.id}`}>
                            <span className="text-xs text-primary hover:underline cursor-pointer">
                              Already exists ({existingMedicalJob.jobCode} · {existingMedicalJob.status})
                            </span>
                          </Link>
                        ) : medicalJobType && (
                          <span className="text-xs text-muted-foreground">
                            (AED {medicalJobType.cost || 0})
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="typeEid"
                          checked={typeEid}
                          onCheckedChange={(checked) => setTypeEid(checked === true)}
                          disabled={!!existingEidJob}
                          data-testid="checkbox-type-eid"
                        />
                        <Label htmlFor="typeEid" className={`text-sm font-medium ${existingEidJob ? "text-muted-foreground" : "cursor-pointer"}`}>
                          Emirates ID Application
                        </Label>
                        {existingEidJob ? (
                          <Link href={`/typing-jobs/${existingEidJob.id}`}>
                            <span className="text-xs text-primary hover:underline cursor-pointer">
                              Already exists ({existingEidJob.jobCode} · {existingEidJob.status})
                            </span>
                          </Link>
                        ) : eidJobType && (
                          <span className="text-xs text-muted-foreground">
                            (AED {eidJobType.cost || 0})
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowNewTypingJobForm(false);
                          setTypeMedical(true);
                          setTypeEid(true);
                        }}
                        data-testid="button-cancel-typing-job"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={handleCreateTypingJobs}
                        disabled={isCreatingJobs || (!typeMedical && !typeEid)}
                        data-testid="button-create-typing-job"
                      >
                        {isCreatingJobs ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <ClipboardList className="h-4 w-4" />
                            Create Job{typeMedical && typeEid ? 's' : ''}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {workOrder.typingJobs && workOrder.typingJobs.length > 0 ? (
                <div className="space-y-3">
                  {workOrder.typingJobs.map((job: any) => (
                    <ExpandedTypingJobCard key={job.id} job={job} woId={id || ""} onRefresh={handleRefreshWo} />
                  ))}
                </div>
              ) : !showNewTypingJobForm && (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No typing jobs"
                  description="Create a typing job to send to the vendor."
                />
              )}
            </TabsContent>

            <TabsContent value="notes" className="p-3 sm:p-6">
              <InternalNotesSection workOrderId={id || ""} />
            </TabsContent>

            <TabsContent value="activity" className="p-3 sm:p-6">
              <ActivityTimelineSection workOrderId={id || ""} />
            </TabsContent>

            <TabsContent value="documents" className="p-3 sm:p-6">
              <DocumentPanel 
                woId={id || ""}
                serviceCategory={serviceTypes?.find(st => st.id === workOrder.serviceTypeId)?.category as ServiceCategory | undefined}
                title="Work Order Documents"
              />
            </TabsContent>

            <TabsContent value="medical-scheduling" className="p-3 sm:p-6">
              <MedicalSchedulingTab
                woId={id || ""}
                centers={allCenters}
                staffList={allStaff}
                typingReady={!!(existingMedicalJob && (existingMedicalJob.status === "ReadyForScheduling" || existingMedicalJob.status === "Returned"))}
              />
            </TabsContent>

            <TabsContent value="biometrics-scheduling" className="p-3 sm:p-6">
              <BiometricsSchedulingTab
                woId={id || ""}
                centers={allCenters}
                staffList={allStaff}
              />
            </TabsContent>

          </Tabs>
        </Card>
      </div>

      {/* Edit Work Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={async (open) => {
        if (!open) await flushAutosave();
        setEditDialogOpen(open);
      }}>
        <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Edit Work Order</DialogTitle>
              <SaveStatusIndicator status={autosaveStatus} onRetry={autosaveRetry} />
            </div>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="woNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Order Number</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., J016308" 
                        className="uppercase"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        data-testid="input-edit-wo-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="applicantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Applicant Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Full name" data-testid="input-edit-applicant" onBlur={(e) => { field.onBlur(); if (e.target.value) form.setValue("applicantName", toProperCase(e.target.value)); }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="applicantPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <MaskedInput
                          mask="phone"
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="+971 50 123 4567"
                          aria-label="Applicant phone number"
                          data-testid="input-edit-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="applicantEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="applicant@email.com"
                          aria-label="Applicant email address"
                          data-testid="input-edit-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isVip"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Button
                        type="button"
                        variant={field.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.onChange(!field.value)}
                        className={field.value ? "bg-amber-500 text-white border-amber-500 gap-2" : "gap-2"}
                        data-testid="button-edit-vip"
                      >
                        <Star className={`h-4 w-4 ${field.value ? "fill-current" : ""}`} />
                        {field.value ? "VIP" : "Mark as VIP"}
                      </Button>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-company">
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-service">
                          <SelectValue placeholder="Select service type (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceTypes?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Additional notes..." 
                        className="resize-none"
                        data-testid="input-edit-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={async () => { await flushAutosave(); setEditDialogOpen(false); }} data-testid="button-close-edit-wo">
                  Close
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-wo">
                  {updateMutation.isPending ? "Saving..." : "Save & Close"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={aptConfirmDialog.open} onOpenChange={(open) => !open && setAptConfirmDialog({ open: false, type: "complete", appointment: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {aptConfirmDialog.type === "complete" && "Mark as Completed"}
              {aptConfirmDialog.type === "cancel" && "Cancel Appointment"}
              {aptConfirmDialog.type === "reschedule" && "Reschedule Appointment"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {aptConfirmDialog.appointment && (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Applicant:</span>{" "}
                  <span className="font-medium">{toProperCase(workOrder?.applicantName || "")}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  <span className="font-medium">{aptConfirmDialog.appointment.type}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  <span className="font-medium">
                    {formatDateWithWeekday(aptConfirmDialog.appointment.datetime)} at{" "}
                    {new Date(aptConfirmDialog.appointment.datetime).toLocaleTimeString("en-US", {
                      hour: "numeric", minute: "2-digit", hour12: true
                    })}
                  </span>
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              {aptConfirmDialog.type === "complete" && "This will mark the appointment as completed."}
              {aptConfirmDialog.type === "cancel" && "This will cancel the appointment. This action cannot be undone."}
              {aptConfirmDialog.type === "reschedule" && "This will mark the current appointment as rescheduled and take you to schedule a new one for the same work order."}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAptConfirmDialog({ open: false, type: "complete", appointment: null })}
              data-testid="button-apt-dialog-cancel"
            >
              Go Back
            </Button>
            <Button
              variant={aptConfirmDialog.type === "cancel" ? "destructive" : "default"}
              onClick={handleAptConfirmAction}
              disabled={updateAptStatusMutation.isPending}
              data-testid="button-apt-dialog-confirm"
            >
              {updateAptStatusMutation.isPending ? "Processing..." :
                aptConfirmDialog.type === "complete" ? "Mark Completed" :
                aptConfirmDialog.type === "cancel" ? "Cancel Appointment" :
                "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Send to Vendor Dialog */}
      <Dialog open={showSendToVendorDialog} onOpenChange={setShowSendToVendorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Vendor</DialogTitle>
            <DialogDescription>
              Select a vendor to assign {draftTypingJobs.length > 1 ? `${draftTypingJobs.length} draft jobs` : "this draft job"} to. Each job will be tracked independently.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select value={sendVendorId} onValueChange={setSendVendorId}>
                <SelectTrigger data-testid="select-send-vendor">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Jobs to send</Label>
              <div className="space-y-2">
                {draftTypingJobs.map((job: any) => {
                  const category = job.jobType?.category;
                  const cost = job.jobType?.cost || 0;
                  return (
                    <div key={job.id} className="flex items-center justify-between gap-2 p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium">
                          {category === "Medical" ? "Medical" : category === "EID" ? "Emirates ID" : "Typing"}
                        </span>
                        {job.jobCode && (
                          <span className="text-xs text-muted-foreground font-mono">{job.jobCode}</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold shrink-0">AED {cost}</span>
                    </div>
                  );
                })}
              </div>
              {draftTypingJobs.length > 1 && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-sm font-semibold">
                    AED {draftTypingJobs.reduce((sum: number, job: any) => sum + (job.jobType?.cost || 0), 0)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowSendToVendorDialog(false); setSendVendorId(""); }} data-testid="button-cancel-send-vendor">
              Cancel
            </Button>
            <Button 
              onClick={() => sendToVendorMutation.mutate()}
              disabled={!sendVendorId || sendToVendorMutation.isPending}
              className="gap-2"
              data-testid="button-confirm-send-vendor"
            >
              {sendToVendorMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send {draftTypingJobs.length > 1 ? `${draftTypingJobs.length} Jobs` : "to Vendor"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Work Order Dialog */}
      <Dialog open={showActivateDialog} onOpenChange={(open) => {
        if (!open) {
          setActivateEntryPermit(false);
          setActivateChangeStatus(false);
          setActivateIsMinor("adult");
        }
        setShowActivateDialog(open);
      }}>
        <DialogContent className="rounded-2xl max-w-md" data-testid="dialog-activate-wo">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              Activate Work Order
            </DialogTitle>
            <DialogDescription>
              Confirm that the required external approvals have been obtained before activating.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Required Approvals</p>
              <div
                className="flex items-center gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => setActivateEntryPermit(!activateEntryPermit)}
                data-testid="checkbox-entry-permit"
              >
                <Checkbox
                  checked={activateEntryPermit}
                  onCheckedChange={(v) => setActivateEntryPermit(!!v)}
                  id="entry-permit"
                />
                <label htmlFor="entry-permit" className="text-sm cursor-pointer select-none">
                  Entry Permit has been approved
                </label>
              </div>
              <div
                className="flex items-center gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => setActivateChangeStatus(!activateChangeStatus)}
                data-testid="checkbox-change-status"
              >
                <Checkbox
                  checked={activateChangeStatus}
                  onCheckedChange={(v) => setActivateChangeStatus(!!v)}
                  id="change-status"
                />
                <label htmlFor="change-status" className="text-sm cursor-pointer select-none">
                  Change Status has been approved
                </label>
              </div>
            </div>

            {serviceTypes?.find(st => st.id === workOrder.serviceTypeId)?.isDependent && (
              <div className="space-y-3 pt-1">
                <p className="text-sm font-medium text-foreground">Applicant Age</p>
                <p className="text-xs text-muted-foreground -mt-2">This is a dependent visa. Medical typing may not be required for minors.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActivateIsMinor("adult")}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors",
                      activateIsMinor === "adult"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40"
                    )}
                    data-testid="radio-adult"
                  >
                    <User className="h-4 w-4" />
                    Adult
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivateIsMinor("minor")}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors",
                      activateIsMinor === "minor"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40"
                    )}
                    data-testid="radio-minor"
                  >
                    <User className="h-4 w-4" />
                    Minor (under 18)
                  </button>
                </div>
                {activateIsMinor === "minor" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Medical typing and scheduling will be skipped for this work order.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setShowActivateDialog(false)}
              data-testid="button-cancel-activate"
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl gap-1.5"
              disabled={!activateEntryPermit || !activateChangeStatus || activateMutation.isPending}
              onClick={() => activateMutation.mutate()}
              data-testid="button-confirm-activate"
            >
              {activateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Activate Work Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeliverDialog} onOpenChange={setShowDeliverDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-deliver">
          <DialogHeader>
            <DialogTitle>Complete & Deliver</DialogTitle>
            <DialogDescription>
              Mark this work order as completed and delivered. This will change the status to "Completed".
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/20 dark:border-emerald-800 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>All pipeline steps are complete for <strong>{workOrder?.woNumber}</strong></span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setShowDeliverDialog(false)}
              data-testid="button-cancel-deliver"
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={deliverMutation.isPending}
              onClick={() => deliverMutation.mutate()}
              data-testid="button-confirm-deliver"
            >
              {deliverMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Complete & Deliver
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
