import { useMemo, useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RelativeTimeProps {
  date: Date | string | null | undefined;
  className?: string;
  showTooltip?: boolean;
  id?: string;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const isFuture = diffMs < 0;
  const absDiffSecs = Math.abs(diffSecs);
  const absDiffMins = Math.abs(diffMins);
  const absDiffHours = Math.abs(diffHours);
  const absDiffDays = Math.abs(diffDays);
  const absDiffWeeks = Math.abs(diffWeeks);
  const absDiffMonths = Math.abs(diffMonths);
  const absDiffYears = Math.abs(diffYears);

  const suffix = isFuture ? "from now" : "ago";

  if (absDiffSecs < 60) {
    return "just now";
  } else if (absDiffMins < 60) {
    return absDiffMins === 1 ? `1 min ${suffix}` : `${absDiffMins} mins ${suffix}`;
  } else if (absDiffHours < 24) {
    return absDiffHours === 1 ? `1 hour ${suffix}` : `${absDiffHours} hours ${suffix}`;
  } else if (absDiffDays === 1) {
    return isFuture ? "tomorrow" : "yesterday";
  } else if (absDiffDays < 7) {
    return `${absDiffDays} days ${suffix}`;
  } else if (absDiffWeeks < 4) {
    return absDiffWeeks === 1 ? `1 week ${suffix}` : `${absDiffWeeks} weeks ${suffix}`;
  } else if (absDiffMonths < 12) {
    return absDiffMonths === 1 ? `1 month ${suffix}` : `${absDiffMonths} months ${suffix}`;
  } else {
    return absDiffYears === 1 ? `1 year ${suffix}` : `${absDiffYears} years ${suffix}`;
  }
}

function formatExactDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RelativeTime({ date, className, showTooltip = true, id }: RelativeTimeProps) {
  const [, setTick] = useState(0);

  const parsedDate = useMemo(() => {
    if (!date) return null;
    return date instanceof Date ? date : new Date(date);
  }, [date]);

  useEffect(() => {
    if (!parsedDate) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [parsedDate]);

  if (!parsedDate || isNaN(parsedDate.getTime())) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  const relativeText = getRelativeTime(parsedDate);
  const exactText = formatExactDate(parsedDate);
  const testIdSuffix = id ? `-${id}` : "";

  if (!showTooltip) {
    return (
      <span 
        className={cn("text-muted-foreground", className)}
        data-testid={`relative-time${testIdSuffix}`}
      >
        {relativeText}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button 
          type="button"
          className={cn("text-muted-foreground cursor-default hover:opacity-80", className)}
          data-testid={`relative-time${testIdSuffix}`}
          aria-label={`${relativeText}, ${exactText}`}
        >
          {relativeText}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{exactText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
