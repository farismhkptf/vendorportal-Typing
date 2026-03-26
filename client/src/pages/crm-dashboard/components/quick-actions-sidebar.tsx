import { Link } from "wouter";
import {
  Building2, FileText, Calendar, Wallet, ArrowRight, ChevronRight,
  Zap, Briefcase, Inbox, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Vendor, DashStats } from "./types";

interface VendorTypingStat {
  vendor: Vendor;
  pending: number;
}

interface QuickActionsSidebarProps {
  companiesCount: number;
  walletBalance: number;
  isAdmin: boolean;
  pendingDeletionCount: number;
  vendorTypingStats: VendorTypingStat[];
}

export function QuickActionsSidebar({ companiesCount, walletBalance, isAdmin, pendingDeletionCount, vendorTypingStats }: QuickActionsSidebarProps) {
  return (
    <div className="space-y-4 opacity-0 animate-fade-in animate-delay-3">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground tracking-tight">Quick Actions</h2>
        </div>
        <div className="space-y-2">
          <Link href="/work-orders/new">
            <div className="premium-card p-3 cursor-pointer hover-elevate flex items-center gap-3" data-testid="quick-action-new-wo">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-primary" /></div>
              <div className="min-w-0"><p className="text-sm font-medium text-foreground">New Work Order</p><p className="text-xs text-muted-foreground">Create for a client</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0" />
            </div>
          </Link>
          <Link href="/appointments">
            <div className="premium-card p-3 cursor-pointer hover-elevate flex items-center gap-3" data-testid="quick-action-appointments">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0"><Calendar className="h-4 w-4 text-blue-600" /></div>
              <div className="min-w-0"><p className="text-sm font-medium text-foreground">Appointments</p><p className="text-xs text-muted-foreground">Schedule & manage</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0" />
            </div>
          </Link>
          <Link href="/companies">
            <div className="premium-card p-3 cursor-pointer hover-elevate flex items-center gap-3" data-testid="quick-action-companies">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-emerald-600" /></div>
              <div className="min-w-0"><p className="text-sm font-medium text-foreground">Companies</p><p className="text-xs text-muted-foreground">{companiesCount} total</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0" />
            </div>
          </Link>
          <Link href="/vendor-wallet">
            <div className="premium-card p-3 cursor-pointer hover-elevate flex items-center gap-3" data-testid="quick-action-wallet">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"><Wallet className="h-4 w-4 text-amber-600" /></div>
              <div className="min-w-0"><p className="text-sm font-medium text-foreground">Vendor Wallet</p><p className="text-xs text-muted-foreground">AED {walletBalance.toLocaleString()}</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0" />
            </div>
          </Link>
        </div>
      </div>

      {isAdmin && pendingDeletionCount > 0 && (
        <div className="premium-card p-4 border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
          <div className="flex items-center gap-2 mb-2">
            <Inbox className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-foreground">Deletion Requests</span>
            <Badge className="text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0">
              {pendingDeletionCount} pending
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Awaiting your review in Admin panel.</p>
          <Link href="/admin?tab=deletionrequests">
            <Button variant="outline" size="sm" className="w-full rounded-lg text-xs gap-1.5" data-testid="link-deletion-requests">
              Review Requests
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">Vendor Health</h2>
          </div>
          <Link href="/vendor-wallet">
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" data-testid="link-vendor-wallet">
              Wallet
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className={cn(
          "premium-card p-3 mb-2 flex items-center justify-between gap-2",
          walletBalance < 1000 && "border-red-200/50 bg-red-50/30 dark:bg-red-950/10"
        )} data-testid="card-wallet-balance">
          <div>
            <p className="text-xs text-muted-foreground">Vendor Wallet Balance</p>
            <p className={cn(
              "text-lg font-bold",
              walletBalance < 1000 ? "text-red-600 dark:text-red-400" : "text-foreground"
            )} data-testid="text-vendor-wallet-balance">
              AED {walletBalance.toLocaleString()}
            </p>
          </div>
          {walletBalance < 1000 && (
            <Badge variant="destructive" className="text-xs shrink-0">
              <AlertTriangle className="h-2.5 w-2.5 mr-1" />
              Low Balance
            </Badge>
          )}
        </div>
        {vendorTypingStats.length > 0 ? (
          <div className="space-y-2">
            {vendorTypingStats.map(({ vendor, pending }) => (
              <div key={vendor.id} className="premium-card p-3 flex items-center justify-between gap-3" data-testid={`card-vendor-health-${vendor.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{vendor.name}</p>
                  <p className="text-xs text-muted-foreground">Active vendor</p>
                </div>
                <Badge variant={pending >= 5 ? "destructive" : "secondary"} className="text-xs shrink-0" data-testid={`badge-vendor-pending-${vendor.id}`}>
                  {pending} pending
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">No pending jobs at vendors</p>
        )}
      </div>
    </div>
  );
}
