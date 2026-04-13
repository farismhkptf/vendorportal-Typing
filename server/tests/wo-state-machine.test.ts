/**
 * Integration-level tests for the Work Order State Machine (Task #105)
 *
 * These tests exercise REAL production code at two levels:
 *
 * 1. Service-layer: imports and calls the actual transition-service functions
 *    directly (via dependency injection of a storage stub).
 *
 * 2. Route-layer: builds a real Express app with the actual scheduling and
 *    work-order route handlers, spins up a local HTTP server, and makes live
 *    HTTP requests to assert correct status codes, response bodies, and
 *    side-effects in the storage layer.
 *
 * Run with:  NODE_TEST=1 npx tsx --test server/tests/wo-state-machine.test.ts
 */

import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import session from "express-session";
import MemoryStore from "memorystore";


// ── Real production services under test ──────────────────────────────────────
import {
  checkAndAutoTransitionWorkOrder,
  checkAndAutoCompleteWorkOrder,
  checkAndRevertWoIfNoAppointments,
  _setStorageForTesting,
  _resetStorage,
  _setCompletionTransactionForTesting,
  _resetCompletionTransaction,
} from "../services/transition-service";

// Storage singleton shared by both route handlers and transition-service
import { storage } from "../storage";

// DB pool — imported so we can close it cleanly and avoid open-handle timeouts
import { pool } from "../db";

// Real route registrars
import { registerSchedulingRoutes } from "../routes/scheduling";
import { registerWorkOrderRoutes } from "../routes/work-orders";

// ──────────────────────────────────────────────────────────────────────────────
// Fixture builders
// ──────────────────────────────────────────────────────────────────────────────

type WoStatus = "Draft" | "AtVendor" | "ReadyToSchedule" | "Scheduled" | "Completed" | "Cancelled";

function makeWo(overrides: Record<string, unknown> = {}) {
  return {
    id: "wo-test-1",
    woNumber: "WO99999",
    applicantName: "Test Applicant",
    companyId: "co-test-1",
    serviceTypeId: "st-test-1",
    status: "Draft" as WoStatus,
    isMinor: false,
    isDelayed: false,
    notes: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeServiceType(overrides: Record<string, unknown> = {}) {
  return {
    id: "st-test-1",
    name: "Test Service",
    requiresMedicalTyping: false,
    requiresMedicalScheduling: false,
    requiresIdTyping2Years: false,
    requiresIdTyping1Year: false,
    requiresIdTyping10Years: false,
    requiresIdBiometrics: false,
    requiresAttestation: false,
    ...overrides,
  };
}

function makeTypingJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "tj-test-1",
    woId: "wo-test-1",
    jobCode: "M00001",
    status: "Draft",
    jobTypeId: "jt-med",
    vendorId: null,
    notes: null,
    sentAt: null,
    ...overrides,
  };
}

function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "apt-test-1",
    woId: "wo-test-1",
    status: "Scheduled",
    type: "Medical",
    ...overrides,
  };
}

const FAKE_ADMIN = {
  id: "test-admin-user-id",
  email: "testadmin@example.com",
  role: "Admin",
  active: true,
  name: "Test Admin",
  staffId: null,
  companyId: null,
};

// ──────────────────────────────────────────────────────────────────────────────
// In-memory store
// ──────────────────────────────────────────────────────────────────────────────

interface InMemoryStore {
  workOrders: Map<string, ReturnType<typeof makeWo>>;
  serviceTypes: Map<string, ReturnType<typeof makeServiceType>>;
  typingJobs: Map<string, ReturnType<typeof makeTypingJob>>;
  appointments: Map<string, ReturnType<typeof makeAppointment>>;
  medicalCases: Map<string, { id: string; woId: string; isOpen: boolean }>;
  biometricsCases: Map<string, { id: string; woId: string; isOpen: boolean }>;
  auditLogs: Array<Record<string, unknown>>;
  updatedTypingJobs: Array<{ id: string; data: Record<string, unknown> }>;
  createdTypingJobs: Array<Record<string, unknown>>;
}

function makeStore(): InMemoryStore {
  return {
    workOrders: new Map(),
    serviceTypes: new Map(),
    typingJobs: new Map(),
    appointments: new Map(),
    medicalCases: new Map(),
    biometricsCases: new Map(),
    auditLogs: [],
    updatedTypingJobs: [],
    createdTypingJobs: [],
  };
}

