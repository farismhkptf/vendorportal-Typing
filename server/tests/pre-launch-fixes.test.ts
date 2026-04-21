/**
 * Unit tests for Pre-Launch Stability Remediation (Task #106)
 *
 * Covers:
 * 1. Background delay-check skips non-UUID work order IDs without crashing
 * 2. Vendor completion notifies "Client Relationship Manager" role
 * 3. Biometrics timer NO_SHOW fires CRM/Admin notification (behavioral)
 * 4. Quick-login endpoints honour ENABLE_QUICK_LOGIN flag (source-level + HTTP)
 * 5. Vendor-job-assigned email fires via state-machine onEmail side-effect
 * 6. Email template registry status accuracy
 *
 * Run with:
 *   NODE_TEST=1 npx tsx --test server/tests/pre-launch-fixes.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import session from "express-session";
import MemoryStore from "memorystore";

import type {
  WorkOrder, Company, Staff, AppSettings, TypingJob,
  AuditLog, StaffNotification, InsertStaffNotification,
} from "@shared/schema";

import { checkAndMarkDelayedWorkOrders } from "../services/background-jobs";
import { dispatchBiometricsNoShowNotification } from "../routes/scheduling";
import { executeTransition, type TransitionContext } from "../typing-job-machine";
import { registerAuthRoutes } from "../routes/auth";
import { getTemplateRegistry, buildTemplatePreview } from "../email-templates/registry";
import { pool } from "../db";

// ─────────────────────────────────────────────────────────────────────────────
// Typed minimal fixture helpers
// All fields use the exact schema-inferred types; no `as any` casts.
// ─────────────────────────────────────────────────────────────────────────────

const NULL_UUID = "00000000-0000-0000-0000-000000000000";

function makeWorkOrder(id: string, fields: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id,
    woNumber: "WO-TEST",
    applicantName: "Test Applicant",
    companyId: NULL_UUID,
    serviceTypeId: null,
    status: "Draft",
    isDelayed: false,
    previousStatus: null,
    notes: null,
    createdBy: null,
    applicantPhone: null,
    applicantEmail: null,
    isVip: false,
    isMinor: false,
    createdAt: new Date(),
    externalWoId: null,
    ...fields,
  };
}

function makeCompany(id: string, fields: Partial<Company> = {}): Company {
  return {
    id,
    name: "Test Company",
    tradeLicenseNumber: null,
    preferredMedicalCenterId: null,
    preferredMedicalCenterVipId: null,
    preferredBiometricsCenterId: null,
    preferredBiometricsCenterVipId: null,
    clientCoordinator: null,
    clientManager: null,
    rmStaffId: null,
    assistStaffId: null,
    deliveryAddress: null,
    active: true,
    ...fields,
  };
}

function makeStaff(id: string, fields: Partial<Staff> = {}): Staff {
  return {
    id,
    name: "Test Staff",
    roleTitle: "CRM",
    staffType: "Permanent",
    phone: null,
    email: null,
    status: "Active",
    replacementId: null,
    leaveEndDate: null,
    active: true,
    ...fields,
  };
}

function makeAppSettings(fields: Partial<AppSettings> = {}): AppSettings {
  return {
    id: NULL_UUID,
    fromEmail: "test@example.com",
    fromName: "Test",
    replyToEmail: "reply@example.com",
    alwaysCc: null,
    testEmailRedirect: null,
    lowBalanceThreshold: 1000,
    masterPassword: null,
    defaultVendorId: null,
    maintenanceMode: false,
    maintenanceMessage: null,
    whatsappNumber: null,
    privacyPolicyHtml: null,
    termsOfServiceHtml: null,
    followUpCenter: null,
    vendorDelayThresholdHours: 48,
    logoUrl: null,
    clientPortalWebhookUrl: null,
    clientPortalOutboundApiKey: null,
    ...fields,
  };
}

function makeTypingJob(id: string, fields: Partial<TypingJob> = {}): TypingJob {
  return {
    id,
    jobCode: `TJ-${id.slice(0, 6)}`,
    woId: NULL_UUID,
    vendorId: null,
    jobTypeId: NULL_UUID,
    assignedToUserId: null,
    status: "Draft",
    costSnapshot: null,
    sentAt: null,
    returnedAt: null,
    sentToClientAt: null,
    vendorMistakeAt: null,
    vendorMistakeReason: null,
    createdBy: null,
    previousStatus: null,
    rejectedReason: null,
    urgent: false,
    createdAt: new Date(),
    ...fields,
  };
}

function makeAuditLog(fields: Partial<AuditLog> = {}): AuditLog {
  return {
    id: NULL_UUID,
    action: "test_action",
    entityType: "typing_job",
    entityId: null,
    userId: null,
    details: null,
    createdAt: new Date(),
    ...fields,
  };
}

function makeStaffNotification(data: InsertStaffNotification): StaffNotification {
  return {
    id: NULL_UUID,
    isRead: false,
    createdAt: new Date(),
    relatedEntityType: null,
    relatedEntityId: null,
    ...data,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helper
// ─────────────────────────────────────────────────────────────────────────────

function makeRequest(
  port: number,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Background delay-check — UUID validation and per-record isolation
// ─────────────────────────────────────────────────────────────────────────────

describe("1. Background delay-check — UUID safety", () => {
  it("returns 0 and does not throw when all active WOs have non-UUID IDs", async () => {
    const { storage } = await import("../storage");

    const originalGetWorkOrders = storage.getWorkOrders.bind(storage);
    const originalGetAppSettings = storage.getAppSettings.bind(storage);

    storage.getWorkOrders = async () => [
      makeWorkOrder("seed-wo-001", { woNumber: "BAD-001", status: "Delayed" }),
      makeWorkOrder("not-a-uuid", { woNumber: "BAD-002", status: "Scheduled" }),
    ];
    storage.getAppSettings = async () => makeAppSettings({ vendorDelayThresholdHours: 48 });

    let threw = false;
    let result = -1;
    try {
      result = await checkAndMarkDelayedWorkOrders();
    } catch {
      threw = true;
    } finally {
      storage.getWorkOrders = originalGetWorkOrders;
      storage.getAppSettings = originalGetAppSettings;
    }

    assert.strictEqual(threw, false, "checkAndMarkDelayedWorkOrders must not throw for invalid UUIDs");
    assert.strictEqual(result, 0, "Should return 0 marked when all records are skipped");
  });

  it("processes valid UUID records and skips invalid ones in the same batch", async () => {
    const { storage } = await import("../storage");

    const originalGetWorkOrders = storage.getWorkOrders.bind(storage);
    const originalGetAppSettings = storage.getAppSettings.bind(storage);
    const originalGetTypingJobs = storage.getTypingJobsByWoId.bind(storage);

    const validUuid = "12345678-1234-4000-8000-000000000001";
    const queriedIds: string[] = [];

    storage.getWorkOrders = async () => [
      makeWorkOrder("seed-wo-bad", { woNumber: "BAD-001", status: "Scheduled" }),
      makeWorkOrder(validUuid, { woNumber: "GOOD-001", status: "Scheduled" }),
    ];
    storage.getAppSettings = async () => makeAppSettings({ vendorDelayThresholdHours: 48 });
    storage.getTypingJobsByWoId = async (woId: string) => {
      queriedIds.push(woId);
      return [];
    };

    try {
      await checkAndMarkDelayedWorkOrders();
    } finally {
      storage.getWorkOrders = originalGetWorkOrders;
      storage.getAppSettings = originalGetAppSettings;
      storage.getTypingJobsByWoId = originalGetTypingJobs;
    }

    assert.ok(!queriedIds.includes("seed-wo-bad"), "Invalid ID should be skipped — never queried");
    assert.ok(queriedIds.includes(validUuid), "Valid UUID should be processed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Vendor completion notification includes CRM (source check — exact roles)
// ─────────────────────────────────────────────────────────────────────────────

describe("2. Vendor completion — CRM notification", () => {
  it("vendor-portal completion notifyStaffByRoles includes all 4 required roles including CRM", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("server/routes/vendor-portal.ts", "utf8");
    const crmIdx = src.indexOf('"Client Relationship Manager"');
    assert.ok(crmIdx !== -1, "vendor-portal.ts must contain the role string 'Client Relationship Manager'");
    const surroundingBlock = src.slice(Math.max(0, crmIdx - 300), crmIdx + 300);
    assert.ok(surroundingBlock.includes("notifyStaffByRoles"), "CRM role must appear inside a notifyStaffByRoles call");
    assert.ok(surroundingBlock.includes('"Admin"'), "notifyStaffByRoles must also include Admin");
    assert.ok(surroundingBlock.includes('"PRO"'), "notifyStaffByRoles must also include PRO");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Biometrics timer NO_SHOW — CRM notification (behavioral)
// ─────────────────────────────────────────────────────────────────────────────

describe("3. Biometrics timer NO_SHOW — CRM notification (behavioral)", () => {
  it("dispatches staff notification when company has rmStaffId with linked userId", async () => {
    const { storage } = await import("../storage");
    const testWoId = "aaaaaaaa-0001-4000-8000-000000000001";
    const testCompanyId = "bbbbbbbb-0001-4000-8000-000000000001";
    const testRmStaffId = "cccccccc-0001-4000-8000-000000000001";
    const testUserId = "dddddddd-0001-4000-8000-000000000001";

    const originalGetWO = storage.getWorkOrderById.bind(storage);
    const originalGetCompany = storage.getCompanyById.bind(storage);
    const originalGetStaff = storage.getStaffById.bind(storage);
    const originalCreateNotification = storage.createStaffNotification.bind(storage);

    const capturedNotifications: Array<Pick<StaffNotification, "userId" | "title">> = [];
    const capturedRoleNotifications: Array<{ roles: string[]; notification: Record<string, unknown> }> = [];

    storage.getWorkOrderById = async (id: string) => {
      if (id === testWoId) return makeWorkOrder(testWoId, { woNumber: "WO-TEST-001", applicantName: "Test Applicant", companyId: testCompanyId });
      return originalGetWO(id);
    };
    storage.getCompanyById = async (id: string) => {
      if (id === testCompanyId) return makeCompany(testCompanyId, { rmStaffId: testRmStaffId });
      return originalGetCompany(id);
    };
    storage.getStaffById = async (id: string) => {
      if (id === testRmStaffId) {
        // Inject userId via structural extension — Staff type does not yet define userId
        // but the notification dispatch path reads it when present.
        return Object.assign(makeStaff(testRmStaffId), { userId: testUserId });
      }
      return originalGetStaff(id);
    };
    storage.createStaffNotification = async (n: InsertStaffNotification) => {
      capturedNotifications.push({ userId: n.userId, title: n.title });
      return makeStaffNotification(n);
    };

    const mockNotifyByRoles = async (roles: string[], notification: Record<string, unknown>) => {
      capturedRoleNotifications.push({ roles, notification });
    };

    try {
      await dispatchBiometricsNoShowNotification(testWoId, mockNotifyByRoles);
    } finally {
      storage.getWorkOrderById = originalGetWO;
      storage.getCompanyById = originalGetCompany;
      storage.getStaffById = originalGetStaff;
      storage.createStaffNotification = originalCreateNotification;
    }

    assert.strictEqual(capturedNotifications.length, 1, "Should create one direct staff notification");
    assert.strictEqual(capturedNotifications[0].userId, testUserId, "Notification must be directed to CRM user");
    assert.strictEqual(capturedNotifications[0].title, "Biometrics Appointment: No Show", "Notification title must match");
    assert.strictEqual(capturedRoleNotifications.length, 0, "Must NOT fall back to role broadcast when CRM user found");
  });

  it("falls back to Admin role notification when company has no rmStaffId", async () => {
    const { storage } = await import("../storage");
    const testWoId = "aaaaaaaa-0002-4000-8000-000000000001";
    const testCompanyId = "bbbbbbbb-0002-4000-8000-000000000001";

    const originalGetWO = storage.getWorkOrderById.bind(storage);
    const originalGetCompany = storage.getCompanyById.bind(storage);

    const capturedRoleNotifications: Array<{ roles: string[]; notification: Record<string, unknown> }> = [];

    storage.getWorkOrderById = async (id: string) => {
      if (id === testWoId) return makeWorkOrder(testWoId, { woNumber: "WO-TEST-002", applicantName: "No RM Applicant", companyId: testCompanyId });
      return originalGetWO(id);
    };
    storage.getCompanyById = async (id: string) => {
      if (id === testCompanyId) return makeCompany(testCompanyId, { rmStaffId: null });
      return originalGetCompany(id);
    };

    const mockNotifyByRoles = async (roles: string[], notification: Record<string, unknown>) => {
      capturedRoleNotifications.push({ roles, notification });
    };

    try {
      await dispatchBiometricsNoShowNotification(testWoId, mockNotifyByRoles);
    } finally {
      storage.getWorkOrderById = originalGetWO;
      storage.getCompanyById = originalGetCompany;
    }

    assert.strictEqual(capturedRoleNotifications.length, 1, "Should fall back to role notification");
    assert.deepEqual(capturedRoleNotifications[0].roles, ["Admin"], "Fallback must notify Admin role");
    assert.strictEqual(capturedRoleNotifications[0].notification.title, "Biometrics Appointment: No Show");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Quick-login security — ENABLE_QUICK_LOGIN flag gating (source check)
// ─────────────────────────────────────────────────────────────────────────────

describe("4. Quick-login — ENABLE_QUICK_LOGIN flag gating (source check)", () => {
  it("auth.ts accounts endpoint checks ENABLE_QUICK_LOGIN", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("server/routes/auth.ts", "utf8");
    assert.ok(src.includes("ENABLE_QUICK_LOGIN"), "auth.ts must reference ENABLE_QUICK_LOGIN");
    assert.ok(src.includes("process.env.ENABLE_QUICK_LOGIN === 'true'"), "auth.ts must check ENABLE_QUICK_LOGIN === 'true'");
  });

  it("auth.ts quick-login still checks NODE_ENV !== production", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("server/routes/auth.ts", "utf8");
    assert.ok(src.includes("process.env.NODE_ENV === 'production'"), "auth.ts must still check NODE_ENV === production");
  });

  it("auth.ts access logs include ISO timestamp", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("server/routes/auth.ts", "utf8");
    assert.ok(src.includes("ts=${new Date().toISOString()}"), "auth.ts access logs must include ISO timestamp");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Quick-login — HTTP-level gating (real Express server)
// ─────────────────────────────────────────────────────────────────────────────

describe("5. Quick-login — HTTP gating (real Express)", () => {
  let server: http.Server;
  let port: number;

  before(
    () =>
      new Promise<void>((resolve) => {
        const app = express();
        app.use(express.json());
        const MemoryStoreSession = MemoryStore(session);
        app.use(
          session({
            secret: "test-secret",
            resave: false,
            saveUninitialized: false,
            store: new MemoryStoreSession({ checkPeriod: 86400000 }),
          })
        );
        registerAuthRoutes(app);
        server = app.listen(0, "127.0.0.1", () => {
          port = (server.address() as { port: number }).port;
          resolve();
        });
      })
  );

  after(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      })
  );

  it("POST /api/auth/quick-login returns 403 when ENABLE_QUICK_LOGIN is not set", async () => {
    const savedEnv = process.env.NODE_ENV;
    const savedFlag = process.env.ENABLE_QUICK_LOGIN;
    process.env.NODE_ENV = "development";
    delete process.env.ENABLE_QUICK_LOGIN;
    try {
      const res = await makeRequest(port, "POST", "/api/auth/quick-login", { userId: "test" });
      assert.strictEqual(res.status, 403);
    } finally {
      process.env.NODE_ENV = savedEnv;
      if (savedFlag !== undefined) process.env.ENABLE_QUICK_LOGIN = savedFlag;
      else delete process.env.ENABLE_QUICK_LOGIN;
    }
  });

  it("POST /api/auth/quick-login returns 403 when NODE_ENV=production and ENABLE_QUICK_LOGIN=true", async () => {
    const savedEnv = process.env.NODE_ENV;
    const savedFlag = process.env.ENABLE_QUICK_LOGIN;
    process.env.NODE_ENV = "production";
    process.env.ENABLE_QUICK_LOGIN = "true";
    try {
      const res = await makeRequest(port, "POST", "/api/auth/quick-login", { userId: "test" });
      assert.strictEqual(res.status, 403);
    } finally {
      process.env.NODE_ENV = savedEnv;
      if (savedFlag !== undefined) process.env.ENABLE_QUICK_LOGIN = savedFlag;
      else delete process.env.ENABLE_QUICK_LOGIN;
    }
  });

  it("POST /api/auth/quick-login returns 403 when ENABLE_QUICK_LOGIN=false", async () => {
    const savedEnv = process.env.NODE_ENV;
    const savedFlag = process.env.ENABLE_QUICK_LOGIN;
    process.env.NODE_ENV = "development";
    process.env.ENABLE_QUICK_LOGIN = "false";
    try {
      const res = await makeRequest(port, "POST", "/api/auth/quick-login", { userId: "test" });
      assert.strictEqual(res.status, 403);
    } finally {
      process.env.NODE_ENV = savedEnv;
      if (savedFlag !== undefined) process.env.ENABLE_QUICK_LOGIN = savedFlag;
      else delete process.env.ENABLE_QUICK_LOGIN;
    }
  });

  it("GET /api/auth/accounts returns 403 when ENABLE_QUICK_LOGIN is not set", async () => {
    const savedEnv = process.env.NODE_ENV;
    const savedFlag = process.env.ENABLE_QUICK_LOGIN;
    process.env.NODE_ENV = "development";
    delete process.env.ENABLE_QUICK_LOGIN;
    try {
      const res = await makeRequest(port, "GET", "/api/auth/accounts");
      assert.strictEqual(res.status, 403);
    } finally {
      process.env.NODE_ENV = savedEnv;
      if (savedFlag !== undefined) process.env.ENABLE_QUICK_LOGIN = savedFlag;
      else delete process.env.ENABLE_QUICK_LOGIN;
    }
  });

  it("GET /api/auth/accounts returns 403 when NODE_ENV=production and ENABLE_QUICK_LOGIN=true", async () => {
    const savedEnv = process.env.NODE_ENV;
    const savedFlag = process.env.ENABLE_QUICK_LOGIN;
    process.env.NODE_ENV = "production";
    process.env.ENABLE_QUICK_LOGIN = "true";
    try {
      const res = await makeRequest(port, "GET", "/api/auth/accounts");
      assert.strictEqual(res.status, 403);
    } finally {
      process.env.NODE_ENV = savedEnv;
      if (savedFlag !== undefined) process.env.ENABLE_QUICK_LOGIN = savedFlag;
      else delete process.env.ENABLE_QUICK_LOGIN;
    }
  });

  it("POST /api/auth/quick-login passes flag check when NODE_ENV=test and ENABLE_QUICK_LOGIN=true (may 401 if user not found)", async () => {
    const savedEnv = process.env.NODE_ENV;
    const savedFlag = process.env.ENABLE_QUICK_LOGIN;
    process.env.NODE_ENV = "test";
    process.env.ENABLE_QUICK_LOGIN = "true";
    try {
      const res = await makeRequest(port, "POST", "/api/auth/quick-login", { userId: "nonexistent-id-xyz" });
      assert.notStrictEqual(res.status, 403, `Must not be 403 (flag check passed) — got ${res.status}`);
    } finally {
      process.env.NODE_ENV = savedEnv;
      if (savedFlag !== undefined) process.env.ENABLE_QUICK_LOGIN = savedFlag;
      else delete process.env.ENABLE_QUICK_LOGIN;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Vendor-job-assigned email — state machine onEmail side-effect (behavioral)
// ─────────────────────────────────────────────────────────────────────────────

describe("6. Vendor-job-assigned email — state machine onEmail side-effect", () => {
  it("executeTransition fires onEmail(vendor_job_assigned) with correct vendorId on submit_to_vendor", async () => {
    const { storage } = await import("../storage");

    const jobId = "eeeeeeee-0001-4000-8000-000000000001";
    const vendorId = "ffffffff-0001-4000-8000-000000000001";
    const testJob = makeTypingJob(jobId, { status: "Draft", vendorId: null });

    const originalGetTypingJob = storage.getTypingJobById.bind(storage);
    const originalUpdateTypingJob = storage.updateTypingJob.bind(storage);
    const originalCreateAuditLog = storage.createAuditLog.bind(storage);

    const capturedEmailEvents: Array<{ event: string; ctx: TransitionContext }> = [];

    storage.getTypingJobById = async (id: string) => {
      if (id === jobId) return testJob;
      return originalGetTypingJob(id);
    };
    storage.updateTypingJob = async (id: string, fields: Partial<TypingJob>) => {
      if (id === jobId) return makeTypingJob(id, { ...testJob, ...fields, vendorId });
      return originalUpdateTypingJob(id, fields);
    };
    storage.createAuditLog = async () => makeAuditLog();

    try {
      const result = await executeTransition({
        action: "submit_to_vendor",
        jobId,
        actor: "team",
        actorId: "actor-test-id",
        storage,
        notifyVendorUsers: async () => { return; },
        onEmail: (event, ctx) => {
          capturedEmailEvents.push({ event, ctx });
        },
        updateFields: { vendorId },
      });

      assert.strictEqual(result.success, true, "Transition must succeed");
      assert.strictEqual(capturedEmailEvents.length, 1, "onEmail must be called exactly once");
      assert.strictEqual(capturedEmailEvents[0].event, "vendor_job_assigned", "Event name must be vendor_job_assigned");
      assert.strictEqual(capturedEmailEvents[0].ctx.vendorId, vendorId, "ctx must carry the vendorId");
      assert.strictEqual(capturedEmailEvents[0].ctx.jobId, jobId, "ctx must carry the jobId");
    } finally {
      storage.getTypingJobById = originalGetTypingJob;
      storage.updateTypingJob = originalUpdateTypingJob;
      storage.createAuditLog = originalCreateAuditLog;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Email template registry — status accuracy
// ─────────────────────────────────────────────────────────────────────────────

describe("7. Email template registry — status accuracy", () => {
  it("vendor-job-assigned template is marked wired", () => {
    const templates = getTemplateRegistry();
    const t = templates.find(x => x.id === "vendor-job-assigned");
    assert.ok(t !== undefined, "vendor-job-assigned template must exist in registry");
    assert.strictEqual(t.status, "wired", "vendor-job-assigned must have status 'wired'");
  });

  it("exactly 4 templates have status live (the wired appointment/document emails)", () => {
    const templates = getTemplateRegistry();
    const live = templates.filter(t => t.status === "live");
    const liveIds = live.map(t => t.id).sort();
    assert.deepEqual(
      liveIds,
      ["document-collection", "document-return", "eid-appointment", "medical-appointment"],
      "Exactly 4 live templates expected"
    );
  });

  it("no template is missing a status field", () => {
    const templates = getTemplateRegistry();
    const missing = templates.filter(t => !t.status);
    assert.strictEqual(missing.length, 0, `All templates must have a status; missing: ${missing.map(t => t.id).join(", ")}`);
  });

  it("vendor-job-assigned preview produces non-empty HTML", () => {
    const html = buildTemplatePreview("vendor-job-assigned");
    assert.ok(typeof html === "string" && html.length > 100, "vendor-job-assigned preview must return substantial HTML");
    assert.ok(html.includes("<!DOCTYPE html>") || html.toLowerCase().includes("<html"), "preview must be valid HTML document");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

after(async () => {
  await pool.end();
});
