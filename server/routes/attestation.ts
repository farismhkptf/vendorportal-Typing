import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole, requireOpsRole, requireAttestationVendor, requireDocCustodyRole } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { checkAndAutoCompleteWorkOrder } from "../services/transition-service";
import { sendEmail, isEmailConfigured } from "../email-service";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";
import type { RouteDeps } from "./types";
import type { AttestationSr, InsertAttestationSr, InsertAttestationSrStep, InsertDocumentCustodyHandoff } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      attestationVendorUserId?: string;
      attestationVendorId?: string;
    }
  }
}

export function registerAttestationRoutes(app: Express, deps: RouteDeps): void {
  const { upload, notifyVendorUsers } = deps;

// ========== Attestation Categories (Admin CRUD) ==========
app.get("/api/admin/attestation-categories", requireAuth, async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === "true";
    const categories = await storage.getAttestationCategories(activeOnly);
    res.json(categories);
  } catch (err) {
    console.error("[attestation-categories] get error:", err);
    res.status(500).json({ message: "Failed to fetch attestation categories" });
  }
});

const createCategorySchema = z.object({
  name: z.string().min(1, "name is required").transform(s => s.trim()),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

app.post("/api/admin/attestation-categories", requireRole("Admin"), async (req, res) => {
  try {
    const validation = validateBody(createCategorySchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const { name, sortOrder, active } = validation.data;
    const existing = await storage.getAttestationCategoryByName(name.trim());
    if (existing) return res.status(409).json({ message: "A category with that name already exists" });
    const allCategories = await storage.getAttestationCategories();
    const nextOrder = typeof sortOrder === "number" ? sortOrder : allCategories.length;
    const category = await storage.createAttestationCategory({
      name: name.trim(),
      sortOrder: nextOrder,
      active: active ?? true,
    });
    res.status(201).json(category);
  } catch (err) {
    console.error("[attestation-categories] create error:", err);
    res.status(500).json({ message: "Failed to create attestation category" });
  }
});

const updateCategorySchema = z.object({
  name: z.string().min(1).transform(s => s.trim()).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

app.patch("/api/admin/attestation-categories/:id", requireRole("Admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const validation = validateBody(updateCategorySchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const { name, sortOrder, active } = validation.data;
    const existing = await storage.getAttestationCategoryById(id);
    if (!existing) return res.status(404).json({ message: "Category not found" });
    if (name !== undefined && name.trim() !== existing.name) {
      const conflict = await storage.getAttestationCategoryByName(name.trim());
      if (conflict && conflict.id !== id) return res.status(409).json({ message: "A category with that name already exists" });
      // Cascade the rename to all services and step records
      await storage.renameAttestationCategoryInServices(existing.name, name.trim());
    }
    const updated = await storage.updateAttestationCategory(id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(active !== undefined ? { active } : {}),
    });
    if (!updated) return res.status(404).json({ message: "Category not found" });
    res.json(updated);
  } catch (err) {
    console.error("[attestation-categories] update error:", err);
    res.status(500).json({ message: "Failed to update attestation category" });
  }
});

app.delete("/api/admin/attestation-categories/:id", requireRole("Admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const category = await storage.getAttestationCategoryById(id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    // Block deletion if any service uses this category
    const allServices = await storage.getAttestationServices();
    const inUse = allServices.some(svc => svc.category === category.name);
    if (inUse) return res.status(409).json({ message: "Cannot delete: this category is in use by one or more services" });
    await storage.deleteAttestationCategory(id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[attestation-categories] delete error:", err);
    res.status(500).json({ message: "Failed to delete attestation category" });
  }
});

// Bulk reorder categories
const reorderCategoriesSchema = z.object({
  ids: z.array(z.string().min(1)),
});

app.put("/api/admin/attestation-categories/reorder", requireRole("Admin"), async (req, res) => {
  try {
    const validation = validateBody(reorderCategoriesSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const { ids } = validation.data;
    await Promise.all(ids.map((id: string, index: number) =>
      storage.updateAttestationCategory(id, { sortOrder: index })
    ));
    const updated = await storage.getAttestationCategories();
    res.json(updated);
  } catch (err) {
    console.error("[attestation-categories] reorder error:", err);
    res.status(500).json({ message: "Failed to reorder categories" });
  }
});

// ========== Attestation Services Catalog (Admin only) ==========
app.get("/api/attestation/services", requireAuth, async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === "true";
    const services = await storage.getAttestationServices(activeOnly);
    const withVariants = await Promise.all(services.map(async (svc) => {
      const variants = await storage.getAttestationServiceVariants(svc.id);
      return { ...svc, variants };
    }));
    res.json(withVariants);
  } catch (err) {
    console.error("[attestation] get services error:", err);
    res.status(500).json({ message: "Failed to fetch attestation services" });
  }
});

const createServiceSchema = z.object({
  name: z.string().min(1, "name is required"),
  category: z.string().min(1, "category is required"),
  documentClassApplicability: z.string().optional(),
  basePriceAed: z.string().optional(),
  timelineDays: z.number().int().nullable().optional(),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

app.post("/api/attestation/services", requireRole("Admin"), async (req, res) => {
  try {
    const validation = validateBody(createServiceSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const { name, category, documentClassApplicability, basePriceAed, timelineDays, description, active } = validation.data;
    const service = await storage.createAttestationService({
      name, category, documentClassApplicability: documentClassApplicability ?? "Both",
      basePriceAed: basePriceAed ?? "0", timelineDays: timelineDays ?? null,
      description: description ?? null, active: active ?? true,
    });
    res.status(201).json(service);
  } catch (err) {
    console.error("[attestation] create service error:", err);
    res.status(500).json({ message: "Failed to create attestation service" });
  }
});

const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  documentClassApplicability: z.string().optional(),
  basePriceAed: z.string().optional(),
  timelineDays: z.number().int().nullable().optional(),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
}).strict();

app.patch("/api/attestation/services/:id", requireRole("Admin"), async (req, res) => {
  try {
    const validation = validateBody(updateServiceSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const updated = await storage.updateAttestationService(req.params.id, validation.data);
    if (!updated) return res.status(404).json({ message: "Service not found" });
    res.json(updated);
  } catch (err) {
    console.error("[attestation] update service error:", err);
    res.status(500).json({ message: "Failed to update attestation service" });
  }
});

app.get("/api/attestation/services/:id/variants", requireAuth, async (req, res) => {
  try {
    const variants = await storage.getAttestationServiceVariants(req.params.id);
    res.json(variants);
  } catch (err) {
    console.error("[attestation] get variants error:", err);
    res.status(500).json({ message: "Failed to fetch variants" });
  }
});

const createVariantSchema = z.object({
  variantLabel: z.string().min(1, "variantLabel is required"),
  priceAed: z.string().optional(),
  timelineDays: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
});

app.post("/api/attestation/services/:id/variants", requireRole("Admin"), async (req, res) => {
  try {
    const validation = validateBody(createVariantSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const { variantLabel, priceAed, timelineDays, active } = validation.data;
    const variant = await storage.createAttestationServiceVariant({
      serviceId: req.params.id, variantLabel, priceAed: priceAed ?? "0",
      timelineDays: timelineDays ?? null, active: active ?? true,
    });
    res.status(201).json(variant);
  } catch (err) {
    console.error("[attestation] create variant error:", err);
    res.status(500).json({ message: "Failed to create variant" });
  }
});

const updateVariantSchema = z.object({
  variantLabel: z.string().min(1).optional(),
  priceAed: z.string().optional(),
  timelineDays: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
}).strict();

app.patch("/api/attestation/services/variants/:variantId", requireRole("Admin"), async (req, res) => {
  try {
    const validation = validateBody(updateVariantSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const updated = await storage.updateAttestationServiceVariant(req.params.variantId, validation.data);
    if (!updated) return res.status(404).json({ message: "Variant not found" });
    res.json(updated);
  } catch (err) {
    console.error("[attestation] update variant error:", err);
    res.status(500).json({ message: "Failed to update variant" });
  }
});

app.delete("/api/attestation/services/variants/:variantId", requireRole("Admin"), async (req, res) => {
  try {
    const deleted = await storage.deleteAttestationServiceVariant(req.params.variantId);
    if (!deleted) return res.status(404).json({ message: "Variant not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("[attestation] delete variant error:", err);
    res.status(500).json({ message: "Failed to delete variant" });
  }
});

app.get("/api/attestation/services/:id/step-definitions", requireAuth, async (req, res) => {
  try {
    const steps = await storage.getAttestationServiceStepDefinitions(req.params.id);
    res.json(steps);
  } catch (err) {
    console.error("[attestation] get step definitions error:", err);
    res.status(500).json({ message: "Failed to fetch step definitions" });
  }
});

const stepDefinitionSchema = z.array(z.object({
  stepOrder: z.number().int(),
  stepName: z.string().min(1),
  stepType: z.string().min(1),
}));

app.put("/api/attestation/services/:id/step-definitions", requireRole("Admin"), async (req, res) => {
  try {
    const validation = validateBody(stepDefinitionSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const steps = validation.data;
    const result = await storage.replaceAttestationServiceStepDefinitions(req.params.id, steps);
    res.json(result);
  } catch (err) {
    console.error("[attestation] replace step defs error:", err);
    res.status(500).json({ message: "Failed to update step definitions" });
  }
});

// ========== Attestation Service Requests (Admin + CRM) ==========
const SR_VALID_TRANSITIONS: Record<string, string[]> = {
  Draft: ["SentToVendor", "Cancelled"],
  SentToVendor: ["AcceptedByVendor", "Cancelled"],
  AcceptedByVendor: ["InProgress", "Cancelled"],
  InProgress: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

app.get("/api/attestation/service-requests", requireOpsRole, async (req, res) => {
  try {
    const { status, companyId, vendorId } = req.query as Record<string, string>;
    const srs = await storage.getAttestationSrs({ status, companyId, vendorId });
    const enriched = await Promise.all(srs.map(async (sr) => {
      const company = await storage.getCompanyById(sr.companyId);
      const vendor = await storage.getVendorById(sr.vendorId);
      const service = await storage.getAttestationServiceById(sr.attestationServiceId);
      return {
        ...sr,
        companyName: company?.name ?? null,
        vendorName: vendor?.name ?? null,
        serviceName: service?.name ?? null,
      };
    }));
    res.json(enriched);
  } catch (err) {
    console.error("[attestation] list SRs error:", err);
    res.status(500).json({ message: "Failed to fetch service requests" });
  }
});

const createSrSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  attestationServiceId: z.string().min(1, "Attestation service is required"),
  externalWoNumber: z.string().min(1, "External WO number is required"),
  documentType: z.string().min(1, "Document type is required"),
  documentNameDescription: z.string().min(1, "Document name/description is required"),
  documentClass: z.string().min(1, "Document class is required"),
  serviceVariantId: z.string().nullable().optional(),
  applicantName: z.string().nullable().optional(),
  homeCountry: z.string().nullable().optional(),
  originalDocumentInvolved: z.boolean().optional(),
  internalNotes: z.string().nullable().optional(),
  serviceFeeAed: z.union([z.string(), z.number()]).nullable().optional(),
});

app.post("/api/attestation/service-requests", requireOpsRole, async (req, res) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    const validation = validateBody(createSrSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });

    const { companyId, vendorId, attestationServiceId, externalWoNumber, documentType,
      documentNameDescription, documentClass, serviceVariantId, applicantName,
      homeCountry, originalDocumentInvolved, internalNotes, serviceFeeAed } = validation.data;

    const company = await storage.getCompanyById(companyId);
    if (!company) return res.status(400).json({ message: "Company not found" });

    const vendor = await storage.getVendorById(vendorId);
    if (!vendor || vendor.vendorType !== "Attestation") {
      return res.status(400).json({ message: "Vendor must be an Attestation vendor" });
    }

    const service = await storage.getAttestationServiceById(attestationServiceId);
    if (!service) return res.status(400).json({ message: "Attestation service not found" });

    let resolvedVariant = null;
    if (serviceVariantId) {
      resolvedVariant = await storage.getAttestationServiceVariantById(serviceVariantId);
      if (!resolvedVariant || resolvedVariant.serviceId !== attestationServiceId) {
        return res.status(400).json({ message: "Service variant does not belong to the selected service" });
      }
    }

    const derivedFeeAed = serviceFeeAed ?? resolvedVariant?.priceAed ?? service.basePriceAed ?? null;

    const sr = await storage.createAttestationSr({
      companyId, vendorId, attestationServiceId, externalWoNumber,
      documentType, documentNameDescription, documentClass,
      serviceVariantId: serviceVariantId ?? null,
      applicantName: applicantName ?? null,
      homeCountry: homeCountry ?? null,
      originalDocumentInvolved: originalDocumentInvolved ?? false,
      internalNotes: internalNotes ?? null,
      serviceFeeAed: derivedFeeAed,
      status: "Draft",
      physicalCustodyStatus: "WithClient",
      currentCustodian: null,
      currentResponsibleStaffId: user.id,
      inquiryId: null,
      createdBy: user.id,
    });

    const stepDefs = await storage.getAttestationServiceStepDefinitions(attestationServiceId);
    for (const def of stepDefs) {
      await storage.createAttestationSrStep({
        srId: sr.id,
        stepOrder: def.stepOrder,
        stepName: def.stepName,
        stepType: def.stepType,
        status: "Pending",
        startedAt: null,
        completedAt: null,
        notes: null,
      });
    }

    res.status(201).json(sr);
  } catch (err) {
    console.error("[attestation] create SR error:", err);
    res.status(500).json({ message: "Failed to create service request" });
  }
});

app.get("/api/attestation/service-requests/:id", requireOpsRole, async (req, res) => {
  try {
    const sr = await storage.getAttestationSrById(req.params.id);
    if (!sr) return res.status(404).json({ message: "Service request not found" });

    const [company, vendor, service, steps] = await Promise.all([
      storage.getCompanyById(sr.companyId),
      storage.getVendorById(sr.vendorId),
      storage.getAttestationServiceById(sr.attestationServiceId),
      storage.getAttestationSrSteps(sr.id),
    ]);

    let variant = null;
    if (sr.serviceVariantId) {
      variant = await storage.getAttestationServiceVariantById(sr.serviceVariantId);
    }

    let responsibleStaff = null;
    if (sr.currentResponsibleStaffId) {
      responsibleStaff = await storage.getUser(sr.currentResponsibleStaffId);
    }

    res.json({
      ...sr,
      companyName: company?.name ?? null,
      vendorName: vendor?.name ?? null,
      serviceName: service?.name ?? null,
      serviceCategory: service?.category ?? null,
      variantLabel: variant?.variantLabel ?? null,
      responsibleStaffName: responsibleStaff?.name ?? null,
      steps,
    });
  } catch (err) {
    console.error("[attestation] get SR error:", err);
    res.status(500).json({ message: "Failed to fetch service request" });
  }
});

const updateSrStatusSchema = z.object({
  status: z.string().min(1, "Status is required"),
});

app.patch("/api/attestation/service-requests/:id/status", requireOpsRole, async (req, res) => {
  try {
    const validation = validateBody(updateSrStatusSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const { status } = validation.data;
    const sr = await storage.getAttestationSrById(req.params.id);
    if (!sr) return res.status(404).json({ message: "Service request not found" });
    const allowedNext = SR_VALID_TRANSITIONS[sr.status] ?? [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({ message: `Invalid transition: ${sr.status} → ${status}` });
    }
    if (status === "Completed" && sr.physicalCustodyStatus === "WithVendor") {
      return res.status(400).json({ message: "Cannot complete SR while documents are still with vendor. Please ensure documents are returned first." });
    }
    const updated = await storage.updateAttestationSr(req.params.id, { status });
    const userId = req.session?.userId;
    await storage.createAttestationSrActivityLog({
      srId: sr.id, action: "status_change",
      detail: `Status changed from ${sr.status} to ${status}`,
      performedBy: userId || null,
    });
    if (status === "SentToVendor") {
      await notifyVendorUsers(sr.vendorId, {
        type: "attestation_sr_assigned",
        title: "New Attestation SR Assigned",
        message: `Service request ${sr.externalWoNumber} has been sent to you.`,
        relatedJobId: null,
      });
    }
    if (status === "Completed" || status === "Cancelled") {
      if (sr.vendorId) {
        await notifyVendorUsers(sr.vendorId, {
          type: "attestation_sr_closed",
          title: `Attestation SR ${status}`,
          message: `Service request ${sr.externalWoNumber} has been ${status.toLowerCase()}.`,
          relatedJobId: null,
        });
      }
    }
    if (status === "Completed" && sr.externalWoNumber) {
      const wo = await storage.getWorkOrderByWoNumber(sr.externalWoNumber);
      if (wo) {
        await checkAndAutoCompleteWorkOrder(wo.id);
      }
    }
    res.json(updated);
  } catch (err) {
    console.error("[attestation] update SR status error:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

const updateSrFieldsSchema = z.object({
  internalNotes: z.string().optional(),
  serviceFeeAed: z.string().nullable().optional(),
  physicalCustodyStatus: z.string().optional(),
  currentCustodian: z.string().nullable().optional(),
}).strict();

app.patch("/api/attestation/service-requests/:id", requireOpsRole, async (req, res) => {
  try {
    const validation = validateBody(updateSrFieldsSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const { internalNotes, serviceFeeAed, physicalCustodyStatus, currentCustodian } = validation.data;
    const sr = await storage.getAttestationSrById(req.params.id);
    if (!sr) return res.status(404).json({ message: "Service request not found" });
    if (sr.status === "Cancelled" || sr.status === "Completed") {
      return res.status(400).json({ message: "Cannot edit a completed or cancelled service request" });
    }
    const updateData: Record<string, unknown> = {};
    const userId = req.session?.userId;
    if (internalNotes !== undefined) {
      updateData.internalNotes = internalNotes;
      await storage.createAttestationSrActivityLog({
        srId: sr.id, action: "notes_updated", detail: "Internal notes updated", performedBy: userId || null,
      });
    }
    if (serviceFeeAed !== undefined) {
      updateData.serviceFeeAed = serviceFeeAed;
      await storage.createAttestationSrActivityLog({
        srId: sr.id, action: "fee_updated",
        detail: `Service fee changed from ${sr.serviceFeeAed || '—'} to ${serviceFeeAed} AED`,
        performedBy: userId || null,
      });
    }
    if (physicalCustodyStatus !== undefined) {
      const validCustody = ["WithClient", "WithUs", "WithVendor", "ReturnedToClient"];
      if (!validCustody.includes(physicalCustodyStatus)) {
        return res.status(400).json({ message: "Invalid custody status" });
      }
      updateData.physicalCustodyStatus = physicalCustodyStatus;
      if (currentCustodian !== undefined) updateData.currentCustodian = currentCustodian;
      await storage.createAttestationSrActivityLog({
        srId: sr.id, action: "custody_change",
        detail: `Custody changed from ${sr.physicalCustodyStatus} to ${physicalCustodyStatus}${currentCustodian ? ` (${currentCustodian})` : ''}`,
        performedBy: userId || null,
      });
    }
    const updated = await storage.updateAttestationSr(req.params.id, updateData as Partial<AttestationSr>);
    res.json(updated);
  } catch (err) {
    console.error("[attestation] patch SR error:", err);
    res.status(500).json({ message: "Failed to update service request" });
  }
});

const bulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one ID is required"),
  status: z.string().min(1, "Status is required"),
});

app.post("/api/attestation/service-requests/bulk-status", requireOpsRole, async (req, res) => {
  try {
    const validation = validateBody(bulkStatusSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const { ids, status } = validation.data;
    const userId = req.session?.userId;
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (const id of ids) {
      const sr = await storage.getAttestationSrById(id);
      if (!sr) { results.push({ id, success: false, error: "Not found" }); continue; }
      const allowedNext = SR_VALID_TRANSITIONS[sr.status] ?? [];
      if (!allowedNext.includes(status)) {
        results.push({ id, success: false, error: `Invalid transition: ${sr.status} → ${status}` });
        continue;
      }
      if (status === "Completed" && sr.physicalCustodyStatus === "WithVendor") {
        results.push({ id, success: false, error: "Cannot complete SR while documents are still with vendor" });
        continue;
      }
      await storage.updateAttestationSr(id, { status });
      await storage.createAttestationSrActivityLog({
        srId: id, action: "status_change",
        detail: `Status changed from ${sr.status} to ${status} (bulk)`,
        performedBy: userId || null,
      });
      if (status === "SentToVendor" && sr.vendorId) {
        await notifyVendorUsers(sr.vendorId, {
          type: "attestation_sr_assigned", title: "New Attestation SR Assigned",
          message: `Service request ${sr.externalWoNumber} has been sent to you.`,
          relatedJobId: null,
        });
      }
      if (status === "Completed" && sr.externalWoNumber) {
        const wo = await storage.getWorkOrderByWoNumber(sr.externalWoNumber);
        if (wo) {
          await checkAndAutoCompleteWorkOrder(wo.id);
        }
      }
      results.push({ id, success: true });
    }
    res.json({ results });
  } catch (err) {
    console.error("[attestation] bulk status error:", err);
    res.status(500).json({ message: "Failed to bulk update" });
  }
});

app.get("/api/attestation/service-requests/:id/steps", requireOpsRole, async (req, res) => {
  try {
    const steps = await storage.getAttestationSrSteps(req.params.id);
    res.json(steps);
  } catch (err) {
    console.error("[attestation] get SR steps error:", err);
    res.status(500).json({ message: "Failed to fetch steps" });
  }
});

const updateSrStepSchema = z.object({
  status: z.enum(["Pending", "InProgress", "Done"]).optional(),
  notes: z.string().nullable().optional(),
});

app.patch("/api/attestation/service-requests/:id/steps/:stepId", requireOpsRole, async (req, res) => {
  try {
    const validation = validateBody(updateSrStepSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const { status, notes } = validation.data;
    const sr = await storage.getAttestationSrById(req.params.id);
    if (!sr) return res.status(404).json({ message: "Service request not found" });
    const step = await storage.getAttestationSrSteps(sr.id).then(steps => steps.find(s => s.id === req.params.stepId));
    if (!step) return res.status(404).json({ message: "Step not found" });
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === "InProgress" && !step.startedAt) updateData.startedAt = new Date();
      if (status === "Done" && !step.completedAt) updateData.completedAt = new Date();
    }
    if (notes !== undefined) updateData.notes = notes;
    const updated = await storage.updateAttestationSrStep(req.params.stepId, updateData as Partial<InsertAttestationSrStep>);
    if (!updated) return res.status(404).json({ message: "Step not found" });
    const userId = req.session?.userId;
    await storage.createAttestationSrActivityLog({
      srId: sr.id, action: "step_updated",
      detail: `Step "${step.stepName}" ${status ? `status → ${status}` : 'notes updated'}`,
      performedBy: userId || null,
    });
    res.json(updated);
  } catch (err) {
    console.error("[attestation] update SR step error:", err);
    res.status(500).json({ message: "Failed to update step" });
  }
});

app.get("/api/attestation/service-requests/:id/activity-log", requireOpsRole, async (req, res) => {
  try {
    const logs = await storage.getAttestationSrActivityLog(req.params.id);
    const enriched = await Promise.all(logs.map(async (log) => {
      let performedByName = null;
      if (log.performedBy) {
        const user = await storage.getUser(log.performedBy);
        performedByName = user?.name ?? null;
      }
      return { ...log, performedByName };
    }));
    res.json(enriched);
  } catch (err) {
    console.error("[attestation] get activity log error:", err);
    res.status(500).json({ message: "Failed to fetch activity log" });
  }
});

app.get("/api/attestation/stats", requireOpsRole, async (req, res) => {
  try {
    const allSrs = await storage.getAttestationSrs({});
    const stats = {
      total: allSrs.length,
      draft: allSrs.filter(sr => sr.status === "Draft").length,
      sentToVendor: allSrs.filter(sr => sr.status === "SentToVendor").length,
      acceptedByVendor: allSrs.filter(sr => sr.status === "AcceptedByVendor").length,
      inProgress: allSrs.filter(sr => sr.status === "InProgress").length,
      completed: allSrs.filter(sr => sr.status === "Completed").length,
      cancelled: allSrs.filter(sr => sr.status === "Cancelled").length,
      totalFees: allSrs.reduce((sum, sr) => sum + (sr.serviceFeeAed ? parseFloat(sr.serviceFeeAed) : 0), 0),
    };
    res.json(stats);
  } catch (err) {
    console.error("[attestation] get stats error:", err);
    res.status(500).json({ message: "Failed to fetch attestation stats" });
  }
});

app.get("/api/attestation/vendors", requireAuth, async (req, res) => {
  try {
    const vendors = await storage.getAttestationVendors();
    res.json(vendors);
  } catch (err) {
    console.error("[attestation] get vendors error:", err);
    res.status(500).json({ message: "Failed to fetch attestation vendors" });
  }
});

// ─── CRM: Attestation Inquiry CRUD ──────────────────────────────────────────

const createInquirySchema = z.object({
  companyId: z.string().min(1),
  applicantName: z.string().optional(),
  vendorId: z.string().min(1),
  documentType: z.string().min(1),
  documentNameDescription: z.string().min(1),
  documentClass: z.enum(["Personal", "Business"]),
  homeCountry: z.string().optional(),
  descriptionOfNeed: z.string().min(1),
  externalWoNumber: z.string().optional(),
});

app.post("/api/attestation/inquiries", requireAuth, async (req, res) => {
  try {
    const validation = validateBody(createInquirySchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const { vendorId, companyId } = validation.data;

    const vendor = await storage.getVendorById(vendorId);
    if (!vendor || vendor.vendorType !== "Attestation") {
      return res.status(400).json({ message: "Selected vendor is not an Attestation vendor" });
    }
    const company = await storage.getCompanyById(companyId);
    if (!company) return res.status(400).json({ message: "Company not found" });

    const inquiry = await storage.createAttestationInquiry({
      ...validation.data,
      createdBy: req.session.userId!,
      status: "Open",
    });

    await storage.createAuditLog({
      action: "attestation_inquiry_created",
      entityType: "attestation_inquiry",
      entityId: inquiry.id,
      userId: req.session.userId!,
      details: { companyId, vendorId, documentType: inquiry.documentType },
    });

    res.status(201).json(inquiry);
  } catch (error) {
    console.error("Create attestation inquiry error:", error);
    res.status(500).json({ message: "Failed to create inquiry" });
  }
});

app.get("/api/attestation/inquiries", requireAuth, async (req, res) => {
  try {
    const { status, companyId, vendorId } = req.query as Record<string, string>;
    const inquiries = await storage.getAttestationInquiries({ status, companyId, vendorId });

    const enriched = await Promise.all(inquiries.map(async inq => {
      const company = await storage.getCompanyById(inq.companyId);
      const vendor = await storage.getVendorById(inq.vendorId);
      const latestQuote = await storage.getLatestQuoteForInquiry(inq.id);
      return {
        ...inq,
        companyName: company?.name || null,
        vendorName: vendor?.name || null,
        latestQuote: latestQuote || null,
      };
    }));

    res.json(enriched);
  } catch (error) {
    console.error("Get attestation inquiries error:", error);
    res.status(500).json({ message: "Failed to get inquiries" });
  }
});

app.get("/api/attestation/inquiries/:id", requireAuth, async (req, res) => {
  try {
    const inquiry = await storage.getAttestationInquiryById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

    const company = await storage.getCompanyById(inquiry.companyId);
    const vendor = await storage.getVendorById(inquiry.vendorId);
    const quotes = await storage.getQuotesByInquiry(inquiry.id);
    const latestQuote = quotes[0] || null;

    let linkedSr = null;
    if (inquiry.convertedToSrId) {
      linkedSr = await storage.getAttestationSrById(inquiry.convertedToSrId);
    }

    res.json({
      ...inquiry,
      companyName: company?.name || null,
      vendorName: vendor?.name || null,
      latestQuote,
      quotes,
      linkedSr,
    });
  } catch (error) {
    console.error("Get attestation inquiry detail error:", error);
    res.status(500).json({ message: "Failed to get inquiry" });
  }
});

const acceptInquirySchema = z.object({
  externalWoNumber: z.string().min(1, "External WO number is required"),
  serviceName: z.string().min(1, "Service name is required"),
  serviceNotes: z.string().optional(),
});

app.post("/api/attestation/inquiries/:id/accept", requireAuth, async (req, res) => {
  try {
    const inquiry = await storage.getAttestationInquiryById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    if (inquiry.status !== "Open" && inquiry.status !== "QuoteReceived") {
      return res.status(400).json({ message: "Inquiry cannot be accepted in current status" });
    }

    const validation = validateBody(acceptInquirySchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });

    const latestQuote = await storage.getLatestQuoteForInquiry(inquiry.id);

    let resolvedServiceId: string | null = null;
    if (validation.data.serviceName) {
      const matchedService = await storage.getAttestationServiceByName(validation.data.serviceName);
      if (!matchedService) {
        return res.status(400).json({ message: `Attestation service "${validation.data.serviceName}" not found in catalog` });
      }
      resolvedServiceId = matchedService.id;
    }

    const sr = await storage.createAttestationSr({
      inquiryId: inquiry.id,
      companyId: inquiry.companyId,
      vendorId: inquiry.vendorId,
      applicantName: inquiry.applicantName,
      documentType: inquiry.documentType,
      documentNameDescription: inquiry.documentNameDescription,
      documentClass: inquiry.documentClass,
      homeCountry: inquiry.homeCountry,
      externalWoNumber: validation.data.externalWoNumber,
      attestationServiceId: resolvedServiceId,
      serviceName: validation.data.serviceName || null,
      serviceFeeAed: latestQuote?.amountAed ? String(latestQuote.amountAed) : null,
      feeSource: latestQuote ? "quote" : null,
      serviceNotes: validation.data.serviceNotes || null,
      status: "SentToVendor",
      createdBy: req.session.userId!,
    } as InsertAttestationSr);

    if (resolvedServiceId) {
      const stepDefs = await storage.getAttestationServiceStepDefinitions(resolvedServiceId);
      for (const def of stepDefs) {
        await storage.createAttestationSrStep({
          srId: sr.id,
          stepOrder: def.stepOrder,
          stepName: def.stepName,
          stepType: def.stepType,
          status: "Pending",
          startedAt: null,
          completedAt: null,
          notes: null,
        });
      }
    }

    await storage.updateAttestationInquiry(inquiry.id, {
      status: "Converted",
      convertedToSrId: sr.id,
      externalWoNumber: validation.data.externalWoNumber,
    });

    await storage.createAuditLog({
      action: "attestation_inquiry_accepted",
      entityType: "attestation_inquiry",
      entityId: inquiry.id,
      userId: req.session.userId!,
      details: { srId: sr.id, externalWoNumber: validation.data.externalWoNumber },
    });

    res.json({ inquiry: { ...inquiry, status: "Converted", convertedToSrId: sr.id }, sr });
  } catch (error) {
    console.error("Accept attestation inquiry error:", error);
    res.status(500).json({ message: "Failed to accept inquiry" });
  }
});

const rejectInquirySchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

app.post("/api/attestation/inquiries/:id/reject", requireAuth, async (req, res) => {
  try {
    const inquiry = await storage.getAttestationInquiryById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    if (inquiry.status === "Converted" || inquiry.status === "Rejected") {
      return res.status(400).json({ message: "Inquiry cannot be rejected in current status" });
    }

    const validation = validateBody(rejectInquirySchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });

    const updated = await storage.updateAttestationInquiry(inquiry.id, {
      status: "Rejected",
      rejectionReason: validation.data.reason,
    });

    await storage.createAuditLog({
      action: "attestation_inquiry_rejected",
      entityType: "attestation_inquiry",
      entityId: inquiry.id,
      userId: req.session.userId!,
      details: { reason: validation.data.reason },
    });

    res.json(updated);
  } catch (error) {
    console.error("Reject attestation inquiry error:", error);
    res.status(500).json({ message: "Failed to reject inquiry" });
  }
});

// ─── Attestation Vendor: Quote Submission ────────────────────────────────────

const submitQuoteSchema = z.object({
  amountAed: z.number().int().positive(),
  timelineDays: z.number().int().positive(),
  notes: z.string().optional(),
});

app.post("/api/attestation-vendor/inquiries/:id/quote", requireAttestationVendor, async (req, res) => {
  try {
    const vendorId = req.attestationVendorId;
    const inquiry = await storage.getAttestationInquiryById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    if (inquiry.vendorId !== vendorId) return res.status(403).json({ message: "Access denied" });
    if (inquiry.status !== "Open" && inquiry.status !== "QuoteReceived") {
      return res.status(400).json({ message: "Inquiry is not open for quoting" });
    }

    const validation = validateBody(submitQuoteSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });

    const version = await storage.getNextQuoteVersion(inquiry.id);
    const quote = await storage.createAttestationInquiryQuote({
      inquiryId: inquiry.id,
      vendorId: vendorId,
      submittedByVendorUserId: req.attestationVendorUserId || null,
      quoteVersion: version,
      amountAed: validation.data.amountAed,
      timelineDays: validation.data.timelineDays,
      notes: validation.data.notes || null,
    });

    await storage.updateAttestationInquiry(inquiry.id, { status: "QuoteReceived" });

    res.status(201).json(quote);
  } catch (error) {
    console.error("Submit attestation quote error:", error);
    res.status(500).json({ message: "Failed to submit quote" });
  }
});

// ─── Attestation Vendor: Inquiry List ────────────────────────────────────────

app.get("/api/attestation-vendor/inquiries", requireAttestationVendor, async (req, res) => {
  try {
    const vendorId = req.attestationVendorId;
    const inquiries = await storage.getAttestationInquiries({ vendorId });

    const result = await Promise.all(inquiries.map(async inq => {
      const latestQuote = await storage.getLatestQuoteForInquiry(inq.id);
      return {
        id: inq.id,
        documentType: inq.documentType,
        documentNameDescription: inq.documentNameDescription,
        documentClass: inq.documentClass,
        homeCountry: inq.homeCountry,
        descriptionOfNeed: inq.descriptionOfNeed,
        externalWoNumber: inq.externalWoNumber,
        status: inq.status,
        createdAt: inq.createdAt,
        latestQuote: latestQuote || null,
      };
    }));

    res.json(result);
  } catch (error) {
    console.error("Attestation vendor inquiries error:", error);
    res.status(500).json({ message: "Failed to get inquiries" });
  }
});

// ─── Document Custody Records (Full Lifecycle Module) ─────────────────────────


// GET /api/custody/records — list with filters
app.get("/api/custody/records", requireDocCustodyRole, async (req: Request, res: Response) => {
  try {
    const { companyId, woId, custodyStage, docCategory, dateFrom, dateTo } = req.query;
    const filters: Record<string, unknown> = {};
    if (companyId) filters.companyId = companyId;
    if (woId) filters.woId = woId;
    if (custodyStage) filters.custodyStage = custodyStage;
    if (docCategory) filters.docCategory = docCategory;
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const records = await storage.getDocumentCustodyRecords(filters);

    // Enrich with company names
    const companyIds = [...new Set(records.map(r => r.companyId))];
    const companiesData = companyIds.length > 0 ? await storage.getCompaniesByIds(companyIds) : [];
    const companyMap = new Map(companiesData.map(c => [c.id, c.name]));

    const enriched = records.map(r => ({
      ...r,
      companyName: companyMap.get(r.companyId) || null,
    }));

    res.json(enriched);
  } catch (error) {
    console.error("Get custody records error:", error);
    res.status(500).json({ message: "Failed to get custody records" });
  }
});

// GET /api/custody/records/summary — dashboard summary counts
app.get("/api/custody/records/summary", requireDocCustodyRole, async (req: Request, res: Response) => {
  try {
    const summary = await storage.getDocumentCustodySummary();
    res.json(summary);
  } catch (error) {
    console.error("Get custody summary error:", error);
    res.status(500).json({ message: "Failed to get custody summary" });
  }
});

// GET /api/custody/records/:id — single record with handoffs
app.get("/api/custody/records/:id", requireDocCustodyRole, async (req: Request, res: Response) => {
  try {
    const record = await storage.getDocumentCustodyRecordById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    const handoffs = await storage.getDocumentCustodyHandoffs(record.id);
    const company = await storage.getCompanyById(record.companyId);

    let woNumber: string | null = null;
    if (record.woId) {
      const wo = await storage.getWorkOrderById(record.woId);
      woNumber = wo?.woNumber || null;
    }

    res.json({
      ...record,
      companyName: company?.name || null,
      woNumber,
      handoffs,
    });
  } catch (error) {
    console.error("Get custody record error:", error);
    res.status(500).json({ message: "Failed to get custody record" });
  }
});

const createCustodyRecordSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  docSubtype: z.string().min(1, "Document subtype is required"),
  applicantName: z.string().optional(),
  woId: z.string().optional(),
  notifyEmail: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

app.post("/api/custody/records", requireDocCustodyRole, async (req: Request, res: Response) => {
  try {
    const validation = validateBody(createCustodyRecordSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const user = req._custodyUser;
    const referenceNumber = await storage.getNextCustodyRefNumber();

    const record = await storage.createDocumentCustodyRecord({
      ...validation.data,
      referenceNumber,
      createdBy: user.id,
      custodyStage: "WithClient",
    });

    await storage.createAuditLog({
      action: "custody_record_created",
      entityType: "custody_record",
      entityId: record.id,
      userId: user.id,
      details: { referenceNumber, companyId: record.companyId, docSubtype: record.docSubtype },
    });

    res.status(201).json(record);
  } catch (error) {
    console.error("Create custody record error:", error);
    res.status(500).json({ message: "Failed to create custody record" });
  }
});

// PATCH /api/custody/records/:id — update notes/email
app.patch("/api/custody/records/:id", requireDocCustodyRole, async (req: Request, res: Response) => {
  try {
    const record = await storage.updateDocumentCustodyRecord(req.params.id, req.body);
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json(record);
  } catch (error) {
    console.error("Update custody record error:", error);
    res.status(500).json({ message: "Failed to update custody record" });
  }
});

const handoffSchema = z.object({
  toStage: z.string().min(1, "Target stage is required"),
  counterpartyName: z.string().optional(),
  counterpartyContact: z.string().optional(),
  notes: z.string().nullable().optional(),
});

app.post("/api/custody/records/:id/handoff", requireDocCustodyRole, upload.single("counterpartyIdPhoto"), async (req: Request, res: Response) => {
  try {
    const validation = validateBody(handoffSchema, req.body);
    if ('error' in validation) return res.status(400).json({ message: validation.error });
    const user = req._custodyUser;
    const record = await storage.getDocumentCustodyRecordById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    const { toStage, counterpartyName, counterpartyContact, notes } = validation.data;

    const custodyStageOrder = ["WithClient", "WithUs", "WithVendor", "ReturnedToClient"];
    if (!custodyStageOrder.includes(toStage)) {
      return res.status(400).json({ message: "Invalid target stage" });
    }
    const currentStageIdx = custodyStageOrder.indexOf(record.custodyStage);
    const targetStageIdx = custodyStageOrder.indexOf(toStage);
    const allowSkipVendor = record.custodyStage === "WithUs" && toStage === "ReturnedToClient";
    if (targetStageIdx !== currentStageIdx + 1 && !allowSkipVendor) {
      return res.status(400).json({ message: `Cannot move directly from '${record.custodyStage}' to '${toStage}'. Must follow the sequential order.` });
    }

    // Upload photo if provided
    let counterpartyIdPhotoUrl: string | undefined;
    if (req.file) {
      const objectStorageService = new ObjectStorageService();
      const ext = req.file.mimetype?.split("/")[1] || "jpg";
      const objectPath = `custody/handoffs/${record.id}/${Date.now()}_id.${ext}`;
      const uploadedUrl = await objectStorageService.uploadObject(objectPath, req.file.buffer, req.file.mimetype, "public-read");
      counterpartyIdPhotoUrl = uploadedUrl || undefined;
    }

    const handoff = await storage.createDocumentCustodyHandoff({
      recordId: record.id,
      fromStage: record.custodyStage,
      toStage,
      counterpartyName,
      counterpartyContact,
      counterpartyIdPhotoUrl,
      notes: notes || null,
      performedBy: user.id,
    } as InsertDocumentCustodyHandoff);

    // Update the record's stage
    await storage.updateDocumentCustodyRecord(record.id, { custodyStage: toStage });

    // Trigger automated emails
    const { buildCustodyCollectionEmail, buildCustodyReturnEmail } = await import("../email-templates/custody-notifications");
    const company = await storage.getCompanyById(record.companyId);
    const companyName = company?.name || "Your Company";

    // Determine notification email: use record's notifyEmail, or fall back to company primary email
    let emailRecipient = record.notifyEmail;
    if (!emailRecipient && record.companyId) {
      const companyEmails = await storage.getCompanyEmails(record.companyId);
      const primaryEmail = companyEmails.find(e => e.isPrimary) || companyEmails[0];
      emailRecipient = primaryEmail?.email || null;
    }

    if (toStage === "WithUs" && emailRecipient) {
      const html = buildCustodyCollectionEmail({ record: { ...record, custodyStage: toStage, updatedAt: new Date() }, companyName });
      sendEmail({
        to: emailRecipient,
        subject: `Document Received — ${record.referenceNumber}`,
        html,
      }).catch(err => console.error("Custody collection email error:", err));
    }

    if (toStage === "ReturnedToClient" && emailRecipient) {
      const html = buildCustodyReturnEmail({ record: { ...record, custodyStage: toStage, updatedAt: new Date() }, companyName });
      sendEmail({
        to: emailRecipient,
        subject: `Document Ready — ${record.referenceNumber}`,
        html,
      }).catch(err => console.error("Custody return email error:", err));
    }

    await storage.createAuditLog({
      action: "custody_stage_transition",
      entityType: "custody_record",
      entityId: record.id,
      userId: user.id,
      details: { referenceNumber: record.referenceNumber, fromStage: record.custodyStage, toStage },
    });

    res.status(201).json({ handoff, newStage: toStage });
  } catch (error) {
    console.error("Custody handoff error:", error);
    res.status(500).json({ message: "Failed to record custody handoff" });
  }
});

// GET /api/custody/records/:id/handoffs — get all handoffs for a record
app.get("/api/custody/records/:id/handoffs", requireDocCustodyRole, async (req: Request, res: Response) => {
  try {
    const handoffs = await storage.getDocumentCustodyHandoffs(req.params.id);
    res.json(handoffs);
  } catch (error) {
    console.error("Get custody handoffs error:", error);
    res.status(500).json({ message: "Failed to get custody handoffs" });
  }
});

// GET /api/custody/wo/:woId — get custody records for a work order
app.get("/api/custody/wo/:woId", requireDocCustodyRole, async (req: Request, res: Response) => {
  try {
    const records = await storage.getDocumentCustodyRecordsByWoId(req.params.woId);
    const companyIds = [...new Set(records.map(r => r.companyId))];
    const companiesData = companyIds.length > 0 ? await storage.getCompaniesByIds(companyIds) : [];
    const companyMap = new Map(companiesData.map(c => [c.id, c.name]));
    res.json(records.map(r => ({ ...r, companyName: companyMap.get(r.companyId) || null })));
  } catch (error) {
    console.error("Get WO custody records error:", error);
    res.status(500).json({ message: "Failed to get custody records for work order" });
  }
});

}
