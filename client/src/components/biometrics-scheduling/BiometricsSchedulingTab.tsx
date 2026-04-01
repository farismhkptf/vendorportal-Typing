import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Calendar, Clock, User, MapPin, ChevronDown, ChevronUp,
  Plus, CheckCircle2, AlertTriangle, XCircle, Shield,
  QrCode, RefreshCw, Loader2, Activity, Lock, Image
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Center, Staff } from "@shared/schema";

type BiometricsApptStatus =
  | "SCHEDULED" | "AWAITING_MEETING" | "IN_PROCESS" | "COMPLETED"
  | "NO_SHOW" | "RESCHEDULE_REQUIRED" | "CLOSED_ADMIN_OVERRIDE";

const FINAL_BIOMETRICS_STATUSES: BiometricsApptStatus[] = ["COMPLETED", "NO_SHOW", "CLOSED_ADMIN_OVERRIDE"];
const NON_ACTIVE_STATUSES: BiometricsApptStatus[] = ["COMPLETED", "NO_SHOW", "CLOSED_ADMIN_OVERRIDE", "RESCHEDULE_REQUIRED"];

type BiometricsEvent = {
  id: string;
  cycleId: string;
  eventType: string;
  actorId: string | null;
  actorRole: string | null;
  details: Record<string, any> | null;
  createdAt: string;
};

type BiometricsCycle = {
  id: string;
  caseId: string;
  cycleNumber: number;
  cycleType: "Initial" | "Reschedule";
  status: BiometricsApptStatus;
  appointmentTime: string;
  centerId: string | null;
  assignedProId: string | null;
  outcome: string | null;
  awaitingMeetingAt: string | null;
  noShowAt: string | null;
  completedAt: string | null;
  crmHoldActive: boolean;
  crmHoldSetBy: string | null;
  crmHoldSetAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmMethod: string | null;
  proofImageUrl: string | null;
  proofUploadedAt: string | null;
  overrideReason: string | null;
  overrideBy: string | null;
  overrideAt: string | null;
  createdBy: string | null;
  createdAt: string;
  events: BiometricsEvent[];
};

type BiometricsCase = {
  id: string;
  woId: string;
  isOpen: boolean;
  createdAt: string;
};

