import type { Express, Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { requireRole } from "../middleware/auth";
import { toProperCase } from "../proper-case";
import { notifyStaffByRoles } from "../services/notification-service";

function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

async function requireIntegrationApiKey(req: Request, res: Response, next: NextFunction) {
  const headerKey = (req.headers["x-api-key"] as string)
    || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);

  if (!headerKey) {
    return res.status(401).json({ error: "Missing API key. Provide X-Api-Key header." });
  }

  try {
    const keyHash = hashApiKey(headerKey);
    const apiKey = await storage.getApiKeyByHash(keyHash);
    if (!apiKey) {
      return res.status(401).json({ error: "Invalid API key." });
    }
    if (!apiKey.active) {
      return res.status(403).json({ error: "API key is deactivated." });
    }
    storage.touchApiKeyLastUsed(apiKey.id).catch(() => {});
    next();
  } catch (err) {
    console.error("[integration] API key auth error:", err);
    res.status(500).json({ error: "Authentication failed." });
  }
}

const VALID_DOCUMENT_TYPES = [
  "PassportCopy", "Photo", "EntryPermit", "ChangeStatus", "CurrentResidency",
  "OldResidencyOrId", "CurrentEmiratesId", "SponsorEmiratesId", "BirthCertificate", "LostEmiratesId",
] as const;

const inboundDocumentSchema = z.object({
  type: z.enum(VALID_DOCUMENT_TYPES),
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  mimeType: z.string().optional().nullable(),
  fileSize: z.number().int().optional().nullable(),
});

const inboundWorkOrderSchema = z.object({
  externalId: z.string().min(1, "externalId is required"),
  woNumber: z.string().min(1, "woNumber is required"),
  applicantName: z.string().min(1, "applicantName is required"),
  applicantPhone: z.string().optional().nullable(),
  applicantEmail: z.string().email().optional().nullable(),
  isVip: z.boolean().optional(),
  isMinor: z.boolean().optional(),
  companyName: z.string().min(1, "companyName is required"),
  companyTradeLicenseNumber: z.string().optional().nullable(),
  serviceTypeName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  documents: z.array(inboundDocumentSchema).optional().nullable(),
});

