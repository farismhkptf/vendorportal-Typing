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
        "premium-card p-4",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
