import { Stethoscope, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toProperCase } from "@/lib/proper-case";
import type { AppointmentWithRelations } from "./types";

interface CalendarDay {
  date: Date;
  appointments: AppointmentWithRelations[];
}

interface AppointmentCalendarProps {
  calendarWeekDays: CalendarDay[];
  onNavigateToWo: (woId: string) => void;
}

export function AppointmentCalendar({ calendarWeekDays, onNavigateToWo }: AppointmentCalendarProps) {
  return (
    <Card className="border border-border/50 shadow-sm rounded-xl overflow-hidden">
      <CardContent className="p-0 overflow-x-auto">
        <div className="grid grid-cols-7 divide-x divide-border/30 min-w-[700px]">
          {calendarWeekDays.map(({ date, appointments: dayApts }) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
            const dayNum = date.getDate();
            return (
              <div key={date.toISOString()} className="min-h-[200px]" data-testid={`cal-day-${date.toISOString().slice(0,10)}`}>
                <div className={`px-2 py-2 text-center border-b border-border/30 ${
                  isToday ? "bg-primary/10" : "bg-muted/20"
                }`}>
                  <p className="text-xs text-muted-foreground">{dayName}</p>
                  <p className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                    {dayNum}
                  </p>
                </div>
                <div className="p-1.5 space-y-1">
                  {dayApts.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 text-center py-4">—</p>
                  )}
                  {dayApts.map(apt => (
                    <div
                      key={apt.id}
                      className={`p-1.5 rounded-md text-xs cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all ${
                        apt.type === "Medical"
                          ? "bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30"
                          : "bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30"
                      } ${apt.status === "Completed" ? "opacity-60" : ""}`}
                      onClick={() => onNavigateToWo(apt.woId)}
                      data-testid={`cal-apt-${apt.id}`}
                    >
                      <div className="flex items-center gap-1">
                        {apt.type === "Medical" ? (
                          <Stethoscope className="h-3 w-3 text-red-500 shrink-0" />
                        ) : (
                          <CreditCard className="h-3 w-3 text-blue-500 shrink-0" />
                        )}
                        <span className="font-medium truncate">
                          {new Date(apt.datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                        </span>
                      </div>
                      <p className="truncate mt-0.5 text-foreground/80">
                        {apt.workOrder?.applicantName ? toProperCase(apt.workOrder.applicantName) : "Unknown"}
                      </p>
                      {apt.center?.name && (
                        <p className="truncate text-muted-foreground">
                          {apt.center.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
