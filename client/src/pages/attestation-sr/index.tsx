import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, FileCheck, CheckCircle2, XCircle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout/app-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import type { AttestationServiceRequest, Company, Vendor } from "@shared/schema";

interface SRWithRelations extends AttestationServiceRequest {
  companyName?: string | null;
  vendorName?: string | null;
  serviceName?: string | null;
}

const SR_STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  SentToVendor: "Sent to Vendor",
  AcceptedByVendor: "Accepted by Vendor",
  InProgress: "In Progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

const SR_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  SentToVendor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  AcceptedByVendor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  InProgress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const CUSTODY_LABELS: Record<string, string> = {
  WithClient: "With Client",
  WithUs: "With Us",
  WithVendor: "With Vendor",
  ReturnedToClient: "Returned",
};

export default function AttestationSRList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: serviceRequests, isLoading } = useQuery<SRWithRelations[]>({
    queryKey: ["/api/attestation/service-requests"],
  });

  const { data: companies } = useQuery<Company[]>({ queryKey: ["/api/companies"] });
  const { data: vendors } = useQuery<Vendor[]>({ queryKey: ["/api/attestation/vendors"] });

  const stats = useMemo(() => {
    if (!serviceRequests) return { total: 0, active: 0, completed: 0, cancelled: 0 };
    return {
      total: serviceRequests.length,
      active: serviceRequests.filter(sr => ["SentToVendor", "AcceptedByVendor", "InProgress"].includes(sr.status)).length,
      completed: serviceRequests.filter(sr => sr.status === "Completed").length,
      cancelled: serviceRequests.filter(sr => sr.status === "Cancelled").length,
    };
  }, [serviceRequests]);

  const filtered = useMemo(() => {
    if (!serviceRequests) return [];
    return serviceRequests.filter(sr => {
      const matchesStatus = statusFilter === "all" || sr.status === statusFilter;
      const matchesCompany = companyFilter === "all" || sr.companyId === companyFilter;
      const matchesVendor = vendorFilter === "all" || sr.vendorId === vendorFilter;
      const srDate = new Date(sr.createdAt);
      const matchesDateFrom = !dateFrom || srDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || srDate <= new Date(dateTo + "T23:59:59");
      const searchLower = search.toLowerCase();
      const matchesSearch = !search ||
        sr.externalWoNumber.toLowerCase().includes(searchLower) ||
        (sr.applicantName?.toLowerCase().includes(searchLower)) ||
        (sr.companyName?.toLowerCase().includes(searchLower)) ||
        (sr.vendorName?.toLowerCase().includes(searchLower)) ||
        (sr.serviceName?.toLowerCase().includes(searchLower));
      return matchesStatus && matchesCompany && matchesVendor && matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }, [serviceRequests, statusFilter, companyFilter, vendorFilter, dateFrom, dateTo, search]);

  const hasActiveFilters = statusFilter !== "all" || companyFilter !== "all" || vendorFilter !== "all" || !!dateFrom || !!dateTo || !!search;

  const clearFilters = () => {
    setStatusFilter("all");
    setCompanyFilter("all");
    setVendorFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="heading-attestation-sr">Attestation Service Requests</h1>
            <p className="text-sm text-muted-foreground">Manage attestation service requests for clients</p>
          </div>
          <Button onClick={() => navigate("/attestation-sr/new")} data-testid="button-new-sr">
            <Plus className="h-4 w-4 mr-2" />
            New SR
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard title="Total" value={stats.total} icon={<FileCheck className="h-4 w-4" />} />
          <StatCard title="Active" value={stats.active} icon={<Activity className="h-4 w-4" />} />
          <StatCard title="Completed" value={stats.completed} icon={<CheckCircle2 className="h-4 w-4" />} />
          <StatCard title="Cancelled" value={stats.cancelled} icon={<XCircle className="h-4 w-4" />} />
        </div>

        <div className="flex gap-2 flex-wrap items-end">
          <Input
            placeholder="Search by WO#, applicant, company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
            data-testid="input-search-sr"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" data-testid="select-status-filter">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(SR_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-44" data-testid="select-company-filter">
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="w-44" data-testid="select-vendor-filter">
              <SelectValue placeholder="All Vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors?.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-36 text-sm"
              data-testid="input-date-from"
              title="Created from"
            />
            <span className="text-muted-foreground text-sm">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-36 text-sm"
              data-testid="input-date-to"
              title="Created to"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              Clear filters
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileCheck className="h-8 w-8" />}
            title="No service requests found"
            description={hasActiveFilters ? "Try adjusting your filters." : "Create the first attestation service request."}
            action={
              <Button onClick={() => navigate("/attestation-sr/new")} data-testid="button-empty-new-sr">
                <Plus className="h-4 w-4 mr-2" />
                New SR
              </Button>
            }
          />
        ) : (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WO Number</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Fee (AED)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Custody</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(sr => (
                  <TableRow
                    key={sr.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/attestation-sr/${sr.id}`)}
                    data-testid={`row-sr-${sr.id}`}
                  >
                    <TableCell className="font-mono text-sm font-medium" data-testid={`text-wo-${sr.id}`}>
                      {sr.externalWoNumber}
                    </TableCell>
                    <TableCell data-testid={`text-applicant-${sr.id}`}>
                      {sr.applicantName || <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell data-testid={`text-company-${sr.id}`}>
                      {sr.companyName || <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell data-testid={`text-service-${sr.id}`}>
                      {sr.serviceName || <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-sm" data-testid={`text-doc-${sr.id}`} title={sr.documentNameDescription}>
                      {sr.documentNameDescription || <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell data-testid={`text-vendor-${sr.id}`}>
                      {sr.vendorName || <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium" data-testid={`fee-${sr.id}`}>
                      {sr.serviceFeeAed ? `${Number(sr.serviceFeeAed).toFixed(2)}` : <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${SR_STATUS_COLORS[sr.status] || ""}`} data-testid={`status-${sr.id}`}>
                        {SR_STATUS_LABELS[sr.status] || sr.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`custody-${sr.id}`}>
                      {CUSTODY_LABELS[sr.physicalCustodyStatus] || sr.physicalCustodyStatus}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`created-${sr.id}`}>
                      {new Date(sr.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <FloatingActionButton
        href="/attestation-sr/new"
        label="New SR"
        testId="fab-new-sr"
      />
    </AppLayout>
  );
}
