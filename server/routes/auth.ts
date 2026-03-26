import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import UAParser from "ua-parser-js";
import { storage } from "../storage";
import { loginSchema, ROLE_CATEGORIES } from "@shared/schema";
import { requireAuth, requireRole, requireOpsRole, loginRateLimit, recordFailedLogin, clearFailedLogins } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { hashApiKey } from "../external-routes";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/accounts", async (_req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
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

  app.post("/api/auth/quick-login", async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
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
      const allUsers = await storage.getUsers();
      const vendorUser = allUsers.find(u => u.role === "Vendor" && u.active && u.vendorId);
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
      const allUsers = await storage.getUsers();
      const vendorUsers = allUsers.filter(u => u.role === "Vendor" && u.active && u.vendorId);
      let foundUser = null;
      for (const vu of vendorUsers) {
        const vendor = await storage.getVendorById(vu.vendorId!);
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

      res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        staffId: user.staffId,
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

  app.put("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "Current and new password required (min 4 chars)" });
      }
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

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      
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

  app.put("/api/admin/reset-user-password", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const { userId, newPassword } = req.body;
      if (!userId || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "User ID and password (min 4 chars) required" });
      }
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
      const resolved = await storage.resolvePasswordResetRequest(req.params.id, req.session.userId!);
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

  app.post("/api/manager/verify-pin", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin) return res.status(400).json({ message: "PIN is required" });
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

  app.put("/api/manager/change-pin", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const { currentPin, newPin } = req.body;
      if (!currentPin || !newPin) return res.status(400).json({ message: "Current and new PIN are required" });
      if (!/^\d{4}$/.test(newPin)) return res.status(400).json({ message: "PIN must be 4 digits" });
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

  app.put("/api/manager/change-password", requireAuth, requireManagerRole, async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "Password must be at least 4 characters" });
      }
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
      res.status(500).json({ count: 0 });
    }
  });

  app.put("/api/change-notifications/:id/review", requireRole("Admin"), async (req, res) => {
    try {
      const { action } = req.body;
      if (!["keep", "revert"].includes(action)) {
        return res.status(400).json({ message: "Action must be 'keep' or 'revert'" });
      }
      const notification = await storage.getChangeNotification(req.params.id);
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

      await storage.reviewChangeNotification(req.params.id, {
        status: action === "keep" ? "kept" : "reverted",
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
      const owns = notifications.some(n => n.id === req.params.id);
      if (!owns) return res.status(404).json({ message: "Notification not found" });
      await storage.markStaffNotificationRead(req.params.id);
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
        role,
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
      const { id } = req.params;
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
      const { id } = req.params;
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
      const { id } = req.params;
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
}
