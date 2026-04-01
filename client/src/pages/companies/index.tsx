import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Building2, Mail, MapPin, User, ArrowUpDown, List, LayoutGrid, Table2, Download } from "lucide-react";
import { SortableHeader } from "@/components/ui/sortable-header";
import { ColumnVisibilityDropdown } from "@/components/ui/column-visibility";
import type { ColumnDef, SortState } from "@/hooks/use-data-table";
import { exportToCsv } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { queryKeys } from "@/lib/query-keys";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { toProperCase } from "@/lib/proper-case";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Company, Staff, Center, CompanyEmail } from "@shared/schema";

type ViewMode = "compact" | "cards" | "table";
type SortByOption = "name_asc" | "name_desc" | "most_used";

interface ClientContact {
  name?: string;
  email?: string;
  mobile?: string;
}

function hasValidContact(contact: ClientContact | null | undefined): boolean {
  return !!(contact && contact.name && contact.name.trim() && contact.email && contact.email.trim());
}

function getCompanyCompleteness(company: CompanyWithRelations): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!company.tradeLicenseNumber) missing.push("Trade License");
  if (!hasValidContact(company.clientCoordinator as ClientContact)) missing.push("Coordinator");
  if (!hasValidContact(company.clientManager as ClientContact)) missing.push("Manager");
  if (!company.preferredMedicalCenter) missing.push("Medical Center");
  if (!company.preferredBiometricsCenter) missing.push("EID Center");
  if (!company.rmStaff) missing.push("RM Staff");
  if (!company.assistStaff) missing.push("Assist Staff");
  return { complete: missing.length === 0, missing };
}

