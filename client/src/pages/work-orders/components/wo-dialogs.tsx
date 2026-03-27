import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toProperCase } from "@/lib/proper-case";
import { formatDateWithWeekday } from "@/lib/format-date";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Appointment } from "@shared/schema";
import type { WorkOrderDetail } from "./types";

interface AptConfirmDialogState {
  open: boolean;
  type: "complete" | "cancel" | "reschedule";
  appointment: Appointment | null;
}

interface WoAptConfirmDialogProps {
  aptConfirmDialog: AptConfirmDialogState;
  setAptConfirmDialog: (state: AptConfirmDialogState) => void;
  workOrderId: string;
  applicantName: string;
}

export function WoAptConfirmDialog({
  aptConfirmDialog,
  setAptConfirmDialog,
  workOrderId,
  applicantName,
}: WoAptConfirmDialogProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const updateAptStatusMutation = useMutation({
    mutationFn: async ({ aptId, status }: { aptId: string; status: string }) => {
      return apiRequest("PATCH", `/api/appointments/${aptId}`, { status });
    },
    onMutate: async ({ aptId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workOrder(workOrderId) });
      await queryClient.cancelQueries({ queryKey: queryKeys.appointments });
      const previousWo = queryClient.getQueryData<WorkOrderDetail>(queryKeys.workOrder(workOrderId));
      const previousApts = queryClient.getQueryData<Appointment[]>(queryKeys.appointments);
      if (previousWo?.appointments) {
        queryClient.setQueryData<WorkOrderDetail>(
          queryKeys.workOrder(workOrderId),
          { ...previousWo, appointments: previousWo.appointments.map(a => a.id === aptId ? { ...a, status: status as Appointment["status"] } : a) },
        );
      }
      if (previousApts) {
        queryClient.setQueryData<Appointment[]>(queryKeys.appointments, previousApts.map(a => a.id === aptId ? { ...a, status: status as Appointment["status"] } : a));
      }
      return { previousWo, previousApts };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousWo) queryClient.setQueryData(queryKeys.workOrder(workOrderId), context.previousWo);
      if (context?.previousApts) queryClient.setQueryData(queryKeys.appointments, context.previousApts);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(workOrderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update appointment";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
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
                <span className="font-medium">{toProperCase(applicantName || "")}</span>
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
  );
}

export type { AptConfirmDialogState };
