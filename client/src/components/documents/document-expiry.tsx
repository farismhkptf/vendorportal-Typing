import { AlertCircle, Clock } from "lucide-react";

export function getExpiryStatus(expiresAt: string | null | undefined, thresholdDays = 30): "expired" | "expiring" | "ok" | null {
  if (!expiresAt) return null;
  const now = new Date();
  const expiryDate = new Date(expiresAt);
  if (expiryDate <= now) return "expired";
  const thresholdDate = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);
  if (expiryDate <= thresholdDate) return "expiring";
  return "ok";
}

export function ExpiryBadge({ expiresAt, thresholdDays = 30 }: { expiresAt: string | null | undefined; thresholdDays?: number }) {
  const status = getExpiryStatus(expiresAt, thresholdDays);
  if (!status || status === "ok") return null;

  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400" data-testid="badge-expired">
        <AlertCircle className="h-3 w-3" />
        Expired
      </span>
    );
  }

  const daysLeft = Math.ceil((new Date(expiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" data-testid="badge-expiring-soon">
      <Clock className="h-3 w-3" />
      Expires in {daysLeft}d
    </span>
  );
}
