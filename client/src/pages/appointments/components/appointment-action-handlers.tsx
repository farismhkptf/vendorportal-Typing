import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/query-keys";
import { toProperCase } from "@/lib/proper-case";
import type { AppointmentWithRelations } from "./types";

export function useAppointmentActions() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "complete" | "cancel" | "reschedule" | "follow_up";
    appointment: AppointmentWithRelations | null;
  }>({ open: false, type: "complete", appointment: null });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/appointments/${id}`, { status });
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

  const handleConfirmAction = async () => {
    const { type, appointment } = confirmDialog;
    if (!appointment) return;

    try {
      if (type === "reschedule") {
        await updateStatusMutation.mutateAsync({ id: appointment.id, status: "Rescheduled" });
        toast({ title: "Appointment marked as rescheduled", description: "Redirecting to schedule a new appointment..." });
        setConfirmDialog({ open: false, type: "complete", appointment: null });
        const scheduleUrl = appointment.type === "Medical"
          ? `/appointments/schedule-medical?wo=${appointment.woId}`
          : `/appointments/schedule-eid?wo=${appointment.woId}`;
        navigate(scheduleUrl);
        return;
      }

      if (type === "follow_up") {
        await updateStatusMutation.mutateAsync({ id: appointment.id, status: "FollowUpRequired" });
        toast({ title: "Follow-up required", description: "Medical appointment marked for follow-up retest." });
        return;
      }

      const status = type === "complete" ? "Completed" : "Cancelled";
      await updateStatusMutation.mutateAsync({ id: appointment.id, status });
      toast({
        title: `Appointment ${status.toLowerCase()}`,
        description: `The appointment has been marked as ${status.toLowerCase()}.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update appointment";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
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

  const openConfirmDialog = useCallback((type: "complete" | "cancel" | "reschedule" | "follow_up", appointment: AppointmentWithRelations) => {
    setConfirmDialog({ open: true, type, appointment });
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
    handleConfirmAction,
    handleCopyAptDetails,
    openConfirmDialog,
    scrollToSection,
  };
}
