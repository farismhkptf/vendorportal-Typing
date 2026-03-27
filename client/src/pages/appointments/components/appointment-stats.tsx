import {
  Calendar, Clock, CalendarPlus, CheckCircle2, AlertCircle,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import type { AppointmentStats as AppointmentStatsType } from "./types";

interface AppointmentStatsProps {
  stats: AppointmentStatsType;
  scrollToSection: (sectionId: string) => void;
}

export function AppointmentStatsRow({ stats, scrollToSection }: AppointmentStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <StatCard title="Ready to Schedule" value={stats.readyToScheduleCount} icon={<CalendarPlus className="h-4 w-4" />} onClick={() => scrollToSection("section-ready")} />
      <StatCard title="Today" value={stats.todayCount} icon={<Calendar className="h-4 w-4" />} animationDelay={1} onClick={() => scrollToSection("section-today")} />
      <StatCard title="Upcoming" value={stats.upcomingCount} icon={<Clock className="h-4 w-4" />} animationDelay={2} onClick={() => scrollToSection("section-upcoming")} />
      <StatCard title="Completed" value={stats.completedCount} icon={<CheckCircle2 className="h-4 w-4" />} animationDelay={3} onClick={() => scrollToSection("section-completed")} />
      <StatCard title="Cancelled" value={stats.cancelledCount} icon={<AlertCircle className="h-4 w-4" />} animationDelay={4} onClick={() => scrollToSection("section-cancelled")} />
    </div>
  );
}
