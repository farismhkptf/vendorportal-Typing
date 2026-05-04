import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import UAParser from "ua-parser-js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { loginSchema, ROLE_CATEGORIES } from "@shared/schema";
import { requireAuth, requireRole, requireOpsRole, loginRateLimit, recordFailedLogin, clearFailedLogins } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { hashApiKey } from "../external-routes";
import { sendEmail } from "../email-service";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Issue a JWT signed with SHARED_JWT_SECRET for the given user.
// Returns null if the shared secret is not configured.
function issueSharedJwt(user: { id: string; email: string | null; role: string; name: string }): string | null {
  const secret = process.env.SHARED_JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(
    { sub: user.email || user.id, email: user.email, role: user.role, name: user.name },
    secret,
    { expiresIn: "8h" }
  );
}

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/accounts", async (req, res) => {
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const isProduction = process.env.NODE_ENV === 'production';
    const quickLoginEnabled = process.env.ENABLE_QUICK_LOGIN === 'true';
    const allowed = !isProduction && quickLoginEnabled;
    console.log(`[quick-login] accounts endpoint accessed — ts=${new Date().toISOString()} ip=${clientIp} NODE_ENV=${process.env.NODE_ENV || 'unset'} ENABLE_QUICK_LOGIN=${process.env.ENABLE_QUICK_LOGIN || 'unset'} outcome=${allowed ? 'allowed' : 'denied'}`);
    if (!allowed) {
      return res.status(403).json({ message: "This endpoint is disabled" });
    }
    try {
      const allUsers = await storage.getUsers();
      const accounts = allUsers
        .filter(u => u.active)
        .map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
      res.json(accounts);
    } catch (error) {
      console.error("Fetch accounts error:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  const quickLoginSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
  });

  app.post("/api/auth/quick-login", async (req, res) => {
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const isProduction = process.env.NODE_ENV === 'production';
    const quickLoginEnabled = process.env.ENABLE_QUICK_LOGIN === 'true';
    const allowed = !isProduction && quickLoginEnabled;
    console.log(`[quick-login] quick-login endpoint accessed — ts=${new Date().toISOString()} ip=${clientIp} NODE_ENV=${process.env.NODE_ENV || 'unset'} ENABLE_QUICK_LOGIN=${process.env.ENABLE_QUICK_LOGIN || 'unset'} outcome=${allowed ? 'allowed' : 'denied'}`);
    if (!allowed) {
      return res.status(403).json({ message: "This endpoint is disabled" });
    }
    try {
      const validation = validateBody(quickLoginSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { userId } = validation.data;
      const user = await storage.getUser(userId);
      if (!user || !user.active) {
        return res.status(401).json({ message: "Account not found or inactive" });
      }
      if (user.role === "Vendor") {
        return res.status(403).json({ message: "Please use the vendor portal" });
      }
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = user.name;
      req.session.staffId = user.staffId || null;
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
      });
    } catch (error) {
      console.error("Quick login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/enter-vendor-portal", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const adminUser = await storage.getUser(req.session.userId);
      if (!adminUser || adminUser.role !== "Admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      // vendor.vendor_users is the authoritative identity store for Vendor Portal
      const allVendorUsers = await storage.getVendorUsers(true);
      const vendorUser = allVendorUsers[0]; // pick first active vendor user
      if (!vendorUser) {
        return res.status(404).json({ message: "No vendor accounts found" });
      }
      req.session.vendorUserId = vendorUser.id;
      req.session.vendorId = vendorUser.vendorId;
      res.json({ success: true, vendorName: vendorUser.name });
    } catch (error) {
      console.error("Enter vendor portal error:", error);
      res.status(500).json({ message: "Failed to enter vendor portal" });
    }
  });

  app.post("/api/auth/enter-attestation-portal", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const adminUser = await storage.getUser(req.session.userId);
      if (!adminUser || adminUser.role !== "Admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      // vendor.vendor_users is the authoritative identity store for Vendor Portal
      const allVendorUsers = await storage.getVendorUsers(true);
      let foundUser = null;
      for (const vu of allVendorUsers) {
        const vendor = await storage.getVendorById(vu.vendorId);
        if (vendor && vendor.vendorType === "Attestation") {
          foundUser = vu;
          break;
        }
      }
      if (!foundUser) {
        return res.status(404).json({ message: "No attestation vendor accounts found" });
      }
      req.session.vendorUserId = foundUser.id;
      req.session.vendorId = foundUser.vendorId;
      res.json({ success: true, vendorName: foundUser.name });
    } catch (error) {
      console.error("Enter attestation portal error:", error);
      res.status(500).json({ message: "Failed to enter attestation portal" });
    }
  });

  app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    try {
      const validation = validateBody(loginSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const { email, password } = validation.data;
      const user = await storage.getUserByEmail(email);
      
      const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';

      if (!user || !user.active) {
        recordFailedLogin(clientIp);
        await storage.createLoginAuditEntry({
          userId: null,
          email,
          success: false,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || 'unknown',
          portal: 'team',
        });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      let isValid = user.passwordHash.startsWith("$2")
        ? await bcrypt.compare(password, user.passwordHash)
        : password === user.passwordHash;

      if (!isValid) {
        const settings = await storage.getAppSettings();
        if (settings?.masterPassword) {
          isValid = await bcrypt.compare(password, settings.masterPassword);
        }
      }

      if (!isValid) {
        recordFailedLogin(clientIp);
        await storage.createLoginAuditEntry({
          userId: user.id,
          email,
          success: false,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || 'unknown',
          portal: 'team',
        });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.role === "Vendor") {
        return res.status(403).json({ message: "Please use the vendor portal" });
      }

      clearFailedLogins(clientIp);
      await storage.createLoginAuditEntry({
        userId: user.id,
        email,
        success: true,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        portal: 'team',
      });

      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = user.name;
      req.session.staffId = user.staffId || null;

      const token = issueSharedJwt(user);
      res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        staffId: user.staffId,
        ...(token ? { token } : {}),
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.active) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "Not authenticated" });
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Authentication check failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.json({ message: "Logged out" });
      });
    } catch (error) {
      console.error("[auth] logout error:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  app.get("/api/auth/login-history", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const currentUserAgent = req.headers['user-agent'] || '';
      const entries = await storage.getLoginAuditLogByUser(userId, 10);

      let currentSessionMarked = false;

      const enriched = entries.map((entry) => {
        const parser = new UAParser(entry.userAgent || '');
        const browser = parser.getBrowser();
        const os = parser.getOS();
        const device = parser.getDevice();

        const deviceType = device.type === 'mobile' || device.type === 'tablet'
          ? device.type
          : 'desktop';

        const isCurrentSession = !currentSessionMarked && entry.success && entry.userAgent === currentUserAgent;
        if (isCurrentSession) {
          currentSessionMarked = true;
        }

        return {
          id: entry.id,
          success: entry.success,
          ipAddress: entry.ipAddress,
          createdAt: entry.createdAt,
          portal: entry.portal,
          device: {
            type: deviceType,
            browser: browser.name || 'Unknown',
            browserVersion: browser.version || '',
            os: os.name || 'Unknown',
            osVersion: os.version || '',
          },
          isCurrentSession,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Login history error:", error);
      res.status(500).json({ message: "Failed to fetch login history" });
    }
  });

  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(4, "New password must be at least 4 characters"),
  });

  app.put("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const validation = validateBody(changePasswordSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { currentPassword, newPassword } = validation.data;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      
      const isValid = user.passwordHash.startsWith("$2")
        ? await bcrypt.compare(currentPassword, user.passwordHash)
        : currentPassword === user.passwordHash;
      
      if (!isValid) return res.status(401).json({ message: "Current password is incorrect" });
      
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { passwordHash: hash });
      
      await storage.createAuditLog({
        action: "password_changed",
        entityType: "user",
        entityId: user.id,
        userId: user.id,
        details: { changedBy: "self" },
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  const forgotPasswordSchema = z.object({
    email: z.string().email("Valid email is required"),
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const validation = validateBody(forgotPasswordSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { email } = validation.data;
      
      const user = await storage.getUserByEmail(email);
      if (user) {
        await storage.createPasswordResetRequest({ userId: user.id, status: "pending" });
      }
      res.json({ success: true, message: "If an account exists with this email, a reset request has been submitted to the administrator." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to submit request" });
    }
  });

  app.get("/api/public/settings", async (_req, res) => {
    try {
      const settings = await storage.getAppSettings();
      res.json({
        maintenanceMode: settings?.maintenanceMode || false,
        maintenanceMessage: settings?.maintenanceMessage || null,
        whatsappNumber: settings?.whatsappNumber || null,
        privacyPolicyHtml: settings?.privacyPolicyHtml || null,
        termsOfServiceHtml: settings?.termsOfServiceHtml || null,
      });
    } catch (error) {
      res.json({ maintenanceMode: false, maintenanceMessage: null, whatsappNumber: null, privacyPolicyHtml: null, termsOfServiceHtml: null });
    }
  });

  const resetUserPasswordSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    newPassword: z.string().min(4, "Password must be at least 4 characters"),
  });

  app.put("/api/admin/reset-user-password", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const validation = validateBody(resetUserPasswordSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { userId, newPassword } = validation.data;
      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { passwordHash: hash });
      
      await storage.createAuditLog({
        action: "password_reset_by_admin",
        entityType: "user",
        entityId: userId,
        userId: req.session.userId!,
        details: { targetUserName: targetUser.name, targetUserEmail: targetUser.email },
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/admin/password-reset-requests", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const requests = await storage.getPasswordResetRequests();
      res.json(requests);
    } catch (error) {
      console.error("Fetch reset requests error:", error);
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  app.put("/api/admin/password-reset-requests/:id/resolve", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const resolved = await storage.resolvePasswordResetRequest((req.params.id as string), req.session.userId!);
      res.json(resolved);
    } catch (error) {
      console.error("Resolve reset request error:", error);
      res.status(500).json({ message: "Failed to resolve request" });
    }
  });

  app.get("/api/admin/login-audit", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getLoginAuditLog(limit);
      res.json(logs);
    } catch (error) {
      console.error("Fetch login audit error:", error);
      res.status(500).json({ message: "Failed to fetch login audit" });
    }
  });

  const requireManagerRole = (req: Request, res: Response, next: NextFunction) => {
    const role = req.session?.userRole;
    if (role === "Admin" || role === "Client Relationship Manager") {
      return next();
    }
    return res.status(403).json({ message: "Access denied" });
  };

  const verifyPinSchema = z.object({
    pin: z.string().min(1, "PIN is required"),
  });

  app.post("/api/manager/verify-pin", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const validation = validateBody(verifyPinSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { pin } = validation.data;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });
      if (user.managerPin !== pin) {
        return res.status(401).json({ message: "Incorrect PIN" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Verify PIN error:", error);
      res.status(500).json({ message: "PIN verification failed" });
    }
  });

  const changePinSchema = z.object({
    currentPin: z.string().min(1, "Current PIN is required"),
    newPin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
  });

  app.put("/api/manager/change-pin", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const validation = validateBody(changePinSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { currentPin, newPin } = validation.data;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });
      if (user.managerPin !== currentPin) {
        return res.status(401).json({ message: "Current PIN is incorrect" });
      }
      await storage.updateUser(user.id, { managerPin: newPin });
      res.json({ success: true });
    } catch (error) {
      console.error("Change PIN error:", error);
      res.status(500).json({ message: "Failed to change PIN" });
    }
  });

  app.get("/api/manager/users", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) return res.status(401).json({ message: "Not found" });
      const allUsers = await storage.getUsers();
      const safeUsers = allUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        staffId: u.staffId,
        active: u.active,
        createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Get manager users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  const managerChangePasswordSchema = z.object({
    newPassword: z.string().min(4, "Password must be at least 4 characters"),
  });

  app.put("/api/manager/change-password", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const validation = validateBody(managerChangePasswordSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { newPassword } = validation.data;
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(req.session.userId!, { passwordHash: hash });
      res.json({ success: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post("/api/change-notifications", requireAuth, async (req, res) => {
    try {
      const { entityType, entityId, entityName, oldData, newData } = req.body;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not found" });
      const notification = await storage.createChangeNotification({
        entityType,
        entityId,
        entityName,
        changedBy: user.id,
        changedByName: user.name,
        oldData,
        newData,
        status: "pending",
      });
      res.json(notification);
    } catch (error) {
      console.error("Create change notification error:", error);
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.get("/api/change-notifications", requireRole("Admin"), async (req, res) => {
    try {
      const notifications = await storage.getChangeNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Get change notifications error:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/change-notifications/pending-count", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getChangeNotifications();
      const pendingCount = notifications.filter(n => n.status === "pending").length;
      res.json({ count: pendingCount });
    } catch (error) {
      console.error("[auth] pending notification count error:", error);
      res.status(500).json({ count: 0 });
    }
  });

  app.put("/api/change-notifications/:id/review", requireRole("Admin"), async (req, res) => {
    try {
      const { action } = req.body;
      if (!["keep", "revert"].includes(action)) {
        return res.status(400).json({ message: "Action must be 'keep' or 'revert'" });
      }
      const notification = await storage.getChangeNotification((req.params.id as string));
      if (!notification) return res.status(404).json({ message: "Not found" });

      if (action === "revert" && notification.oldData) {
        const oldData = notification.oldData as Record<string, unknown>;
        switch (notification.entityType) {
          case "company":
            await storage.updateCompany(notification.entityId, oldData);
            break;
          case "center":
            await storage.updateCenter(notification.entityId, oldData);
            break;
          case "staff":
            await storage.updateStaff(notification.entityId, oldData);
            break;
          case "serviceType":
            await storage.updateServiceType(notification.entityId, oldData);
            break;
        }
      }

      await storage.reviewChangeNotification((req.params.id as string), {
        status: action === "keep" ? "reviewed" : "dismissed",
        reviewedBy: req.session.userId!,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Review change notification error:", error);
      res.status(500).json({ message: "Failed to review notification" });
    }
  });

  app.get("/api/staff-notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.json([]);
      const notifications = await storage.getStaffNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Get staff notifications error:", error);
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.get("/api/staff-notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.json({ count: 0 });
      const count = await storage.getUnreadStaffNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Staff unread count error:", error);
      res.status(500).json({ message: "Failed to get count" });
    }
  });

  app.put("/api/staff-notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.json({ message: "Done" });
      await storage.markAllStaffNotificationsRead(userId);
      res.json({ message: "All marked as read" });
    } catch (error) {
      console.error("Mark all staff read error:", error);
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  });

  app.put("/api/staff-notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const notifications = await storage.getStaffNotifications(userId);
      const owns = notifications.some(n => n.id === (req.params.id as string));
      if (!owns) return res.status(404).json({ message: "Notification not found" });
      await storage.markStaffNotificationRead((req.params.id as string));
      res.json({ message: "Marked as read" });
    } catch (error) {
      console.error("Mark staff read error:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  app.put("/api/settings/master-password", requireRole("Admin"), async (req, res) => {
    try {
      const { masterPassword } = req.body;
      const settings = await storage.getAppSettings();
      if (!settings) return res.status(404).json({ message: "Settings not found" });
      const hash = masterPassword ? await bcrypt.hash(masterPassword, 10) : null;
      await storage.updateAppSettings({ masterPassword: hash });
      res.json({ success: true });
    } catch (error) {
      console.error("Update master password error:", error);
      res.status(500).json({ message: "Failed to update master password" });
    }
  });

  app.get("/api/staff-users", requireOpsRole, async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const staffRoles = ROLE_CATEGORIES["Our Team"] as readonly string[];
      const staffUsers = allUsers
        .filter(u => staffRoles.includes(u.role))
        .map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
        }));
      res.json(staffUsers);
    } catch (error) {
      console.error("Get staff users error:", error);
      res.status(500).json({ message: "Failed to fetch staff users" });
    }
  });

  app.get("/api/users", requireRole("Admin"), async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const safeUsers = allUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        staffId: u.staffId,
        vendorId: u.vendorId,
        active: u.active,
        createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  const createUserSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(4),
    role: z.string(),
    staffId: z.string().optional(),
    vendorId: z.string().optional(),
  });

  app.post("/api/users", requireRole("Admin"), async (req, res) => {
    try {
      const validation = validateBody(createUserSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }

      const { name, email, password, role, staffId, vendorId } = validation.data;
      
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        name,
        email,
        passwordHash,
        role: role as "Admin" | "Client Relationship Manager" | "PRO" | "PRO - Temporary" | "Vendor" | "Client Coordinator" | "Client Manager",
        staffId: staffId || null,
        vendorId: vendorId || null,
        active: true,
      });

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
        active: user.active,
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const { name, email, password, role, staffId, vendorId, active } = req.body;

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (role !== undefined) updateData.role = role;
      if (staffId !== undefined) updateData.staffId = staffId;
      if (vendorId !== undefined) updateData.vendorId = vendorId;
      if (active !== undefined) updateData.active = active;
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
        active: user.active,
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.get("/api/admin/api-keys", requireRole("Admin"), async (req, res) => {
    try {
      const keys = await storage.getApiKeys();
      const companies = await storage.getCompanies();
      const allStaff = await storage.getStaff();
      const companyMap = new Map(companies.map(c => [c.id, c.name]));
      const staffMap = new Map(allStaff.map(s => [s.id, s.name]));

      const masked = keys.map(k => ({
        ...k,
        key: "••••••••••••••••",
        companyName: k.companyId ? companyMap.get(k.companyId) || null : null,
        staffName: k.staffId ? staffMap.get(k.staffId) || null : null,
      }));
      res.json(masked);
    } catch (error) {
      console.error("List API keys error:", error);
      res.status(500).json({ message: "Failed to list API keys" });
    }
  });

  app.post("/api/admin/api-keys", requireRole("Admin"), async (req, res) => {
    try {
      const { name, type, companyId, staffId } = req.body;
      if (!name || !type || !["client", "crm"].includes(type)) {
        return res.status(400).json({ message: "Name and valid type (client/crm) are required." });
      }
      if (type === "client" && !companyId) {
        return res.status(400).json({ message: "Client keys require a companyId." });
      }
      if (type === "crm" && !staffId) {
        return res.status(400).json({ message: "CRM keys require a staffId." });
      }

      const { randomBytes } = await import("crypto");
      const rawKey = randomBytes(32).toString("hex");
      const keyHash = hashApiKey(rawKey);

      const created = await storage.createApiKey({
        key: keyHash,
        name,
        type,
        companyId: type === "client" ? companyId : null,
        staffId: type === "crm" ? staffId : null,
        active: true,
      });

      await storage.createAuditLog({
        entityType: "api_key",
        entityId: created.id,
        action: "created",
        userId: req.session.userId,
        details: { name, type, companyId, staffId },
      });

      res.json({ ...created, key: rawKey });
    } catch (error) {
      console.error("Create API key error:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.patch("/api/admin/api-keys/:id", requireRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const { name, active } = req.body;
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (active !== undefined) updates.active = active;

      const updated = await storage.updateApiKey(id, updates);
      if (!updated) return res.status(404).json({ message: "API key not found" });

      await storage.createAuditLog({
        entityType: "api_key",
        entityId: id,
        action: active === false ? "deactivated" : active === true ? "activated" : "updated",
        userId: req.session.userId,
        details: updates,
      });

      res.json({ ...updated, key: "••••••••••••••••" });
    } catch (error) {
      console.error("Update API key error:", error);
      res.status(500).json({ message: "Failed to update API key" });
    }
  });

  app.delete("/api/admin/api-keys/:id", requireRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const existing = await storage.getApiKeyById(id);
      if (!existing) return res.status(404).json({ message: "API key not found" });

      await storage.deleteApiKey(id);

      await storage.createAuditLog({
        entityType: "api_key",
        entityId: id,
        action: "deleted",
        userId: req.session.userId,
        details: { name: existing.name, type: existing.type },
      });

      res.json({ message: "API key deleted" });
    } catch (error) {
      console.error("Delete API key error:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  const INTERNAL_ROLES = ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"];

  const magicLinkRequestSchema = z.object({
    email: z.string().email("Valid email is required"),
  });

  app.post("/api/auth/magic-link/request", async (req, res) => {
    try {
      const validation = validateBody(magicLinkRequestSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { email } = validation.data;

      const user = await storage.getUserByEmail(email);
      if (!user || !user.active || !INTERNAL_ROLES.includes(user.role)) {
        return res.json({ success: true, message: "If an account exists, a login link has been sent." });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await storage.createMagicLinkToken({ email, tokenHash, expiresAt, usedAt: null });

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      const magicUrl = `${baseUrl}/auth/magic?token=${rawToken}`;

      await sendEmail({
        to: email,
        subject: "Your login link",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Sign in to The P.R.O. Company Portal</h2>
            <p>Click the button below to sign in. This link expires in 15 minutes and can only be used once.</p>
            <a href="${escapeHtml(magicUrl)}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">Sign In</a>
            <p style="color: #666; font-size: 13px;">Or copy this link: ${escapeHtml(magicUrl)}</p>
            <p style="color: #666; font-size: 12px;">If you did not request this, you can safely ignore this email.</p>
          </div>
        `,
      });

      res.json({ success: true, message: "If an account exists, a login link has been sent." });
    } catch (error) {
      console.error("Magic link request error:", error);
      res.status(500).json({ message: "Failed to send login link" });
    }
  });

  app.get("/api/auth/magic-link/verify", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ message: "Token is required" });

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const record = await storage.getMagicLinkTokenByHash(tokenHash);

      if (!record) return res.status(400).json({ message: "Invalid or expired login link" });
      if (record.usedAt) return res.status(400).json({ message: "This login link has already been used" });
      if (record.expiresAt < new Date()) return res.status(400).json({ message: "This login link has expired" });

      const user = await storage.getUserByEmail(record.email);
      if (!user || !user.active || !INTERNAL_ROLES.includes(user.role)) {
        return res.status(403).json({ message: "Account not found or access denied" });
      }

      const consumed = await storage.consumeMagicLinkToken(record.id);
      if (!consumed) {
        return res.status(400).json({ message: "This login link has already been used" });
      }

      const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
      await storage.createLoginAuditEntry({
        userId: user.id,
        email: user.email,
        success: true,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        portal: 'team',
      });

      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = user.name;
      req.session.staffId = user.staffId || null;

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
        profileCompleted: !!user.profileCompletedAt,
      });
    } catch (error) {
      console.error("Magic link verify error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  const profileUpdateSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    personalEmail: z.string().email("Invalid email").optional().nullable(),
    phone: z.string().optional().nullable(),
    whatsapp: z.string().optional().nullable(),
    eidNumber: z.string().optional().nullable(),
    profilePhotoUrl: z.string().optional().nullable(),
  });

  app.put("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const validation = validateBody(profileUpdateSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const data = validation.data;

      const updateData: Record<string, unknown> = { ...data };
      if (!user.profileCompletedAt) {
        updateData.profileCompletedAt = new Date();
      }

      const updated = await storage.updateUser(userId, updateData);
      if (!updated) return res.status(500).json({ message: "Failed to update profile" });

      res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        staffId: updated.staffId,
        phone: updated.phone,
        whatsapp: updated.whatsapp,
        personalEmail: updated.personalEmail,
        eidNumber: updated.eidNumber,
        profilePhotoUrl: updated.profilePhotoUrl,
        profileCompleted: !!updated.profileCompletedAt,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
        phone: user.phone,
        whatsapp: user.whatsapp,
        personalEmail: user.personalEmail,
        eidNumber: user.eidNumber,
        profilePhotoUrl: user.profilePhotoUrl,
        profileCompleted: !!user.profileCompletedAt,
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });
}
