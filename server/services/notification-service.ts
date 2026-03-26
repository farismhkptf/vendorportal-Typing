import { storage } from "../storage";
import type { InsertStaffNotification, InsertVendorNotification } from "@shared/schema";

export async function notifyStaffByRoles(roles: string[], notification: Omit<InsertStaffNotification, 'userId'>) {
  try {
    const allUsers = await storage.getUsers();
    const staffUsers = allUsers.filter(u => u.active && roles.includes(u.role));
    for (const user of staffUsers) {
      await storage.createStaffNotification({
        ...notification,
        userId: user.id,
      });
    }
  } catch (error) {
    console.error("Failed to create staff notification:", error);
  }
}

export async function notifySingleUser(userId: string, notification: Omit<InsertStaffNotification, 'userId'>) {
  try {
    await storage.createStaffNotification({ ...notification, userId });
  } catch (error) {
    console.error("Failed to create single-user staff notification:", error);
  }
}

export async function notifyVendorUsers(vendorId: string, notification: Omit<InsertVendorNotification, 'vendorUserId' | 'vendorId'>) {
  try {
    const allUsers = await storage.getUsers();
    const vendorUsers = allUsers.filter(u => u.vendorId === vendorId && u.active);
    for (const user of vendorUsers) {
      await storage.createVendorNotification({
        ...notification,
        vendorUserId: user.id,
        vendorId: vendorId,
      });
    }
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}
