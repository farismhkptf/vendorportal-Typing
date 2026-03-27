import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Plus, FileText, Building2, Calendar, CheckCircle2, XCircle,
  Clock, ChevronRight, Filter, Search, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { queryClient } from "@/lib/queryClient";
import { formatRelativeTime } from "@/lib/format-date";

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  QuoteReceived: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  Converted: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

interface InquiryRow {
  id: string;
  companyId: string;
  companyName: string | null;
  vendorId: string;
  vendorName: string | null;
  documentType: string;
  documentClass: string;
  status: string;
  createdAt: string;
  latestQuote: { amountAed: number; timelineDays: number } | null;
  externalWoNumber: string | null;
}

export default function AttestationInquiriesPage() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: inquiries = [], isLoading, refetch } = useQuery<InquiryRow[]>({
    queryKey: ["/api/attestation/inquiries", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/attestation/inquiries?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load inquiries");
      return res.json();
    },
  });

  const filtered = inquiries.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.companyName?.toLowerCase().includes(q) ||
      i.documentType.toLowerCase().includes(q) ||
      i.vendorName?.toLowerCase().includes(q)
    );
  });

  const statusCounts = {
    Open: inquiries.filter(i => i.status === "Open").length,
    QuoteReceived: inquiries.filter(i => i.status === "QuoteReceived").length,
    Accepted: inquiries.filter(i => i.status === "Accepted").length,
    Rejected: inquiries.filter(i => i.status === "Rejected").length,
    Converted: inquiries.filter(i => i.status === "Converted").length,
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-inquiries">Attestation Inquiries</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage attestation service inquiries and vendor quotes</p>
          </div>
          <Button onClick={() => setLocation("/attestation/inquiries/new")} data-testid="button-new-inquiry">
            <Plus className="h-4 w-4 mr-2" />
            New Inquiry
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["Open", "QuoteReceived", "Accepted", "Rejected", "Converted"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={`text-left p-3 rounded-xl border transition-all ${statusFilter === s ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              data-testid={`filter-status-${s.toLowerCase()}`}
            >
              <p className="text-lg font-bold text-foreground">{statusCounts[s]}</p>
              <p className="text-xs text-muted-foreground">{s === "QuoteReceived" ? "Quote Received" : s}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search company, document, vendor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-inquiries"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" data-testid="select-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="QuoteReceived">Quote Received</SelectItem>
              <SelectItem value="Accepted">Accepted</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="Converted">Converted</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-inquiries">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card animate-pulse">
                <div className="h-10 w-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-muted rounded" />
                  <div className="h-3 w-32 bg-muted rounded" />
                </div>
                <div className="h-6 w-20 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">No inquiries found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try adjusting your search" : "Create a new inquiry to get started"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setLocation("/attestation/inquiries/new")} data-testid="button-empty-new-inquiry">
                <Plus className="h-4 w-4 mr-2" />
                New Inquiry
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(inquiry => (
              <Link key={inquiry.id} href={`/attestation/inquiries/${inquiry.id}`}>
                <div
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  data-testid={`inquiry-row-${inquiry.id}`}
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground text-sm truncate">{inquiry.documentType}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{inquiry.documentClass}</span>
                      {inquiry.externalWoNumber && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs font-mono text-muted-foreground">{inquiry.externalWoNumber}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {inquiry.companyName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{inquiry.companyName}
                        </span>
                      )}
                      {inquiry.vendorName && (
                        <span className="text-xs text-muted-foreground">· {inquiry.vendorName}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inquiry.status] || ""}`}>
                      {inquiry.status === "QuoteReceived" ? "Quote Received" : inquiry.status}
                    </span>
                    {inquiry.latestQuote && (
                      <p className="text-xs text-muted-foreground">{inquiry.latestQuote.amountAed.toLocaleString()} AED</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
                    {formatRelativeTime(inquiry.createdAt)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
