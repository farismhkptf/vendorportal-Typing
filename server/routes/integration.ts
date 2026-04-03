import type { Express, Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { z } from "zod";
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

      const existing = await storage.getWorkOrderByWoNumber(data.woNumber);
      if (existing) {
        return res.status(409).json({
          error: "Work order already exists",
          workOrderId: existing.id,
          woNumber: existing.woNumber,
        });
      }

      let company = (await storage.getCompanies()).find(
        c => c.name.toLowerCase() === data.companyName.toLowerCase()
          || (data.companyTradeLicenseNumber && c.tradeLicenseNumber === data.companyTradeLicenseNumber)
      );
      if (!company) {
        company = await storage.createCompany({
          name: data.companyName,
          tradeLicenseNumber: data.companyTradeLicenseNumber || null,
          active: true,
        });
      }

      let serviceTypeId: string | null = null;
      if (data.serviceTypeName) {
        const allServiceTypes = await storage.getServiceTypes();
        const matched = allServiceTypes.find(
          st => st.name.toLowerCase() === data.serviceTypeName!.toLowerCase()
        );
        serviceTypeId = matched?.id || null;
      }

      const wo = await storage.createWorkOrder({
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

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: wo.id,
        action: "received_from_client_portal",
        userId: null,
        details: { woNumber: wo.woNumber, externalId: data.externalId, source: "integration_api" },
      });

      notifyStaffByRoles(["Admin", "Client Relationship Manager"], {
        type: "wo_received_integration",
        title: "New Work Order Received",
        message: `Work order ${wo.woNumber} received from Client Portal for ${wo.applicantName} (${company.name})`,
        relatedEntityType: "work_order",
        relatedEntityId: wo.id,
      }).catch((err: unknown) => { console.error("[integration] notify error:", err); });

      return res.status(201).json({
        workOrderId: wo.id,
        woNumber: wo.woNumber,
        companyId: company.id,
        status: wo.status,
      });
    } catch (err) {
      console.error("[integration] inbound WO error:", err);
      return res.status(500).json({ error: "Failed to create work order" });
    }
  });

  app.get("/api/admin/integration/status", requireRole("Admin"), async (req, res) => {
    try {
      const [recentEvents, failedCount, lastSuccess] = await Promise.all([
        storage.getRecentCrossPortalEvents(50),
        storage.getFailedCrossPortalEventsCount(),
        storage.getLastSuccessfulCrossPortalEvent(),
      ]);

      const allWos = await storage.getWorkOrders();
      const inboundWos = allWos.filter(wo => (wo as { externalWoId?: string | null }).externalWoId);
      const lastInbound = inboundWos.sort((a, b) =>
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      )[0] || null;

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
}
