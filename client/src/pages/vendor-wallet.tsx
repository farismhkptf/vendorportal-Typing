import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Plus,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
import type { VendorWalletLedger } from "@shared/schema";

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

export default function VendorWallet() {
  const [topupOpen, setTopupOpen] = useState(false);
  const { toast } = useToast();

  const { data: summary, isLoading: summaryLoading } = useQuery<WalletSummary>({
    queryKey: ["/api/vendor-wallet/summary"],
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery<LedgerEntryWithDetails[]>({
    queryKey: ["/api/vendor-wallet/ledger"],
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
      return apiRequest("POST", "/api/vendor-wallet/topup", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-wallet"] });
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

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="px-6 lg:px-10 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
              Vendor Wallet
            </h1>
            <p className="text-muted-foreground">
              Manage vendor advance payments and track spending
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 rounded-xl h-11" data-testid="button-export">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 rounded-xl h-11 px-5" data-testid="button-topup">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Top Up</span>
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
                              className="h-12 rounded-xl"
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
                              className="h-12 rounded-xl"
                              data-testid="input-topup-note"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setTopupOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="rounded-xl"
                        disabled={topupMutation.isPending}
                        data-testid="button-confirm-topup"
                      >
                        {topupMutation.isPending ? "Processing..." : "Add Top-Up"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-10 pb-10 space-y-8">
        {/* Low Balance Alert */}
        {summary?.lowBalanceWarning && (
          <div 
            className="premium-card p-5 border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 opacity-0 animate-fade-in"
            data-testid="alert-low-balance"
          >
            <div className="flex items-center gap-4">
              <div className="icon-container icon-container-md !bg-amber-100 dark:!bg-amber-900/40 !text-amber-600 dark:!text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-amber-800 dark:text-amber-200">Low Balance Warning</p>
                <p className="text-sm text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                  Wallet balance is below AED 1,000. Top up to continue vendor services.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 rounded-xl"
                onClick={() => setTopupOpen(true)}
              >
                Top Up
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4 lg:gap-5">
          {summaryLoading ? (
            <>
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </>
          ) : (
            <>
              <StatCard
                title="Current Balance"
                value={`AED ${(summary?.balance || 0).toLocaleString()}`}
                icon={<Wallet className="h-5 w-5" />}
                animationDelay={1}
              />
              <StatCard
                title="This Month Top-ups"
                value={`AED ${(summary?.monthTopups || 0).toLocaleString()}`}
                icon={<TrendingUp className="h-5 w-5" />}
                animationDelay={2}
              />
              <StatCard
                title="This Month Spend"
                value={`AED ${(summary?.monthSpend || 0).toLocaleString()}`}
                icon={<TrendingDown className="h-5 w-5" />}
                animationDelay={3}
              />
            </>
          )}
        </div>

        {/* Ledger */}
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-foreground">Transaction Ledger</h2>
          <div className="space-y-3">
            {ledgerLoading ? (
              <>
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </>
            ) : ledger && ledger.length > 0 ? (
              ledger.map((entry, index) => (
                <div
                  key={entry.id}
                  className="premium-card p-4 opacity-0 animate-fade-in"
                  style={{ animationDelay: `${0.3 + index * 0.05}s` }}
                  data-testid={`ledger-entry-${entry.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center">
                        {getEntryIcon(entry.entryType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground capitalize">
                            {entry.entryType}
                          </p>
                          {entry.typingJob && (
                            <Badge variant="secondary" className="text-xs rounded-full">
                              {entry.typingJob.woNumber}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.note || (entry.typingJob ? entry.typingJob.applicantName : "—")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-semibold", getEntryColor(entry.entryType))}>
                        {entry.entryType === "Debit" ? "-" : "+"}AED {Math.abs(entry.amount).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3" />
                        {new Date(entry.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Wallet className="h-6 w-6" />}
                title="No transactions yet"
                description="Add a top-up to get started with the vendor wallet."
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
