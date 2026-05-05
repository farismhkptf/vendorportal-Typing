import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { ToastActionElement } from "@/components/ui/toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/query-keys";
import { toProperCase } from "@/lib/proper-case";
import type { AppointmentWithRelations } from "./types";
import type { EmailSendLogEntry } from "@shared/schema";

function CountdownUndoButton({ seconds, onUndo }: { seconds: number; onUndo: () => void }): ToastActionElement {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <ToastAction altText={`Undo (${remaining}s)`} onClick={onUndo}>
      Undo ({remaining}s)
    </ToastAction>
  );
}

export function useAppointmentActions() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "complete" | "cancel" | "reschedule" | "follow_up";
    appointment: AppointmentWithRelations | null;
    reason: string;
    typingNotStarted?: boolean;
  }>({ open: false, type: "complete", appointment: null, reason: "" });

  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, cancelReason, rescheduleReason }: {
      id: string;
      status: string;
      cancelReason?: string;
      rescheduleReason?: string;
    }) => {
      return apiRequest("PATCH", `/api/appointments/${id}`, { status, cancelReason, rescheduleReason });
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.appointments });
      const previous = queryClient.getQueryData<AppointmentWithRelations[]>(queryKeys.appointments);
      if (previous) {
        queryClient.setQueryData<AppointmentWithRelations[]>(
          queryKeys.appointments,
          previous.map(a => a.id === id ? { ...a, status: status as AppointmentWithRelations["status"] } : a),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.appointments, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
    },
  });

  const revertMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return apiRequest("PATCH", `/api/appointments/${id}`, { status: "Scheduled" });
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.appointments });
      const previous = queryClient.getQueryData<AppointmentWithRelations[]>(queryKeys.appointments);
      if (previous) {
        queryClient.setQueryData<AppointmentWithRelations[]>(
          queryKeys.appointments,
          previous.map(a => a.id === id ? { ...a, status: "Scheduled" } : a),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.appointments, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
    },
  });

  const handleConfirmAction = async () => {
    const { type, appointment, reason, typingNotStarted } = confirmDialog;
    if (!appointment) return;

    try {
      if (type === "reschedule") {
        await updateStatusMutation.mutateAsync({
          id: appointment.id,
          status: "Rescheduled",
          rescheduleReason: reason || undefined,
        });
        toast({ title: "Appointment marked as rescheduled", description: "Redirecting to schedule a new appointment..." });
        setConfirmDialog({ open: false, type: "complete", appointment: null, reason: "" });

        // Build reschedule URL with previous appointment context params
        const dt = new Date(appointment.datetime);
        const prevDate = dt.toISOString().slice(0, 10);
        const prevTime = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
        const params = new URLSearchParams({ wo: appointment.woId });
        params.set("prevDate", prevDate);
        params.set("prevTime", prevTime);
        if (appointment.centerId) params.set("prevCenter", appointment.centerId);
        if (appointment.applicationNumber) params.set("prevAppNum", appointment.applicationNumber);
        // Carry forward last send log recipients
        const sendLog = (appointment.emailSendLog ?? []) as EmailSendLogEntry[];
        if (sendLog.length > 0) {
          const lastEntry = sendLog[sendLog.length - 1];
          if (lastEntry.sentTo?.length) params.set("prevRecipients", lastEntry.sentTo.join(","));
        }

        const scheduleUrl = appointment.type === "Medical"
          ? `/appointments/schedule-medical?${params.toString()}`
          : `/appointments/schedule-eid?${params.toString()}`;
        navigate(scheduleUrl);
        return;
      }

      if (type === "follow_up") {
        await updateStatusMutation.mutateAsync({ id: appointment.id, status: "FollowUpRequired" });
        toast({ title: "Follow-up required", description: "Medical appointment marked for follow-up retest." });
        setConfirmDialog({ open: false, type: "complete", appointment: null, reason: "" });
        return;
      }

      if (type === "cancel") {
        setConfirmDialog({ open: false, type: "complete", appointment: null, reason: "" });

        queryClient.setQueryData<AppointmentWithRelations[]>(
          queryKeys.appointments,
          (prev) => prev ? prev.map(a => a.id === appointment.id ? { ...a, status: "Cancelled" } : a) : prev,
        );

        let undone = false;
        const aptId = appointment.id;
        const cancelReason = reason || undefined;

        const commitCancel = async () => {
          if (undone) return;
          try {
            await apiRequest("PATCH", `/api/appointments/${aptId}`, { status: "Cancelled", cancelReason });
          } catch {
            queryClient.setQueryData<AppointmentWithRelations[]>(
              queryKeys.appointments,
              (prev) => prev ? prev.map(a => a.id === aptId ? { ...a, status: "Scheduled" } : a) : prev,
            );
            toast({ title: "Cancel failed", description: "Could not cancel appointment. Please try again.", variant: "destructive" });
          } finally {
            queryClient.invalidateQueries({ queryKey: queryKeys.appointments });
          }
        };

        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(commitCancel, 15000);

        const handleUndo = () => {
          undone = true;
          if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
          }
          queryClient.setQueryData<AppointmentWithRelations[]>(
            queryKeys.appointments,
            (prev) => prev ? prev.map(a => a.id === aptId ? { ...a, status: "Scheduled" } : a) : prev,
          );
          toast({ title: "Undo successful", description: "Appointment restored to scheduled." });
        };

        toast({
          title: "Appointment cancelled",
          description: reason ? `Reason: ${reason}` : "The appointment has been cancelled.",
          action: <CountdownUndoButton seconds={15} onUndo={handleUndo} />,
          duration: 15000,
        });
        return;
      }

      // type === "complete"
      await updateStatusMutation.mutateAsync({ id: appointment.id, status: "Completed" });
      toast({
        title: "Appointment done",
        description: "The appointment has been marked as completed.",
      });

      if (typingNotStarted) {
        const woId = appointment.woId;
        setTimeout(() => {
          toast({
            title: "Typing job not started",
            description: "Heads up — the typing job for this work order hasn't been started yet.",
            action: (
              <ToastAction altText="Open WO" onClick={() => navigate(`/work-orders/${woId}`)}>
                Open WO
              </ToastAction>
            ),
          });
        }, 600);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update appointment";
      toast({ title: "Error", description: message, variant: "destructive" });
    }

    setConfirmDialog({ open: false, type: "complete", appointment: null, reason: "" });
  };

  const handleCopyAptDetails = useCallback((apt: AppointmentWithRelations) => {
    const lines = [
      `Type: ${apt.type}`,
      `Applicant: ${apt.workOrder?.applicantName ? toProperCase(apt.workOrder.applicantName) : "Unknown"}`,
      `WO#: ${apt.workOrder?.woNumber || "N/A"}`,
      `Date: ${new Date(apt.datetime).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
      `Time: ${new Date(apt.datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`,
      apt.center?.name ? `Center: ${apt.center.name}` : null,
      apt.applicationNumber ? `Application #: ${apt.applicationNumber}` : null,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines);
    toast({ title: "Copied", description: "Appointment details copied to clipboard." });
  }, [toast]);

  const openConfirmDialog = useCallback((
    type: "complete" | "cancel" | "reschedule" | "follow_up",
    appointment: AppointmentWithRelations,
    typingNotStarted?: boolean,
  ) => {
    setConfirmDialog({ open: true, type, appointment, reason: "", typingNotStarted });
  }, []);

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      document.querySelectorAll("[data-highlight]").forEach(e => {
        e.classList.remove("ring-2", "ring-primary/40");
        e.removeAttribute("data-highlight");
      });
      el.setAttribute("data-highlight", "true");
      el.classList.add("ring-2", "ring-primary/40");
      highlightTimerRef.current = setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/40");
        el.removeAttribute("data-highlight");
        highlightTimerRef.current = null;
      }, 1500);
    }
  }, []);

  return {
    toast,
    confirmDialog,
    setConfirmDialog,
    updateStatusMutation,
    revertMutation,
    handleConfirmAction,
    handleCopyAptDetails,
    openConfirmDialog,
    scrollToSection,
  };
}