const STATUS_CONFIG: Record<BiometricsApptStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}> = {
  SCHEDULED: {
    label: "Scheduled",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    icon: <Calendar className="h-3 w-3" />,
  },
  AWAITING_MEETING: {
    label: "Awaiting Meeting",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    icon: <Clock className="h-3 w-3" />,
  },
  IN_PROCESS: {
    label: "In Process",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    icon: <Activity className="h-3 w-3" />,
  },
  COMPLETED: {
    label: "Completed",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  NO_SHOW: {
    label: "No Show",
    color: "text-slate-700 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/20",
    border: "border-slate-200 dark:border-slate-800",
    icon: <XCircle className="h-3 w-3" />,
  },
  RESCHEDULE_REQUIRED: {
    label: "Reschedule Required",
    color: "text-pink-700 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-900/20",
    border: "border-pink-200 dark:border-pink-800",
    icon: <RefreshCw className="h-3 w-3" />,
  },
  CLOSED_ADMIN_OVERRIDE: {
    label: "Closed (Admin)",
    color: "text-gray-700 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/20",
    border: "border-gray-200 dark:border-gray-700",
    icon: <Lock className="h-3 w-3" />,
  },
};

function StatusChip({ status }: { status: BiometricsApptStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-xs font-medium", config.color, config.bg, config.border)}
      data-testid={`bio-status-chip-${status}`}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}

function CycleTypeBadge({ type }: { type: "Initial" | "Reschedule" }) {
  const colors: Record<string, string> = {
    Initial: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    Reschedule: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px]", colors[type])} data-testid={`bio-cycle-type-${type}`}>
      {type}
    </Badge>
  );
}

function EventLabel({ eventType }: { eventType: string }) {
  const labels: Record<string, string> = {
    CYCLE_CREATED: "Cycle Created",
    STATUS_CHANGED: "Status Changed",
    QR_CONFIRMED: "QR Confirmed",
    MANUAL_CONFIRMED: "Manually Confirmed (Fallback)",
    CRM_HOLD_SET: "No-Show Hold Set",
    CRM_HOLD_REMOVED: "No-Show Hold Removed",
    COMPLETED_MARKED: "Marked Completed",
    PROOF_UPLOADED: "Proof Image Uploaded",
    RESCHEDULE_REQUIRED_SET: "Reschedule Required Set",
    ADMIN_OVERRIDE: "Admin Override (Force Close)",
    TIMER_AWAITING_MEETING: "Timer: Awaiting Meeting",
    TIMER_NO_SHOW: "Timer: No Show",
  };
  return <span>{labels[eventType] || eventType}</span>;
}

function EventTimeline({ events }: { events: BiometricsEvent[] }) {
  if (events.length === 0) return <p className="text-xs text-muted-foreground">No events yet</p>;
  return (
    <div className="space-y-2" data-testid="bio-event-timeline">
      {events.map((ev) => (
        <div key={ev.id} className="flex gap-2 text-xs" data-testid={`bio-event-${ev.id}`}>
          <div className="mt-0.5 h-2 w-2 rounded-full bg-primary/50 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-medium"><EventLabel eventType={ev.eventType} /></span>
              {ev.actorRole && ev.actorRole !== "system" && (
                <span className="text-muted-foreground">by {ev.actorRole}</span>
              )}
              {ev.actorRole === "system" && (
                <Badge variant="outline" className="text-[10px] px-1">timer</Badge>
              )}
              {ev.details?.fallback && (
                <Badge variant="outline" className="text-[10px] px-1 bg-amber-50 text-amber-700 border-amber-200">fallback</Badge>
              )}
            </div>
            {ev.details && ev.eventType === "STATUS_CHANGED" && ev.details.from && (
              <p className="text-muted-foreground">{ev.details.from} → {ev.details.to}</p>
            )}
            {ev.details?.reason && (
              <p className="text-muted-foreground">Reason: {ev.details.reason}</p>
            )}
            {ev.details?.note && (
              <p className="text-muted-foreground">Note: {ev.details.note}</p>
            )}
            <p className="text-muted-foreground/70">
              {format(new Date(ev.createdAt), "MMM d, yyyy HH:mm")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const newCycleSchema = z.object({
  appointmentTime: z.string().min(1, "Appointment time is required"),
  cycleType: z.enum(["Initial", "Reschedule"]),
  centerId: z.string().optional(),
  assignedProId: z.string().optional(),
});

const adminOverrideSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

const completeSchema = z.object({
  proofImageUrl: z.string().optional(),
});

function CycleCard({
  cycle,
  userRole,
  isActive,
  centers,
  staffList,
  onAction,
}: {
  cycle: BiometricsCycle;
  userRole: string;
  isActive: boolean;
  centers: Center[];
  staffList: Staff[];
  onAction: (action: string, cycleId: string, extra?: any) => void;
}) {
  const [showEvents, setShowEvents] = useState(false);
  const isFinal = FINAL_BIOMETRICS_STATUSES.includes(cycle.status);
  const center = centers.find(c => c.id === cycle.centerId);
  const pro = staffList.find(s => s.id === cycle.assignedProId);

  const isPRO = ["PRO", "PRO - Temporary", "Admin"].includes(userRole);
  const isCRM = userRole === "Client Relationship Manager" || userRole === "Admin";
  const isAdmin = userRole === "Admin";

  return (
    <Card
      className={cn(
        "border border-border/50 transition-all",
        isActive && "ring-1 ring-primary/30",
        isFinal && "opacity-60"
      )}
      data-testid={`bio-cycle-card-${cycle.id}`}
    >
      <Collapsible open={showEvents} onOpenChange={setShowEvents}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold",
                isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                #{cycle.cycleNumber}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusChip status={cycle.status} />
                  <CycleTypeBadge type={cycle.cycleType} />
                  {cycle.crmHoldActive && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 gap-0.5">
                      <Shield className="h-2.5 w-2.5" />
                      No-Show Hold
                    </Badge>
                  )}
                  {cycle.proofImageUrl && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 gap-0.5">
                      <Image className="h-2.5 w-2.5" />
                      Proof
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(cycle.appointmentTime), "MMM d, yyyy")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(cycle.appointmentTime), "HH:mm")}
                  </span>
                  {center && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {center.name}
                    </span>
                  )}
                  {pro && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {pro.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              {cycle.status === "AWAITING_MEETING" && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {cycle.awaitingMeetingAt
                    ? `Waiting ${formatDistanceToNow(new Date(cycle.awaitingMeetingAt))}`
                    : "Waiting for presence"}
                </span>
              )}

              {/* PRO actions */}
              {isPRO && isActive && cycle.status === "AWAITING_MEETING" && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1.5 text-xs"
                    onClick={() => onAction("confirm-qr", cycle.id)}
                    data-testid={`button-bio-confirm-qr-${cycle.id}`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Confirm (QR)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => onAction("confirm-manual", cycle.id)}
                    data-testid={`button-bio-confirm-manual-${cycle.id}`}
                  >
                    Confirm (Manual)
                  </Button>
                </>
              )}

              {isPRO && isActive && cycle.status === "IN_PROCESS" && (
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5 text-xs"
                  onClick={() => onAction("complete", cycle.id)}
                  data-testid={`button-bio-complete-${cycle.id}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark Completed
                </Button>
              )}

              {/* CRM actions */}
              {isCRM && isActive && (cycle.status === "AWAITING_MEETING" || cycle.status === "SCHEDULED") && (
                <Button
                  size="sm"
                  variant="outline"
                  className={cn("gap-1.5 text-xs", cycle.crmHoldActive && "text-amber-700 border-amber-300")}
                  onClick={() => onAction("crm-hold", cycle.id, { active: !cycle.crmHoldActive })}
                  data-testid={`button-bio-crm-hold-${cycle.id}`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  {cycle.crmHoldActive ? "Remove Hold" : "Set No-Show Hold"}
                </Button>
              )}

              {isCRM && isActive && !FINAL_BIOMETRICS_STATUSES.includes(cycle.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs text-pink-700 border-pink-300 dark:text-pink-400 dark:border-pink-800"
                  onClick={() => onAction("reschedule-required", cycle.id)}
                  data-testid={`button-bio-reschedule-${cycle.id}`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Set Reschedule Required
                </Button>
              )}

              {/* Admin-only force close */}
              {isAdmin && !isFinal && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs text-red-600 border-red-300 dark:text-red-400 dark:border-red-800"
                  onClick={() => onAction("admin-override", cycle.id)}
                  data-testid={`button-bio-admin-override-${cycle.id}`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  Force Close
                </Button>
              )}

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-bio-toggle-events-${cycle.id}`}>
                  {showEvents ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardContent>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-border/50 pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Event Timeline
            </p>
            <EventTimeline events={cycle.events} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function BiometricsSchedulingTab({
  woId,
  centers,
  staffList,
}: {
  woId: string;
  centers: Center[];
  staffList: Staff[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRole = user?.role || "";

  const [showNewCycleDialog, setShowNewCycleDialog] = useState(false);
  const [adminOverrideDialog, setAdminOverrideDialog] = useState<{ open: boolean; cycleId: string }>({ open: false, cycleId: "" });
  const [completeDialog, setCompleteDialog] = useState<{ open: boolean; cycleId: string }>({ open: false, cycleId: "" });

  const newCycleForm = useForm({
    resolver: zodResolver(newCycleSchema),
    defaultValues: {
      appointmentTime: "",
      cycleType: "Initial" as const,
      centerId: "",
      assignedProId: "",
    },
  });

  const adminOverrideForm = useForm({
    resolver: zodResolver(adminOverrideSchema),
    defaultValues: { reason: "" },
  });

  const completeForm = useForm({
    resolver: zodResolver(completeSchema),
    defaultValues: { proofImageUrl: "" },
  });

  const { data: bioCase, isLoading: caseLoading } = useQuery<BiometricsCase | null>({
    queryKey: ["/api/biometrics-cases", woId],
    queryFn: () => fetch(`/api/biometrics-cases/${woId}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: cycles = [], isLoading: cyclesLoading, refetch: refetchCycles } = useQuery<BiometricsCycle[]>({
    queryKey: ["/api/biometrics-cases", bioCase?.id, "cycles"],
    queryFn: () => fetch(`/api/biometrics-cases/${bioCase!.id}/cycles`, { credentials: "include" }).then(r => r.json()),
    enabled: !!bioCase?.id,
  });

  const createCaseMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/biometrics-cases/${woId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biometrics-cases", woId] });
    },
    onError: (err: Error) => toast({ title: "Failed to create case", description: err.message, variant: "destructive" }),
  });

  const createCycleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/biometrics-cases/${bioCase!.id}/cycles`, data),
    onSuccess: () => {
      refetchCycles();
      setShowNewCycleDialog(false);
      newCycleForm.reset();
      toast({ title: "Cycle created", description: "New appointment cycle created and set to SCHEDULED" });
    },
    onError: (err: Error) => toast({ title: "Failed to create cycle", description: err.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ endpoint, body }: { endpoint: string; body?: any }) =>
      apiRequest("POST", endpoint, body || {}),
    onSuccess: () => {
      refetchCycles();
      setAdminOverrideDialog({ open: false, cycleId: "" });
      setCompleteDialog({ open: false, cycleId: "" });
      adminOverrideForm.reset();
      completeForm.reset();
      toast({ title: "Action completed successfully" });
    },
    onError: (err: Error) => toast({ title: "Action failed", description: err.message, variant: "destructive" }),
  });

  const activeCycle = cycles.find(c => !NON_ACTIVE_STATUSES.includes(c.status));
  const canCreateNewCycle = bioCase?.isOpen && !activeCycle;

  function handleAction(action: string, cycleId: string, extra?: any) {
    if (action === "admin-override") {
      setAdminOverrideDialog({ open: true, cycleId });
      return;
    }
    if (action === "complete") {
      setCompleteDialog({ open: true, cycleId });
      return;
    }

    const endpoint = `/api/biometrics-cycles/${cycleId}/${action}`;
    const body: any = extra || {};

    actionMutation.mutate({ endpoint, body });
  }

  function handleNewCycleSubmit(data: any) {
    createCycleMutation.mutate({
      appointmentTime: data.appointmentTime,
      cycleType: data.cycleType,
      centerId: data.centerId || undefined,
      assignedProId: data.assignedProId || undefined,
    });
  }

  function handleAdminOverrideSubmit(data: any) {
    actionMutation.mutate({
      endpoint: `/api/biometrics-cycles/${adminOverrideDialog.cycleId}/admin-override`,
      body: { reason: data.reason },
    });
  }

  function handleCompleteSubmit(data: any) {
    actionMutation.mutate({
      endpoint: `/api/biometrics-cycles/${completeDialog.cycleId}/complete`,
      body: { proofImageUrl: data.proofImageUrl || undefined },
    });
  }

  if (caseLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const eidCenters = centers.filter(c => c.type === "EID" || c.type === "Both");

  return (
    <div className="space-y-4" data-testid="biometrics-scheduling-tab">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-medium text-foreground">EID Biometrics Scheduling</h3>
          {bioCase && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Case {bioCase.isOpen ? "open" : "closed"} · {cycles.length} cycle{cycles.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!bioCase && (
            <Button
              size="sm"
              variant="default"
              className="gap-1.5"
              onClick={() => createCaseMutation.mutate()}
              disabled={createCaseMutation.isPending}
              data-testid="button-open-biometrics-case"
            >
              {createCaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Open Biometrics Case
            </Button>
          )}
          {bioCase && canCreateNewCycle && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowNewCycleDialog(true)}
              data-testid="button-bio-new-cycle"
            >
              <Plus className="h-4 w-4" />
              New Cycle
            </Button>
          )}
        </div>
      </div>

      {/* No case yet */}
      {!bioCase && !createCaseMutation.isPending && (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No biometrics case yet"
          description="Open a biometrics case to start scheduling EID biometric appointment cycles."
        />
      )}

      {/* Cycles list */}
      {bioCase && cyclesLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {bioCase && !cyclesLoading && cycles.length === 0 && (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No appointment cycles"
          description="Create the first appointment cycle for this biometrics case."
        />
      )}

      {bioCase && cycles.length > 0 && (
        <div className="space-y-3">
          {cycles.map((cycle) => {
            const isActive = cycle.id === activeCycle?.id;
            return (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                userRole={userRole}
                isActive={isActive}
                centers={centers}
                staffList={staffList}
                onAction={handleAction}
              />
            );
          })}
        </div>
      )}

      {/* New Cycle Dialog */}
      <Dialog open={showNewCycleDialog} onOpenChange={setShowNewCycleDialog}>
        <DialogContent className="max-w-md" data-testid="bio-dialog-new-cycle">
          <DialogHeader>
            <DialogTitle>Create New Biometrics Appointment Cycle</DialogTitle>
            <DialogDescription>
              A new cycle will be created and set to SCHEDULED status.
            </DialogDescription>
          </DialogHeader>
          <Form {...newCycleForm}>
            <form onSubmit={newCycleForm.handleSubmit(handleNewCycleSubmit)} className="space-y-4">
              <FormField
                control={newCycleForm.control}
                name="appointmentTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Appointment Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="bio-input-appointment-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={newCycleForm.control}
                name="cycleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cycle Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="bio-select-cycle-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Initial">Initial</SelectItem>
                        <SelectItem value="Reschedule">Reschedule</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={newCycleForm.control}
                name="centerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EID Center (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="bio-select-center">
                          <SelectValue placeholder="Select center" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eidCenters.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={newCycleForm.control}
                name="assignedProId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned PRO (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="bio-select-pro">
                          <SelectValue placeholder="Select PRO" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {staffList.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNewCycleDialog(false)} data-testid="bio-button-cancel-new-cycle">
                  Cancel
                </Button>
                <Button type="submit" disabled={createCycleMutation.isPending} data-testid="bio-button-submit-new-cycle">
                  {createCycleMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Create Cycle
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Complete Cycle Dialog */}
      <Dialog open={completeDialog.open} onOpenChange={(open) => setCompleteDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md" data-testid="bio-dialog-complete">
          <DialogHeader>
            <DialogTitle>Mark Cycle Completed</DialogTitle>
            <DialogDescription>
              Optionally attach a proof image URL. Completion does not require proof.
            </DialogDescription>
          </DialogHeader>
          <Form {...completeForm}>
            <form onSubmit={completeForm.handleSubmit(handleCompleteSubmit)} className="space-y-4">
              <FormField
                control={completeForm.control}
                name="proofImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proof Image URL (optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://..."
                        data-testid="bio-input-proof-image"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCompleteDialog({ open: false, cycleId: "" })} data-testid="bio-button-cancel-complete">
                  Cancel
                </Button>
                <Button type="submit" disabled={actionMutation.isPending} data-testid="bio-button-confirm-complete">
                  {actionMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Mark Completed
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Admin Override Dialog */}
      <Dialog open={adminOverrideDialog.open} onOpenChange={(open) => setAdminOverrideDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md" data-testid="bio-dialog-admin-override">
          <DialogHeader>
            <DialogTitle>Force Close Biometrics Cycle</DialogTitle>
            <DialogDescription>
              This will close the active cycle with an admin override. A reason is required and will be logged.
            </DialogDescription>
          </DialogHeader>
          <Form {...adminOverrideForm}>
            <form onSubmit={adminOverrideForm.handleSubmit(handleAdminOverrideSubmit)} className="space-y-4">
              <FormField
                control={adminOverrideForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Override Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter mandatory reason for force closing this cycle..."
                        data-testid="bio-input-override-reason"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdminOverrideDialog({ open: false, cycleId: "" })} data-testid="bio-button-cancel-override">
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={actionMutation.isPending} data-testid="bio-button-confirm-override">
                  {actionMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Force Close
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
