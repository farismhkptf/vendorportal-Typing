import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireOpsRole, requireRole } from "../middleware/auth";
import { validateBody, validateEmailField } from "../middleware/validation";
import { toProperCase } from "../proper-case";
import { validateAppointmentTime, getAvailableTimeSlots, isCenterOpenOnDate } from "@shared/scheduling";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";
import { insertCompanySchema, insertStaffSchema, insertCenterSchema, insertServiceTypeSchema, insertJobTypeSchema } from "@shared/schema";
import type { CenterTimings } from "@shared/schema";
import type { RouteDeps } from "./types";

export function registerEntityRoutes(app: Express, deps: RouteDeps): void {
  const { upload } = deps;
  // ========== Companies ==========
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const companiesList = await storage.getCompanies();

      if (companiesList.length === 0) {
        return res.json([]);
      }

      const staffIds = Array.from(new Set(
        companiesList.flatMap(c => [c.rmStaffId, c.assistStaffId].filter(Boolean) as string[])
      ));
      const centerIds = Array.from(new Set(
        companiesList.flatMap(c => [
          c.preferredMedicalCenterId, c.preferredMedicalCenterVipId,
          c.preferredBiometricsCenterId, c.preferredBiometricsCenterVipId,
        ].filter(Boolean) as string[])
      ));

      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const [workOrderCounts, allStaff, allCenters, allEmails, expiringDocCompanyIds] = await Promise.all([
        storage.getWorkOrderCountsByCompany(),
        storage.getStaffByIds(staffIds),
        storage.getCentersByIds(centerIds),
        storage.getAllCompanyEmails(),
        storage.getCompanyIdsWithExpiringDocs(thirtyDaysFromNow),
      ]);

      const staffMap = new Map(allStaff.map(s => [s.id, s]));
      const centerMap = new Map(allCenters.map(c => [c.id, c]));
      const emailsByCompany = new Map<string, typeof allEmails>();
      for (const email of allEmails) {
        const list = emailsByCompany.get(email.companyId) || [];
        list.push(email);
        emailsByCompany.set(email.companyId, list);
      }

      const result = companiesList.map(company => ({
        ...company,
        emails: emailsByCompany.get(company.id) || [],
        rmStaff: company.rmStaffId ? staffMap.get(company.rmStaffId) || null : null,
        assistStaff: company.assistStaffId ? staffMap.get(company.assistStaffId) || null : null,
        preferredMedicalCenter: company.preferredMedicalCenterId ? centerMap.get(company.preferredMedicalCenterId) || null : null,
        preferredMedicalCenterVip: company.preferredMedicalCenterVipId ? centerMap.get(company.preferredMedicalCenterVipId) || null : null,
        preferredBiometricsCenter: company.preferredBiometricsCenterId ? centerMap.get(company.preferredBiometricsCenterId) || null : null,
        preferredBiometricsCenterVip: company.preferredBiometricsCenterVipId ? centerMap.get(company.preferredBiometricsCenterVipId) || null : null,
        workOrderCount: workOrderCounts[company.id] || 0,
        hasExpiringDocs: expiringDocCompanyIds.has(company.id),
      }));

      res.json(result);
    } catch (error) {
      console.error("Companies error:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post("/api/companies", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertCompanySchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const contactEmails = [
        validation.data.clientCoordinator?.email,
        validation.data.clientManager?.email,
      ];
      for (const ce of contactEmails) {
        if (!validateEmailField(ce)) {
          return res.status(400).json({ message: "Invalid contact email format" });
        }
      }
      const companyData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
        ...(validation.data.clientCoordinator?.name && { 
          clientCoordinator: { ...validation.data.clientCoordinator, name: toProperCase(validation.data.clientCoordinator.name) } 
        }),
        ...(validation.data.clientManager?.name && { 
          clientManager: { ...validation.data.clientManager, name: toProperCase(validation.data.clientManager.name) } 
        }),
      };
      const company = await storage.createCompany(companyData);
      await storage.createAuditLog({
        action: 'created',
        entityType: 'company',
        entityId: company.id,
        userId: req.session?.userId || null,
      });
      res.status(201).json(company);
    } catch (error) {
      console.error("Create company error:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.get("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const company = await storage.getCompanyById(id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      const emails = await storage.getCompanyEmails(company.id);
      const rmStaff = company.rmStaffId ? await storage.getStaffById(company.rmStaffId) : null;
      const assistStaff = company.assistStaffId ? await storage.getStaffById(company.assistStaffId) : null;
      const preferredMedicalCenter = company.preferredMedicalCenterId 
        ? await storage.getCenterById(company.preferredMedicalCenterId) 
        : null;
      const preferredMedicalCenterVip = company.preferredMedicalCenterVipId 
        ? await storage.getCenterById(company.preferredMedicalCenterVipId) 
        : null;
      const preferredBiometricsCenter = company.preferredBiometricsCenterId 
        ? await storage.getCenterById(company.preferredBiometricsCenterId) 
        : null;
      const preferredBiometricsCenterVip = company.preferredBiometricsCenterVipId 
        ? await storage.getCenterById(company.preferredBiometricsCenterVipId) 
        : null;

      res.json({
        ...company,
        emails,
        rmStaff,
        assistStaff,
        preferredMedicalCenter,
        preferredMedicalCenterVip,
        preferredBiometricsCenter,
        preferredBiometricsCenterVip,
      });
    } catch (error) {
      console.error("Get company error:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.put("/api/companies/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const validation = validateBody(insertCompanySchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const contactEmails = [
        validation.data.clientCoordinator?.email,
        validation.data.clientManager?.email,
      ];
      for (const ce of contactEmails) {
        if (!validateEmailField(ce)) {
          return res.status(400).json({ message: "Invalid contact email format" });
        }
      }
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
        ...(validation.data.clientCoordinator?.name && { 
          clientCoordinator: { ...validation.data.clientCoordinator, name: toProperCase(validation.data.clientCoordinator.name) } 
        }),
        ...(validation.data.clientManager?.name && { 
          clientManager: { ...validation.data.clientManager, name: toProperCase(validation.data.clientManager.name) } 
        }),
      };
      const company = await storage.updateCompany(id, updateData);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      await storage.createAuditLog({
        action: 'updated',
        entityType: 'company',
        entityId: id,
        userId: req.session?.userId || null,
      });
      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // ========== Company Emails ==========
  app.get("/api/companies/:companyId/emails", requireAuth, async (req, res) => {
    try {
      const emails = await storage.getCompanyEmails((req.params.companyId as string));
      res.json(emails);
    } catch (error) {
      console.error("Get company emails error:", error);
      res.status(500).json({ message: "Failed to fetch company emails" });
    }
  });

  const companyEmailSchema = z.object({
    label: z.string().min(1, "Label is required"),
    email: z.string().email("Valid email is required"),
  });

  app.post("/api/companies/:companyId/emails", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(companyEmailSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { label, email } = validation.data;
      const created = await storage.createCompanyEmail({ companyId: (req.params.companyId as string), label, email });
      res.json(created);
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes("Maximum")) return res.status(400).json({ message: error.message });
      console.error("Create company email error:", error);
      res.status(500).json({ message: "Failed to create company email" });
    }
  });

  const updateCompanyEmailSchema = z.object({
    label: z.string().min(1).optional(),
    email: z.string().email("Valid email is required").optional(),
  });

  app.put("/api/companies/:companyId/emails/:emailId", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(updateCompanyEmailSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { label, email } = validation.data;
      const existing = await storage.getCompanyEmails((req.params.companyId as string));
      const owns = existing.some(e => e.id === (req.params.emailId as string));
      if (!owns) return res.status(404).json({ message: "Email not found for this company" });
      const updated = await storage.updateCompanyEmail((req.params.emailId as string), { label, email });
      if (!updated) return res.status(404).json({ message: "Email not found" });
      res.json(updated);
    } catch (error) {
      console.error("Update company email error:", error);
      res.status(500).json({ message: "Failed to update company email" });
    }
  });

  app.delete("/api/companies/:companyId/emails/:emailId", requireRole("Admin"), async (req, res) => {
    try {
      const existing = await storage.getCompanyEmails((req.params.companyId as string));
      const owns = existing.some(e => e.id === (req.params.emailId as string));
      if (!owns) return res.status(404).json({ message: "Email not found for this company" });
      const deleted = await storage.deleteCompanyEmail((req.params.emailId as string));
      if (!deleted) return res.status(404).json({ message: "Email not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete company email error:", error);
      res.status(500).json({ message: "Failed to delete company email" });
    }
  });

  // ========== Staff ==========
  app.get("/api/staff", requireAuth, async (req, res) => {
    try {
      const staffList = await storage.getStaff();
      res.json(staffList);
    } catch (error) {
      console.error("Staff error:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post("/api/staff", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertStaffSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      if (!validateEmailField(validation.data.email)) {
        return res.status(400).json({ message: "Invalid staff email format" });
      }
      const staffData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
      };
      const member = await storage.createStaff(staffData);
      await storage.createAuditLog({
        action: 'created',
        entityType: 'staff',
        entityId: member.id,
        userId: req.session?.userId || null,
      });
      res.status(201).json(member);
    } catch (error) {
      console.error("Create staff error:", error);
      res.status(500).json({ message: "Failed to create staff member" });
    }
  });

  app.put("/api/staff/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const validation = validateBody(insertStaffSchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      if (!validateEmailField(validation.data.email)) {
        return res.status(400).json({ message: "Invalid staff email format" });
      }
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
      };
      const member = await storage.updateStaff(id, updateData);
      if (!member) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      await storage.createAuditLog({
        action: 'updated',
        entityType: 'staff',
        entityId: id,
        userId: req.session?.userId || null,
      });
      res.json(member);
    } catch (error) {
      console.error("Update staff error:", error);
      res.status(500).json({ message: "Failed to update staff member" });
    }
  });

  app.delete("/api/staff/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const success = await storage.deleteStaff(id);
      if (!success) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      await storage.createAuditLog({
        action: 'deleted',
        entityType: 'staff',
        entityId: id,
        userId: req.session?.userId || null,
      });
      res.status(204).send();
    } catch (error) {
      console.error("Delete staff error:", error);
      res.status(500).json({ message: "Failed to delete staff member" });
    }
  });

  app.delete("/api/staff/bulk", requireOpsRole, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteStaff(ids);
      await storage.createAuditLog({
        action: 'bulk_deleted',
        entityType: 'staff',
        userId: req.session?.userId || null,
        details: { count: deleted, ids },
      });
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete staff error:", error);
      res.status(500).json({ message: "Failed to bulk delete staff" });
    }
  });

  // ========== Centers ==========
  app.get("/api/centers", requireAuth, async (req, res) => {
    try {
      const centers = await storage.getCenters();
      res.json(centers);
    } catch (error) {
      console.error("Centers error:", error);
      res.status(500).json({ message: "Failed to fetch centers" });
    }
  });

  app.post("/api/centers", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertCenterSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const centerData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
      };
      const center = await storage.createCenter(centerData);
      res.status(201).json(center);
    } catch (error) {
      console.error("Create center error:", error);
      res.status(500).json({ message: "Failed to create center" });
    }
  });

  app.put("/api/centers/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const validation = validateBody(insertCenterSchema.partial(), req.body);
      if ("error" in validation) return res.status(400).json({ message: validation.error });
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
      };
      const center = await storage.updateCenter(id, updateData);
      if (!center) {
        return res.status(404).json({ message: "Center not found" });
      }
      res.json(center);
    } catch (error) {
      console.error("Update center error:", error);
      res.status(500).json({ message: "Failed to update center" });
    }
  });

  app.delete("/api/centers/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const success = await storage.deleteCenter(id);
      if (!success) {
        return res.status(404).json({ message: "Center not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete center error:", error);
      res.status(500).json({ message: "Failed to delete center" });
    }
  });

  app.delete("/api/centers/bulk", requireOpsRole, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteCenters(ids);
      await storage.createAuditLog({
        action: 'bulk_deleted',
        entityType: 'center',
        userId: req.session?.userId || null,
        details: { count: deleted, ids },
      });
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete centers error:", error);
      res.status(500).json({ message: "Failed to bulk delete centers" });
    }
  });

  // ========== Scheduling Validation ==========
  app.post("/api/centers/:centerId/validate-appointment", requireAuth, async (req, res) => {
    try {
      const { centerId } = req.params as { [key: string]: string };
      const { date, time } = req.body;

      if (!date || !time) {
        return res.status(400).json({ message: "Date and time are required" });
      }

      const center = await storage.getCenterById(centerId);
      if (!center) {
        return res.status(404).json({ message: "Center not found" });
      }

      const appointmentDate = new Date(date);
      const validation = validateAppointmentTime(
        appointmentDate,
        time,
        center.timings as CenterTimings | null
      );

      res.json({
        ...validation,
        center: {
          id: center.id,
          name: center.name,
          timingText: center.timingText,
        },
      });
    } catch (error) {
      console.error("Validate appointment error:", error);
      res.status(500).json({ message: "Failed to validate appointment time" });
    }
  });

  app.get("/api/centers/:centerId/available-times", requireAuth, async (req, res) => {
    try {
      const { centerId } = req.params as { [key: string]: string };
      const { date, interval } = req.query;

      if (!date) {
        return res.status(400).json({ message: "Date is required" });
      }

      const center = await storage.getCenterById(centerId);
      if (!center) {
        return res.status(404).json({ message: "Center not found" });
      }

      const appointmentDate = new Date(date as string);
      const isOpen = isCenterOpenOnDate(appointmentDate, center.timings as CenterTimings | null);
      
      if (!isOpen) {
        return res.json({
          date,
          isOpen: false,
          slots: [],
          message: "Center is closed on this day",
        });
      }

      const intervalMinutes = interval ? parseInt(interval as string) : 30;
      const slots = getAvailableTimeSlots(
        appointmentDate,
        center.timings as CenterTimings | null,
        intervalMinutes
      );

      res.json({
        date,
        isOpen: true,
        slots,
        center: {
          id: center.id,
          name: center.name,
          timingText: center.timingText,
        },
      });
    } catch (error) {
      console.error("Get available times error:", error);
      res.status(500).json({ message: "Failed to get available times" });
    }
  });

  // ========== Vendors ==========
  app.get("/api/vendors", requireAuth, async (req, res) => {
    try {
      const vendorsList = await storage.getVendors();
      res.json(vendorsList);
    } catch (error) {
      console.error("Vendors error:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.get("/api/vendors/:id", requireAuth, async (req, res) => {
    try {
      const vendor = await storage.getVendorById((req.params.id as string));
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      console.error("Get vendor error:", error);
      res.status(500).json({ message: "Failed to fetch vendor" });
    }
  });

  const createVendorSchema = z.object({
    name: z.string().min(1, "Vendor name is required"),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email("Invalid email format").optional().or(z.literal("")),
    vendorType: z.enum(["Typing", "Attestation"]).optional(),
  });

  app.post("/api/vendors", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(createVendorSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { name, contactPerson, phone, email, vendorType } = validation.data;
      const vendor = await storage.createVendor({
        name: toProperCase(name),
        contactPerson: contactPerson ? toProperCase(contactPerson) : undefined,
        phone,
        email,
        vendorType: vendorType || "Typing",
      });
      await storage.createAuditLog({
        action: 'created',
        entityType: 'vendor',
        entityId: vendor.id,
        userId: req.session?.userId || null,
      });
      res.status(201).json(vendor);
    } catch (error) {
      console.error("Create vendor error:", error);
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });

  const updateVendorSchema = z.object({
    name: z.string().min(1).optional(),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email("Invalid email format").optional().or(z.literal("")),
    active: z.boolean().optional(),
    vendorType: z.enum(["Typing", "Attestation"]).optional(),
  });

  app.put("/api/vendors/:id", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(updateVendorSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { name, contactPerson, phone, email, active, vendorType } = validation.data;
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = toProperCase(name);
      if (contactPerson !== undefined) updateData.contactPerson = contactPerson ? toProperCase(contactPerson) : null;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (active !== undefined) updateData.active = active;
      if (vendorType !== undefined) updateData.vendorType = vendorType;
      
      const vendor = await storage.updateVendor((req.params.id as string), updateData);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      await storage.createAuditLog({
        action: 'updated',
        entityType: 'vendor',
        entityId: (req.params.id as string),
        userId: req.session?.userId || null,
      });
      res.json(vendor);
    } catch (error) {
      console.error("Update vendor error:", error);
      res.status(500).json({ message: "Failed to update vendor" });
    }
  });

  app.delete("/api/vendors/:id", requireOpsRole, async (req, res) => {
    try {
      await storage.deleteVendor((req.params.id as string));
      await storage.createAuditLog({
        action: 'deleted',
        entityType: 'vendor',
        entityId: (req.params.id as string),
        userId: req.session?.userId || null,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete vendor error:", error);
      res.status(500).json({ message: "Failed to delete vendor" });
    }
  });

  app.post("/api/vendors/:id/logo", requireOpsRole, upload.single('logo'), async (req, res) => {
    try {
      const vendorId = (req.params.id as string);
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
      const objectStorageService = new ObjectStorageService();
      const logoUrl = await objectStorageService.uploadObjectEntityFile(
        `vendor-logos/${vendorId}.${ext}`,
        req.file.buffer,
        req.file.mimetype
      );
      await storage.updateVendor(vendorId, { logoUrl });
      res.json({ logoUrl });
    } catch (error) {
      console.error("Vendor logo upload error:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  app.get("/api/public/vendor-lookup", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ message: "email required" });
      const user = await storage.getUserByEmail(email);
      if (!user || !user.vendorId || user.role !== "Vendor") {
        return res.status(404).json({ message: "Not found" });
      }
      const vendor = await storage.getVendorById(user.vendorId);
      if (!vendor) return res.status(404).json({ message: "Not found" });
      res.json({ vendorName: vendor.name, logoUrl: vendor.logoUrl || null });
    } catch (error) {
      console.error("Vendor lookup error:", error);
      res.status(404).json({ message: "Not found" });
    }
  });

  // ========== Service Types ==========
  app.get("/api/service-types", requireAuth, async (req, res) => {
    try {
      const types = await storage.getServiceTypes();
      res.json(types);
    } catch (error) {
      console.error("Service types error:", error);
      res.status(500).json({ message: "Failed to fetch service types" });
    }
  });

  app.post("/api/service-types", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertServiceTypeSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const typeData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
      };
      const type = await storage.createServiceType(typeData);
      res.status(201).json(type);
    } catch (error) {
      console.error("Create service type error:", error);
      res.status(500).json({ message: "Failed to create service type" });
    }
  });

  app.put("/api/service-types/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const validation = validateBody(insertServiceTypeSchema.partial(), req.body);
      if ("error" in validation) return res.status(400).json({ message: validation.error });
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
      };
      const type = await storage.updateServiceType(id, updateData);
      if (!type) {
        return res.status(404).json({ message: "Service type not found" });
      }
      res.json(type);
    } catch (error) {
      console.error("Update service type error:", error);
      res.status(500).json({ message: "Failed to update service type" });
    }
  });

  app.delete("/api/service-types/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const success = await storage.deleteServiceType(id);
      if (!success) {
        return res.status(404).json({ message: "Service type not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete service type error:", error);
      res.status(500).json({ message: "Failed to delete service type" });
    }
  });

  app.post("/api/service-types/bulk", requireOpsRole, async (req, res) => {
    try {
      const { names } = req.body;
      if (!Array.isArray(names) || names.length === 0) {
        return res.status(400).json({ message: "Names array is required" });
      }
      const types = await storage.bulkCreateServiceTypes(names);
      res.status(201).json(types);
    } catch (error) {
      console.error("Bulk create service types error:", error);
      res.status(500).json({ message: "Failed to bulk create service types" });
    }
  });

  app.delete("/api/service-types/bulk", requireOpsRole, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteServiceTypes(ids);
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete service types error:", error);
      res.status(500).json({ message: "Failed to bulk delete service types" });
    }
  });

  // ========== Job Types ==========
  app.get("/api/job-types", requireAuth, async (req, res) => {
    try {
      const types = await storage.getJobTypes();
      res.json(types);
    } catch (error) {
      console.error("Job types error:", error);
      res.status(500).json({ message: "Failed to fetch job types" });
    }
  });

  app.post("/api/job-types", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertJobTypeSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const typeData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
      };
      const type = await storage.createJobType(typeData);
      res.status(201).json(type);
    } catch (error) {
      console.error("Create job type error:", error);
      res.status(500).json({ message: "Failed to create job type" });
    }
  });

  app.put("/api/job-types/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const validation = validateBody(insertJobTypeSchema.partial(), req.body);
      if ("error" in validation) return res.status(400).json({ message: validation.error });
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
      };
      const type = await storage.updateJobType(id, updateData);
      if (!type) {
        return res.status(404).json({ message: "Job type not found" });
      }
      res.json(type);
    } catch (error) {
      console.error("Update job type error:", error);
      res.status(500).json({ message: "Failed to update job type" });
    }
  });

  app.delete("/api/job-types/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params as { [key: string]: string };
      const success = await storage.deleteJobType(id);
      if (!success) {
        return res.status(404).json({ message: "Job type not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete job type error:", error);
      res.status(500).json({ message: "Failed to delete job type" });
    }
  });

  app.delete("/api/job-types/bulk", requireOpsRole, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteJobTypes(ids);
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete job types error:", error);
      res.status(500).json({ message: "Failed to bulk delete job types" });
    }
  });

}
