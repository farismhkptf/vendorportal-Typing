import { STAGE_CONFIG, type PipelineStage } from "@/lib/pipeline-stage";

export function TypingStatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-muted-foreground/50">--</span>;
  const styles: Record<string, { bg: string; label: string }> = {
    Draft: { bg: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", label: "Draft" },
    SubmittedToVendor: { bg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300", label: "At Vendor" },
    InProcess: { bg: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300", label: "In Process" },
    ReadyForScheduling: { bg: "bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-300", label: "Ready for Scheduling" },
    Returned: { bg: "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300", label: "Returned" },
    Aborted: { bg: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", label: "Aborted" },
  };
  const s = styles[status] || { bg: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", label: status };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg}`} data-testid={`pill-typing-${status.toLowerCase()}`}>
      {s.label}
    </span>
  );
}

export function AppointmentStatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-muted-foreground/50">--</span>;
  const styles: Record<string, { bg: string; label: string }> = {
    Scheduled: { bg: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300", label: "Scheduled" },
    Completed: { bg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300", label: "Done" },
    Cancelled: { bg: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", label: "Cancelled" },
  };
  const s = styles[status] || { bg: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", label: status };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg}`} data-testid={`pill-appt-${status.toLowerCase()}`}>
      {s.label}
    </span>
  );
}

export function PipelineStageBadge({ stage }: { stage: PipelineStage }) {
  const config = STAGE_CONFIG[stage];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${config.bgColor} ${config.color}`}
      data-testid={`badge-pipeline-${stage}`}
    >
      {config.label}
    </span>
  );
}

export function NextActionIndicator({ message, variant }: { message: string; variant: string }) {
  const variantStyles: Record<string, string> = {
    action: "text-blue-600 dark:text-blue-400",
    warning: "text-red-600 dark:text-red-400",
    success: "text-emerald-600 dark:text-emerald-400",
    info: "text-muted-foreground",
  };
  return (
    <span className={`text-[10px] ${variantStyles[variant] || variantStyles.info} truncate`} data-testid="text-next-action">
      {message}
    </span>
  );
}

export function MedEidStatusRow({ icon: Icon, label, typing, appointment, hasData, summaryLabel }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  typing: string | null;
  appointment: string | null;
  hasData: boolean;
  summaryLabel?: string | null;
}) {
  if (!hasData && !summaryLabel) return null;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-10 shrink-0">{label}</span>
      {hasData ? (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground/60 text-[10px]">T:</span>
          <TypingStatusPill status={typing} />
          <span className="text-muted-foreground/60 text-[10px] ml-1">A:</span>
          <AppointmentStatusPill status={appointment} />
        </div>
      ) : summaryLabel ? (
        <span className="text-muted-foreground/60 italic">{summaryLabel}</span>
      ) : null}
    </div>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  if (percent === 0) return null;
  return (
    <div className="w-full h-1 bg-muted/50 rounded-full overflow-hidden" data-testid="progress-bar">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          percent >= 100 ? "bg-emerald-500" : percent > 50 ? "bg-blue-500" : "bg-amber-500"
        }`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}
