import { Stethoscope, Calendar, CreditCard, Fingerprint } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TrackColorState, FourTrackState } from "@/lib/pipeline-stage";

const COLOR_CLASSES: Record<TrackColorState, string> = {
  gray: "text-slate-400 dark:text-slate-500",
  blue: "text-blue-500 dark:text-blue-400",
  amber: "text-amber-500 dark:text-amber-400",
  green: "text-emerald-500 dark:text-emerald-400",
  red: "text-red-500 dark:text-red-400",
};

const TRACK_CONFIG = [
  { key: "medTyping" as const, icon: Stethoscope, title: "Medical Typing" },
  { key: "medAppointment" as const, icon: Calendar, title: "Medical Appointment" },
  { key: "eidTyping" as const, icon: CreditCard, title: "EID Typing" },
  { key: "biometrics" as const, icon: Fingerprint, title: "Biometrics" },
];

export function TrackStatusIconsFromState({ tracks, size = "sm", className }: { tracks: FourTrackState; size?: "sm" | "md"; className?: string }) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className={`inline-flex items-center gap-1.5 ${className || ""}`} data-testid="track-status-icons">
      {TRACK_CONFIG.map(({ key, icon: Icon, title }) => {
        const track = tracks[key];
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <span className={`${COLOR_CLASSES[track.color]} transition-colors cursor-default`} data-testid={`track-icon-${key}`}>
                <Icon className={iconSize} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px]">
              <p className="text-xs font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{track.detail}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
