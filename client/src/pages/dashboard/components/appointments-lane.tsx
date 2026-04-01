import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Calendar, ArrowRight, ChevronRight, ChevronDown,
  Clock, Stethoscope, CreditCard, CalendarDays, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toProperCase } from "@/lib/proper-case";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { LaneHeader, SubSection, TypeIcon } from "./shared";
import type { AppointmentsSummary } from "./types";

export function AppointmentsLane({ data, isLoading, photoMap }: { data?: AppointmentsSummary; isLoading: boolean; photoMap?: Record<string, string> }) {
  const [, navigate] = useLocation();
  const [showUpcoming, setShowUpcoming] = useState(false);

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-3" data-testid="lane-appointments">
      <LaneHeader
        icon={<Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
        title="Appointments"
        count={data?.counts.today}
        color="bg-blue-100 dark:bg-blue-900/40"
        action={
          <Link href="/appointments">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7" data-testid="link-view-all-appointments">
              View All
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-2 mt-3">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div data-testid="section-today-appointments">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-5 rounded flex items-center justify-center bg-blue-100 dark:bg-blue-900/40">
                <CalendarDays className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium text-foreground">Today's Schedule</span>
              <span className="text-xs font-medium text-muted-foreground tabular-nums bg-muted/50 px-1.5 py-0.5 rounded-full">{data?.counts.today || 0}</span>
            </div>
            {data && data.today.length > 0 ? (
              <div className="space-y-0.5">
                {data.today.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover-elevate"
                    onClick={() => navigate(`/work-orders/${apt.woId}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`/work-orders/${apt.woId}`); }}
                    data-testid={`appointment-today-${apt.id}`}
                  >
                    <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-appt-${apt.id}`}>
                      {photoMap?.[apt.woId] && <AvatarImage src={photoMap[apt.woId]} alt={apt.applicantName} />}
                      <AvatarFallback className="text-[9px] font-medium">{getInitials(apt.applicantName)}</AvatarFallback>
                    </Avatar>
                    <TypeIcon type={apt.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{apt.woNumber}</span>
                        <StatusBadge status={apt.type} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{toProperCase(apt.applicantName)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-foreground tabular-nums">{apt.time}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[100px]">{apt.center}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="No appointments today"
                description="Nothing scheduled for today."
              />
            )}
          </div>

          {data && data.upcoming.length > 0 && (
            <div data-testid="section-upcoming-appointments">
              <button
                className="flex items-center justify-between gap-2 w-full p-2 rounded-lg hover:bg-muted/30 transition-colors text-left"
                onClick={() => setShowUpcoming(!showUpcoming)}
                data-testid="toggle-upcoming"
              >
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded flex items-center justify-center bg-blue-100 dark:bg-blue-900/40">
                    <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Upcoming</span>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums bg-muted/50 px-1.5 py-0.5 rounded-full">{data.counts.upcoming}</span>
                </div>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", showUpcoming && "rotate-180")} />
              </button>
              {showUpcoming && (
                <div className="mt-1 space-y-0.5">
                  {data.upcoming.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover-elevate"
                      onClick={() => navigate(`/work-orders/${apt.woId}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/work-orders/${apt.woId}`); }}
                      data-testid={`appointment-upcoming-${apt.id}`}
                    >
                      <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-upcoming-${apt.id}`}>
                        {photoMap?.[apt.woId] && <AvatarImage src={photoMap[apt.woId]} alt={apt.applicantName} />}
                        <AvatarFallback className="text-[9px] font-medium">{getInitials(apt.applicantName)}</AvatarFallback>
                      </Avatar>
                      <TypeIcon type={apt.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{apt.woNumber}</span>
                          <StatusBadge status={apt.type} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{toProperCase(apt.applicantName)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-foreground">{apt.date}</p>
                        <p className="text-[11px] text-muted-foreground">{apt.time} · {apt.center}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {data && data.needsScheduling.length > 0 && (
            <SubSection
              title="Needs Scheduling"
              count={data.counts.needsScheduling}
              icon={<AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
              color="bg-amber-100 dark:bg-amber-900/40"
              testId="section-needs-scheduling"
            >
              {data.needsScheduling.map((item) => (
                <div
                  key={item.woId}
                  className="flex items-center gap-3 p-2.5 rounded-xl transition-all"
                  data-testid={`needs-scheduling-${item.woId}`}
                >
                  <div className="flex gap-1">
                    {item.types.includes("Medical") && <Stethoscope className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                    {item.types.includes("EID") && <CreditCard className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.woNumber}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{toProperCase(item.applicantName)}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {item.types.includes("Medical") && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/appointments/schedule-medical?woId=${item.woId}`);
                        }}
                        data-testid={`button-schedule-medical-${item.woId}`}
                      >
                        <Stethoscope className="h-3 w-3" />
                        Medical
                      </Button>
                    )}
                    {item.types.includes("EID") && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/appointments/schedule-eid?woId=${item.woId}`);
                        }}
                        data-testid={`button-schedule-eid-${item.woId}`}
                      >
                        <CreditCard className="h-3 w-3" />
                        EID
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </SubSection>
          )}

          <div className="flex gap-2 pt-1">
            <Link href="/appointments/schedule-medical" className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" data-testid="button-schedule-medical">
                <Stethoscope className="h-3.5 w-3.5" />
                Schedule Medical
              </Button>
            </Link>
            <Link href="/appointments/schedule-eid" className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" data-testid="button-schedule-eid">
                <CreditCard className="h-3.5 w-3.5" />
                Schedule EID
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