function buildStub(store: InMemoryStore) {
  return {
    async getWorkOrderById(id: string) { return store.workOrders.get(id); },
    async updateWorkOrder(id: string, data: Record<string, unknown>) {
      const existing = store.workOrders.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...data };
      store.workOrders.set(id, updated);
      return updated;
    },
    async getServiceTypeById(id: string) { return store.serviceTypes.get(id); },
    async getTypingJobsByWoId(woId: string) {
      return [...store.typingJobs.values()].filter(j => j.woId === woId);
    },
    async getAppointmentsByWoId(woId: string) {
      return [...store.appointments.values()].filter(a => a.woId === woId);
    },
    async getMedicalCaseByWoId(woId: string) {
      return [...store.medicalCases.values()].find(c => c.woId === woId);
    },
    async getBiometricsCaseByWoId(woId: string) {
      return [...store.biometricsCases.values()].find(c => c.woId === woId);
    },
    async updateMedicalCase(id: string, data: Record<string, unknown>) {
      const existing = [...store.medicalCases.values()].find(c => c.id === id);
      if (!existing) return undefined;
      const updated = { ...existing, ...data };
      store.medicalCases.set(id, updated);
      return updated;
    },
    async updateBiometricsCase(id: string, data: Record<string, unknown>) {
      const existing = [...store.biometricsCases.values()].find(c => c.id === id);
      if (!existing) return undefined;
      const updated = { ...existing, ...data };
      store.biometricsCases.set(id, updated);
      return updated;
    },
    async updateTypingJob(id: string, data: Record<string, unknown>) {
      const existing = store.typingJobs.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...data };
      store.typingJobs.set(id, updated);
      store.updatedTypingJobs.push({ id, data });
      return updated;
    },
    async createTypingJob(data: Record<string, unknown>) {
      const job = { id: `tj-new-${Date.now()}-${Math.random()}`, notes: null, ...data };
      store.typingJobs.set(job.id as string, job as ReturnType<typeof makeTypingJob>);
      store.createdTypingJobs.push(job);
      return job;
    },
    async getJobTypes() {
      return [
        { id: "jt-med", category: "Medical", name: "Medical Typing" },
        { id: "jt-eid", category: "EID", name: "EID Typing" },
      ];
    },
    async generateNextJobCode(category: string) {
      return category === "Medical" ? "M99999" : "E99999";
    },
    async getCyclesByCase(_caseId: string) { return []; },
    async getBiometricsCyclesByCase(_caseId: string) { return []; },
    async getAttestationSrs() { return []; },
    async getCompanyById(_id: string) { return null; },
    async getStaffById(_id: string) { return null; },
    async getAppSettings() { return null; },
    async createAuditLog(data: Record<string, unknown>) { store.auditLogs.push(data); },
    async createStaffNotification(_data: unknown) { return null; },
    async createMedicalCase(_data: unknown) {
      const mc = { id: `mc-${Date.now()}`, woId: "wo-test-1", isOpen: true };
      store.medicalCases.set(mc.id, mc);
      return mc;
    },
    async getAllAppointments() { return []; },
    async getTypingJobs(_status?: string) { return []; },
    async getUser(_id: string) { return FAKE_ADMIN; },
    async getUserByEmail(_email: string) { return FAKE_ADMIN; },
    async createWoNote(_data: unknown) { return null; },
    async getWoNotes(_woId: string) { return []; },
    async getUserById(_id: string) { return FAKE_ADMIN; },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Storage patching: replace method implementations on the singleton in-place
// ──────────────────────────────────────────────────────────────────────────────

type Stub = ReturnType<typeof buildStub>;
const _savedMethods = new Map<string, unknown>();

function patchStorage(stub: Stub): void {
  for (const key of Object.keys(stub) as (keyof Stub)[]) {
    if (typeof stub[key] === "function") {
      if (!_savedMethods.has(key)) {
        // Walk prototype chain to find original
        let proto: object = storage;
        while (proto) {
          if (Object.getOwnPropertyDescriptor(proto, key)) {
            _savedMethods.set(key, (storage as Record<string, unknown>)[key]
              ?? (proto as Record<string, unknown>)[key]);
            break;
          }
          proto = Object.getPrototypeOf(proto) as object;
        }
      }
      (storage as Record<string, unknown>)[key] = stub[key];
    }
  }
}

function unpatchStorage(): void {
  for (const [key, fn] of _savedMethods) {
    (storage as Record<string, unknown>)[key] = fn;
  }
  _savedMethods.clear();
}

