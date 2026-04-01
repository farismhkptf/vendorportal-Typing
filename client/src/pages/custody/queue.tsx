import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { 
  Plus, Package, ArrowRight, Filter, X, Building2, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Company } from "@shared/schema";
import { 
  CUSTODY_DOC_CATEGORY_LABELS, CUSTODY_DOC_SUBTYPE_LABELS, CUSTODY_DOC_STAGE_LABELS,
  CUSTODY_DOC_SUBTYPES_BY_CATEGORY
} from "@shared/schema";

interface CustodyRecord {
  id: string;
  referenceNumber: string;
  companyId: string;
  companyName: string | null;
  woId: string | null;
  srId: string | null;
  docCategory: string;
  docSubtype: string;
  docCustomName: string | null;
  custodyStage: string;
  notifyEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STAGE_COLORS: Record<string, string> = {
  WithClient: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  WithUs: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  WithVendor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ReturnedToClient: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

function getDocLabel(record: CustodyRecord): string {
  if (record.docSubtype === "Other" && record.docCustomName) return record.docCustomName;
  return CUSTODY_DOC_SUBTYPE_LABELS[record.docSubtype] || record.docSubtype;
}

function RecordRow({ record }: { record: CustodyRecord }) {
  const stageColor = STAGE_COLORS[record.custodyStage] || "";
  const stageLabel = CUSTODY_DOC_STAGE_LABELS[record.custodyStage] || record.custodyStage;
  const categoryLabel = CUSTODY_DOC_CATEGORY_LABELS[record.docCategory] || record.docCategory;
  const docLabel = getDocLabel(record);
  const isOverdue = (record.custodyStage === "WithUs" || record.custodyStage === "WithVendor")
    && (Date.now() - new Date(record.updatedAt).getTime()) > 14 * 24 * 60 * 60 * 1000;

  return (
    <Link href={`/custody/${record.id}`}>
      <div
        className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow cursor-pointer"
        data-testid={`custody-record-${record.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs text-muted-foreground" data-testid={`text-ref-${record.id}`}>
              {record.referenceNumber}
            </span>
            {isOverdue && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> Overdue
              </span>
            )}
          </div>
          <p className="font-semibold text-foreground truncate" data-testid={`text-doc-${record.id}`}>{docLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{categoryLabel}</p>
          {record.companyName && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate" data-testid={`text-company-${record.id}`}>{record.companyName}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", stageColor)} data-testid={`status-${record.id}`}>
            {stageLabel}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}

interface NewRecordFormProps {
  companies: Company[];
  onClose: () => void;
  prefilledWoId?: string;
  prefilledCompanyId?: string;
}

function NewRecordForm({ companies, onClose, prefilledWoId, prefilledCompanyId }: NewRecordFormProps) {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState(prefilledCompanyId || "");
  const [woId, setWoId] = useState(prefilledWoId || "");
  const [docCategory, setDocCategory] = useState("");
  const [docSubtype, setDocSubtype] = useState("");
  const [docCustomName, setDocCustomName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notes, setNotes] = useState("");

  const availableSubtypes = docCategory ? CUSTODY_DOC_SUBTYPES_BY_CATEGORY[docCategory] || [] : [];

  const createMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/custody/records", {
        companyId,
        woId: woId || null,
        docCategory,
        docSubtype,
        docCustomName: docSubtype === "Other" ? docCustomName : null,
        notifyEmail: notifyEmail || null,
        notes: notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custody/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custody/records/summary"] });
      toast({ title: "Custody record created" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to create record", variant: "destructive" });
    },
  });

  const canSubmit = companyId && docCategory && docSubtype && (docSubtype !== "Other" || docCustomName);

  return (
    <div className="space-y-4" data-testid="new-custody-form">
      <div>
        <Label htmlFor="select-company">Company *</Label>
        <Select value={companyId} onValueChange={setCompanyId} disabled={!!prefilledCompanyId}>
          <SelectTrigger id="select-company" className="mt-1" data-testid="select-company">
            <SelectValue placeholder="Select company" />
          </SelectTrigger>
          <SelectContent>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id} data-testid={`option-company-${c.id}`}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="input-wo-id">Work Order ID (optional)</Label>
        <Input
          id="input-wo-id"
          value={woId}
          onChange={e => setWoId(e.target.value)}
          placeholder="Linked work order ID"
          className="mt-1"
          data-testid="input-wo-id"
          disabled={!!prefilledWoId}
        />
      </div>

      <div>
        <Label htmlFor="select-doc-category">Document Category *</Label>
        <Select value={docCategory} onValueChange={v => { setDocCategory(v); setDocSubtype(""); }}>
          <SelectTrigger id="select-doc-category" className="mt-1" data-testid="select-doc-category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CUSTODY_DOC_CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k} data-testid={`option-category-${k}`}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {docCategory && (
        <div>
          <Label htmlFor="select-doc-subtype">Document Type *</Label>
          <Select value={docSubtype} onValueChange={setDocSubtype}>
            <SelectTrigger id="select-doc-subtype" className="mt-1" data-testid="select-doc-subtype">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {availableSubtypes.map(s => (
                <SelectItem key={s} value={s} data-testid={`option-subtype-${s}`}>{CUSTODY_DOC_SUBTYPE_LABELS[s] || s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {docSubtype === "Other" && (
        <div>
          <Label htmlFor="input-custom-name">Custom Document Name *</Label>
          <Input
            id="input-custom-name"
            value={docCustomName}
            onChange={e => setDocCustomName(e.target.value)}
            placeholder="Describe the document"
            className="mt-1"
            data-testid="input-custom-name"
          />
        </div>
      )}

      <div>
        <Label htmlFor="input-notify-email">Client Notification Email</Label>
        <Input
          id="input-notify-email"
          type="email"
          value={notifyEmail}
          onChange={e => setNotifyEmail(e.target.value)}
          placeholder="client@company.com"
          className="mt-1"
          data-testid="input-notify-email"
        />
        <p className="text-xs text-muted-foreground mt-1">Automated emails will be sent when document is collected and returned.</p>
      </div>

      <div>
        <Label htmlFor="textarea-notes">Notes (optional)</Label>
        <Textarea
          id="textarea-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional notes"
          rows={2}
          className="mt-1"
          data-testid="textarea-notes"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1" data-testid="button-cancel-new-record">Cancel</Button>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!canSubmit || createMutation.isPending}
          className="flex-1"
          data-testid="button-create-record"
        >
          {createMutation.isPending ? "Creating..." : "Create Record"}
        </Button>
      </div>
    </div>
  );
}

export default function CustodyQueuePage() {
  const { user } = useAuth();
  const [showNewForm, setShowNewForm] = useState(false);
  const [filterStage, setFilterStage] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDocSubtype, setFilterDocSubtype] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const buildParams = () => {
    const p = new URLSearchParams();
    if (filterStage !== "all") p.set("custodyStage", filterStage);
    if (filterCategory !== "all") p.set("docCategory", filterCategory);
    if (filterCompany !== "all") p.set("companyId", filterCompany);
    if (filterDateFrom) p.set("dateFrom", filterDateFrom);
    if (filterDateTo) p.set("dateTo", filterDateTo);
    return p.toString();
  };

  const { data: records, isLoading } = useQuery<CustodyRecord[]>({
    queryKey: ["/api/custody/records", filterStage, filterCategory, filterCompany, filterDateFrom, filterDateTo],
    queryFn: async () => {
      const params = buildParams();
      const res = await fetch(`/api/custody/records${params ? `?${params}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: summary } = useQuery<{ withUs: number; withVendor: number; returnedThisMonth: number; overdue: number }>({
    queryKey: ["/api/custody/records/summary"],
  });

  const { data: companies } = useQuery<Company[]>({ queryKey: ["/api/companies"] });

  const hasFilters = filterStage !== "all" || filterCategory !== "all" || filterCompany !== "all" || !!filterDateFrom || !!filterDateTo;

  // Filter docsubtype client-side (it's a subordinate of category)
  const displayedRecords = filterDocSubtype !== "all"
    ? (records || []).filter(r => r.docSubtype === filterDocSubtype)
    : (records || []);

  const stageCounts = records ? {
    WithClient: records.filter(r => r.custodyStage === "WithClient").length,
    WithUs: records.filter(r => r.custodyStage === "WithUs").length,
    WithVendor: records.filter(r => r.custodyStage === "WithVendor").length,
    ReturnedToClient: records.filter(r => r.custodyStage === "ReturnedToClient").length,
  } : null;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-page-title">
              Document Custody
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track original documents from receipt to return</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(f => !f)}
              className={cn("gap-2", hasFilters && "border-primary text-primary")}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setShowNewForm(true)} data-testid="button-new-record">
              <Plus className="h-4 w-4" />
              New Record
            </Button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="px-4 lg:px-6 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 p-3" data-testid="summary-with-us">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">With Us</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{summary.withUs}</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-3" data-testid="summary-with-vendor">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">With Vendor</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{summary.withVendor}</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-3" data-testid="summary-overdue">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Overdue</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{summary.overdue}</p>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 p-3" data-testid="summary-returned">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">Returned (this month)</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{summary.returnedThisMonth}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="px-4 lg:px-6 pb-4">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filterStage} onValueChange={setFilterStage}>
                  <SelectTrigger className="mt-1" data-testid="filter-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {Object.entries(CUSTODY_DOC_STAGE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Document Category</Label>
                <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setFilterDocSubtype("all"); }}>
                  <SelectTrigger className="mt-1" data-testid="filter-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(CUSTODY_DOC_CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Document Type</Label>
                <Select value={filterDocSubtype} onValueChange={setFilterDocSubtype} disabled={filterCategory === "all"}>
                  <SelectTrigger className="mt-1" data-testid="filter-doc-subtype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {(filterCategory !== "all" ? (CUSTODY_DOC_SUBTYPES_BY_CATEGORY[filterCategory] || []) : Object.keys(CUSTODY_DOC_SUBTYPE_LABELS)).map(s => (
                      <SelectItem key={s} value={s}>{CUSTODY_DOC_SUBTYPE_LABELS[s] || s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Company</Label>
                <Select value={filterCompany} onValueChange={setFilterCompany}>
                  <SelectTrigger className="mt-1" data-testid="filter-company">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">From Date</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="mt-1"
                  data-testid="filter-date-from"
                />
              </div>
              <div>
                <Label className="text-xs">To Date</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="mt-1"
                  data-testid="filter-date-to"
                />
              </div>
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs gap-1.5"
                onClick={() => { setFilterStage("all"); setFilterCategory("all"); setFilterCompany("all"); setFilterDocSubtype("all"); setFilterDateFrom(""); setFilterDateTo(""); }}
                data-testid="button-clear-filters"
              >
                <X className="h-3 w-3" /> Clear filters
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Stage counts bar */}
      {stageCounts && !isLoading && (
        <div className="px-4 lg:px-6 pb-3 flex items-center gap-3 text-xs flex-wrap">
          {Object.entries(CUSTODY_DOC_STAGE_LABELS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setFilterStage(filterStage === k ? "all" : k)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors",
                filterStage === k
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-muted-foreground hover:border-border/80"
              )}
              data-testid={`stage-tab-${k}`}
            >
              {v}
              <span className="font-semibold">{stageCounts[k as keyof typeof stageCounts]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Records list */}
      <div className="px-4 lg:px-6 pb-8">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : displayedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4" data-testid="empty-state">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No custody records</p>
              <p className="text-sm text-muted-foreground mt-1">
                {hasFilters ? "Try adjusting your filters" : "Create a new record to start tracking documents"}
              </p>
            </div>
            {!hasFilters && (
              <Button onClick={() => setShowNewForm(true)} data-testid="button-create-first">
                <Plus className="h-4 w-4 mr-2" /> Create First Record
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {displayedRecords.map(r => <RecordRow key={r.id} record={r} />)}
          </div>
        )}
      </div>

      {/* New Record Dialog */}
      <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-new-record">
          <DialogHeader>
            <DialogTitle>New Custody Record</DialogTitle>
          </DialogHeader>
          <NewRecordForm
            companies={companies || []}
            onClose={() => setShowNewForm(false)}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
