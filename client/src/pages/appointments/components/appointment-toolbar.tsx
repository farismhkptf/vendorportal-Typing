import { Filter, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { exportToCsv } from "@/lib/csv-export";
import type { AppointmentWithRelations } from "./types";

interface AppointmentToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  density: "comfortable" | "compact";
  onDensityChange: (value: "comfortable" | "compact") => void;
  totalItems: number;
  selectedCount: number;
  onClearSelection: () => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  dateRangeFilter: string;
  onDateRangeFilterChange: (value: string) => void;
  onClearFilters: () => void;
  selectedIds: Set<string>;
  allFilteredAppointments: AppointmentWithRelations[];
}

export function AppointmentToolbar({
  search,
  onSearchChange,
  density,
  onDensityChange,
  totalItems,
  selectedCount,
  onClearSelection,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  onClearFilters,
  selectedIds,
  allFilteredAppointments,
}: AppointmentToolbarProps) {
  const activeFilterCount = (typeFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0) + (dateRangeFilter !== "all" ? 1 : 0);

  return (
    <DataTableToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by WO number, applicant, or center..."
      density={density}
      onDensityChange={onDensityChange}
      totalItems={totalItems}
      selectedCount={selectedCount}
      onClearSelection={onClearSelection}
      filters={
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger className="w-32 rounded-lg" data-testid="select-type-filter">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Medical">Medical</SelectItem>
              <SelectItem value="EID">Emirates ID</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-36 rounded-lg" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Scheduled">Scheduled</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
              <SelectItem value="Rescheduled">Rescheduled</SelectItem>
              <SelectItem value="FollowUpRequired">Follow-Up Required</SelectItem>
              <SelectItem value="FollowUpScheduled">Follow-Up Scheduled</SelectItem>
              <SelectItem value="FollowUpCompleted">Follow-Up Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRangeFilter} onValueChange={onDateRangeFilterChange}>
            <SelectTrigger className="w-36 rounded-lg" data-testid="select-date-range-filter">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={onClearFilters}
      selectionActions={
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          data-testid="button-export-csv"
          onClick={() => {
            const selected = allFilteredAppointments.filter(a => selectedIds.has(a.id));
            exportToCsv(selected, [
              { header: "WO Number", accessor: (a: AppointmentWithRelations) => a.workOrder?.woNumber || "" },
              { header: "Applicant", accessor: (a: AppointmentWithRelations) => a.workOrder?.applicantName || "" },
              { header: "Type", accessor: (a: AppointmentWithRelations) => a.type },
              { header: "Date/Time", accessor: (a: AppointmentWithRelations) => a.datetime ? new Date(a.datetime).toLocaleString() : "" },
              { header: "Center", accessor: (a: AppointmentWithRelations) => a.center?.name || "" },
              { header: "Status", accessor: (a: AppointmentWithRelations) => a.status },
            ], "appointments-export");
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      }
    />
  );
}