// ──────────────────────────────────────────────────────────────────────────────
// Test Express server with real route handlers + in-memory session
// ──────────────────────────────────────────────────────────────────────────────

let _server: http.Server;
let _port: number;
let _memStore: InstanceType<ReturnType<typeof MemoryStore>>;

const MemoryStoreClass = MemoryStore(session);

function buildTestApp(): express.Application {
  const app = express();
  app.use(express.json());

  _memStore = new MemoryStoreClass({ checkPeriod: 0 }); // checkPeriod=0 disables the interval timer
  app.use(session({
    secret: "test-session-secret",
    resave: false,
    saveUninitialized: false,
    store: _memStore,
  }));

  // Pre-set session userId so requireAuth passes without a real login.
  // requireAuth checks req.session?.userId first, so this bypasses JWT/login.
  app.use((req, _res, next) => {
    if (!req.session.userId) {
      req.session.userId = FAKE_ADMIN.id;
      req.session.userRole = FAKE_ADMIN.role;
      req.session.userName = FAKE_ADMIN.name;
      req.session.staffId = null;
    }
    next();
  });

  const routeDeps = {
    notifyStaffByRoles: async () => {},
    notifyVendorUsers: async () => {},
  } as unknown as import("../routes/types").RouteDeps;

  registerSchedulingRoutes(app, routeDeps);
  registerWorkOrderRoutes(app, routeDeps);

  return app;
}

before(async () => {
  const app = buildTestApp();
  await new Promise<void>((resolve) => {
    _server = http.createServer(app);
    _server.listen(0, "127.0.0.1", () => {
      const addr = _server.address();
      _port = typeof addr === "object" && addr !== null ? addr.port : 0;
      // unref so the server does not keep the Node process alive after tests finish
      _server.unref();
      resolve();
    });
  });
});

after(async () => {
  _server.closeAllConnections();
  await new Promise<void>((resolve) => _server.close(() => resolve()));
  // Close the DB connection pool that transition-service imports keep alive
  await pool.end().catch(() => { /* ignore if already closed */ });
});

afterEach(() => {
  unpatchStorage();
  _resetStorage();
  _resetCompletionTransaction();
});

// ──────────────────────────────────────────────────────────────────────────────
// HTTP helper
// ──────────────────────────────────────────────────────────────────────────────

function httpReq(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : "";
    const opts: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: _port,
      path,
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : {} }); }
        catch { resolve({ status: res.statusCode ?? 0, body: { raw: data } }); }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// setupStore: seed the in-memory store and patch storage + transition service
// ──────────────────────────────────────────────────────────────────────────────

function setupStore(init?: (s: InMemoryStore) => void): InMemoryStore {
  const store = makeStore();
  if (init) init(store);
  const stub = buildStub(store);
  patchStorage(stub);
  _setStorageForTesting(stub as unknown as import("../storage").IStorage);
  _setCompletionTransactionForTesting(async (woId: string) => {
    const wo = store.workOrders.get(woId);
    if (wo) store.workOrders.set(woId, { ...wo, status: "Completed" as WoStatus });
    for (const [id, mc] of store.medicalCases) {
      if (mc.woId === woId) store.medicalCases.set(id, { ...mc, isOpen: false });
    }
    for (const [id, bc] of store.biometricsCases) {
      if (bc.woId === woId) store.biometricsCases.set(id, { ...bc, isOpen: false });
    }
  });
  return store;
}

// ──────────────────────────────────────────────────────────────────────────────
// Suite 1 — Activation transitions (service-layer)
// ──────────────────────────────────────────────────────────────────────────────

