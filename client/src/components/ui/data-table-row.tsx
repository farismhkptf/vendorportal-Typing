import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataTableRowProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function DataTableRow({ children, onClick, className }: DataTableRowProps) {
  return (
    <div 
      className={cn(
        "premium-card p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {children}
    </div>
  );
}
