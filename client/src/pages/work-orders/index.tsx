import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, FileText, Building2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTableRow } from "@/components/ui/data-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkOrder, Company } from "@shared/schema";

interface WorkOrderWithCompany extends WorkOrder {
  company?: Company;
}

export default function WorkOrdersList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  return (
    <AppLayout>
      <PageHeader
        title="Work Orders"
        subtitle="Manage all work orders and track their progress"
        actions={
          <Link href="/work-orders/new">
            <Button className="gap-2" data-testid="button-new-work-order">
              <Plus className="h-4 w-4" />
              New Work Order
            </Button>
          </Link>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by WO number or applicant name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl"
              data-testid="input-search-work-orders"
            />
          </div>
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-11 rounded-xl" data-testid="select-status-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Work Orders List */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </>
          ) : filteredWorkOrders && filteredWorkOrders.length > 0 ? (
            filteredWorkOrders.map((wo) => (
              <Link key={wo.id} href={`/work-orders/${wo.id}`}>
                <DataTableRow className="mb-0" data-testid={`work-order-row-${wo.woNumber}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{wo.woNumber}</span>
                          <StatusBadge status={wo.status} />
                        </div>
                        <p className="text-sm text-foreground">{wo.applicantName}</p>
                        {wo.company && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {wo.company.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {new Date(wo.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </DataTableRow>
              </Link>
            ))
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No work orders found"
              description={search ? "Try adjusting your search or filters" : "Create your first work order to get started."}
              action={
                !search && (
                  <Link href="/work-orders/new">
                    <Button size="sm" className="gap-2">
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