describe("1. Activating a WO — state machine transitions (service-layer)", () => {
  it("Draft → AtVendor when service type requires typing and Draft jobs exist", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Draft", serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({ id: "st-test-1", requiresMedicalTyping: true }));
      s.typingJobs.set("tj-1", makeTypingJob({ id: "tj-1", status: "Draft", jobCode: "M00001" }));
    });

    await checkAndAutoTransitionWorkOrder("wo-test-1");

    assert.equal(store.workOrders.get("wo-test-1")!.status, "AtVendor");
    assert.ok(store.auditLogs.some(l => (l.details as Record<string, string>)?.to === "AtVendor"));
  });

  it("Draft → AtVendor when jobs are SubmittedToVendor", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Draft", serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({ id: "st-test-1", requiresMedicalTyping: true }));
      s.typingJobs.set("tj-1", makeTypingJob({ id: "tj-1", status: "SubmittedToVendor", jobCode: "M00001" }));
    });

    await checkAndAutoTransitionWorkOrder("wo-test-1");

    assert.equal(store.workOrders.get("wo-test-1")!.status, "AtVendor");
  });

  it("AtVendor → ReadyToSchedule when all required typing jobs are terminal", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "AtVendor", serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({ id: "st-test-1", requiresMedicalTyping: true }));
      s.typingJobs.set("tj-1", makeTypingJob({ id: "tj-1", status: "ReadyForScheduling", jobCode: "M00001" }));
    });

    await checkAndAutoTransitionWorkOrder("wo-test-1");

    assert.equal(store.workOrders.get("wo-test-1")!.status, "ReadyToSchedule");
    assert.ok(store.auditLogs.some(l => (l.details as Record<string, string>)?.to === "ReadyToSchedule"));
  });

  it("Draft → ReadyToSchedule when service type requires no typing", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Draft", serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({ id: "st-test-1" }));
    });

    await checkAndAutoTransitionWorkOrder("wo-test-1");

    assert.equal(store.workOrders.get("wo-test-1")!.status, "ReadyToSchedule");
  });

  it("Completed WO never transitions (regression guard)", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Completed", serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({ id: "st-test-1", requiresMedicalTyping: true }));
    });

    await checkAndAutoTransitionWorkOrder("wo-test-1");

    assert.equal(store.workOrders.get("wo-test-1")!.status, "Completed");
    assert.equal(store.auditLogs.length, 0);
  });

  it("isMinor=true: medical typing requirement suppressed → Draft → ReadyToSchedule", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Draft", isMinor: true, serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({ id: "st-test-1", requiresMedicalTyping: true }));
    });

    await checkAndAutoTransitionWorkOrder("wo-test-1");

    assert.equal(store.workOrders.get("wo-test-1")!.status, "ReadyToSchedule",
      "minor WO: needsMedical=false → noTypingRequired=true → ReadyToSchedule");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 2 — Appointment cancellation reversion (service-layer)
// ──────────────────────────────────────────────────────────────────────────────

describe("2. Cancelling an appointment — WO reversion (service-layer)", () => {
  it("Scheduled → ReadyToSchedule when last appointment is cancelled", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Scheduled" }));
      s.appointments.set("apt-1", makeAppointment({ id: "apt-1", status: "Cancelled" }));
    });

    await checkAndRevertWoIfNoAppointments("wo-test-1");

    assert.equal(store.workOrders.get("wo-test-1")!.status, "ReadyToSchedule");
    assert.ok(store.auditLogs.some(l => {
      const d = l.details as Record<string, string>;
      return d?.to === "ReadyToSchedule" && d?.reason === "All appointments cancelled";
    }));
  });

  it("stays Scheduled when one active appointment remains", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Scheduled" }));
      s.appointments.set("apt-1", makeAppointment({ id: "apt-1", status: "Cancelled" }));
      s.appointments.set("apt-2", makeAppointment({ id: "apt-2", status: "Scheduled" }));
    });

    await checkAndRevertWoIfNoAppointments("wo-test-1");

    assert.equal(store.workOrders.get("wo-test-1")!.status, "Scheduled");
  });

  it("does not revert WO when not in Scheduled status", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "AtVendor" }));
      s.appointments.set("apt-1", makeAppointment({ id: "apt-1", status: "Cancelled" }));
    });

    await checkAndRevertWoIfNoAppointments("wo-test-1");

    assert.equal(store.workOrders.get("wo-test-1")!.status, "AtVendor");
  });

  it("Rescheduled appointments are treated as inactive → triggers reversion", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Scheduled" }));
      s.appointments.set("apt-1", makeAppointment({ id: "apt-1", status: "Rescheduled" }));
    });

    await checkAndRevertWoIfNoAppointments("wo-test-1");

    assert.equal(store.workOrders.get("wo-test-1")!.status, "ReadyToSchedule");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 3 — Minor guard: route-level HTTP test (POST /api/medical-cases/:woId)
// ──────────────────────────────────────────────────────────────────────────────

