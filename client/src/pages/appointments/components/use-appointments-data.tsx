import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { queryKeys } from "@/lib/query-keys";
import { useDataTable } from "@/hooks/use-data-table";
import type { Staff, Company, ServiceType } from "@shared/schema";
import type {
  AppointmentWithRelations,
  TypingJobWithRelations,
  ReadyToScheduleJob,
  WoTypingStatus,
  AppointmentStats,
} from "./types";

export function useAppointmentsData() {
  const searchParams = useSearch();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const { data: appointments, isLoading, isError: appointmentsError, refetch: refetchAppointments } = useQuery<AppointmentWithRelations[]>({
    queryKey: queryKeys.appointments,
  });

  const { data: staffList } = useQuery<Staff[]>({
    queryKey: queryKeys.staff,
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: queryKeys.companies,
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: queryKeys.serviceTypes,
  });

  const { data: readyToScheduleJobs } = useQuery<ReadyToScheduleJob[]>({
    queryKey: queryKeys.typingJobsReadyToSchedule,
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: queryKeys.workOrderPhotos,
    staleTime: 60000,
  });

  const { data: allTypingJobs } = useQuery<TypingJobWithRelations[]>({
    queryKey: queryKeys.typingJobsAll,
  });

  const woTypingStatusMap = useMemo(() => {
    const map = new Map<string, WoTypingStatus>();
    if (!allTypingJobs) return map;
    const sorted = [...allTypingJobs]
      .filter(j => j.status !== "Aborted")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (const job of sorted) {
      const category = job.jobType?.category;
      if (!category) continue;
      const existing = map.get(job.woId) || { medical: null, eid: null };
      const track = category === "Medical" ? "medical" : "eid";
      if (existing[track] !== null) { map.set(job.woId, existing); continue; }
      const completedStatuses = ["ReadyForScheduling", "Returned"];
      const inProgressStatuses = ["SubmittedToVendor", "InProcess"];
      let statusLabel = "Not Started";
      if (completedStatuses.includes(job.status)) statusLabel = "Complete";
      else if (inProgressStatuses.includes(job.status)) statusLabel = "In Progress";
      else if (job.status === "Draft") statusLabel = "Draft";
      else if (job.status === "OnHold") statusLabel = "On Hold";
      else if (job.status === "Rejected") statusLabel = "Rejected";
      existing[track] = { status: statusLabel, completedAt: job.returnedAt };
      map.set(job.woId, existing);
    }
    return map;
  }, [allTypingJobs]);

  const { today, tomorrow } = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const tm = new Date(t);
    tm.setDate(tm.getDate() + 1);
    return { today: t, tomorrow: tm };
  }, []);

  const readyJobsWithoutAppointment = useMemo(() =>
    readyToScheduleJobs?.filter(j => !j.hasAppointment) || [],
    [readyToScheduleJobs]
  );

  const stats: AppointmentStats = {
    readyToScheduleCount: readyJobsWithoutAppointment.length,
    todayCount: appointments?.filter(a => {
      const aptDate = new Date(a.datetime);
      return aptDate >= today && aptDate < tomorrow && a.status === "Scheduled";
    }).length || 0,
    upcomingCount: appointments?.filter(a => {
      const aptDate = new Date(a.datetime);
      return aptDate >= tomorrow && a.status === "Scheduled";
    }).length || 0,
    completedCount: appointments?.filter(a => a.status === "Completed").length || 0,
    cancelledCount: appointments?.filter(a => a.status === "Cancelled" || a.status === "Rescheduled").length || 0,
  };

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    const now = new Date();
    const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0,0,0,0); return r; };
    const endOfDay = (d: Date) => { const r = new Date(d); r.setHours(23,59,59,999); return r; };
    const getWeekStart = () => { const d = startOfDay(now); d.setDate(d.getDate() - d.getDay()); return d; };
    const getWeekEnd = () => { const d = getWeekStart(); d.setDate(d.getDate() + 6); return endOfDay(d); };
    const getMonthStart = () => { const d = startOfDay(now); d.setDate(1); return d; };
    const getMonthEnd = () => { const d = new Date(now.getFullYear(), now.getMonth() + 1, 0); return endOfDay(d); };
    const getLastMonthStart = () => { const d = startOfDay(now); d.setDate(1); d.setMonth(d.getMonth() - 1); return d; };
    const getLastMonthEnd = () => { const d = new Date(now.getFullYear(), now.getMonth(), 0); return endOfDay(d); };

    return appointments.filter(a => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (dateRangeFilter !== "all") {
        const aptDate = new Date(a.datetime);
        if (dateRangeFilter === "today") {
          if (aptDate < startOfDay(now) || aptDate > endOfDay(now)) return false;
        } else if (dateRangeFilter === "week") {
          if (aptDate < getWeekStart() || aptDate > getWeekEnd()) return false;
        } else if (dateRangeFilter === "month") {
          if (aptDate < getMonthStart() || aptDate > getMonthEnd()) return false;
        } else if (dateRangeFilter === "last_month") {
          if (aptDate < getLastMonthStart() || aptDate > getLastMonthEnd()) return false;
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const woNumber = a.workOrder?.woNumber?.toLowerCase() || "";
        const applicant = a.workOrder?.applicantName?.toLowerCase() || "";
        const centerName = a.center?.name?.toLowerCase() || "";
        if (!woNumber.includes(q) && !applicant.includes(q) && !centerName.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, search, typeFilter, statusFilter, dateRangeFilter]);

  const todayAppointments = useMemo(() =>
    filteredAppointments.filter(a => {
      const aptDate = new Date(a.datetime);
      return aptDate >= today && aptDate < tomorrow && a.status === "Scheduled";
    }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()),
    [filteredAppointments, today, tomorrow]
  );

  const upcomingAppointments = useMemo(() =>
    filteredAppointments.filter(a => {
      const aptDate = new Date(a.datetime);
      return aptDate >= tomorrow && a.status === "Scheduled";
    }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()),
    [filteredAppointments, tomorrow]
  );

  const completedAppointments = useMemo(() =>
    filteredAppointments.filter(a => a.status === "Completed")
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()),
    [filteredAppointments]
  );

  const cancelledAppointments = useMemo(() =>
    filteredAppointments.filter(a => a.status === "Cancelled" || a.status === "Rescheduled")
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()),
    [filteredAppointments]
  );

  const allFilteredAppointments = useMemo(() => [
    ...todayAppointments,
    ...upcomingAppointments,
    ...completedAppointments,
    ...cancelledAppointments,
  ], [todayAppointments, upcomingAppointments, completedAppointments, cancelledAppointments]);

  const calendarWeekDays = useMemo(() => {
    const startOfWeek = new Date(calendarDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);

    const days: { date: Date; appointments: AppointmentWithRelations[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dayStart = new Date(d);
      const dayEnd = new Date(d);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayApts = (appointments || []).filter(a => {
        if (typeFilter !== "all" && a.type !== typeFilter) return false;
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        if (statusFilter === "all" && (a.status === "Cancelled" || a.status === "Rescheduled")) return false;
        const aptDate = new Date(a.datetime);
        return aptDate >= dayStart && aptDate < dayEnd;
      }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

      days.push({ date: d, appointments: dayApts });
    }
    return days;
  }, [calendarDate, appointments, typeFilter, statusFilter]);

  const calendarWeekLabel = useMemo(() => {
    if (calendarWeekDays.length === 0) return "";
    const first = calendarWeekDays[0].date;
    const last = calendarWeekDays[6].date;
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    if (first.getMonth() === last.getMonth()) {
      return `${first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })} · ${first.getDate()} – ${last.getDate()}`;
    }
    return `${first.toLocaleDateString("en-GB", opts)} – ${last.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
  }, [calendarWeekDays]);

  const navigateCalendar = useCallback((direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      setCalendarDate(d);
    } else {
      setCalendarDate(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() + (direction === "next" ? 7 : -7));
        return d;
      });
    }
  }, []);

  const getId = useCallback((apt: AppointmentWithRelations) => apt.id, []);

  const dt = useDataTable(allFilteredAppointments, {
    storageKey: "apt_list",
    defaultPageSize: 25,
    getId,
  });

  return {
    searchParams,
    appointments,
    isLoading,
    appointmentsError,
    refetchAppointments,
    staffList,
    companies,
    serviceTypes,
    photoMap,
    woTypingStatusMap,
    stats,
    readyJobsWithoutAppointment,
    todayAppointments,
    upcomingAppointments,
    completedAppointments,
    cancelledAppointments,
    allFilteredAppointments,
    calendarWeekDays,
    calendarWeekLabel,
    navigateCalendar,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    dateRangeFilter,
    setDateRangeFilter,
    viewMode,
    setViewMode,
    dt,
  };
}
