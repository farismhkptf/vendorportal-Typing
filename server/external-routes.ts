import type { Express, Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import type { ApiKey } from "@shared/schema";

interface ExternalRequest extends Request {
  apiKey?: ApiKey;
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW = 60 * 1000;

function rateLimit(req: ExternalRequest, res: Response, next: NextFunction) {
  const keyId = req.apiKey?.id || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(keyId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(keyId, { count: 1, resetAt: now + RATE_WINDOW });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: "Rate limit exceeded. Max 100 requests per minute." });
  }
  next();
}

async function requireApiKey(req: ExternalRequest, res: Response, next: NextFunction) {
  const headerKey = req.headers["x-api-key"] as string
    || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);

  if (!headerKey) {
    return res.status(401).json({ error: "Missing API key. Provide X-API-Key header or Authorization: Bearer <key>." });
  }

  try {
    const keyHash = hashApiKey(headerKey);
    const apiKey = await storage.getApiKeyByHash(keyHash);
    if (!apiKey) {
      return res.status(401).json({ error: "Invalid API key." });
    }
    if (!apiKey.active) {
      return res.status(403).json({ error: "API key is deactivated. Contact your administrator." });
    }

    req.apiKey = apiKey;
    storage.touchApiKeyLastUsed(apiKey.id).catch(() => {});
    next();
  } catch (error) {
    console.error("API key auth error:", error);
    res.status(500).json({ error: "Authentication failed." });
  }
}

function sanitizeWorkOrder(wo: any) {
  return {
    id: wo.id,
    woNumber: wo.woNumber,
    applicantName: wo.applicantName,
    applicantPhone: wo.applicantPhone,
    applicantEmail: wo.applicantEmail,
    isVip: wo.isVip,
    isMinor: wo.isMinor,
    status: wo.status,
    createdAt: wo.createdAt,
    companyId: wo.companyId,
    serviceTypeId: wo.serviceTypeId,
  };
}

function sanitizeAppointment(appt: any) {
  return {
    id: appt.id,
    woId: appt.woId,
    type: appt.type,
    isVip: appt.isVip,
    datetime: appt.datetime,
    centerId: appt.centerId,
    applicationNumber: appt.applicationNumber,
    status: appt.status,
    createdAt: appt.createdAt,
  };
}

function sanitizeCompany(c: any) {
  return {
    id: c.id,
    name: c.name,
    tradeLicenseNumber: c.tradeLicenseNumber,
    clientCoordinator: c.clientCoordinator,
    clientManager: c.clientManager,
    deliveryAddress: c.deliveryAddress,
    active: c.active,
  };
}

function sanitizeCenter(c: any) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    tier: c.tier,
    address: c.address,
    timings: c.timings,
    active: c.active,
  };
}

