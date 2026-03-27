import { cn } from "@/lib/utils";
import { STAGE_CONFIG, PIPELINE_STEPS, type PipelineInfo } from "@/lib/pipeline-stage";
import {
  Package,
  Stethoscope,
  CreditCard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ServiceType } from "@shared/schema";

export function PipelineBar({ pipeline, serviceType, isMinor, onTrackClick }: { pipeline: PipelineInfo; serviceType?: ServiceType; isMinor?: boolean; onTrackClick?: (track: "medical" | "eid") => void }) {
  const medRequired = !isMinor && serviceType && (serviceType.requiresMedicalTyping || serviceType.requiresMedicalScheduling);
  const eidRequired = serviceType && (serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year || serviceType.requiresIdTyping10Years || serviceType.requiresIdBiometrics);

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm" data-testid="pipeline-bar">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Workflow Progress</span>
        </div>
        {onTrackClick && (
          <span className="text-[10px] text-muted-foreground/60 italic">Click a row to jump to its tab</span>
        )}
      </div>
      {pipeline.medical.exists ? (
        <TrackRow label="Medical" icon={<Stethoscope className="h-3.5 w-3.5" />} track={pipeline.medical} onClick={() => onTrackClick?.("medical")} />
      ) : medRequired ? (
        <div className="flex items-center gap-3 py-2" data-testid="track-medical-not-started">
          <div className="flex items-center gap-1.5 w-24 shrink-0">
            <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Medical</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-muted/50" />
          <Badge variant="outline" className="text-xs shrink-0 min-w-[90px] justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 border-blue-200 dark:border-blue-800" data-testid="badge-medical-not-started">
            Not Started
          </Badge>
        </div>
      ) : (
        <div className="flex items-center gap-3 py-2" data-testid="track-medical-not-required">
          <div className="flex items-center gap-1.5 w-24 shrink-0">
            <Stethoscope className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-xs font-medium text-muted-foreground/60">Medical</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-muted/50" />
          <Badge variant="outline" className="text-xs shrink-0 min-w-[90px] justify-center bg-muted/30 text-muted-foreground/60 border-border/30" data-testid="badge-medical-not-required">
            Not Required
          </Badge>
        </div>
      )}
      {pipeline.eid.exists ? (
        <TrackRow label="Emirates ID" icon={<CreditCard className="h-3.5 w-3.5" />} track={pipeline.eid} onClick={() => onTrackClick?.("eid")} />
      ) : eidRequired ? (
        <div className="flex items-center gap-3 py-2" data-testid="track-eid-not-started">
          <div className="flex items-center gap-1.5 w-24 shrink-0">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Emirates ID</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-muted/50" />
          <Badge variant="outline" className="text-xs shrink-0 min-w-[90px] justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 border-blue-200 dark:border-blue-800" data-testid="badge-eid-not-started">
            Not Started
          </Badge>
        </div>
      ) : (
        <div className="flex items-center gap-3 py-2" data-testid="track-eid-not-required">
          <div className="flex items-center gap-1.5 w-24 shrink-0">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-xs font-medium text-muted-foreground/60">Emirates ID</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-muted/50" />
          <Badge variant="outline" className="text-xs shrink-0 min-w-[90px] justify-center bg-muted/30 text-muted-foreground/60 border-border/30" data-testid="badge-eid-not-required">
            Not Required
          </Badge>
        </div>
      )}
    </div>
  );
}

function TrackRow({ label, icon, track, onClick }: { label: string; icon: React.ReactNode; track: import("@/lib/pipeline-stage").TrackStatus; onClick?: () => void }) {
  const currentIdx = PIPELINE_STEPS.indexOf(track.stage as any);
  const isAttention = track.stage === "needs_attention";

  const row = (
    <div
      className={cn("flex items-center gap-3 py-2 rounded-lg px-1 -mx-1 transition-colors", onClick && "cursor-pointer hover:bg-muted/50 hover:underline-offset-1")}
      onClick={onClick}
      data-testid={`track-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="flex items-center gap-1.5 w-24 shrink-0">
        {icon}
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1 flex-1">
        {PIPELINE_STEPS.map((step, idx) => {
          const isComplete = !isAttention && idx <= currentIdx;
          const isCurrent = !isAttention && idx === currentIdx;
          return (
            <div key={step} className="flex items-center flex-1">
              <div className={cn(
                "h-2 rounded-full flex-1 transition-all",
                isComplete ? "bg-primary" : "bg-muted",
                isCurrent && "ring-1 ring-primary/50 ring-offset-1 ring-offset-background"
              )} />
              {idx < PIPELINE_STEPS.length - 1 && <div className="w-0.5" />}
            </div>
          );
        })}
      </div>
      <Badge
        variant="outline"
        className={cn(
          "text-xs shrink-0 min-w-[90px] justify-center",
          isAttention
            ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
            : track.stage === "complete"
              ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
              : "bg-primary/5 text-primary border-primary/20"
        )}
        data-testid={`badge-track-${label.toLowerCase().replace(/\s/g, "-")}`}
      >
        {track.label}
      </Badge>
    </div>
  );

  if (onClick) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {row}
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          Click to jump to {label} tab
        </TooltipContent>
      </Tooltip>
    );
  }

  return row;
}
