import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Search, FileText, Building2, Filter, ArrowUpDown, List, LayoutGrid, Columns3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toProperCase } from "@/lib/proper-case";
import type { WorkOrder, Company } from "@shared/schema";

interface WorkOrderWithCompany extends WorkOrder {
  company?: Company;
}

type ViewMode = "compact" | "cards" | "table" | "kanban";
type SortByOption = "newest" | "oldest" | "wo_asc" | "wo_desc" | "applicant_asc" | "applicant_desc";

const STATUS_ORDER = ["Draft", "Scheduled", "Sent", "Completed", "Cancelled"] as const;
type WorkOrderStatus = typeof STATUS_ORDER[number];

export default function WorkOrdersList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortBy, setSortBy] = useState<SortByOption>("newest");

  const { data: workOrders, isLoading } = useQuery<WorkOrderWithCompany[]>({
    queryKey: ["/api/work-orders"],
    staleTime: 0,
  });

  const filteredAndSortedWorkOrders = useMemo(() => {
    let result = workOrders?.filter((wo) => {
      const matchesSearch = !search || 
        wo.woNumber.toLowerCase().includes(search.toLowerCase()) ||
        wo.applicantName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || wo.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    
    if (result) {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case "oldest":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "wo_asc":
            return a.woNumber.localeCompare(b.woNumber);
          case "wo_desc":
            return b.woNumber.localeCompare(a.woNumber);
          case "applicant_asc":
            return a.applicantName.localeCompare(b.applicantName);
          case "applicant_desc":
            return b.applicantName.localeCompare(a.applicantName);
          default:
            return 0;
        }
      });
    }
    
    return result;
  }, [workOrders, search, statusFilter, sortBy]);

  // Group by status for Kanban view
  const kanbanGroups = useMemo(() => {
    if (!filteredAndSortedWorkOrders) return null;
    const groups: Record<string, WorkOrderWithCompany[]> = {};
    STATUS_ORDER.forEach(status => { groups[status] = []; });
    filteredAndSortedWorkOrders.forEach(wo => {
      if (groups[wo.status]) {
        groups[wo.status].push(wo);
      }
    });
    return groups;
  }, [filteredAndSortedWorkOrders]);

  const renderCompactList = (items: WorkOrderWithCompany[]) => (
    <div className="space-y-1">
      {items.map((wo, index) => (
        <Link key={wo.id} href={`/work-orders/${wo.id}`}>
          <div 
            className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover-elevate opacity-0 animate-fade-in"
            style={{ animationDelay: `${index * 0.02}s` }}
            data-testid={`work-order-compact-${wo.woNumber}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-sm font-medium text-foreground">{wo.woNumber}</span>
              <span className="text-sm text-muted-foreground truncate">{toProperCase(wo.applicantName)}</span>
              {wo.company && (
                <span className="text-xs text-muted-foreground/70 hidden sm:inline">• {toProperCase(wo.company.name)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={wo.status} />
              <RelativeTime date={wo.createdAt} className="text-xs" id={wo.id} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );

  const renderCards = (items: WorkOrderWithCompany[]) => (
    <div className="space-y-2">
      {items.map((wo, index) => (
        <Link key={wo.id} href={`/work-orders/${wo.id}`}>
          <div 
            className="premium-card p-4 opacity-0 animate-fade-in"
            style={{ animationDelay: `${index * 0.03}s` }}
            data-testid={`work-order-card-${wo.woNumber}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-container icon-container-sm shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{wo.woNumber}</span>
                    <StatusBadge status={wo.status} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{toProperCase(wo.applicantName)}</p>
                  {wo.company && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {toProperCase(wo.company.name)}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <RelativeTime date={wo.createdAt} className="text-xs" id={wo.id} />
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );

  const renderTable = (items: WorkOrderWithCompany[]) => (
    <div className="premium-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Work Order #</TableHead>
            <TableHead>Applicant</TableHead>
            <TableHead className="hidden sm:table-cell">Company</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-24 text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((wo) => (
            <TableRow 
              key={wo.id} 
              className="cursor-pointer hover-elevate" 
              onClick={() => navigate(`/work-orders/${wo.id}`)}
              data-testid={`work-order-table-${wo.woNumber}`}
            >
              <TableCell>
                <span className="font-mono font-medium text-primary">{wo.woNumber}</span>
              </TableCell>
              <TableCell>{toProperCase(wo.applicantName)}</TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground">
                {wo.company?.name ? toProperCase(wo.company.name) : "-"}
              </TableCell>
              <TableCell>
                <StatusBadge status={wo.status} />
              </TableCell>
              <TableCell className="text-right text-sm">
                <RelativeTime date={wo.createdAt} id={wo.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderKanban = () => {
    if (!kanbanGroups) return null;
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="flex-shrink-0 w-72">
            <div className="flex items-center justify-between gap-2 mb-3 px-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="text-xs text-muted-foreground">({kanbanGroups[status]?.length || 0})</span>
              </div>
            </div>
            <div className="space-y-2 min-h-[200px] p-2 rounded-xl bg-muted/30">
              {kanbanGroups[status]?.map((wo, index) => (
                <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                  <div 
                    className="premium-card p-3 opacity-0 animate-fade-in"
                    style={{ animationDelay: `${index * 0.03}s` }}
                    data-testid={`work-order-kanban-${wo.woNumber}`}
                  >
                    <div className="font-mono text-sm font-medium text-foreground mb-1">{wo.woNumber}</div>
                    <div className="text-sm text-muted-foreground truncate">{toProperCase(wo.applicantName)}</div>
                    {wo.company && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{toProperCase(wo.company.name)}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {(!kanbanGroups[status] || kanbanGroups[status].length === 0) && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No items
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Work Orders
          </h1>
          <Link href="/work-orders/new">
            <Button size="sm" className="gap-1.5 rounded-lg" data-testid="button-new-work-order">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Work Order</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-20 md:pb-6 space-y-4">
        {/* Search, Filters, and View Mode */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by work order number or applicant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search-work-orders"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9 rounded-lg" data-testid="select-status-filter">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Scheduled">Scheduled</SelectItem>
              <SelectItem value="Sent">Sent</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortByOption)}>
            <SelectTrigger className="w-36 h-9 rounded-lg" data-testid="select-sort-by">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="wo_asc">Work Order # A-Z</SelectItem>
              <SelectItem value="wo_desc">Work Order # Z-A</SelectItem>
              <SelectItem value="applicant_asc">Applicant A-Z</SelectItem>
              <SelectItem value="applicant_desc">Applicant Z-A</SelectItem>
            </SelectContent>
          </Select>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
            <Button
              size="icon"
              variant={viewMode === "compact" ? "secondary" : "ghost"}
              onClick={() => setViewMode("compact")}
              data-testid="button-view-compact"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              onClick={() => setViewMode("cards")}
              data-testid="button-view-cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              onClick={() => setViewMode("table")}
              data-testid="button-view-table"
            >
              <Table2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              onClick={() => setViewMode("kanban")}
              data-testid="button-view-kanban"
            >
              <Columns3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Work Orders Display */}
        <div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : filteredAndSortedWorkOrders && filteredAndSortedWorkOrders.length > 0 ? (
            <>
              {viewMode === "compact" && renderCompactList(filteredAndSortedWorkOrders)}
              {viewMode === "cards" && renderCards(filteredAndSortedWorkOrders)}
              {viewMode === "table" && renderTable(filteredAndSortedWorkOrders)}
              {viewMode === "kanban" && renderKanban()}
            </>
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No work orders found"
              description={search ? "Try adjusting your search or filters" : "Create your first work order to get started."}
              action={
                !search && (
                  <Link href="/work-orders/new">
                    <Button size="sm" className="gap-2 rounded-lg">
                      <Plus className="h-4 w-4" />
                      New Work Order
                    </Button>
                  </Link>
                )
              }
            />
          )}
        </div>
      </div>
      <FloatingActionButton href="/work-orders/new" label="New Work Order" testId="fab-new-work-order" />
    </AppLayout>
  );
}
