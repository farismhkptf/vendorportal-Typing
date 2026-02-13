import { Columns3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ColumnDef } from "@/hooks/use-data-table";

interface ColumnVisibilityDropdownProps {
  columns: ColumnDef[];
  isColumnVisible: (id: string) => boolean;
  toggleColumn: (id: string) => void;
  resetColumns: () => void;
}

export function ColumnVisibilityDropdown({
  columns,
  isColumnVisible,
  toggleColumn,
  resetColumns,
}: ColumnVisibilityDropdownProps) {
  if (columns.length === 0) return null;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-column-visibility">
              <Columns3 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Toggle columns</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          Columns
          <Button variant="ghost" size="sm" onClick={resetColumns} className="text-xs gap-1" data-testid="button-reset-columns">
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={isColumnVisible(col.id)}
            onCheckedChange={() => toggleColumn(col.id)}
            data-testid={`toggle-column-${col.id}`}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