export function registerIntegrationRoutes(app: Express): void {

  app.post("/api/integration/work-orders", requireIntegrationApiKey, async (req, res) => {
    try {
      const parsed = inboundWorkOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid payload",
          details: parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
        });
      }

      const data = parsed.data;

      // Upsert company: indexed lookup by trade license, then by normalized name
      let company = data.companyTradeLicenseNumber
        ? await storage.getCompanyByTradeLicenseNumber(data.companyTradeLicenseNumber)
        : undefined;
      if (!company) {
        company = await storage.getCompanyByName(data.companyName);
      }
      if (!company) {
        company = await storage.createCompany({
          name: data.companyName,
          tradeLicenseNumber: data.companyTradeLicenseNumber || null,
          active: true,
        });
      } else if (data.companyTradeLicenseNumber && !company.tradeLicenseNumber) {
        // Back-fill trade license if we matched by name and now have the number
        company = await storage.updateCompany(company.id, {
          tradeLicenseNumber: data.companyTradeLicenseNumber,
        }) || company;
      }

      let serviceTypeId: string | null = null;
      if (data.serviceTypeName) {
        const allServiceTypes = await storage.getServiceTypes();
        const matched = allServiceTypes.find(
          st => st.name.toLowerCase() === data.serviceTypeName!.toLowerCase()
        );
        serviceTypeId = matched?.id || null;
      }

      // Upsert work order: indexed lookup by externalId first, then woNumber
      const existingByExternal = data.externalId
        ? await storage.getWorkOrderByExternalId(data.externalId)
        : null;
      const existingByWoNum = existingByExternal ? null : await storage.getWorkOrderByWoNumber(data.woNumber);
      const existing = existingByExternal || existingByWoNum;

      let wo: Awaited<ReturnType<typeof storage.createWorkOrder>>;
      let isUpdate = false;
      if (existing) {
        // Update existing work order (allow updating company, service, notes, contact info)
        wo = await storage.updateWorkOrder(existing.id, {
          applicantName: toProperCase(data.applicantName),
          applicantPhone: data.applicantPhone || null,
          applicantEmail: data.applicantEmail || null,
          isVip: data.isVip ?? existing.isVip,
          isMinor: data.isMinor ?? existing.isMinor,
          companyId: company.id,
          serviceTypeId: serviceTypeId ?? existing.serviceTypeId,
          notes: data.notes ?? existing.notes,
          externalWoId: data.externalId,
        }) as typeof wo;
        isUpdate = true;
      } else {
        wo = await storage.createWorkOrder({
          woNumber: data.woNumber,
          applicantName: toProperCase(data.applicantName),
          applicantPhone: data.applicantPhone || null,
          applicantEmail: data.applicantEmail || null,
          isVip: data.isVip || false,
          isMinor: data.isMinor || false,
          companyId: company.id,
          serviceTypeId,
          status: "Draft",
          notes: data.notes || null,
          externalWoId: data.externalId,
        });
      }

      // Upsert documents: for each document in payload, check if a matching record exists
      // (same woId + documentType + fileUrl) and create if not — idempotent on re-push
      if (data.documents && data.documents.length > 0) {
        const existingDocs = await storage.getWoDocuments(wo.id);
        for (const doc of data.documents) {
          const alreadyExists = existingDocs.some(
            d => d.documentType === doc.type && d.fileUrl === doc.fileUrl
          );
          if (!alreadyExists) {
            await storage.createWoDocument({
              woId: wo.id,
              documentType: doc.type,
              fileName: doc.fileName,
              fileUrl: doc.fileUrl,
              mimeType: doc.mimeType || null,
              fileSize: doc.fileSize || null,
              status: "Uploaded",
            });
          }
        }
      }

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: wo.id,
        action: isUpdate ? "updated_from_client_portal" : "received_from_client_portal",
        userId: null,
        details: { woNumber: wo.woNumber, externalId: data.externalId, source: "integration_api", documentCount: data.documents?.length || 0 },
      });

      if (!isUpdate) {
        notifyStaffByRoles(["Admin", "Client Relationship Manager"], {
          type: "wo_received_integration",
          title: "New Work Order Received",
          message: `Work order ${wo.woNumber} received from Client Portal for ${wo.applicantName} (${company.name})`,
          relatedEntityType: "work_order",
          relatedEntityId: wo.id,
        }).catch((err: unknown) => { console.error("[integration] notify error:", err); });
      }

      return res.status(isUpdate ? 200 : 201).json({
        workOrderId: wo.id,
        woNumber: wo.woNumber,
        companyId: company.id,
        status: wo.status,
        upserted: isUpdate ? "updated" : "created",
      });
    } catch (err) {
      console.error("[integration] inbound WO error:", err);
      return res.status(500).json({ error: "Failed to create work order" });
    }
  });

  app.get("/api/admin/integration/status", requireRole("Admin"), async (req, res) => {
    try {
      const [recentEvents, failedCount, lastSuccess, lastInbound] = await Promise.all([
        storage.getRecentCrossPortalEvents(50),
        storage.getFailedCrossPortalEventsCount(),
        storage.getLastSuccessfulCrossPortalEvent(),
        storage.getLastInboundWorkOrder(),
      ]);

      return res.json({
        lastInboundWo: lastInbound
          ? { woNumber: lastInbound.woNumber, applicantName: lastInbound.applicantName, createdAt: lastInbound.createdAt }
          : null,
        lastSuccessfulPush: lastSuccess
          ? { eventType: lastSuccess.eventType, processedAt: lastSuccess.processedAt }
          : null,
        failedPushCount: failedCount,
        recentEvents: recentEvents.map(ev => ({
          id: ev.id,
          eventType: ev.eventType,
          status: ev.status,
          workOrderId: ev.workOrderId,
          attemptCount: ev.attemptCount,
          errorMessage: ev.errorMessage,
          createdAt: ev.createdAt,
          processedAt: ev.processedAt,
        })),
      });
    } catch (err) {
      console.error("[integration] status error:", err);
      return res.status(500).json({ error: "Failed to fetch integration status" });
    }
  });

  app.post("/api/admin/integration/retry-failed", requireRole("Admin"), async (req, res) => {
    try {
      const { retryFailedPushes } = await import("../services/client-portal-push");
      const count = await retryFailedPushes();
      return res.json({ retriedCount: count });
    } catch (err) {
      console.error("[integration] retry error:", err);
      return res.status(500).json({ error: "Failed to retry pushes" });
    }
  });

  // Shared staff authentication endpoints
  // -------------------------------------------------------------------

  // GET /api/integration/auth/redirect?token=<jwt>
  // Client Portal sets this URL as the "Open PRO Portal" link target.
  // The token (signed with SHARED_JWT_SECRET) is verified here, the
  // matching local staff account is looked up, and a session is set.
  app.get("/api/integration/auth/redirect", async (req: Request, res: Response) => {
    const sharedSecret = process.env.SHARED_JWT_SECRET;
    if (!sharedSecret) {
      console.warn("[integration/auth] SHARED_JWT_SECRET not configured");
      return res.redirect("/?sso_error=not_configured");
    }

    const token = req.query.token as string | undefined;
    if (!token) {
      return res.redirect("/?sso_error=missing_token");
    }

    let payload: { email?: string; sub?: string; role?: string };
    try {
      payload = jwt.verify(token, sharedSecret) as typeof payload;
    } catch (err) {
      console.warn("[integration/auth] Invalid SSO token:", (err as Error).message);
      return res.redirect("/?sso_error=invalid_token");
    }

    const email = payload.email || payload.sub;
    if (!email || !email.includes("@")) {
      return res.redirect("/?sso_error=missing_email");
    }

    try {
      const user = await storage.getUserByEmail(email);
      if (!user || !user.active) {
        return res.redirect("/?sso_error=user_not_found");
      }
      if (user.role === "Vendor") {
        return res.redirect("/?sso_error=vendor_not_allowed");
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = user.name;
      req.session.staffId = user.staffId || null;

      await storage.createLoginAuditEntry({
        userId: user.id,
        email: user.email || email,
        success: true,
        ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        portal: "team",
      });

      console.log(`[integration/auth] SSO silent login for ${email}`);
      return res.redirect("/");
    } catch (err) {
      console.error("[integration/auth] redirect error:", err);
      return res.redirect("/?sso_error=server_error");
    }
  });

  // GET /api/integration/auth/verify
  // API-key protected. Client Portal can call this to check whether a
  // JWT (e.g. one it issued) is valid for a staff member on this app.
  // Accepts: Authorization: Bearer <jwt>
  // Returns: { valid, userId, email, role } or { valid: false, error }
  app.get("/api/integration/auth/verify", requireIntegrationApiKey, async (req: Request, res: Response) => {
    const sharedSecret = process.env.SHARED_JWT_SECRET;
    if (!sharedSecret) {
      return res.status(501).json({ valid: false, error: "SHARED_JWT_SECRET not configured on this app" });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(400).json({ valid: false, error: "Missing Bearer token in Authorization header" });
    }

    let payload: { email?: string; sub?: string; role?: string };
    try {
      payload = jwt.verify(token, sharedSecret) as typeof payload;
    } catch (err) {
      return res.json({ valid: false, error: (err as Error).message });
    }

    const email = payload.email || payload.sub;
    if (!email || !email.includes("@")) {
      return res.json({ valid: false, error: "Token payload missing email" });
    }

    try {
      const user = await storage.getUserByEmail(email);
      if (!user || !user.active) {
        return res.json({ valid: false, error: "No active staff account for this email" });
      }
      return res.json({ valid: true, userId: user.id, email: user.email, role: user.role });
    } catch (err) {
      console.error("[integration/auth] verify error:", err);
      return res.status(500).json({ valid: false, error: "Server error" });
    }
  });
}
