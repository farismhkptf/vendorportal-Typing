import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZES, type PageSize } from "@/hooks/use-data-table";

interface DataTablePaginationProps {
  page: number;
  pageSize: PageSize;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  selectedCount?: number;
}

export function DataTablePagination({
  page,
  pageSize,
  totalPages,
  totalItems,
  onPageChange,
  onPageSizeChange,
  selectedCount = 0,
}: DataTablePaginationProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap py-3 px-1" data-testid="data-table-pagination">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {selectedCount > 0 && (
          <span className="font-medium text-foreground" data-testid="text-selected-count">
            {selectedCount} selected
          </span>
        )}
        <span data-testid="text-pagination-info">
          {start}-{end} of {totalItems}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v) as PageSize)}
          >
            <SelectTrigger className="h-8 w-[65px] rounded-md text-xs" data-testid="select-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            data-testid="button-first-page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[60px] text-center" data-testid="text-page-indicator">
            {page} / {totalPages}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            data-testid="button-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            data-testid="button-last-page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
