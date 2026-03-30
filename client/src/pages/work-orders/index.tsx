import { useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { useDataTable, type ColumnDef } from "@/hooks/use-data-table";
import { ColumnVisibilityDropdown } from "@/components/ui/column-visibility";
import { QueryErrorState } from "@/components/ui/query-error-state";
import type { WorkOrderEnriched, ViewMode } from "./components/types";
import { WorkOrderCardView } from "./components/work-order-card-view";
import { WorkOrderCompactView } from "./components/work-order-compact-view";
import { WorkOrderTableView } from "./components/work-order-table-view";
import { WorkOrderKanbanView } from "./components/work-order-kanban-view";
import { useWorkOrdersData } from "./components/use-work-orders-data";
import { StatTiles, PipelineButtons, FilterControls, ViewModeToggle, BulkActions, useWoMenus } from "./components/work-order-toolbar";

export default function WorkOrdersList() {
  const [, navigate] = useLocation();

  const {
    search, setSearch, statusFilter, setStatusFilter, dateRangeFilter, setDateRangeFilter,
    pipelineFilter, setPipelineFilter, specialFilter, setSpecialFilter,
    sortBy, setSortBy, columnSort, toggleColumnSort,
    isLoading, isError, refetch, photoMap,
    stats, pipelineCounts, filteredAndSortedWorkOrders, kanbanGroups,
    bulkStatusMutation, singleStatusMutation, toggleVipMutation,
    handleCopyWoNumber, activeFilterCount, clearAllFilters,
  } = useWorkOrdersData();

  const getId = useCallback((wo: WorkOrderEnriched) => wo.id, []);
  const woColumns: ColumnDef[] = useMemo(() => [
    { id: "woNumber", label: "WO #" }, { id: "applicant", label: "Applicant" },
    { id: "company", label: "Company" }, { id: "service", label: "Service" },
    { id: "pipeline", label: "Tracks" }, { id: "status", label: "Status" },
    { id: "age", label: "Age" }, { id: "nextAction", label: "Next Action" },
  ], []);

  const dt = useDataTable(filteredAndSortedWorkOrders, {
    storageKey: "wo_list", defaultPageSize: 25, defaultViewMode: "cards", getId, columns: woColumns,
  });

  const { renderWoContextMenu, renderMobileMenu } = useWoMenus({
    navigate,
    handleCopyWoNumber,
    singleStatusMutate: (args) => singleStatusMutation.mutate(args),
    toggleVipMutate: (args) => toggleVipMutation.mutate(args),
  });

  const viewMode = dt.viewMode as ViewMode;
  const isKanban = viewMode === "kanban";
  const displayItems = isKanban ? (filteredAndSortedWorkOrders || []) : dt.paginatedData;

  const filterControls = (
    <FilterControls
      statusFilter={statusFilter} setStatusFilter={setStatusFilter}
      specialFilter={specialFilter} setSpecialFilter={setSpecialFilter}
      dateRangeFilter={dateRangeFilter} setDateRangeFilter={setDateRangeFilter}
      sortBy={sortBy} setSortBy={setSortBy}
    />
  );

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-semibold text-foreground tracking-tight">Work Orders</h1>
            <p className="text-sm text-muted-foreground mt-1">Track and manage all applicant work orders</p>
          </div>
          <Link href="/work-orders/new">
            <Button size="sm" className="gap-1.5" data-testid="button-new-work-order"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New Work Order</span></Button>
          </Link>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-20 md:pb-6 space-y-4">
        <StatTiles stats={stats} specialFilter={specialFilter} setSpecialFilter={setSpecialFilter} />
        <PipelineButtons pipelineCounts={pipelineCounts} pipelineFilter={pipelineFilter} setPipelineFilter={setPipelineFilter} />

        <DataTableToolbar
          search={search} onSearchChange={setSearch} searchPlaceholder="Search by WO# or applicant..."
          density={dt.density} onDensityChange={dt.setDensity} totalItems={dt.totalItems}
          selectedCount={dt.selectedCount} onClearSelection={dt.clearSelection}
          filters={filterControls}
          viewModeToggle={<ViewModeToggle viewMode={viewMode} setViewMode={dt.setViewMode} />}
          activeFilterCount={activeFilterCount} onClearFilters={clearAllFilters}
          actions={<ColumnVisibilityDropdown columns={dt.columns} isColumnVisible={dt.isColumnVisible} toggleColumn={dt.toggleColumn} resetColumns={dt.resetColumns} />}
          selectionActions={
            <BulkActions
              selectedIds={dt.selectedIds}
              filteredWorkOrders={filteredAndSortedWorkOrders}
              bulkStatusMutation={{ isPending: bulkStatusMutation.isPending, mutate: (args) => { bulkStatusMutation.mutate(args); dt.clearSelection(); } }}
            />
          }
        />

        <div>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : isError ? (
            <QueryErrorState message="Could not load work orders." onRetry={() => refetch()} />
          ) : displayItems.length > 0 ? (
            <>
              {viewMode === "compact" && <WorkOrderCompactView items={displayItems} photoMap={photoMap} density={dt.density} selectedIds={dt.selectedIds} toggleSelected={dt.toggleSelected} renderContextMenu={renderWoContextMenu} renderMobileMenu={renderMobileMenu} />}
              {viewMode === "cards" && <WorkOrderCardView items={displayItems} photoMap={photoMap} density={dt.density} selectedIds={dt.selectedIds} toggleSelected={dt.toggleSelected} navigate={navigate} renderContextMenu={renderWoContextMenu} renderMobileMenu={renderMobileMenu} />}
              {viewMode === "table" && <WorkOrderTableView items={displayItems} photoMap={photoMap} density={dt.density} selectedIds={dt.selectedIds} isAllSelected={dt.isAllSelected} isPartiallySelected={dt.isPartiallySelected} toggleSelected={dt.toggleSelected} toggleSelectAll={dt.toggleSelectAll} columnSort={columnSort} toggleColumnSort={toggleColumnSort} isColumnVisible={dt.isColumnVisible} navigate={navigate} handleCopyWoNumber={handleCopyWoNumber} singleStatusMutate={(args) => singleStatusMutation.mutate(args)} toggleVipMutate={(args) => toggleVipMutation.mutate(args)} />}
              {viewMode === "kanban" && kanbanGroups && <WorkOrderKanbanView groups={kanbanGroups} photoMap={photoMap} renderContextMenu={renderWoContextMenu} />}
            </>
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={search || activeFilterCount > 0 ? "No results match your filters" : "No work orders yet"}
              description={search || activeFilterCount > 0 ? "Try adjusting your search or filters." : "Create your first work order to get started."}
              action={search || activeFilterCount > 0 ? (
                <Button size="sm" variant="outline" className="gap-2 rounded-lg" onClick={clearAllFilters} data-testid="button-clear-all-filters">Clear all filters</Button>
              ) : (
                <Link href="/work-orders/new"><Button size="sm" className="gap-2 rounded-lg" data-testid="button-create-first-wo"><Plus className="h-4 w-4" />New Work Order</Button></Link>
              )}
            />
          )}
        </div>

        {!isKanban && <DataTablePagination page={dt.page} totalPages={dt.totalPages} pageSize={dt.pageSize} totalItems={dt.totalItems} onPageChange={dt.setPage} onPageSizeChange={dt.setPageSize} />}
      </div>

      <FloatingActionButton href="/work-orders/new" label="New Work Order" icon={<Plus className="h-5 w-5" />} />
    </AppLayout>
  );
}
