import { useQuery } from "@tanstack/react-query";
import { CreditCard, ArrowUpCircle, ArrowDownCircle, RotateCcw, Settings2, Shield, Stethoscope } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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
    jobCategory: string | null;
  } | null;
}

const ENTRY_TYPE_CONFIG: Record<string, { label: string; icon: typeof ArrowUpCircle; color: string; bg: string }> = {
  Topup: { label: "Top Up", icon: ArrowUpCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  Debit: { label: "Deduction", icon: ArrowDownCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  Reversal: { label: "Reversal", icon: RotateCcw, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  Adjustment: { label: "Adjustment", icon: Settings2, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
};

export default function VendorWallet() {
  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ["/api/vendor/wallet/balance"],
  });

  const { data: transactions, isLoading: txLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/vendor/wallet/transactions"],
  });

  const topups = transactions?.filter(t => t.entryType === "Topup" || t.entryType === "Reversal") || [];
  const debits = transactions?.filter(t => t.entryType === "Debit") || [];
  const totalIn = topups.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalOut = debits.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-wallet">Wallet</h1>
          <p className="text-sm text-muted-foreground">Balance & transaction history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="sm:col-span-1" data-testid="card-balance">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Available Balance</p>
            {balanceLoading ? (
              <Skeleton className="h-10 w-36" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-wallet-balance">
                AED {(balanceData?.balance || 0).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-total-in">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Total Received</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              AED {totalIn.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-out">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Total Debited</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              AED {totalOut.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Transaction History</h2>

        {txLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
          </div>
        ) : transactions && transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const config = ENTRY_TYPE_CONFIG[tx.entryType] || ENTRY_TYPE_CONFIG.Adjustment;
              const Icon = config.icon;
              const isCredit = tx.entryType === "Topup" || tx.entryType === "Reversal";

              return (
                <Card key={tx.id} data-testid={`transaction-${tx.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${config.bg}`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{config.label}</Badge>
                            {tx.jobInfo?.woNumber && (
                              <span className="text-xs text-muted-foreground">
                                {tx.jobInfo.woNumber}
                                {tx.jobInfo.jobCode && ` (${tx.jobInfo.jobCode})`}
                              </span>
                            )}
                            {tx.jobInfo?.jobCategory && (
                              <Badge variant="secondary" className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${tx.jobInfo.jobCategory === "EID" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"}`}>
                                {tx.jobInfo.jobCategory === "EID" ? "EID" : "Medical"}
                              </Badge>
                            )}
                          </div>
                          {tx.note && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{tx.note}</p>
                          )}
                          {tx.jobInfo?.applicantName && (
                            <p className="text-xs text-muted-foreground truncate">{tx.jobInfo.applicantName}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} data-testid={`text-amount-${tx.id}`}>
                          {isCredit ? "+" : "-"} AED {Math.abs(tx.amount).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tx.createdAt ? formatDateTime(tx.createdAt) : ""}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8">
              <EmptyState
                icon={<CreditCard className="h-5 w-5" />}
                title="No transactions"
                description="Your transaction history will appear here."
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
