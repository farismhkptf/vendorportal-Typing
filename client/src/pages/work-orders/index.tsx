import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, FileText, Building2, Filter, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTableRow } from "@/components/ui/data-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkOrder, Company } from "@shared/schema";

interface WorkOrderWithCompany extends WorkOrder {
  company?: Company;
}

type ViewByOption = "none" | "status" | "company";

export default function WorkOrdersList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewBy, setViewBy] = useState<ViewByOption>("none");

  const { data: workOrders, isLoading } = useQuery<WorkOrderWithCompany[]>({
    queryKey: ["/api/work-orders"],
    staleTime: 0,
  });

  const filteredWorkOrders = workOrders?.filter((wo) => {
    const matchesSearch = !search || 
      wo.woNumber.toLowerCase().includes(search.toLowerCase()) ||
      wo.applicantName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const groupedWorkOrders = useMemo(() => {
    if (!filteredWorkOrders || filteredWorkOrders.length === 0 || viewBy === "none") return null;
    
    const groups: Record<string, WorkOrderWithCompany[]> = {};
    
    filteredWorkOrders.forEach((wo) => {
      let key: string;
      if (viewBy === "status") {
        key = wo.status;
      } else if (viewBy === "company") {
        key = wo.company?.name || "No Company";
      } else {
        key = "All";
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(wo);
    });
    
    return Object.keys(groups).length > 0 ? groups : null;
  }, [filteredWorkOrders, viewBy]);

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

      <div className="px-4 lg:px-6 pb-6 space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by WO number or applicant..."
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
          <Select value={viewBy} onValueChange={(v) => setViewBy(v as ViewByOption)}>
            <SelectTrigger className="w-32 h-9 rounded-lg" data-testid="select-view-by">
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="View by" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
              <SelectItem value="company">By Company</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Work Orders List */}
        <div className="space-y-4">
          {isLoading ? (
            <>
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </>
          ) : groupedWorkOrders ? (
            Object.entries(groupedWorkOrders).map(([groupKey, items]) => (
              <div key={groupKey} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{groupKey}</h3>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="space-y-2">
                  {items.map((wo, index) => (
                    <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                      <div 
                        className="premium-card p-4 opacity-0 animate-fade-in"
                        style={{ animationDelay: `${index * 0.03}s` }}
                        data-testid={`work-order-row-${wo.woNumber}`}
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
                              <p className="text-sm text-muted-foreground truncate">{wo.applicantName}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {new Date(wo.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          ) : filteredWorkOrders && filteredWorkOrders.length > 0 ? (
            <div className="space-y-2">
              {filteredWorkOrders.map((wo, index) => (
                <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                  <div 
                    className="premium-card p-4 opacity-0 animate-fade-in"
                    style={{ animationDelay: `${index * 0.03}s` }}
                    data-testid={`work-order-row-${wo.woNumber}`}
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
                          <p className="text-sm text-muted-foreground truncate">{wo.applicantName}</p>
                          {wo.company && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {wo.company.name}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {new Date(wo.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
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
    </AppLayout>
  );
}
