import type { WalletService } from "../wallet-service";
import type { NotificationPayload } from "../typing-job-machine";
import type multer from "multer";

export interface RouteDeps {
  walletService: WalletService;
  upload: multer.Multer;
  notifyVendorUsers: (vendorId: string, payload: NotificationPayload) => Promise<void>;
  notifyStaffByRoles: (roles: string[], payload: NotificationPayload) => Promise<void>;
  notifySingleUser: (userId: string, payload: NotificationPayload) => Promise<void>;
}
