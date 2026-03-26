import type { IStorage } from "./storage";
import type { VendorWalletLedger } from "@shared/schema";

export interface WalletTopupParams {
  vendorId: string;
  amount: number;
  note?: string;
  createdBy?: string;
}

export interface WalletDebitParams {
  vendorId: string;
  amount: number;
  typingJobId?: string;
  jobCode?: string;
  note?: string;
  createdBy?: string;
}

export interface WalletSummary {
  balance: number;
  monthTopups: number;
  monthSpend: number;
  lowBalanceWarning: boolean;
}

export class WalletService {
  constructor(
    private storage: IStorage,
    private notifyVendorUsers: (vendorId: string, notification: { type: string; title: string; message: string; relatedJobId?: string }) => Promise<void>
  ) {}

  async getBalance(vendorId: string): Promise<number> {
    return this.storage.getWalletBalance(vendorId);
  }

  async getLedger(vendorId: string): Promise<VendorWalletLedger[]> {
    return this.storage.getWalletLedger(vendorId);
  }

  async getSummary(vendorId: string, lowBalanceThreshold = 1000): Promise<WalletSummary> {
    const balance = await this.storage.getWalletBalance(vendorId);
    const monthlyStats = await this.storage.getMonthlyStats(vendorId);

    return {
      balance,
      monthTopups: monthlyStats.topups,
      monthSpend: monthlyStats.spend,
      lowBalanceWarning: balance < lowBalanceThreshold,
    };
  }

  async topup(params: WalletTopupParams): Promise<VendorWalletLedger> {
    const { vendorId, amount, note, createdBy } = params;

    const entry = await this.storage.createWalletEntry({
      vendorId,
      entryType: "Topup",
      amount,
      note: note || "Manual top-up",
      createdBy,
    });

    await this.storage.createAuditLog({
      entityType: "VendorWallet",
      entityId: vendorId,
      action: "wallet_topup",
      details: { amount, note },
    });

    try {
      await this.notifyVendorUsers(vendorId, {
        type: "wallet_topup",
        title: "Wallet Top-Up",
        message: `Your wallet has been topped up with AED ${amount}.`,
      });
    } catch (err) {
      console.error("Failed to notify vendor about topup:", err);
    }

    return entry;
  }

  async debit(params: WalletDebitParams): Promise<VendorWalletLedger> {
    const { vendorId, amount, typingJobId, jobCode, note, createdBy } = params;

    const debitAmount = amount > 0 ? -amount : amount;

    const entry = await this.storage.createWalletEntry({
      vendorId,
      entryType: "Debit",
      typingJobId,
      amount: debitAmount,
      note: note || `Job completed - deduction for ${jobCode || typingJobId || "unknown"}`,
      createdBy,
    });

    await this.storage.createAuditLog({
      entityType: "VendorWallet",
      entityId: vendorId,
      action: "wallet_deduction",
      details: { amount: Math.abs(debitAmount), typingJobId, jobCode },
    });

    try {
      await this.notifyVendorUsers(vendorId, {
        type: "wallet_deduction",
        title: "Wallet Deduction",
        message: `AED ${Math.abs(debitAmount)} deducted for completing job ${jobCode || typingJobId || "unknown"}.`,
      });
    } catch (err) {
      console.error("Failed to notify vendor about deduction:", err);
    }

    return entry;
  }

  async getMonthlyStats(vendorId: string): Promise<{ topups: number; spend: number }> {
    return this.storage.getMonthlyStats(vendorId);
  }
}
