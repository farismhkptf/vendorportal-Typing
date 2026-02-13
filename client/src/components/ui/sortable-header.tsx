import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { SortState } from "@/hooks/use-data-table";

interface SortableHeaderProps {
  sortKey: string;
  sort: SortState;
  onToggle: (key: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function SortableHeader({ sortKey, sort, onToggle, children, className = "" }: SortableHeaderProps) {
  const isActive = sort.key === sortKey;
  const dir = isActive ? sort.direction : null;

  return (
    <TableHead
      className={`cursor-pointer select-none group ${className}`}
      onClick={() => onToggle(sortKey)}
      data-testid={`sort-header-${sortKey}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="inline-flex text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          {dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-foreground" />
          ) : dir === "desc" ? (
            <ArrowDown className="h-3.5 w-3.5 text-foreground" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 invisible group-hover:visible" />
          )}
        </span>
      </span>
    </TableHead>
  );
}
