import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DataTableRowProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function DataTableRow({ children, onClick, className }: DataTableRowProps) {
  return (
    <Card 
      className={cn(
        "border border-border/50 shadow-sm transition-all duration-200",
        onClick && "cursor-pointer hover-elevate",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {children}
      </CardContent>
    </Card>
  );
}
