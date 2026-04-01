import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toProperCase } from "@/lib/proper-case";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ArrowRight,
  LayoutGrid,
  Search,
  Filter,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import type { VendorWalletLedger, Vendor } from "@shared/schema";

interface WalletSummary {
  balance: number;
  monthTopups: number;
  monthSpend: number;
  lowBalanceWarning: boolean;
}

interface LedgerEntryWithDetails extends VendorWalletLedger {
  typingJob?: {
    woNumber: string;
    applicantName: string;
  };
}

const topupSchema = z.object({
  amount: z.number().min(100, "Minimum top-up amount is AED 100").max(50000, "Maximum top-up amount is AED 50,000"),
  note: z.string().optional(),
});

type TopupForm = z.infer<typeof topupSchema>;

type ViewByOption = "none" | "type" | "date";

function LedgerEntry({ entry, index, getEntryIcon, getEntryColor }: {
  entry: LedgerEntryWithDetails;
  index: number;
  getEntryIcon: (type: string) => JSX.Element;
  getEntryColor: (type: string) => string;
}) {
  return (
    <div
      className="premium-card p-3 opacity-0 animate-fade-in"
      style={{ animationDelay: `${index * 0.03}s` }}
      data-testid={`ledger-entry-${entry.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
            {getEntryIcon(entry.entryType)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm text-foreground capitalize">{entry.entryType}</p>
              {entry.typingJob && (
                <Badge variant="secondary" className="text-xs rounded-full">{entry.typingJob.woNumber}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {entry.note || (entry.typingJob ? toProperCase(entry.typingJob.applicantName) : "—")}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("font-semibold text-sm", getEntryColor(entry.entryType))}>
            {entry.entryType === "Debit" ? "-" : "+"}AED {Math.abs(entry.amount).toLocaleString()}
          </p>
          <RelativeTime date={entry.createdAt} className="text-xs" id={entry.id} />
        </div>
      </div>
    </div>
  );
}

export default function VendorWallet() {
  const { user } = useAuth();
  const isCrm = user?.role === "Client Relationship Manager";
  const [topupOpen, setTopupOpen] = useState(false);
  const [viewBy, setViewBy] = useState<ViewByOption>("date");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>("all");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const { toast } = useToast();

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (!selectedVendorId && vendors.length > 0) {
      const defaultId = settings?.defaultVendorId;
      if (defaultId && vendors.some(v => v.id === defaultId)) {
        setSelectedVendorId(defaultId);
      } else {
        setSelectedVendorId(vendors[0].id);
      }
    }
  }, [vendors, settings, selectedVendorId]);

  const { data: summary, isLoading: summaryLoading } = useQuery<WalletSummary>({
    queryKey: ["/api/vendor-wallet/summary", selectedVendorId],
    queryFn: () => fetch(`/api/vendor-wallet/summary?vendorId=${selectedVendorId}`).then(r => r.json()),
    enabled: !!selectedVendorId,
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery<LedgerEntryWithDetails[]>({
    queryKey: ["/api/vendor-wallet/ledger", selectedVendorId],
    queryFn: () => fetch(`/api/vendor-wallet/ledger?vendorId=${selectedVendorId}`).then(r => r.json()),
    enabled: !!selectedVendorId,
  });

  const form = useForm<TopupForm>({
    resolver: zodResolver(topupSchema),
    defaultValues: {
      amount: 5000,
      note: "",
    },
  });

  const topupMutation = useMutation({
    mutationFn: async (data: TopupForm) => {
      return apiRequest("POST", "/api/vendor-wallet/topup", { ...data, vendorId: selectedVendorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-wallet/summary", selectedVendorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-wallet/ledger", selectedVendorId] });
      toast({
        title: "Top-up successful",
        description: `AED ${form.getValues("amount").toLocaleString()} has been added to the wallet.`,
      });
      setTopupOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process top-up",
        variant: "destructive",
      });
    },
  });

  const onSubmitTopup = (data: TopupForm) => {
    topupMutation.mutate(data);
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case "Topup":
        return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
      case "Debit":
        return <ArrowDownRight className="h-4 w-4 text-red-500" />;
      case "Reversal":
        return <RefreshCw className="h-4 w-4 text-amber-500" />;
      default:
        return <Wallet className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEntryColor = (type: string) => {
    switch (type) {
      case "Topup":
        return "text-emerald-600";
      case "Debit":
        return "text-red-500";
      case "Reversal":
        return "text-amber-500";
      default:
        return "text-foreground";
    }
  };

  const filteredLedger = useMemo(() => {
    if (!ledger) return [];
    return ledger.filter(entry => {
      if (ledgerTypeFilter !== "all" && entry.entryType !== ledgerTypeFilter) return false;
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase();
        const note = (entry.note || "").toLowerCase();
        const woNumber = (entry.typingJob?.woNumber || "").toLowerCase();
        const applicant = (entry.typingJob?.applicantName || "").toLowerCase();
        if (!note.includes(q) && !woNumber.includes(q) && !applicant.includes(q)) return false;
      }
      return true;
    });
  }, [ledger, ledgerSearch, ledgerTypeFilter]);

  const activeFilterCount = (ledgerTypeFilter !== "all" ? 1 : 0) + (ledgerSearch.trim() ? 1 : 0);

  const groupedLedger = useMemo(() => {
    if (!filteredLedger || filteredLedger.length === 0 || viewBy === "none") return null;
    
    const groups: Record<string, LedgerEntryWithDetails[]> = {};
    
    filteredLedger.forEach((entry) => {
      let key: string;
      if (viewBy === "type") {
        key = entry.entryType;
      } else if (viewBy === "date") {
        key = new Date(entry.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      } else {
        key = "All";
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    
    return Object.keys(groups).length > 0 ? groups : null;
  }, [filteredLedger, viewBy]);

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Vendor Wallet
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Vendor advance balance and transaction history</p>
            </div>
            <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
              <SelectTrigger className="w-[240px]" data-testid="select-vendor-wallet">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isCrm && (
            <Button size="sm" className="gap-1.5 lg:hidden" onClick={() => setTopupOpen(true)} data-testid="button-topup">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Top Up</span>
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-4">
        {/* Low Balance Alert */}
        {summary?.lowBalanceWarning && (
          <div 
            className="premium-card p-3 border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-r from-amber-50 to-amber-50/50 dark:from-amber-950/20 dark:to-amber-950/10 opacity-0 animate-fade-in"
            data-testid="alert-low-balance"
          >
            <div className="flex items-center gap-3">
              <div className="icon-container icon-container-sm !bg-amber-100 dark:!bg-amber-900/40 !text-amber-600 dark:!text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-amber-800 dark:text-amber-200">Low Balance - Top up to continue</p>
              </div>
              {!isCrm && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 rounded-lg"
                onClick={() => setTopupOpen(true)}
              >
                Top Up
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              )}
            </div>
          </div>
        )}

        {/* Desktop split-pane layout */}
        <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
          {/* Left pane: balance summary + stats + quick actions */}
          <div className="lg:w-[380px] lg:shrink-0 lg:sticky lg:top-4 space-y-4">
            {summaryLoading ? (
              <>
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </>
            ) : (
              <>
                {/* Balance highlight */}
                <div className="premium-card p-6 opacity-0 animate-fade-in animate-delay-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Current Balance</p>
                  <p className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
                    AED {(summary?.balance || 0).toLocaleString()}
                  </p>
                  {!isCrm && (
                    <div className="mt-5">
                      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full gap-2 rounded-xl" data-testid="button-topup-pane">
                            <Plus className="h-4 w-4" />
                            Top Up Wallet
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md rounded-2xl">
                          <DialogHeader>
                            <DialogTitle>Add Top-Up</DialogTitle>
                          </DialogHeader>
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmitTopup)} className="space-y-5">
                              <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Amount (AED)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        placeholder="5000"
                                        {...field}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                        className="rounded-xl"
                                        data-testid="input-topup-amount"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="note"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Note (Optional)</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Reference or note"
                                        {...field}
                                        className="rounded-xl"
                                        data-testid="input-topup-note"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="flex justify-end gap-3 pt-2">
                                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setTopupOpen(false)}>Cancel</Button>
                                <Button type="submit" className="rounded-xl" disabled={topupMutation.isPending} data-testid="button-confirm-topup">
                                  {topupMutation.isPending ? "Processing..." : "Add Top-Up"}
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    title="Month Top-ups"
                    value={`AED ${(summary?.monthTopups || 0).toLocaleString()}`}
                    icon={<TrendingUp className="h-4 w-4" />}
                    animationDelay={2}
                  />
                  <StatCard
                    title="Month Spend"
                    value={`AED ${(summary?.monthSpend || 0).toLocaleString()}`}
                    icon={<TrendingDown className="h-4 w-4" />}
                    animationDelay={3}
                  />
                </div>
              </>
            )}
          </div>

          {/* Right pane: scrollable transaction history */}
          <div className="flex-1 min-w-0 premium-card overflow-hidden flex flex-col lg:max-h-[calc(100vh-12rem)]" id="section-ledger">
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Transaction History
                  {filteredLedger.length !== (ledger?.length || 0) && (
                    <span className="ml-1.5 normal-case text-xs font-normal">
                      ({filteredLedger.length} of {ledger?.length || 0})
                    </span>
                  )}
                </h2>
                <Select value={viewBy} onValueChange={(v) => setViewBy(v as ViewByOption)}>
                  <SelectTrigger className="w-32 rounded-lg text-xs" data-testid="select-view-by">
                    <LayoutGrid className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="View by" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="type">By Type</SelectItem>
                    <SelectItem value="date">By Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by WO number, applicant, or note..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-ledger-search"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={ledgerTypeFilter} onValueChange={setLedgerTypeFilter}>
                    <SelectTrigger className="w-32 rounded-lg" data-testid="select-ledger-type-filter">
                      <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Topup">Top-ups</SelectItem>
                      <SelectItem value="Debit">Debits</SelectItem>
                      <SelectItem value="Reversal">Reversals</SelectItem>
                    </SelectContent>
                  </Select>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs text-muted-foreground"
                      onClick={() => { setLedgerSearch(""); setLedgerTypeFilter("all"); }}
                      data-testid="button-clear-ledger-filters"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                {ledgerLoading ? (
                  <>
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                  </>
                ) : groupedLedger ? (
                  Object.entries(groupedLedger).map(([groupKey, items]) => (
                    <div key={groupKey} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{groupKey}</h3>
                        <span className="text-xs text-muted-foreground">({items.length})</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((entry, index) => (
                          <LedgerEntry key={entry.id} entry={entry} index={index} getEntryIcon={getEntryIcon} getEntryColor={getEntryColor} />
                        ))}
                      </div>
                    </div>
                  ))
                ) : filteredLedger && filteredLedger.length > 0 ? (
                  <div className="space-y-2">
                    {filteredLedger.map((entry, index) => (
                      <LedgerEntry key={entry.id} entry={entry} index={index} getEntryIcon={getEntryIcon} getEntryColor={getEntryColor} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={activeFilterCount > 0 ? <Search className="h-6 w-6" /> : <Wallet className="h-6 w-6" />}
                    title={activeFilterCount > 0 ? "No matching transactions" : "No transactions yet"}
                    description={activeFilterCount > 0 ? "Try adjusting your search or filters." : "Add a top-up to get started with the vendor wallet."}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
