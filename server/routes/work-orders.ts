import type { Express } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireOpsRole, requireRole } from "../middleware/auth";
import { validateBody, validateEmailField } from "../middleware/validation";
import { checkAndAutoCompleteWorkOrder, revertDelayedWorkOrder } from "../services/transition-service";
import { checkAndMarkDelayedWorkOrders } from "../services/background-jobs";
import { notifyStaffByRoles, notifyVendorUsers } from "../services/notification-service";
import { toProperCase } from "../proper-case";
import { buildAppointmentEmail } from "../email-templates/appointment-confirmation";
import { loadAppointmentEmailData, loadAppointmentEmailDataById, renderAppointmentEmailHtml, getPhotoAsSignedUrl } from "../email-templates/preview-data-loader";
import { sendEmail, isEmailConfigured } from "../email-service";
import { insertWorkOrderSchema, insertAppointmentSchema, insertWoNoteSchema } from "@shared/schema";
import type { Staff, AppSettings, WoDocument } from "@shared/schema";
import type { RouteDeps } from "./types";

export function registerWorkOrderRoutes(app: Express, deps: RouteDeps): void {
  // ========== Scheduling Queue ==========
  app.get("/api/appointments/scheduling-queue", requireAuth, async (req, res) => {
    try {
      const [readyJobs, allJobTypes, allAppointments] = await Promise.all([
        storage.getTypingJobs("ReadyForScheduling"),
        storage.getJobTypes(),
        storage.getAllAppointments(),
      ]);

      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));

      const activeApptSet = new Set(
        allAppointments
          .filter(a => a.status !== "Cancelled" && a.status !== "Rescheduled")
          .map(a => `${a.woId}-${a.type}`)
      );

      const medicalQueue: Record<string, unknown>[] = [];
      const eidQueue: Record<string, unknown>[] = [];

      for (const job of readyJobs) {
        const jt = jobTypeMap.get(job.jobTypeId);
        if (!jt) continue;
        const apptType = jt.category === "Medical" ? "Medical" : "EID";

        if (activeApptSet.has(`${job.woId}-${apptType}`)) continue;

        const result = await storage.getTypingJobResult(job.id);

        if (apptType === "EID" && !result?.biometricsRequired) continue;

        const wo = await storage.getWorkOrderById(job.woId);
        if (!wo) continue;
        const company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;

        const queueItem = {
          typingJobId: job.id,
          jobCode: job.jobCode,
          woId: wo.id,
          woNumber: wo.woNumber,
          applicantName: wo.applicantName,
          applicantPhone: wo.applicantPhone,
          applicantEmail: wo.applicantEmail,
          isVip: wo.isVip || false,
          serviceTypeId: wo.serviceTypeId,
          companyId: company?.id || null,
          companyName: company?.name || null,
          preferredMedicalCenterId: company?.preferredMedicalCenterId || null,
          preferredMedicalCenterVipId: company?.preferredMedicalCenterVipId || null,
          preferredBiometricsCenterId: company?.preferredBiometricsCenterId || null,
          preferredBiometricsCenterVipId: company?.preferredBiometricsCenterVipId || null,
          assistStaffId: company?.assistStaffId || null,
          rmStaffId: company?.rmStaffId || null,
          applicationRefNo: result?.applicationRefNo || null,
          biometricsRequired: result?.biometricsRequired || false,
          biometricsDatetime: result?.biometricsDatetime || null,
          biometricsCenter: result?.biometricsCenter || null,
          notes: result?.vendorNotes || null,
          returnedAt: job.returnedAt || null,
          completedAt: job.returnedAt || null,
          readyAt: job.returnedAt || job.createdAt || null,
        };

        if (apptType === "Medical") {
          medicalQueue.push(queueItem);
        } else {
          eidQueue.push(queueItem);
        }
      }

      res.json({ medical: medicalQueue, eid: eidQueue });
    } catch (error) {
      console.error("Scheduling queue error:", error);
      res.status(500).json({ message: "Failed to fetch scheduling queue" });
    }
  });

  // ========== Work Orders ==========
  let lastDelayCheck = 0;
  app.get("/api/work-orders", requireAuth, async (req, res) => {
    try {
      const now = Date.now();
      if (now - lastDelayCheck > 5 * 60 * 1000) {
        lastDelayCheck = now;
        checkAndMarkDelayedWorkOrders().catch((err) => { console.error("[work-orders] delay check failed:", err); });
      }
      const { search, status } = req.query;
      const workOrdersList = await storage.getWorkOrders(
        search as string | undefined,
        status as string | undefined
      );

      if (workOrdersList.length === 0) {
        return res.json([]);
      }

      const woIds = workOrdersList.map(wo => wo.id);
      const companyIds = Array.from(new Set(workOrdersList.map(wo => wo.companyId).filter(Boolean)));
      const serviceTypeIds = Array.from(new Set(workOrdersList.map(wo => wo.serviceTypeId).filter((id): id is string => !!id)));

      const [allCompanies, allServiceTypes, allTypingJobs, allAppointments, allJobTypes] = await Promise.all([
        companyIds.length > 0 ? storage.getCompaniesByIds(companyIds) : Promise.resolve([]),
        serviceTypeIds.length > 0 ? storage.getServiceTypesByIds(serviceTypeIds) : Promise.resolve([]),
        storage.getTypingJobsByWoIds(woIds),
        storage.getAppointmentsByWoIds(woIds),
        storage.getJobTypes(),
      ]);

      const companyMap = new Map(allCompanies.map(c => [c.id, c]));
      const serviceTypeMap = new Map(allServiceTypes.map(st => [st.id, st]));
      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));
      const typingJobsByWo = new Map<string, unknown[]>();
      for (const job of allTypingJobs) {
        const list = typingJobsByWo.get(job.woId) || [];
        list.push({ ...job, jobType: job.jobTypeId ? jobTypeMap.get(job.jobTypeId) || null : null });
        typingJobsByWo.set(job.woId, list);
      }
      const appointmentsByWo = new Map<string, unknown[]>();
      for (const apt of allAppointments) {
        const list = appointmentsByWo.get(apt.woId) || [];
        list.push(apt);
        appointmentsByWo.set(apt.woId, list);
      }

      const result = workOrdersList.map(wo => ({
        ...wo,
        company: companyMap.get(wo.companyId),
        serviceType: wo.serviceTypeId ? serviceTypeMap.get(wo.serviceTypeId) : undefined,
        typingJobs: typingJobsByWo.get(wo.id) || [],
        appointments: appointmentsByWo.get(wo.id) || [],
      }));

      res.json(result);
    } catch (error) {
      console.error("Work orders error:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  app.post("/api/work-orders/bulk-status", requireOpsRole, async (req, res) => {
    try {
      const bulkStatusSchema = z.object({
        ids: z.array(z.string()).min(1),
        status: z.enum(["Draft", "AtVendor", "ReadyToSchedule", "Scheduled", "Completed", "Cancelled"]),
      });
      const validation = validateBody(bulkStatusSchema, req.body);
      if ("error" in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { ids, status } = validation.data;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const id of ids) {
        try {
          const wo = await storage.updateWorkOrder(id, { status });
          if (!wo) {
            failed++;
            errors.push(`Work order ${id} not found`);
            continue;
          }
          await storage.createAuditLog({
            entityType: "work_order",
            entityId: id,
            action: "status_changed",
            userId: req.session?.userId || null,
            details: { newStatus: status, bulkAction: true, applicantName: wo.applicantName, woNumber: wo.woNumber },
          });

          if (status === "Cancelled") {
            const jobs = await storage.getTypingJobsByWoId(wo.id);
            for (const job of jobs) {
              if (job.vendorId) {
                await notifyVendorUsers(job.vendorId, {
                  type: 'wo_status_change',
                  title: 'Work Order ' + status,
                  message: `Work order ${wo.woNumber} has been ${status.toLowerCase()}`,
                  relatedJobId: job.id,
                });
              }
            }
          }

          updated++;
        } catch (err: unknown) {
          failed++;
          errors.push(`Failed to update ${id}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      res.json({ updated, failed, errors });
    } catch (error) {
      console.error("Bulk status update error:", error);
      res.status(500).json({ message: "Failed to bulk update work order statuses" });
    }
  });

  app.get("/api/work-orders/check-duplicate", requireAuth, async (req, res) => {
    try {
      const applicantName = (req.query.applicantName as string || "").trim();
      if (!applicantName) {
        return res.json({ duplicates: [] });
      }
      const workOrders = await storage.getWorkOrders();
      const matches = workOrders.filter(
        wo =>
          wo.applicantName.toLowerCase() === applicantName.toLowerCase() &&
          wo.status !== "Completed" &&
          wo.status !== "Cancelled"
      );
      const duplicates = await Promise.all(
        matches.map(async (wo) => {
          const company = await storage.getCompanyById(wo.companyId);
          return {
            id: wo.id,
            woNumber: wo.woNumber,
            applicantName: wo.applicantName,
            companyName: company?.name || "N/A",
            status: wo.status,
            createdAt: wo.createdAt,
          };
        })
      );
      res.json({ duplicates });
    } catch (error) {
      console.error("Check duplicate error:", error);
      res.status(500).json({ message: "Failed to check duplicates" });
    }
  });

  app.get("/api/work-orders/:id", requireAuth, async (req, res) => {
    try {
      const wo = await storage.getWorkOrderById(req.params.id);
      if (!wo) {
        return res.status(404).json({ message: "Work order not found" });
      }

      const company = await storage.getCompanyById(wo.companyId);
      const appointments = await storage.getAppointmentsByWoId(wo.id);
      const typingJobsRaw = await storage.getTypingJobsByWoId(wo.id);
      
      // Include typing job results and job type info
      const typingJobs = await Promise.all(
        typingJobsRaw.map(async (job) => {
          const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
          const result = await storage.getTypingJobResult(job.id);
          return { ...job, jobType, result };
        })
      );

      let companyWithDetails = null;
      if (company) {
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
        
        companyWithDetails = {
          ...company,
          emails,
          rmStaff,
          assistStaff,
          preferredMedicalCenter,
          preferredMedicalCenterVip,
          preferredBiometricsCenter,
          preferredBiometricsCenterVip,
        };
      }

      const serviceType = wo.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId) : null;

      res.json({
        ...wo,
        company: companyWithDetails,
        appointments,
        typingJobs,
        serviceType,
      });
    } catch (error) {
      console.error("Work order detail error:", error);
      res.status(500).json({ message: "Failed to fetch work order" });
    }
  });

  app.post("/api/work-orders", requireOpsRole, async (req, res) => {
    try {
      const validation = validateBody(insertWorkOrderSchema.omit({ status: true }), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      if (!validateEmailField(validation.data.applicantEmail)) {
        return res.status(400).json({ message: "Invalid applicant email format" });
      }

      const existing = await storage.getWorkOrderByWoNumber(validation.data.woNumber);
      if (existing) {
        return res.status(400).json({ message: `Work order ${validation.data.woNumber} already exists` });
      }

      const duplicateCount = await storage.countDuplicateApplicants(validation.data.applicantName);
      
      const wo = await storage.createWorkOrder({
        ...validation.data,
        applicantName: toProperCase(validation.data.applicantName),
        status: "Draft",
      });
      await storage.createAuditLog({
        entityType: "work_order",
        entityId: wo.id,
        action: "created",
        userId: req.session?.userId || null,
        details: { woNumber: wo.woNumber, applicantName: wo.applicantName },
      });

      notifyStaffByRoles(["Admin"], {
        type: "wo_created",
        title: "New Work Order Created",
        message: `Work order ${wo.woNumber} created for ${wo.applicantName}`,
        relatedEntityType: "work_order",
        relatedEntityId: wo.id,
      });

      // Notify the company's assigned CRM
      try {
        const woCompany = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;
        if (woCompany?.rmStaffId) {
          const woRmStaff = await storage.getStaffById(woCompany.rmStaffId).catch((err) => { console.error("[work-orders] failed to fetch RM staff:", err); return null; });
          if (woRmStaff?.userId) {
            await storage.createStaffNotification({
              userId: woRmStaff.userId,
              type: "wo_created",
              title: "New Work Order — Your Client",
              message: `Work order ${wo.woNumber} created for ${wo.applicantName} (${woCompany.name})`,
              relatedEntityType: "work_order",
              relatedEntityId: wo.id,
            });
          }
        }
      } catch (crmNotifyErr) {
        console.error("[wo-create] Failed to notify CRM:", crmNotifyErr);
      }
      
      // Auto-create typing jobs based on service type requirements
      const autoCreatedJobs: { id: string; jobCode: string; category: string; label: string }[] = [];
      try {
        const serviceTypeForWo = wo.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId) : null;
        const jobTypes = await storage.getJobTypes();
        const medicalJobType = jobTypes.find(jt => jt.category === "Medical");
        const eidJobType = jobTypes.find(jt => jt.category === "EID");

        const needsMedical = serviceTypeForWo?.requiresMedicalTyping ?? false;
        const needsEid = (serviceTypeForWo ? (serviceTypeForWo.requiresIdTyping2Years || serviceTypeForWo.requiresIdTyping1Year || serviceTypeForWo.requiresIdTyping10Years) : false);
        const eidLabel = serviceTypeForWo?.requiresIdTyping2Years
          ? "EID Typing (2 Years)"
          : serviceTypeForWo?.requiresIdTyping1Year
            ? "EID Typing (1 Year)"
            : serviceTypeForWo?.requiresIdTyping10Years
              ? "EID Typing (10 Years)"
              : "EID Typing";
        
        if (needsMedical && medicalJobType) {
          const jobCode = await storage.generateNextJobCode("Medical");
          const medJob = await storage.createTypingJob({
            woId: wo.id,
            jobCode,
            jobTypeId: medicalJobType.id,
            status: "Draft",
          });
          autoCreatedJobs.push({ id: medJob.id, jobCode: medJob.jobCode ?? jobCode, category: "Medical", label: "Medical Typing" });
        }
        
        if (needsEid && eidJobType) {
          const jobCode = await storage.generateNextJobCode("EID");
          const eidJob = await storage.createTypingJob({
            woId: wo.id,
            jobCode,
            jobTypeId: eidJobType.id,
            status: "Draft",
          });
          // Note: typing job status "Draft" is intentional - typing jobs stay draft until WO is activated
          autoCreatedJobs.push({ id: eidJob.id, jobCode: eidJob.jobCode ?? jobCode, category: "EID", label: eidLabel });
        }
      } catch (typingJobError) {
        // Log but don't fail the WO creation if typing job creation fails
        console.error("Failed to auto-create typing jobs for WO:", typingJobError);
      }
      
      const responseData = { ...wo, autoCreatedJobs } as typeof wo & { autoCreatedJobs: typeof autoCreatedJobs; duplicateWarning?: { message: string; count: number } };
      if (duplicateCount > 0) {
        responseData.duplicateWarning = {
          message: "An active work order for this applicant already exists",
          count: duplicateCount,
        };
      }
      
      res.status(201).json(responseData);
    } catch (error) {
      console.error("Create work order error:", error);
      res.status(500).json({ message: "Failed to create work order" });
    }
  });

  app.put("/api/work-orders/:id", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertWorkOrderSchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      if (!validateEmailField(validation.data.applicantEmail)) {
        return res.status(400).json({ message: "Invalid applicant email format" });
      }

      if (validation.data.woNumber) {
        const existing = await storage.getWorkOrderByWoNumber(validation.data.woNumber);
        if (existing && existing.id !== id) {
          return res.status(400).json({ message: `Work order ${validation.data.woNumber} already exists` });
        }
      }
      
      const updateData = {
        ...validation.data,
        ...(validation.data.applicantName && { applicantName: toProperCase(validation.data.applicantName) }),
      };
      const wo = await storage.updateWorkOrder(id, updateData);
      if (!wo) {
        return res.status(404).json({ message: "Work order not found" });
      }
      await storage.createAuditLog({
        action: 'updated',
        entityType: 'work_order',
        entityId: id,
        userId: req.session?.userId || null,
        details: { applicantName: wo.applicantName, woNumber: wo.woNumber },
      });
      res.json(wo);
    } catch (error) {
      console.error("Update work order error:", error);
      res.status(500).json({ message: "Failed to update work order" });
    }
  });

  app.delete("/api/work-orders/:id", requireRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteWorkOrder(id);
      if (!deleted) {
        return res.status(404).json({ message: "Work order not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete work order error:", error);
      res.status(500).json({ message: "Failed to delete work order" });
    }
  });

  app.get("/api/work-orders/:woId/document-completeness", requireAuth, async (req, res) => {
    try {
      const { woId } = req.params;
      const wo = await storage.getWorkOrderById(woId);
      if (!wo) {
        return res.status(404).json({ message: "Work order not found" });
      }
      if (!wo.serviceTypeId) {
        return res.json({ complete: true, missingDocumentTypes: [] });
      }
      const serviceType = await storage.getServiceTypeById(wo.serviceTypeId);
      if (!serviceType?.category) {
        return res.json({ complete: true, missingDocumentTypes: [] });
      }
      const requirements = await storage.getDocumentRequirementsByCategory(serviceType.category);
      const requiredDocTypes = requirements.filter(r => r.isRequired).map(r => r.documentType);
      if (requiredDocTypes.length === 0) {
        return res.json({ complete: true, missingDocumentTypes: [] });
      }
      const uploadedDocs = await storage.getWoDocuments(woId);
      const uploadedTypes = new Set(
        uploadedDocs
          .filter(d => d.status === "Uploaded" || d.status === "Verified")
          .map(d => d.documentType)
      );
      const missingDocumentTypes = requiredDocTypes.filter(t => !uploadedTypes.has(t));
      return res.json({ complete: missingDocumentTypes.length === 0, missingDocumentTypes });
    } catch (error) {
      console.error("Document completeness check error:", error);
      res.status(500).json({ message: "Failed to check document completeness" });
    }
  });

  app.patch("/api/work-orders/:id/activate", requireOpsRole, async (req, res) => {
    try {
      const { id } = req.params;
      const activateSchema = z.object({
        isMinor: z.boolean().default(false),
      });
      const validation = validateBody(activateSchema, req.body);
      if ("error" in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const wo = await storage.getWorkOrderById(id);
      if (!wo) {
        return res.status(404).json({ message: "Work order not found" });
      }
      if (wo.status !== "Draft") {
        return res.status(400).json({ message: "Work order is already active" });
      }
      const updated = await storage.activateWorkOrder(id, validation.data.isMinor ?? false);
      await storage.createAuditLog({
        entityType: "work_order",
        entityId: id,
        action: "activated",
        userId: req.session?.userId || null,
        details: { isMinor: validation.data.isMinor, applicantName: wo.applicantName, woNumber: wo.woNumber },
      });
      res.json(updated);
    } catch (error) {
      console.error("Activate work order error:", error);
      res.status(500).json({ message: "Failed to activate work order" });
    }
  });

  // ========== Auto-fill Helpers ==========
  app.get("/api/companies/:companyId/last-work-order", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.params;
      const workOrder = await storage.getLastWorkOrderByCompany(companyId);
      res.json(workOrder || null);
    } catch (error) {
      console.error("Last work order error:", error);
      res.status(500).json({ message: "Failed to fetch last work order" });
    }
  });

  // ========== Work Order Notes ==========
  app.get("/api/wo-notes/:woId", requireAuth, async (req, res) => {
    try {
      const notes = await storage.getWoNotes(req.params.woId);
      res.json(notes);
    } catch (error) {
      console.error("WO notes error:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/wo-notes", requireAuth, async (req, res) => {
    try {
      const validation = validateBody(insertWoNoteSchema, req.body);
      if ("error" in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const note = await storage.createWoNote(validation.data);
      res.json(note);
    } catch (error) {
      console.error("Create WO note error:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.delete("/api/wo-notes/:noteId", requireRole("Admin"), async (req, res) => {
    try {
      const { noteId } = req.params;
      const deleted = await storage.deleteWoNote(noteId);
      if (!deleted) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete WO note error:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // ========== Audit Logs ==========
  app.get("/api/audit-logs/:entityType/:entityId", requireAuth, async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await storage.getAuditLogsByEntity(entityType, entityId);
      const enriched = await Promise.all(logs.map(async (log) => {
        let userName: string | undefined;
        if (log.userId) {
          const user = await storage.getUser(log.userId);
          userName = user?.name;
        }
        return { ...log, userName };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Audit logs error:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ========== Ready to Schedule (typing jobs completed by vendor) ==========
  app.get("/api/typing-jobs/ready-to-schedule", requireAuth, async (req, res) => {
    try {
      const readyJobs = await storage.getTypingJobs("ReadyForScheduling");
      const allJobTypes = await storage.getJobTypes();
      const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));
      const allAppointments = await storage.getAllAppointments();
      
      const enriched = await Promise.all(readyJobs.map(async (job) => {
        const wo = await storage.getWorkOrderById(job.woId);
        const jobType = job.jobTypeId ? jobTypeMap.get(job.jobTypeId) : null;
        const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
        const vendor = job.vendorId ? await storage.getVendorById(job.vendorId) : null;
        const woAppointments = allAppointments.filter(a => a.woId === job.woId && a.status !== "Cancelled");
        const hasAppointment = woAppointments.some(a => 
          (jobType?.category === "Medical" && a.type === "Medical") ||
          (jobType?.category === "EID" && a.type === "EID")
        );
        return {
          ...job,
          workOrder: wo ? { ...wo, company: company ? { name: company.name } : undefined } : undefined,
          jobType: jobType || undefined,
          vendor: vendor ? { name: vendor.name } : undefined,
          hasAppointment,
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Ready to schedule error:", error);
      res.status(500).json({ message: "Failed to fetch ready to schedule jobs" });
    }
  });

  // ========== Appointments ==========
  app.get("/api/appointments", requireAuth, async (req, res) => {
    try {
      const { woId } = req.query;
      let rawAppointments;
      if (woId && typeof woId === "string") {
        rawAppointments = await storage.getAppointmentsByWoId(woId);
      } else {
        rawAppointments = await storage.getAllAppointments();
      }
      
      const allCompanies = await storage.getCompanies();
      const enriched = await Promise.all(rawAppointments.map(async (apt) => {
        const workOrder = apt.woId ? await storage.getWorkOrderById(apt.woId) : undefined;
        const center = apt.centerId ? await storage.getCenterById(apt.centerId) : undefined;
        const company = workOrder?.companyId ? allCompanies.find(c => c.id === workOrder.companyId) : undefined;
        return {
          ...apt,
          workOrder: workOrder ? { ...workOrder, company: company ? { name: company.name } : undefined } : undefined,
          center: center || undefined,
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Appointments error:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments/email-preview", requireAuth, async (req, res) => {
    try {
      const { woId, centerId, assignedStaffId, datetime, type, applicationNumber } = req.body;
      const data = await loadAppointmentEmailData({
        woId, centerId, assignedStaffId, datetime, type, applicationNumber, req,
      });
      const html = renderAppointmentEmailHtml(data);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (error) {
      console.error("Email preview generate error:", error);
      res.status(500).json({ message: "Failed to generate email preview" });
    }
  });

  app.get("/api/email-preview/appointment/:id", requireAuth, async (req, res) => {
    try {
      const data = await loadAppointmentEmailDataById(req.params.id, req);
      if (!data) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      const { notes } = req.query;
      if (typeof notes === "string") {
        data.appointment = { ...data.appointment, notes };
      }
      const html = renderAppointmentEmailHtml(data);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (error) {
      console.error("Email preview error:", error);
      res.status(500).json({ message: "Failed to generate email preview" });
    }
  });

  // Check if email sending is configured
  app.get("/api/appointments/email-status", requireAuth, async (_req, res) => {
    res.json({ configured: isEmailConfigured(), sender: process.env.ZOHO_SMTP_USER || null });
  });

  // Send appointment confirmation email
  app.post("/api/appointments/:id/send-email", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { overrideEmail, recipients, notes: overrideNotes } = req.body || {};
      const appointment = await storage.getAppointmentById(id);
      if (!appointment) return res.status(404).json({ message: "Appointment not found" });

      const wo = await storage.getWorkOrderById(appointment.woId).catch((err) => { console.error("[work-orders] resend-email: failed to fetch work order:", err); return undefined; });
      if (!wo) return res.status(404).json({ message: "Work order not found" });

      let recipientList: string[] = [];
      if (Array.isArray(recipients) && recipients.length > 0) {
        recipientList = recipients.map((r: string) => r.trim()).filter(Boolean);
      } else if (overrideEmail && overrideEmail.trim()) {
        recipientList = [overrideEmail.trim()];
      } else if (wo.applicantEmail) {
        recipientList = [wo.applicantEmail];
      }
      if (recipientList.length === 0) return res.status(400).json({ message: "No recipient email address provided." });

      const recipientEmail = recipientList[0];

      const company = wo.companyId ? await storage.getCompanyById(wo.companyId).catch((err) => { console.error("[work-orders] resend-email: failed to fetch company:", err); return undefined; }) : undefined;
      const serviceType = wo.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId).catch((err) => { console.error("[work-orders] resend-email: failed to fetch service type:", err); return undefined; }) : undefined;
      const center = appointment.centerId ? await storage.getCenterById(appointment.centerId).catch((err) => { console.error("[work-orders] resend-email: failed to fetch center:", err); return undefined; }) : undefined;
      const assignedStaff = appointment.assignedStaffId ? await storage.getStaffById(appointment.assignedStaffId).catch((err) => { console.error("[work-orders] resend-email: failed to fetch staff:", err); return undefined; }) : undefined;

      let rmStaff: Staff | undefined;
      let rmUserEmail: string | undefined;
      if (company?.rmStaffId) {
        rmStaff = await storage.getStaffById(company.rmStaffId).catch((err) => { console.error("[work-orders] resend-email: failed to fetch RM staff:", err); return undefined; });
        rmUserEmail = rmStaff?.email || undefined;
      }

      let applicantPhotoUrl: string | undefined;
      try {
        const docs = await storage.getWoDocuments(wo.id);
        const photo = docs.find((d: WoDocument) => d.documentType === "Photo" && d.fileUrl);
        if (photo?.fileUrl) {
          applicantPhotoUrl = await getPhotoAsSignedUrl(photo.fileUrl);
        }
      } catch (err) {
        console.error("[work-orders] create-appointment: failed to fetch applicant photo:", err);
      }

      let appLogoUrl: string | undefined;
      const settings = await storage.getAppSettings().catch((err: unknown) => { console.error("[work-orders] create-appointment: failed to fetch app settings:", err); return undefined; });
      if (settings?.logoUrl) appLogoUrl = settings.logoUrl;

      const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

      const appointmentForEmail = (overrideNotes !== undefined && overrideNotes !== null)
        ? { ...appointment, notes: overrideNotes }
        : appointment;

      const html = buildAppointmentEmail({
        workOrder: wo,
        company,
        serviceType,
        appointment: appointmentForEmail,
        center,
        assignedStaff,
        rmStaff,
        rmUserEmail,
        applicantPhotoUrl,
        appLogoUrl,
        appBaseUrl,
      });

      const testRedirect = settings?.testEmailRedirect?.trim() || null;
      const alwaysCcList: string[] = (!testRedirect && settings?.alwaysCc && Array.isArray(settings.alwaysCc))
        ? settings.alwaysCc.filter((e: string) => e && !recipientList.includes(e))
        : [];

      const applicantName = toProperCase(wo.applicantName || "Applicant");
      const apptTypeLabel = appointment.type === "EID" ? "Emirates ID Biometrics" : "Medical Fitness";
      const subject = `${apptTypeLabel} Appointment - ${applicantName}. ${wo.woNumber}`;

      const sendTargets = testRedirect ? [testRedirect] : recipientList;
      const results = await Promise.all(sendTargets.map(to =>
        sendEmail({
          to,
          cc: testRedirect ? undefined : (alwaysCcList.length > 0 ? alwaysCcList : undefined),
          subject,
          html,
          from: settings?.fromEmail || undefined,
        })
      ));

      const failed = results.filter(r => !r.success);
      if (failed.length === results.length) {
        return res.status(500).json({ message: failed[0]?.error || "Failed to send email" });
      }

      const user = req.user;
      await storage.updateAppointment(id, {
        messageSentAt: new Date(),
        messageSentBy: user?.name || user?.email || "Staff",
        emailDraft: html,
      });

      const sentTo = testRedirect ? testRedirect : recipientList.join(", ");
      res.json({
        success: true,
        sentTo,
        sentToList: testRedirect ? [testRedirect] : recipientList,
        cc: testRedirect ? [] : alwaysCcList,
        testRedirectActive: !!testRedirect,
        partialFailures: failed.length > 0 ? failed.length : undefined,
      });
    } catch (error: unknown) {
      console.error("Send appointment email error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to send email" });
    }
  });

  app.post("/api/appointments", requireAuth, async (req, res) => {
    try {
      // Convert datetime string to Date object
      const body = {
        ...req.body,
        datetime: req.body.datetime ? new Date(req.body.datetime) : undefined,
      };
      
      const validation = validateBody(insertAppointmentSchema.omit({ messageSentAt: true, messageSentBy: true }), body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const existingActive = await storage.getActiveAppointmentByWoAndType(
        validation.data.woId,
        validation.data.type
      );
      if (existingActive) {
        return res.status(409).json({ 
          message: `This work order already has a ${validation.data.type} appointment that is ${existingActive.status.toLowerCase()}.`,
          existingAppointmentId: existingActive.id
        });
      }

      const allAppts = await storage.getAppointmentsByWoId(validation.data.woId);
      const followUpAppt = allAppts.find(
        (a: { type: string; status: string }) => a.type === validation.data.type && a.status === "FollowUpRequired"
      );
      if (followUpAppt) {
        await storage.updateAppointment(followUpAppt.id, { status: "FollowUpScheduled" });
      }

      const rescheduleToken = randomUUID();
      const appointment = await storage.createAppointment({
        ...validation.data,
        rescheduleToken,
      });
      
      if (appointment.woId) {
        const woForAppt = await storage.getWorkOrderById(appointment.woId);
        if (woForAppt && (woForAppt.status === "ReadyToSchedule" || woForAppt.status === "Draft" || woForAppt.status === "AtVendor")) {
          const serviceType = woForAppt.serviceTypeId
            ? await storage.getServiceTypeById(woForAppt.serviceTypeId)
            : null;
          const allAppts = await storage.getAppointmentsByWoId(appointment.woId);
          const activeAppts = allAppts.filter(a => a.status !== "Cancelled" && a.status !== "Rescheduled");

          const needsMed = serviceType
            ? (!woForAppt.isMinor && (serviceType.requiresMedicalTyping || serviceType.requiresMedicalScheduling))
            : false;
          const needsEid = serviceType
            ? (serviceType.requiresIdTyping2Years || serviceType.requiresIdTyping1Year || serviceType.requiresIdTyping10Years || serviceType.requiresIdBiometrics)
            : false;

          const hasMedAppt = activeAppts.some(a => a.type === "Medical");
          const hasEidAppt = activeAppts.some(a => a.type === "EID");

          const medSatisfied = !needsMed || hasMedAppt;
          const eidSatisfied = !needsEid || hasEidAppt;
          const anyApptBooked = hasMedAppt || hasEidAppt;

          if (anyApptBooked && medSatisfied && eidSatisfied) {
            await storage.updateWorkOrder(appointment.woId, { status: "Scheduled" });
          }
        }
      }
      
      res.status(201).json(appointment);

      (async () => {
        try {
          const wo = await storage.getWorkOrderById(appointment.woId).catch((err) => { console.error("[work-orders] auto-email: failed to fetch work order for appointment", appointment.id, ":", err); return undefined; });
          const comp = wo?.companyId ? await storage.getCompanyById(wo.companyId).catch((err) => { console.error("[work-orders] auto-email: failed to fetch company for appointment", appointment.id, ":", err); return undefined; }) : undefined;
          const st = wo?.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId).catch((err) => { console.error("[work-orders] auto-email: failed to fetch service type for appointment", appointment.id, ":", err); return undefined; }) : undefined;
          const ctr = appointment.centerId ? await storage.getCenterById(appointment.centerId).catch((err) => { console.error("[work-orders] auto-email: failed to fetch center for appointment", appointment.id, ":", err); return undefined; }) : undefined;
          const guide = appointment.assignedStaffId ? await storage.getStaffById(appointment.assignedStaffId).catch((err) => { console.error("[work-orders] auto-email: failed to fetch staff for appointment", appointment.id, ":", err); return undefined; }) : undefined;

          let rm: Staff | undefined;
          let rmEmail: string | undefined;
          if (comp?.rmStaffId) {
            rm = await storage.getStaffById(comp.rmStaffId).catch((err) => { console.error("[work-orders] auto-email: failed to fetch RM staff for appointment", appointment.id, ":", err); return undefined; });
            if (rm?.email) rmEmail = rm.email;
          }

          let photoUrl: string | undefined;
          if (wo) {
            try {
              const docs = await storage.getWoDocuments(wo.id);
              const photo = docs.find((d: WoDocument) => d.documentType === "Photo" && d.fileUrl);
              if (photo?.fileUrl) {
                photoUrl = await getPhotoAsSignedUrl(photo.fileUrl);
              }
            } catch (err) {
              console.error("[work-orders] auto-email: failed to fetch applicant photo for appointment", appointment.id, ":", err);
            }
          }

          let logoUrl: string | undefined;
          let settings: AppSettings | undefined;
          try {
            settings = await storage.getAppSettings();
            if (settings?.logoUrl) {
              logoUrl = settings.logoUrl;
            }
          } catch (err) {
            console.error("[work-orders] auto-email: failed to fetch app settings for appointment", appointment.id, ":", err);
          }

          const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

          const html = buildAppointmentEmail({
            workOrder: wo,
            company: comp,
            serviceType: st,
            appointment,
            center: ctr,
            assignedStaff: guide,
            rmStaff: rm,
            rmUserEmail: rmEmail,
            applicantPhotoUrl: photoUrl,
            appLogoUrl: logoUrl,
            appBaseUrl,
          });

          const updateData: Parameters<typeof storage.updateAppointment>[1] = { emailDraft: html };

          if (isEmailConfigured()) {
            const primaryRecipients: string[] = [];
            if (comp?.clientCoordinator?.email) primaryRecipients.push(comp.clientCoordinator.email);
            if (comp?.clientManager?.email && comp.clientManager.email !== comp.clientCoordinator?.email) {
              primaryRecipients.push(comp.clientManager.email);
            }
            if (primaryRecipients.length === 0 && rmEmail) {
              primaryRecipients.push(rmEmail);
            }

            if (primaryRecipients.length > 0) {
              try {
                const testRedirectAuto = settings?.testEmailRedirect?.trim() || null;
                const ccRecipients: string[] = [];
                if (!testRedirectAuto) {
                  if (settings?.alwaysCc && Array.isArray(settings.alwaysCc)) {
                    ccRecipients.push(...settings.alwaysCc.filter((e: string) => e && !primaryRecipients.includes(e)));
                  }
                  if (rmEmail && !primaryRecipients.includes(rmEmail)) {
                    ccRecipients.push(rmEmail);
                  }
                }
                const applicantName = toProperCase(wo?.applicantName || "Applicant");
                const apptTypeLabel = appointment.type === "EID" ? "Emirates ID Biometrics" : "Medical Fitness";
                const emailResult = await sendEmail({
                  to: testRedirectAuto || primaryRecipients,
                  cc: testRedirectAuto ? undefined : (ccRecipients.length > 0 ? ccRecipients : undefined),
                  subject: `${apptTypeLabel} Appointment - ${applicantName}. ${wo?.woNumber || ""}`,
                  html,
                  from: settings?.fromEmail || undefined,
                });
                if (emailResult.success) {
                  updateData.messageSentAt = new Date();
                  updateData.messageSentBy = "auto";
                } else {
                  console.error("[work-orders] auto-send email failed for appointment", appointment.id, ":", emailResult.error);
                }
              } catch (emailErr) {
                console.error("Auto-send email error:", emailErr);
              }
            }
          }

          await storage.updateAppointment(appointment.id, updateData);
        } catch (err) {
          console.error("Email draft generation error:", err);
        }
      })();
    } catch (error) {
      console.error("Create appointment error:", error);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const appointmentStatusSchema = z.object({
        status: z.enum(["Completed", "Cancelled", "Rescheduled", "FollowUpRequired", "FollowUpScheduled", "FollowUpCompleted"], {
          errorMap: () => ({ message: "Invalid status" }),
        }),
      });
      const statusValidation = validateBody(appointmentStatusSchema, req.body);
      if ('error' in statusValidation) return res.status(400).json({ message: statusValidation.error });
      const { status } = statusValidation.data;
      
      const updated = await storage.updateAppointment(id, { status });
      if (!updated) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      await storage.createAuditLog({
        action: 'status_changed',
        entityType: 'appointment',
        entityId: id,
        userId: req.session?.userId || null,
        details: { newStatus: status },
      });
      
      if (status === "Completed" || status === "FollowUpCompleted") {
        await revertDelayedWorkOrder(updated.woId);
        await checkAndAutoCompleteWorkOrder(updated.woId);
      }

      res.json(updated);
    } catch (error) {
      console.error("Update appointment error:", error);
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

}
