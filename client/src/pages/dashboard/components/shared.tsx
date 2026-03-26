import { useState } from "react";
import { ChevronDown, ChevronRight, Stethoscope, CreditCard } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toProperCase } from "@/lib/proper-case";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function TypeIcon({ type, className }: { type: "Medical" | "EID"; className?: string }) {
  return type === "Medical" 
    ? <Stethoscope className={cn("h-3.5 w-3.5 text-rose-500 dark:text-rose-400", className)} />
    : <CreditCard className={cn("h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400", className)} />;
}

export function JobRow({ 
  item, 
  rightContent, 
  onClick,
  photoUrl,
}: { 
  item: { woNumber: string; applicantName: string; type: "Medical" | "EID"; urgent?: boolean; woId?: string }; 
  rightContent: React.ReactNode;
  onClick: () => void;
  photoUrl?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover-elevate"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      <Avatar className="h-6 w-6 shrink-0" data-testid={`avatar-${item.woNumber}`}>
        {photoUrl && <AvatarImage src={photoUrl} alt={item.applicantName} />}
        <AvatarFallback className="text-[9px] font-medium">{getInitials(item.applicantName)}</AvatarFallback>
      </Avatar>
      <TypeIcon type={item.type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{item.woNumber}</span>
          {item.urgent && (
            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded-full">URGENT</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{toProperCase(item.applicantName)}</p>
      </div>
      <div className="shrink-0 text-right">
        {rightContent}
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
    </div>
  );
}

export function LaneHeader({ 
  icon, 
  title, 
  count, 
  color,
  action,
}: { 
  icon: React.ReactNode; 
  title: string; 
  count?: number;
  color: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1">
      <div className="flex items-center gap-2.5">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", color)}>
          {icon}
        </div>
        <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full tabular-nums">{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}

export function SubSection({ 
  title, 
  count, 
  icon, 
  color,
  children, 
  defaultOpen = true,
  testId,
}: { 
  title: string; 
  count: number; 
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div data-testid={testId}>
      <button
        className="flex items-center justify-between gap-2 w-full p-2 rounded-lg hover:bg-muted/30 transition-colors text-left"
        onClick={() => setOpen(!open)}
        data-testid={`toggle-${testId}`}
      >
        <div className="flex items-center gap-2">
          <div className={cn("h-5 w-5 rounded flex items-center justify-center", color)}>
            {icon}
          </div>
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs font-medium text-muted-foreground tabular-nums bg-muted/50 px-1.5 py-0.5 rounded-full">{count}</span>
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}
