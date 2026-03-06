import { useQuery } from "@tanstack/react-query";
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, RotateCcw,
  Settings2, Shield, Stethoscope, CreditCard
} from "lucide-react";
import { formatDateTime } from "@/lib/format-date";
import { GlassCard, GlassSection, GlassSkeleton, GlassEmpty } from "@/components/vendor-v2/layout";

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

const ENTRY_ICONS: Record<string, { icon: typeof ArrowUpCircle; color: string; bg: string }> = {
  Topup: { icon: ArrowUpCircle, color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/15" },
  Debit: { icon: ArrowDownCircle, color: "text-red-500 dark:text-red-400", bg: "bg-red-500/15" },
  Reversal: { icon: RotateCcw, color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/15" },
  Adjustment: { icon: Settings2, color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/15" },
};

function groupByDate(transactions: WalletTransaction[]): { label: string; items: WalletTransaction[] }[] {
  const groups: Record<string, WalletTransaction[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const tx of transactions) {
    const d = new Date(tx.createdAt).toDateString();
    const label = d === today ? "Today" : d === yesterday ? "Yesterday" : new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export default function V2WalletPage() {
  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ["/api/vendor/wallet/balance"],
  });

  const { data: transactions, isLoading: txLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/vendor/wallet/transactions"],
  });

  const balance = balanceData?.balance || 0;
  const topups = transactions?.filter(t => t.entryType === "Topup" || t.entryType === "Reversal") || [];
  const debits = transactions?.filter(t => t.entryType === "Debit") || [];
  const totalIn = topups.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalOut = debits.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const grouped = transactions ? groupByDate(transactions) : [];

  if (balanceLoading) {
    return (
      <div className="max-w-2xl mx-auto pt-4 space-y-4">
        <GlassSkeleton className="h-40" />
        <GlassSkeleton className="h-16" />
        {[1, 2, 3].map(i => <GlassSkeleton key={i} className="h-16" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pt-2 pb-4">
      <GlassCard className="p-6 mb-6 text-center" data-testid="card-v2-balance">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
          <Wallet className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
        </div>
        <p className="text-slate-500 dark:text-white/50 text-sm mb-1">Available Balance</p>
        <p className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums" data-testid="text-v2-wallet-balance">
          {balance.toLocaleString()} <span className="text-lg font-normal text-slate-400 dark:text-white/40">AED</span>
        </p>

        <div className="flex items-center justify-center gap-6 mt-5">
          <div className="text-center" data-testid="stat-total-in">
            <div className="flex items-center gap-1.5 justify-center mb-0.5">
              <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              <span className="text-xs text-slate-400 dark:text-white/40">Received</span>
            </div>
            <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400 tabular-nums">{totalIn.toLocaleString()} AED</p>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-white/10" />
          <div className="text-center" data-testid="stat-total-out">
            <div className="flex items-center gap-1.5 justify-center mb-0.5">
              <ArrowDownCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
              <span className="text-xs text-slate-400 dark:text-white/40">Debited</span>
            </div>
            <p className="text-sm font-semibold text-red-500 dark:text-red-400 tabular-nums">{totalOut.toLocaleString()} AED</p>
          </div>
        </div>
      </GlassCard>

      <GlassSection title="Transactions">
        {txLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <GlassSkeleton key={i} className="h-16" />)}
          </div>
        ) : grouped.length > 0 ? (
          <div className="space-y-5">
            {grouped.map(group => (
              <div key={group.label}>
                <p className="text-[11px] font-medium text-slate-300 dark:text-white/30 uppercase tracking-wider mb-2">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map(tx => {
                    const config = ENTRY_ICONS[tx.entryType] || ENTRY_ICONS.Adjustment;
                    const Icon = config.icon;
                    const isCredit = tx.entryType === "Topup" || tx.entryType === "Reversal";

                    return (
                      <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" data-testid={`v2-transaction-${tx.id}`}>
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${config.bg}`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {tx.entryType === "Topup" ? "Top Up" : tx.entryType === "Debit" ? "Deduction" : tx.entryType}
                            </span>
                            {tx.jobInfo?.woNumber && (
                              <span className="text-[11px] text-slate-400 dark:text-white/30">{tx.jobInfo.woNumber}</span>
                            )}
                            {tx.jobInfo?.jobCategory && (
                              <span className={`v2-status-badge text-[10px] ${tx.jobInfo.jobCategory === "EID" ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30" : "bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30"}`}>
                                {tx.jobInfo.jobCategory}
                              </span>
                            )}
                          </div>
                          {(tx.note || tx.jobInfo?.applicantName) && (
                            <p className="text-xs text-slate-400 dark:text-white/30 truncate">{tx.note || tx.jobInfo?.applicantName}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold tabular-nums ${isCredit ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                            {isCredit ? "+" : "-"} {Math.abs(tx.amount).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-slate-300 dark:text-white/20">
                            {new Date(tx.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <GlassEmpty
            icon={<CreditCard className="h-8 w-8" />}
            title="No transactions yet"
            description="Your wallet history will appear here"
          />
        )}
      </GlassSection>
    </div>
  );
}