function CompletenessIndicator({ company }: { company: CompanyWithRelations }) {
  const { complete, missing } = getCompanyCompleteness(company);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${complete ? "bg-emerald-500" : "bg-red-500"}`}
          data-testid={`completeness-dot-${company.id}`}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        {complete ? (
          <p className="text-xs">All key fields filled</p>
        ) : (
          <div className="text-xs">
            <p className="font-medium mb-1">Missing:</p>
            <ul className="list-disc pl-3 space-y-0.5">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

interface CompanyWithRelations extends Company {
  rmStaff?: Staff;
  assistStaff?: Staff;
  preferredMedicalCenter?: Center;
  preferredMedicalCenterVip?: Center;
  preferredBiometricsCenter?: Center;
  preferredBiometricsCenterVip?: Center;
  emails?: CompanyEmail[];
  workOrderCount?: number;
}

export default function CompaniesList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortByOption>("name_asc");
  const [columnSort, setColumnSort] = useState<SortState>({ key: null, direction: null });
  const toggleColumnSort = useCallback((key: string) => {
    setColumnSort(prev => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: null };
    });
  }, []);

  const { data: companies, isLoading, isError, refetch } = useQuery<CompanyWithRelations[]>({
    queryKey: queryKeys.companies,
  });

  const filteredAndSortedCompanies = useMemo(() => {
    let result = companies?.filter((company) =>
      !search || company.name.toLowerCase().includes(search.toLowerCase())
    );
    
    if (result) {
      result = [...result].sort((a, b) => {
        if (columnSort.key) {
          const dir = columnSort.direction === "desc" ? -1 : 1;
          switch (columnSort.key) {
            case "name":
              return dir * a.name.localeCompare(b.name);
            case "rm":
              return dir * (a.rmStaff?.name || "").localeCompare(b.rmStaff?.name || "");
            case "medicalCenter":
              return dir * (a.preferredMedicalCenter?.name || "").localeCompare(b.preferredMedicalCenter?.name || "");
          }
        }
        switch (sortBy) {
          case "name_asc":
            return a.name.localeCompare(b.name);
          case "name_desc":
            return b.name.localeCompare(a.name);
          case "most_used":
            return (b.workOrderCount || 0) - (a.workOrderCount || 0);
          default:
            return 0;
        }
      });
    }
    
    return result;
  }, [companies, search, sortBy, columnSort]);

  const getId = useCallback((company: CompanyWithRelations) => company.id, []);

  const columns: ColumnDef[] = [
    { id: "name", label: "Company Name", defaultVisible: true },
    { id: "rm", label: "RM", defaultVisible: true },
    { id: "medicalCenter", label: "Medical Center", defaultVisible: true },
    { id: "emails", label: "Emails", defaultVisible: true },
  ];

  const dt = useDataTable(filteredAndSortedCompanies, {
    storageKey: "co_list",
    defaultPageSize: 25,
    defaultViewMode: "cards",
    getId,
    columns,
  });

  const viewMode = dt.viewMode as ViewMode;
  const isComfortable = dt.density === "comfortable";

  const renderCompactList = (items: CompanyWithRelations[]) => (
    <div className="space-y-1 stagger-children">
      {items.map((company, index) => {
        const isSelected = dt.selectedIds.has(company.id);
        return (
          <div key={company.id} className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => dt.toggleSelected(company.id)}
              aria-label={`Select ${company.name}`}
              data-testid={`checkbox-company-${company.id}`}
            />
            <Link href={`/companies/${company.id}`} className="flex-1 min-w-0">
              <div 
                className={`flex items-center justify-between gap-2 ${isComfortable ? "py-2.5 px-3" : "py-1.5 px-2"} rounded-lg hover-elevate opacity-0 animate-fade-in`}
                style={{ animationDelay: `${index * 0.02}s` }}
                data-testid={`company-compact-${company.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CompletenessIndicator company={company} />
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground truncate">{toProperCase(company.name)}</span>
                  {company.rmStaff && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">• RM: {company.rmStaff.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {company.emails && company.emails.filter(e => e.active).length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {company.emails.filter(e => e.active).length} email(s)
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );

  const renderCards = (items: CompanyWithRelations[]) => (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
      {items.map((company, index) => {
        const isSelected = dt.selectedIds.has(company.id);
        return (
          <div key={company.id} className="relative">
            <div className="absolute top-3 left-3 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => dt.toggleSelected(company.id)}
                aria-label={`Select ${company.name}`}
                data-testid={`checkbox-company-${company.id}`}
              />
            </div>
            <Link href={`/companies/${company.id}`}>
              <div 
                className={`premium-card ${isComfortable ? "p-5" : "p-3"} h-full opacity-0 animate-fade-in`}
                style={{ animationDelay: `${index * 0.05}s` }}
                data-testid={`company-card-${company.id}`}
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="relative icon-container icon-container-md shrink-0 ml-6">
                      <Building2 className="h-5 w-5" />
                      <span className="absolute -top-0.5 -right-0.5">
                        <CompletenessIndicator company={company} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{toProperCase(company.name)}</h3>
                      {company.emails && company.emails.filter(e => e.active).length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {company.emails.filter(e => e.active).length} email(s)
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {company.preferredMedicalCenter && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">Medical: {company.preferredMedicalCenter.name}</span>
                      </div>
                    )}
                    {company.preferredMedicalCenterVip && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">VIP Medical: {company.preferredMedicalCenterVip.name}</span>
                      </div>
                    )}
                    {company.preferredBiometricsCenter && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">Biometrics: {company.preferredBiometricsCenter.name}</span>
                      </div>
                    )}
                  </div>

                  {(company.rmStaff || company.assistStaff) && (
                    <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex gap-1.5 flex-wrap">
                        {company.rmStaff && (
                          <Badge variant="secondary" className="text-xs rounded-full">
                            {company.rmStaff.name}
                          </Badge>
                        )}
                        {company.assistStaff && (
                          <Badge variant="secondary" className="text-xs rounded-full">
                            {company.assistStaff.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );

  const cv = dt.isColumnVisible;

  const renderTable = (items: CompanyWithRelations[]) => (
    <div className="premium-card overflow-hidden">
      <Table>
        <TableHeader className="sticky top-0 z-[9999] bg-background">
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={dt.isAllSelected}
                ref={(el) => {
                  if (el) (el as any).indeterminate = dt.isPartiallySelected;
                }}
                onCheckedChange={() => dt.toggleSelectAll()}
                aria-label="Select all"
                data-testid="checkbox-select-all"
              />
            </TableHead>
            {cv("name") && <SortableHeader sortKey="name" sort={columnSort} onToggle={toggleColumnSort}>Company Name</SortableHeader>}
            {cv("rm") && <SortableHeader sortKey="rm" sort={columnSort} onToggle={toggleColumnSort} className="hidden md:table-cell">RM</SortableHeader>}
            {cv("medicalCenter") && <SortableHeader sortKey="medicalCenter" sort={columnSort} onToggle={toggleColumnSort} className="hidden lg:table-cell">Medical Center</SortableHeader>}
            {cv("emails") && <TableHead className="text-right">Emails</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((company) => {
            const isSelected = dt.selectedIds.has(company.id);
            const cellPadding = isComfortable ? "" : "py-1.5";
            return (
              <TableRow 
                key={company.id} 
                className={`cursor-pointer hover-elevate ${isSelected ? "bg-primary/5" : ""}`}
                data-testid={`company-table-${company.id}`}
              >
                <TableCell className={cellPadding} onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => dt.toggleSelected(company.id)}
                    aria-label={`Select ${company.name}`}
                    data-testid={`checkbox-company-${company.id}`}
                  />
                </TableCell>
                {cv("name") && <TableCell className={cellPadding} onClick={() => navigate(`/companies/${company.id}`)}>
                  <div className="flex items-center gap-2">
                    <CompletenessIndicator company={company} />
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-primary">{toProperCase(company.name)}</span>
                  </div>
                </TableCell>}
                {cv("rm") && <TableCell className={`hidden md:table-cell text-muted-foreground ${cellPadding}`} onClick={() => navigate(`/companies/${company.id}`)}>
                  {company.rmStaff?.name || "-"}
                </TableCell>}
                {cv("medicalCenter") && <TableCell className={`hidden lg:table-cell text-muted-foreground ${cellPadding}`} onClick={() => navigate(`/companies/${company.id}`)}>
                  {company.preferredMedicalCenter?.name || "-"}
                </TableCell>}
                {cv("emails") && <TableCell className={`text-right ${cellPadding}`} onClick={() => navigate(`/companies/${company.id}`)}>
                  {company.emails && company.emails.filter(e => e.active).length > 0 ? (
                    <Badge variant="secondary" className="text-xs">
                      {company.emails.filter(e => e.active).length}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const viewModeToggle = (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
      <Button
        size="icon"
        variant={viewMode === "compact" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("compact")}
        data-testid="button-view-compact"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewMode === "cards" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("cards")}
        data-testid="button-view-cards"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewMode === "table" ? "secondary" : "ghost"}
        onClick={() => dt.setViewMode("table")}
        data-testid="button-view-table"
      >
        <Table2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const sortFilter = (
    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortByOption)}>
      <SelectTrigger className="w-36 h-9 rounded-lg" data-testid="select-sort-by">
        <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        <SelectItem value="most_used">Most Used</SelectItem>
        <SelectItem value="name_asc">Name A-Z</SelectItem>
        <SelectItem value="name_desc">Name Z-A</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Companies
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage client companies and their preferences</p>
          </div>
          <Link href="/companies/new">
            <Button size="sm" className="gap-1.5" data-testid="button-new-company">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Company</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-20 md:pb-6 space-y-4">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search companies..."
          density={dt.density}
          onDensityChange={dt.setDensity}
          totalItems={dt.totalItems}
          selectedCount={dt.selectedCount}
          onClearSelection={dt.clearSelection}
          filters={sortFilter}
          viewModeToggle={viewModeToggle}
          actions={
            <ColumnVisibilityDropdown
              columns={dt.columns}
              isColumnVisible={dt.isColumnVisible}
              toggleColumn={dt.toggleColumn}
              resetColumns={dt.resetColumns}
            />
          }
          selectionActions={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              data-testid="button-export-csv"
              onClick={() => {
                const selected = (filteredAndSortedCompanies || []).filter(c => dt.selectedIds.has(c.id));
                exportToCsv(selected, [
                  { header: "Name", accessor: (c: CompanyWithRelations) => c.name },
                  { header: "Trade License", accessor: (c: CompanyWithRelations) => c.tradeLicenseNumber || "" },
                  { header: "Email", accessor: (c: CompanyWithRelations) => c.emails?.filter(e => e.active).map(e => e.email).join("; ") || "" },
                  { header: "Coordinator", accessor: (c: CompanyWithRelations) => c.clientCoordinator?.name || "" },
                  { header: "RM Staff", accessor: (c: CompanyWithRelations) => c.rmStaff?.name || "" },
                ], "companies-export");
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          }
        />

        <div>
          {isError ? (
            <QueryErrorState message="Could not load companies." onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : dt.paginatedData.length > 0 ? (
            <>
              {viewMode === "compact" && renderCompactList(dt.paginatedData)}
              {viewMode === "cards" && renderCards(dt.paginatedData)}
              {viewMode === "table" && renderTable(dt.paginatedData)}
            </>
          ) : (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title={search ? "No results match your search" : "No companies found"}
              description={search ? "Try adjusting your search terms" : "Add your first company to get started."}
              action={
                search ? (
                  <Button size="sm" variant="outline" className="gap-2 rounded-lg" onClick={() => setSearch("")} data-testid="button-clear-search">
                    Clear search
                  </Button>
                ) : (
                  <Link href="/companies/new">
                    <Button size="sm" className="gap-2 rounded-lg">
                      <Plus className="h-4 w-4" />
                      Add Company
                    </Button>
                  </Link>
                )
              }
            />
          )}
        </div>

        <DataTablePagination
          page={dt.page}
          pageSize={dt.pageSize}
          totalPages={dt.totalPages}
          totalItems={dt.totalItems}
          onPageChange={dt.setPage}
          onPageSizeChange={dt.setPageSize}
          selectedCount={dt.selectedCount}
        />
      </div>
      <FloatingActionButton href="/companies/new" label="Add Company" testId="fab-add-company" />
    </AppLayout>
  );
}
