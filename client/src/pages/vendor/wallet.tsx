import { useQuery } from "@tanstack/react-query";
import { Wallet, ArrowUpCircle, ArrowDownCircle, RotateCcw, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { VendorHeader } from "@/components/vendor-header";
import { formatDateTime } from "@/lib/format-date";

interface WalletTransaction {
  id: string;
  vendorId: string;
  entryType: "Topup" | "Debit" | "Reversal" | "Adjustment";
  typingJobId: string | null;
  amount: number;
  note: string | null;
  createdAt: string;
  jobInfo: {
    jobCode: string | null;
    woNumber: string | null;
    applicantName: string | null;
  } | null;
}

const ENTRY_TYPE_CONFIG: Record<string, { label: string; icon: typeof ArrowUpCircle; color: string }> = {
  Topup: { label: "Top Up", icon: ArrowUpCircle, color: "text-emerald-600 dark:text-emerald-400" },
  Debit: { label: "Deduction", icon: ArrowDownCircle, color: "text-red-600 dark:text-red-400" },
  Reversal: { label: "Reversal", icon: RotateCcw, color: "text-blue-600 dark:text-blue-400" },
  Adjustment: { label: "Adjustment", icon: Settings2, color: "text-amber-600 dark:text-amber-400" },
};

export default function VendorWallet() {
  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ["/api/vendor/wallet/balance"],
  });

  const { data: transactions, isLoading: txLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/vendor/wallet/transactions"],
  });

  return (
    <div className="min-h-screen bg-background">
      <VendorHeader />
      
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Wallet className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                {balanceLoading ? (
                  <Skeleton className="h-9 w-36 mt-1" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight" data-testid="text-wallet-balance">
                    AED {(balanceData?.balance || 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((tx) => {
                  const config = ENTRY_TYPE_CONFIG[tx.entryType] || ENTRY_TYPE_CONFIG.Adjustment;
                  const Icon = config.icon;
                  const isCredit = tx.entryType === "Topup" || tx.entryType === "Reversal";
                  
                  return (
                    <div 
                      key={tx.id} 
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
                      data-testid={`transaction-${tx.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={config.color}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{config.label}</Badge>
                            {tx.jobInfo?.woNumber && (
                              <span className="text-xs text-muted-foreground">
                                {tx.jobInfo.woNumber}
                                {tx.jobInfo.jobCode && ` (${tx.jobInfo.jobCode})`}
                              </span>
                            )}
                          </div>
                          {tx.note && (
                            <p className="text-xs text-muted-foreground mt-0.5">{tx.note}</p>
                          )}
                          {tx.jobInfo?.applicantName && (
                            <p className="text-xs text-muted-foreground">{tx.jobInfo.applicantName}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {isCredit ? "+" : "-"} AED {Math.abs(tx.amount).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.createdAt ? formatDateTime(tx.createdAt) : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Wallet className="h-5 w-5" />}
                title="No transactions"
                description="Your transaction history will appear here."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
