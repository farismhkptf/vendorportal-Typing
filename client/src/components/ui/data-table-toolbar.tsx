import { type ReactNode } from "react";
import { Search, AlignJustify, AlignCenter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Density } from "@/hooks/use-data-table";

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  density: Density;
  onDensityChange: (d: Density) => void;
  totalItems: number;
  selectedCount: number;
  onClearSelection?: () => void;
  selectionActions?: ReactNode;
  filters?: ReactNode;
  viewModeToggle?: ReactNode;
  actions?: ReactNode;
  activeFilterCount?: number;
  onClearFilters?: () => void;
}

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  density,
  onDensityChange,
  totalItems,
  selectedCount,
  onClearSelection,
  selectionActions,
  filters,
  viewModeToggle,
  actions,
  activeFilterCount = 0,
  onClearFilters,
}: DataTableToolbarProps) {
  return (
    <div className="space-y-2">
      {selectedCount > 0 && (
        <div
          className="flex items-center gap-2 flex-wrap py-2 px-3 rounded-lg bg-primary/5 border border-primary/10"
          data-testid="selection-bar"
        >
          <span className="text-sm font-medium text-foreground" data-testid="text-selection-count">
            {selectedCount} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-xs text-muted-foreground"
            data-testid="button-clear-selection"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          {selectionActions}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        {filters}

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted/50">
                <Button
                  size="icon"
                  variant={density === "comfortable" ? "secondary" : "ghost"}
                  onClick={() => onDensityChange("comfortable")}
                  data-testid="button-density-comfortable"
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant={density === "compact" ? "secondary" : "ghost"}
                  onClick={() => onDensityChange("compact")}
                  data-testid="button-density-compact"
                >
                  <AlignJustify className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>Row density</TooltipContent>
          </Tooltip>

          {viewModeToggle}
          {actions}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2" data-testid="active-filters-bar">
          <Badge variant="secondary" className="rounded-full text-xs gap-1">
            {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
          </Badge>
          {onClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-xs text-muted-foreground"
              data-testid="button-clear-filters"
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
