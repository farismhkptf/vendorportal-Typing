import { Link } from "wouter";
import {
  Stethoscope, CreditCard,
  Building2, User,
  CalendarPlus, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { toProperCase } from "@/lib/proper-case";
import type { ReadyToScheduleJob } from "./types";

interface ReadyToScheduleCardProps {
  job: ReadyToScheduleJob;
}

export function ReadyToScheduleCard({ job }: ReadyToScheduleCardProps) {
  return (
    <div
      className="flex items-start gap-4 p-4 rounded-lg bg-background border border-border/30"
      data-testid={`ready-job-card-${job.id}`}
    >
      <div className="shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          job.jobType?.category === "Medical" 
            ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        }`}>
          {job.jobType?.category === "Medical" ? (
            <Stethoscope className="h-4 w-4" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm text-foreground truncate">
            {job.workOrder?.applicantName ? toProperCase(job.workOrder.applicantName) : "Unknown"}
          </span>
          <Badge variant="secondary" className="text-xs">
            {job.jobType?.category === "Medical" ? "Medical" : "Emirates ID"}
          </Badge>
          {job.urgent && (
            <Badge variant="destructive" className="text-xs">Urgent</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground truncate">
            {job.workOrder?.woNumber || "No WO"} · {job.jobCode || "No code"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground truncate">
            {job.workOrder?.company?.name ? toProperCase(job.workOrder.company.name) : "Unknown Company"}
          </span>
        </div>
        {job.vendor?.name && (
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              Completed by {job.vendor.name}
            </span>
            {job.returnedAt && (
              <span className="text-xs text-muted-foreground">
                · <RelativeTime date={job.returnedAt} />
              </span>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <Link href={
          job.jobType?.category === "Medical"
            ? `/appointments/schedule-medical?wo=${job.woId}`
            : `/appointments/schedule-eid?wo=${job.woId}`
        }>
          <Button size="sm" className="gap-1.5" data-testid={`button-schedule-${job.id}`}>
            <CalendarPlus className="h-3.5 w-3.5" />
            Schedule
          </Button>
        </Link>
        <Link href={`/work-orders/${job.woId}`}>
          <Button variant="ghost" size="sm" data-testid={`button-view-wo-ready-${job.id}`}>
            View WO
          </Button>
        </Link>
      </div>
    </div>
  );
}