export function registerExternalRoutes(app: Express) {
  app.get("/api/external/me", requireApiKey, rateLimit, async (req: ExternalRequest, res: Response) => {
    try {
      const apiKey = req.apiKey!;
      const result: any = {
        name: apiKey.name,
        type: apiKey.type,
        active: apiKey.active,
      };

      if (apiKey.type === "client" && apiKey.companyId) {
        const company = await storage.getCompanyById(apiKey.companyId);
        result.company = company ? sanitizeCompany(company) : null;
      }

      if (apiKey.type === "crm" && apiKey.staffId) {
        const allCompanies = await storage.getCompanies();
        const assigned = allCompanies.filter(c => c.rmStaffId === apiKey.staffId);
        result.companies = assigned.map(sanitizeCompany);
        const staffMember = await storage.getStaffById(apiKey.staffId);
        result.staffName = staffMember?.name || null;
      }

      res.json(result);
    } catch (error) {
      console.error("External /me error:", error);
      res.status(500).json({ error: "Failed to fetch account info." });
    }
  });

  app.get("/api/external/appointments", requireApiKey, rateLimit, async (req: ExternalRequest, res: Response) => {
    try {
      const apiKey = req.apiKey!;
      const companyIds = await getCompanyIdsForKey(apiKey);
      if (companyIds.length === 0) {
        return res.json([]);
      }

      const allWos = await storage.getWorkOrders();
      const scopedWoIds = allWos
        .filter(wo => wo.companyId && companyIds.includes(wo.companyId))
        .map(wo => wo.id);

      if (scopedWoIds.length === 0) return res.json([]);

      const allAppointments = await storage.getAllAppointments();
      const filtered = allAppointments.filter(a => scopedWoIds.includes(a.woId));

      const centers = await storage.getCenters();
      const centerMap = new Map(centers.map(c => [c.id, c]));
      const woMap = new Map(allWos.map(wo => [wo.id, wo]));

      const result = filtered.map(appt => {
        const wo = woMap.get(appt.woId);
        const center = appt.centerId ? centerMap.get(appt.centerId) : null;
        return {
          ...sanitizeAppointment(appt),
          workOrder: wo ? { woNumber: wo.woNumber, applicantName: wo.applicantName } : null,
          center: center ? sanitizeCenter(center) : null,
        };
      });

      res.json(result);
    } catch (error) {
      console.error("External appointments error:", error);
      res.status(500).json({ error: "Failed to fetch appointments." });
    }
  });

  app.get("/api/external/work-orders", requireApiKey, rateLimit, async (req: ExternalRequest, res: Response) => {
    try {
      const apiKey = req.apiKey!;
      const companyIds = await getCompanyIdsForKey(apiKey);
      if (companyIds.length === 0) return res.json([]);

      const allWos = await storage.getWorkOrders();
      const filtered = allWos.filter(wo => wo.companyId && companyIds.includes(wo.companyId));

      const serviceTypes = await storage.getServiceTypes();
      const stMap = new Map(serviceTypes.map(st => [st.id, st]));

      const result = filtered.map(wo => {
        const st = wo.serviceTypeId ? stMap.get(wo.serviceTypeId) : null;
        return {
          ...sanitizeWorkOrder(wo),
          serviceTypeName: st?.name || null,
        };
      });

      res.json(result);
    } catch (error) {
      console.error("External work-orders error:", error);
      res.status(500).json({ error: "Failed to fetch work orders." });
    }
  });

  app.get("/api/external/work-orders/:id", requireApiKey, rateLimit, async (req: ExternalRequest, res: Response) => {
    try {
      const apiKey = req.apiKey!;
      const companyIds = await getCompanyIdsForKey(apiKey);
      const wo = await storage.getWorkOrderById(req.params.id);

      if (!wo || !wo.companyId || !companyIds.includes(wo.companyId)) {
        return res.status(404).json({ error: "Work order not found." });
      }

      const serviceTypes = await storage.getServiceTypes();
      const st = wo.serviceTypeId ? serviceTypes.find(s => s.id === wo.serviceTypeId) : null;

      const woAppointments = await storage.getAppointmentsByWoId(wo.id);

      const centers = await storage.getCenters();
      const centerMap = new Map(centers.map(c => [c.id, c]));

      const company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;

      let assignedStaff = null;
      let crmStaff = null;
      if (company) {
        if (company.assistStaffId) {
          const s = await storage.getStaffById(company.assistStaffId);
          if (s) assignedStaff = { name: s.name, phone: s.phone };
        }
        if (company.rmStaffId) {
          const s = await storage.getStaffById(company.rmStaffId);
          if (s) crmStaff = { name: s.name, phone: s.phone };
        }
      }

      res.json({
        ...sanitizeWorkOrder(wo),
        serviceTypeName: st?.name || null,
        companyName: company?.name || null,
        appointments: woAppointments.map(appt => ({
          ...sanitizeAppointment(appt),
          center: appt.centerId ? sanitizeCenter(centerMap.get(appt.centerId)) : null,
        })),
        contacts: {
          assignedStaff,
          crmStaff,
          clientCoordinator: company?.clientCoordinator || null,
          clientManager: company?.clientManager || null,
        },
      });
    } catch (error) {
      console.error("External work-order detail error:", error);
      res.status(500).json({ error: "Failed to fetch work order." });
    }
  });

  app.get("/api/external/company", requireApiKey, rateLimit, async (req: ExternalRequest, res: Response) => {
    try {
      const apiKey = req.apiKey!;
      if (apiKey.type !== "client" || !apiKey.companyId) {
        return res.status(403).json({ error: "This endpoint is for client API keys only." });
      }

      const company = await storage.getCompanyById(apiKey.companyId);
      if (!company) return res.status(404).json({ error: "Company not found." });

      const centers = await storage.getCenters();
      const centerMap = new Map(centers.map(c => [c.id, c]));

      const preferredMedical = company.preferredMedicalCenterId ? centerMap.get(company.preferredMedicalCenterId) : null;
      const preferredEid = company.preferredBiometricsCenterId ? centerMap.get(company.preferredBiometricsCenterId) : null;

      res.json({
        ...sanitizeCompany(company),
        preferredMedicalCenter: preferredMedical ? sanitizeCenter(preferredMedical) : null,
        preferredEidCenter: preferredEid ? sanitizeCenter(preferredEid) : null,
      });
    } catch (error) {
      console.error("External company error:", error);
      res.status(500).json({ error: "Failed to fetch company." });
    }
  });

  app.get("/api/external/companies", requireApiKey, rateLimit, async (req: ExternalRequest, res: Response) => {
    try {
      const apiKey = req.apiKey!;
      if (apiKey.type !== "crm" || !apiKey.staffId) {
        return res.status(403).json({ error: "This endpoint is for CRM API keys only." });
      }

      const allCompanies = await storage.getCompanies();
      const assigned = allCompanies.filter(c => c.rmStaffId === apiKey.staffId);

      res.json(assigned.map(sanitizeCompany));
    } catch (error) {
      console.error("External companies error:", error);
      res.status(500).json({ error: "Failed to fetch companies." });
    }
  });
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

async function getCompanyIdsForKey(apiKey: ApiKey): Promise<string[]> {
  if (apiKey.type === "client" && apiKey.companyId) {
    return [apiKey.companyId];
  }
  if (apiKey.type === "crm" && apiKey.staffId) {
    const allCompanies = await storage.getCompanies();
    return allCompanies
      .filter(c => c.rmStaffId === apiKey.staffId)
      .map(c => c.id);
  }
  return [];
}