describe("3. Minor applicant guard — POST /api/medical-cases/:woId (route-level HTTP)", () => {
  it("returns HTTP 400 with minor-guard message when wo.isMinor=true", async () => {
    setupStore(s => {
      s.workOrders.set("wo-minor", makeWo({ id: "wo-minor", isMinor: true }));
    });

    const { status, body } = await httpReq("POST", "/api/medical-cases/wo-minor", {});

    assert.equal(status, 400);
    assert.equal(
      (body as Record<string, string>).message,
      "Medical scheduling is not required for minor applicants"
    );
  });

  it("does NOT return 400 for non-minor applicants (passes minor guard)", async () => {
    setupStore(s => {
      s.workOrders.set("wo-adult", makeWo({ id: "wo-adult", isMinor: false }));
      s.medicalCases.set("mc-1", { id: "mc-1", woId: "wo-adult", isOpen: true });
    });

    const { status } = await httpReq("POST", "/api/medical-cases/wo-adult", {});

    assert.notEqual(status, 400, "non-minor applicant must not be blocked by the minor guard");
  });

  it("returns HTTP 404 when WO does not exist", async () => {
    setupStore(_ => { /* empty store */ });

    const { status, body } = await httpReq("POST", "/api/medical-cases/nonexistent-wo", {});

    assert.equal(status, 404);
    assert.equal((body as Record<string, string>).message, "Work order not found");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 4 — Service-type change: route-level HTTP (PUT /api/work-orders/:id)
// ──────────────────────────────────────────────────────────────────────────────

describe("4. Service type change — PUT /api/work-orders/:id (route-level HTTP)", () => {
  it("returns HTTP 409 when InProcess typing jobs exist", async () => {
    setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ id: "wo-test-1", serviceTypeId: "st-old" }));
      s.serviceTypes.set("st-old", makeServiceType({ id: "st-old" }));
      s.serviceTypes.set("st-new", makeServiceType({ id: "st-new", requiresMedicalTyping: true }));
      s.typingJobs.set("tj-1", makeTypingJob({ id: "tj-1", status: "InProcess", woId: "wo-test-1" }));
    });

    const { status, body } = await httpReq("PUT", "/api/work-orders/wo-test-1", {
      serviceTypeId: "st-new",
    });

    assert.equal(status, 409);
    assert.ok(
      (body as Record<string, string>).message?.includes("Cannot change service type"),
      "409 must include a meaningful error message"
    );
    assert.ok(
      Array.isArray((body as Record<string, unknown>).inFlightJobIds),
      "409 response must include inFlightJobIds array"
    );
    assert.ok(
      ((body as Record<string, string[]>).inFlightJobIds ?? []).includes("tj-1"),
      "in-flight job id must be listed"
    );
  });

  it("aborts Draft jobs and creates new jobs for the new service type", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ id: "wo-test-1", serviceTypeId: "st-old" }));
      s.serviceTypes.set("st-old", makeServiceType({ id: "st-old" }));
      s.serviceTypes.set("st-new", makeServiceType({ id: "st-new", requiresIdTyping2Years: true }));
      s.typingJobs.set("tj-draft", makeTypingJob({ id: "tj-draft", status: "Draft", woId: "wo-test-1" }));
      s.typingJobs.set("tj-terminal", makeTypingJob({ id: "tj-terminal", status: "ReadyForScheduling", woId: "wo-test-1" }));
    });

    const { status } = await httpReq("PUT", "/api/work-orders/wo-test-1", {
      serviceTypeId: "st-new",
    });

    assert.equal(status, 200, "service type change on non-InProcess jobs must succeed");

    const draftJob = store.typingJobs.get("tj-draft")!;
    const terminalJob = store.typingJobs.get("tj-terminal")!;
    assert.equal(draftJob.status, "Aborted", "Draft job must be aborted");
    assert.ok((draftJob.notes as string)?.includes("CancelledOnServiceTypeChange"), "abort note must include reason");
    assert.equal(terminalJob.status, "ReadyForScheduling", "terminal jobs must NOT be aborted");

    assert.ok(store.createdTypingJobs.length > 0, "new typing jobs must be created");
    assert.ok(
      store.createdTypingJobs.some(j => (j.jobCode as string)?.startsWith("E")),
      "new EID job must be created for the new service type"
    );
  });

  it("aborts SubmittedToVendor jobs (not blocked by 409 guard: only InProcess is blocked)", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ id: "wo-test-1", serviceTypeId: "st-old" }));
      s.serviceTypes.set("st-old", makeServiceType({ id: "st-old" }));
      s.serviceTypes.set("st-new", makeServiceType({ id: "st-new" }));
      s.typingJobs.set("tj-sv", makeTypingJob({ id: "tj-sv", status: "SubmittedToVendor", woId: "wo-test-1" }));
    });

    const { status } = await httpReq("PUT", "/api/work-orders/wo-test-1", {
      serviceTypeId: "st-new",
    });

    assert.equal(status, 200, "SubmittedToVendor jobs do not trigger 409 guard");
    assert.equal(
      store.typingJobs.get("tj-sv")!.status,
      "Aborted",
      "SubmittedToVendor job is aborted on service type change"
    );
  });

  it("returns HTTP 404 when WO does not exist", async () => {
    setupStore(_ => { /* empty store */ });

    const { status } = await httpReq("PUT", "/api/work-orders/no-such-wo", {
      serviceTypeId: "st-new",
    });

    assert.ok([404, 400].includes(status), "must return 404 or 400 for missing WO");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Suite 5 — WO completion and atomic case closure (service-layer)
// ──────────────────────────────────────────────────────────────────────────────

describe("5. Work order completion — cases are closed atomically (service-layer)", () => {
  it("completes WO and closes medical case when all typing and scheduling is done", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Scheduled", serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({
        id: "st-test-1", requiresMedicalTyping: true, requiresMedicalScheduling: true,
      }));
      s.typingJobs.set("tj-1", makeTypingJob({ id: "tj-1", status: "ReadyForScheduling", jobCode: "M00001" }));
      s.appointments.set("apt-1", makeAppointment({ id: "apt-1", status: "Completed", type: "Medical" }));
      s.medicalCases.set("mc-1", { id: "mc-1", woId: "wo-test-1", isOpen: true });
    });

    const completed = await checkAndAutoCompleteWorkOrder("wo-test-1");

    assert.equal(completed, true);
    assert.equal(store.workOrders.get("wo-test-1")!.status, "Completed");
    assert.equal(store.medicalCases.get("mc-1")!.isOpen, false);
    assert.ok(store.auditLogs.some(l => l.action === "auto_completed"));
  });

  it("closes both medical and biometrics cases on completion", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Scheduled", serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({ id: "st-test-1" }));
      s.medicalCases.set("mc-1", { id: "mc-1", woId: "wo-test-1", isOpen: true });
      s.biometricsCases.set("bc-1", { id: "bc-1", woId: "wo-test-1", isOpen: true });
    });

    const completed = await checkAndAutoCompleteWorkOrder("wo-test-1");

    assert.equal(completed, true);
    assert.equal(store.workOrders.get("wo-test-1")!.status, "Completed");
    assert.equal(store.medicalCases.get("mc-1")!.isOpen, false);
    assert.equal(store.biometricsCases.get("bc-1")!.isOpen, false);
  });

  it("does not complete when required medical typing is still in progress", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "AtVendor", serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({ id: "st-test-1", requiresMedicalTyping: true }));
      s.typingJobs.set("tj-1", makeTypingJob({ id: "tj-1", status: "SubmittedToVendor", jobCode: "M00001" }));
    });

    const completed = await checkAndAutoCompleteWorkOrder("wo-test-1");

    assert.equal(completed, false);
    assert.equal(store.workOrders.get("wo-test-1")!.status, "AtVendor");
  });

  it("does not complete when a FollowUpRequired appointment is blocking", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Scheduled", serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({ id: "st-test-1" }));
      s.appointments.set("apt-1", makeAppointment({ id: "apt-1", status: "FollowUpRequired" }));
    });

    const completed = await checkAndAutoCompleteWorkOrder("wo-test-1");

    assert.equal(completed, false);
    assert.notEqual(store.workOrders.get("wo-test-1")!.status, "Completed");
  });

  it("isOpen=false persists in storage after completion", async () => {
    const store = setupStore(s => {
      s.workOrders.set("wo-test-1", makeWo({ status: "Draft", serviceTypeId: "st-test-1" }));
      s.serviceTypes.set("st-test-1", makeServiceType({ id: "st-test-1" }));
      s.biometricsCases.set("bc-1", { id: "bc-1", woId: "wo-test-1", isOpen: true });
    });

    await checkAndAutoCompleteWorkOrder("wo-test-1");

    const fetchedBc = [...store.biometricsCases.values()].find(c => c.woId === "wo-test-1");
    assert.ok(fetchedBc, "biometrics case must still exist after completion");
    assert.equal(fetchedBc!.isOpen, false);
  });
});
