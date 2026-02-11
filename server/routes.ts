import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { z } from "zod";
import { 
  insertWorkOrderSchema, insertCompanySchema, insertStaffSchema,
  insertCenterSchema, insertServiceTypeSchema, insertJobTypeSchema, loginSchema,
  insertAppointmentSchema, insertTypingJobSchema,
  type CenterTimings
} from "@shared/schema";
import { validateAppointmentTime, getAvailableTimeSlots, isCenterOpenOnDate } from "@shared/scheduling";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { toProperCase } from "./proper-case";

const topupSchema = z.object({
  amount: z.number().positive(),
  note: z.string().optional(),
});

const rescheduleSubmitSchema = z.object({
  requestedDatetime: z.string(),
  notes: z.string().optional(),
});

const vendorLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T } | { error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { error: result.error.errors.map(e => e.message).join(", ") };
  }
  return { data: result.data };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes
  registerObjectStorageRoutes(app);
  
  // Seed database on startup
  await storage.seedData();

  // ========== Dashboard ==========
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrders();
      const todayAppointments = await storage.getTodayAppointments();
      // Count Draft typing jobs as "pending" - these need to be submitted to vendor
      const pendingJobs = await storage.getTypingJobs("Draft");
      const vendors = await storage.getVendors();
      
      let walletBalance = 0;
      let lowBalanceWarning = false;
      
      if (vendors.length > 0) {
        walletBalance = await storage.getWalletBalance(vendors[0].id);
        const settings = await storage.getAppSettings();
        lowBalanceWarning = walletBalance < (settings?.lowBalanceThreshold || 1000);
      }

      res.json({
        totalWorkOrders: workOrders.length,
        todayAppointments: todayAppointments.length,
        pendingTypingJobs: pendingJobs.length,
        walletBalance,
        lowBalanceWarning,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/today-appointments", async (req, res) => {
    try {
      const appointments = await storage.getTodayAppointments();
      const result = await Promise.all(
        appointments.map(async (apt) => {
          const wo = await storage.getWorkOrderById(apt.woId);
          const center = apt.centerId ? await storage.getCenterById(apt.centerId) : null;
          return {
            id: apt.id,
            woNumber: wo?.woNumber || "N/A",
            applicantName: wo?.applicantName || "N/A",
            type: apt.type,
            time: new Date(apt.datetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            center: center?.name || "TBD",
          };
        })
      );
      res.json(result);
    } catch (error) {
      console.error("Today appointments error:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.get("/api/dashboard/recent-work-orders", async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrders();
      const recent = workOrders.slice(0, 5);
      
      const result = await Promise.all(
        recent.map(async (wo) => {
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
      res.json(result);
    } catch (error) {
      console.error("Recent work orders error:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // ========== Work Orders ==========
  app.get("/api/work-orders", async (req, res) => {
    try {
      const { search, status } = req.query;
      const workOrders = await storage.getWorkOrders(
        search as string | undefined,
        status as string | undefined
      );
      
      const result = await Promise.all(
        workOrders.map(async (wo) => {
          const company = await storage.getCompanyById(wo.companyId);
          return { ...wo, company };
        })
      );
      
      res.json(result);
    } catch (error) {
      console.error("Work orders error:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  app.get("/api/work-orders/:id", async (req, res) => {
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

      res.json({
        ...wo,
        company: companyWithDetails,
        appointments,
        typingJobs,
      });
    } catch (error) {
      console.error("Work order detail error:", error);
      res.status(500).json({ message: "Failed to fetch work order" });
    }
  });

  app.post("/api/work-orders", async (req, res) => {
    try {
      const validation = validateBody(insertWorkOrderSchema.omit({ status: true }), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      // Check if WO number already exists
      const existing = await storage.getWorkOrderByWoNumber(validation.data.woNumber);
      if (existing) {
        return res.status(400).json({ message: `Work order ${validation.data.woNumber} already exists` });
      }
      
      const wo = await storage.createWorkOrder({
        ...validation.data,
        applicantName: toProperCase(validation.data.applicantName),
        status: "Draft",
      });
      
      // Auto-create Medical and EID typing jobs for the new work order
      try {
        const jobTypes = await storage.getJobTypes();
        const medicalJobType = jobTypes.find(jt => jt.category === "Medical");
        const eidJobType = jobTypes.find(jt => jt.category === "EID");
        
        if (medicalJobType) {
          const jobCode = await storage.generateNextJobCode("Medical");
          await storage.createTypingJob({
            woId: wo.id,
            jobCode,
            jobTypeId: medicalJobType.id,
            status: "Draft",
          });
        }
        
        if (eidJobType) {
          const jobCode = await storage.generateNextJobCode("EID");
          await storage.createTypingJob({
            woId: wo.id,
            jobCode,
            jobTypeId: eidJobType.id,
            status: "Draft",
          });
        }
      } catch (typingJobError) {
        // Log but don't fail the WO creation if typing job creation fails
        console.error("Failed to auto-create typing jobs for WO:", typingJobError);
      }
      
      res.status(201).json(wo);
    } catch (error) {
      console.error("Create work order error:", error);
      res.status(500).json({ message: "Failed to create work order" });
    }
  });

  app.put("/api/work-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertWorkOrderSchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      // If changing WO number, check it doesn't exist for another work order
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
      res.json(wo);
    } catch (error) {
      console.error("Update work order error:", error);
      res.status(500).json({ message: "Failed to update work order" });
    }
  });

  app.delete("/api/work-orders/:id", async (req, res) => {
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

  // ========== Auto-fill Helpers ==========
  app.get("/api/companies/:companyId/last-work-order", async (req, res) => {
    try {
      const { companyId } = req.params;
      const workOrder = await storage.getLastWorkOrderByCompany(companyId);
      res.json(workOrder || null);
    } catch (error) {
      console.error("Last work order error:", error);
      res.status(500).json({ message: "Failed to fetch last work order" });
    }
  });

  // ========== Audit Logs ==========
  app.get("/api/audit-logs/:entityType/:entityId", async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await storage.getAuditLogsByEntity(entityType, entityId);
      res.json(logs);
    } catch (error) {
      console.error("Audit logs error:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ========== Appointments ==========
  app.get("/api/appointments", async (req, res) => {
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

  app.post("/api/appointments", async (req, res) => {
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
          message: `This work order already has an active ${validation.data.type} appointment scheduled.`,
          existingAppointmentId: existingActive.id
        });
      }

      const rescheduleToken = randomUUID();
      const appointment = await storage.createAppointment({
        ...validation.data,
        rescheduleToken,
      });
      
      if (appointment.woId) {
        await storage.updateWorkOrder(appointment.woId, { status: "Scheduled" });
      }
      
      res.status(201).json(appointment);
    } catch (error) {
      console.error("Create appointment error:", error);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !["Completed", "Cancelled", "Rescheduled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be Completed, Cancelled, or Rescheduled." });
      }
      
      const updated = await storage.updateAppointment(id, { status });
      if (!updated) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Update appointment error:", error);
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  // ========== Companies ==========
  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      const workOrderCounts = await storage.getWorkOrderCountsByCompany();
      const result = await Promise.all(
        companies.map(async (company) => {
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
          
          return {
            ...company,
            emails,
            rmStaff,
            assistStaff,
            preferredMedicalCenter,
            preferredMedicalCenterVip,
            preferredBiometricsCenter,
            preferredBiometricsCenterVip,
            workOrderCount: workOrderCounts[company.id] || 0,
          };
        })
      );
      res.json(result);
    } catch (error) {
      console.error("Companies error:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const validation = validateBody(insertCompanySchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
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
        ...(validation.data.clientAccountant?.name && { 
          clientAccountant: { ...validation.data.clientAccountant, name: toProperCase(validation.data.clientAccountant.name) } 
        }),
      };
      const company = await storage.createCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      console.error("Create company error:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const { id } = req.params;
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

  app.put("/api/companies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertCompanySchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
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
        ...(validation.data.clientAccountant?.name && { 
          clientAccountant: { ...validation.data.clientAccountant, name: toProperCase(validation.data.clientAccountant.name) } 
        }),
      };
      const company = await storage.updateCompany(id, updateData);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // ========== Staff ==========
  app.get("/api/staff", async (req, res) => {
    try {
      const staffList = await storage.getStaff();
      res.json(staffList);
    } catch (error) {
      console.error("Staff error:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post("/api/staff", async (req, res) => {
    try {
      const validation = validateBody(insertStaffSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const staffData = {
        ...validation.data,
        name: toProperCase(validation.data.name),
      };
      const member = await storage.createStaff(staffData);
      res.status(201).json(member);
    } catch (error) {
      console.error("Create staff error:", error);
      res.status(500).json({ message: "Failed to create staff member" });
    }
  });

  app.put("/api/staff/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = validateBody(insertStaffSchema.partial(), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const updateData = {
        ...validation.data,
        ...(validation.data.name && { name: toProperCase(validation.data.name) }),
      };
      const member = await storage.updateStaff(id, updateData);
      if (!member) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      res.json(member);
    } catch (error) {
      console.error("Update staff error:", error);
      res.status(500).json({ message: "Failed to update staff member" });
    }
  });

  app.delete("/api/staff/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteStaff(id);
      if (!success) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete staff error:", error);
      res.status(500).json({ message: "Failed to delete staff member" });
    }
  });

  app.delete("/api/staff/bulk", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteStaff(ids);
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete staff error:", error);
      res.status(500).json({ message: "Failed to bulk delete staff" });
    }
  });

  // ========== Centers ==========
  app.get("/api/centers", async (req, res) => {
    try {
      const centers = await storage.getCenters();
      res.json(centers);
    } catch (error) {
      console.error("Centers error:", error);
      res.status(500).json({ message: "Failed to fetch centers" });
    }
  });

  app.post("/api/centers", async (req, res) => {
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

  app.put("/api/centers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        ...(req.body.name && { name: toProperCase(req.body.name) }),
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

  app.delete("/api/centers/:id", async (req, res) => {
    try {
      const { id } = req.params;
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

  app.delete("/api/centers/bulk", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteCenters(ids);
      res.json({ deleted });
    } catch (error) {
      console.error("Bulk delete centers error:", error);
      res.status(500).json({ message: "Failed to bulk delete centers" });
    }
  });

  // ========== Scheduling Validation ==========
  app.post("/api/centers/:centerId/validate-appointment", async (req, res) => {
    try {
      const { centerId } = req.params;
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

  app.get("/api/centers/:centerId/available-times", async (req, res) => {
    try {
      const { centerId } = req.params;
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
  app.get("/api/vendors", async (req, res) => {
    try {
      const vendorsList = await storage.getVendors();
      res.json(vendorsList);
    } catch (error) {
      console.error("Vendors error:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.get("/api/vendors/:id", async (req, res) => {
    try {
      const vendor = await storage.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      console.error("Get vendor error:", error);
      res.status(500).json({ message: "Failed to fetch vendor" });
    }
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const { name, contactPerson, phone, email } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Vendor name is required" });
      }
      const vendor = await storage.createVendor({
        name: toProperCase(name),
        contactPerson: contactPerson ? toProperCase(contactPerson) : undefined,
        phone,
        email,
      });
      res.status(201).json(vendor);
    } catch (error) {
      console.error("Create vendor error:", error);
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });

  app.put("/api/vendors/:id", async (req, res) => {
    try {
      const { name, contactPerson, phone, email, active } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = toProperCase(name);
      if (contactPerson !== undefined) updateData.contactPerson = contactPerson ? toProperCase(contactPerson) : null;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (active !== undefined) updateData.active = active;
      
      const vendor = await storage.updateVendor(req.params.id, updateData);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      console.error("Update vendor error:", error);
      res.status(500).json({ message: "Failed to update vendor" });
    }
  });

  app.delete("/api/vendors/:id", async (req, res) => {
    try {
      await storage.deleteVendor(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete vendor error:", error);
      res.status(500).json({ message: "Failed to delete vendor" });
    }
  });

  // ========== Service Types ==========
  app.get("/api/service-types", async (req, res) => {
    try {
      const types = await storage.getServiceTypes();
      res.json(types);
    } catch (error) {
      console.error("Service types error:", error);
      res.status(500).json({ message: "Failed to fetch service types" });
    }
  });

  app.post("/api/service-types", async (req, res) => {
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

  app.put("/api/service-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        ...(req.body.name && { name: toProperCase(req.body.name) }),
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

  app.delete("/api/service-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
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

  app.post("/api/service-types/bulk", async (req, res) => {
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

  app.delete("/api/service-types/bulk", async (req, res) => {
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
  app.get("/api/job-types", async (req, res) => {
    try {
      const types = await storage.getJobTypes();
      res.json(types);
    } catch (error) {
      console.error("Job types error:", error);
      res.status(500).json({ message: "Failed to fetch job types" });
    }
  });

  app.post("/api/job-types", async (req, res) => {
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

  app.put("/api/job-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        ...(req.body.name && { name: toProperCase(req.body.name) }),
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

  app.delete("/api/job-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
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

  app.delete("/api/job-types/bulk", async (req, res) => {
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

  // ========== Typing Jobs ==========
  app.post("/api/typing-jobs", async (req, res) => {
    try {
      const validation = validateBody(insertTypingJobSchema.omit({ jobCode: true }), req.body);
      if ("error" in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      // Get job type to determine category for job code generation
      const jobType = await storage.getJobTypeById(validation.data.jobTypeId);
      const category = jobType?.category || "Medical";
      
      // Auto-generate job code based on category
      const jobCode = await storage.generateNextJobCode(category as "Medical" | "EID");
      
      const job = await storage.createTypingJob({
        ...validation.data,
        jobCode,
      });
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: job.id,
        action: "created",
        details: { jobTypeId: job.jobTypeId, woId: job.woId, jobCode },
      });
      
      res.status(201).json(job);
    } catch (error) {
      console.error("Create typing job error:", error);
      res.status(500).json({ message: "Failed to create typing job" });
    }
  });

  app.get("/api/typing-jobs", async (req, res) => {
    try {
      const { status } = req.query;
      const jobs = await storage.getTypingJobs(status as string | undefined);
      
      const result = await Promise.all(
        jobs.map(async (job) => {
          const wo = await storage.getWorkOrderById(job.woId);
          const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
          return { ...job, workOrder: wo, jobType };
        })
      );
      
      res.json(result);
    } catch (error) {
      console.error("Typing jobs error:", error);
      res.status(500).json({ message: "Failed to fetch typing jobs" });
    }
  });

  app.get("/api/typing-jobs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const job = await storage.getTypingJobById(id);
      
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      const wo = await storage.getWorkOrderById(job.woId);
      const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
      const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
      const vendor = job.vendorId ? await storage.getVendorById(job.vendorId) : null;
      const result = await storage.getTypingJobResult(id);
      const comments = await storage.getTypingJobComments(id);
      const jobFiles = await storage.getFilesByRelated("TypingJob", id);
      
      res.json({ 
        ...job, 
        workOrder: wo ? { ...wo, company } : null, 
        jobType, 
        vendor,
        result,
        comments,
        files: jobFiles
      });
    } catch (error) {
      console.error("Typing job detail error:", error);
      res.status(500).json({ message: "Failed to fetch typing job" });
    }
  });

  app.put("/api/typing-jobs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const existingJob = await storage.getTypingJobById(id);
      const previousStatus = existingJob?.status;
      
      const job = await storage.updateTypingJob(id, req.body);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      if (req.body.status && req.body.status !== previousStatus) {
        await storage.createAuditLog({
          entityType: "typing_job",
          entityId: id,
          action: "status_changed",
          details: { previousStatus, newStatus: req.body.status, changedBy: "Internal" },
        });
      }
      
      res.json(job);
    } catch (error) {
      console.error("Typing job update error:", error);
      res.status(500).json({ message: "Failed to update typing job" });
    }
  });

  // Typing Job Comments
  app.post("/api/typing-jobs/:id/comments", async (req, res) => {
    try {
      const { id } = req.params;
      const comment = await storage.createTypingJobComment({
        typingJobId: id,
        ...req.body
      });
      
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "comment_added",
        details: { 
          authorType: req.body.authorType || "Internal",
          message: req.body.message?.substring(0, 100) 
        },
      });
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Typing job comment error:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Submit typing job to vendor
  app.post("/api/typing-jobs/:id/submit-to-vendor", async (req, res) => {
    try {
      const { id } = req.params;
      const { vendorId } = req.body;
      
      if (!vendorId) {
        return res.status(400).json({ message: "Vendor ID is required" });
      }
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      if (job.status !== "Draft") {
        return res.status(400).json({ message: "Only draft jobs can be submitted to vendor" });
      }
      
      // Get job type to determine cost
      const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
      const cost = jobType?.cost || 0;
      
      // Get vendor and check balance
      const vendor = await storage.getVendorById(vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      const balance = await storage.getWalletBalance(vendorId);
      if (balance < cost) {
        return res.status(400).json({ 
          message: `Insufficient vendor balance. Required: AED ${cost}, Available: AED ${balance}` 
        });
      }
      
      // Deduct from vendor wallet
      if (cost > 0) {
        await storage.createWalletEntry({
          vendorId,
          entryType: "Debit",
          typingJobId: id,
          amount: -cost,
          note: `Job submission: ${job.id}`,
        });
      }
      
      // Update job with vendor assignment and status
      const updatedJob = await storage.updateTypingJob(id, {
        vendorId,
        status: "SentToVendor",
        costSnapshot: cost,
        sentAt: new Date(),
      });
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "submitted_to_vendor",
        details: { vendorId, vendorName: vendor.name, cost },
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Submit to vendor error:", error);
      res.status(500).json({ message: "Failed to submit job to vendor" });
    }
  });

  // Mark typing job as received from vendor
  app.post("/api/typing-jobs/:id/mark-received", async (req, res) => {
    try {
      const { id } = req.params;
      const { applicationRefNo, centerName, centerArea, centerNotes, biometricsRequired, biometricsDatetime, biometricsCenter, vendorNotes } = req.body;
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      if (job.status !== "SentToVendor" && job.status !== "InProgress") {
        return res.status(400).json({ message: "Job must be with vendor to mark as received" });
      }
      
      // Create or update typing job result
      await storage.createTypingJobResult({
        typingJobId: id,
        applicationRefNo,
        centerName,
        centerArea,
        centerNotes,
        biometricsRequired: biometricsRequired || false,
        biometricsDatetime: biometricsDatetime ? new Date(biometricsDatetime) : null,
        biometricsCenter,
        vendorNotes,
      });
      
      // Update job status
      const updatedJob = await storage.updateTypingJob(id, {
        status: "WaitingForDocs",
        returnedAt: new Date(),
      });
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "received_from_vendor",
        details: { applicationRefNo },
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Mark received error:", error);
      res.status(500).json({ message: "Failed to mark job as received" });
    }
  });

  // Mark typing job as returned (needs more docs)
  app.post("/api/typing-jobs/:id/mark-returned", async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      // Update job status to Returned
      const updatedJob = await storage.updateTypingJob(id, {
        status: "Returned",
      });
      
      // Add comment with reason
      if (reason) {
        await storage.createTypingJobComment({
          typingJobId: id,
          authorType: "Vendor",
          message: `Returned for additional documents: ${reason}`,
        });
      }
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "returned_by_vendor",
        details: { reason },
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Mark returned error:", error);
      res.status(500).json({ message: "Failed to mark job as returned" });
    }
  });

  // Resubmit typing job to vendor
  app.post("/api/typing-jobs/:id/resubmit", async (req, res) => {
    try {
      const { id } = req.params;
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      if (job.status !== "Returned") {
        return res.status(400).json({ message: "Only returned jobs can be resubmitted" });
      }
      
      // Update job status back to SentToVendor
      const updatedJob = await storage.updateTypingJob(id, {
        status: "SentToVendor",
        sentAt: new Date(),
      });
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "resubmitted_to_vendor",
        details: {},
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Resubmit error:", error);
      res.status(500).json({ message: "Failed to resubmit job" });
    }
  });

  // Deliver typing job to client
  app.post("/api/typing-jobs/:id/deliver-to-client", async (req, res) => {
    try {
      const { id } = req.params;
      
      const job = await storage.getTypingJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Typing job not found" });
      }
      
      // Update job status
      const updatedJob = await storage.updateTypingJob(id, {
        status: "SentToClient",
        sentToClientAt: new Date(),
      });
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: id,
        action: "delivered_to_client",
        details: {},
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Deliver to client error:", error);
      res.status(500).json({ message: "Failed to deliver to client" });
    }
  });

  // Files API
  app.get("/api/files/:relatedType/:relatedId", async (req, res) => {
    try {
      const { relatedType, relatedId } = req.params;
      const filesList = await storage.getFilesByRelated(relatedType, relatedId);
      res.json(filesList);
    } catch (error) {
      console.error("Files fetch error:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  app.post("/api/files", async (req, res) => {
    try {
      const file = await storage.createFile(req.body);
      
      if (req.body.relatedType === "TypingJob") {
        await storage.createAuditLog({
          entityType: "typing_job",
          entityId: req.body.relatedId,
          action: "file_uploaded",
          details: { 
            fileName: req.body.fileName, 
            direction: req.body.direction,
            uploadedBy: req.body.uploadedByType 
          },
        });
      }
      
      res.status(201).json(file);
    } catch (error) {
      console.error("File create error:", error);
      res.status(500).json({ message: "Failed to create file" });
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFile(id);
      res.status(204).end();
    } catch (error) {
      console.error("File delete error:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // ========== Vendor Wallet ==========
  app.get("/api/vendor-wallet/summary", async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      if (vendors.length === 0) {
        return res.json({
          balance: 0,
          monthTopups: 0,
          monthSpend: 0,
          lowBalanceWarning: false,
        });
      }

      const vendorId = vendors[0].id;
      const balance = await storage.getWalletBalance(vendorId);
      const monthlyStats = await storage.getMonthlyStats(vendorId);
      const settings = await storage.getAppSettings();

      res.json({
        balance,
        monthTopups: monthlyStats.topups,
        monthSpend: monthlyStats.spend,
        lowBalanceWarning: balance < (settings?.lowBalanceThreshold || 1000),
      });
    } catch (error) {
      console.error("Wallet summary error:", error);
      res.status(500).json({ message: "Failed to fetch wallet summary" });
    }
  });

  app.get("/api/vendor-wallet/ledger", async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      if (vendors.length === 0) {
        return res.json([]);
      }

      const ledger = await storage.getWalletLedger(vendors[0].id);
      res.json(ledger);
    } catch (error) {
      console.error("Wallet ledger error:", error);
      res.status(500).json({ message: "Failed to fetch wallet ledger" });
    }
  });

  app.post("/api/vendor-wallet/topup", async (req, res) => {
    try {
      const validation = validateBody(topupSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const { amount, note } = validation.data;
      const vendors = await storage.getVendors();
      
      if (vendors.length === 0) {
        return res.status(400).json({ message: "No vendor found" });
      }

      const entry = await storage.createWalletEntry({
        vendorId: vendors[0].id,
        entryType: "Topup",
        amount,
        note: note || "Manual top-up",
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error("Wallet topup error:", error);
      res.status(500).json({ message: "Failed to process top-up" });
    }
  });

  // ========== Settings ==========
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      res.json(settings || {
        fromEmail: "notifications@procompany.ae",
        fromName: "The P.R.O. Company",
        replyToEmail: "operations@procompany.ae",
        alwaysCc: ["faris@procompany.ae", "yasin@procompany.ae"],
        lowBalanceThreshold: 1000,
      });
    } catch (error) {
      console.error("Settings error:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const settings = await storage.updateAppSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error("Update settings error:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // ========== Seed Real Companies (Development Only) ==========
  app.post("/api/admin/seed-companies", async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      
      const result = await storage.seedRealCompanies();
      res.json({ 
        message: `Companies seeded: ${result.added} added, ${result.skipped} already existed`,
        ...result
      });
    } catch (error) {
      console.error("Seed companies error:", error);
      res.status(500).json({ message: "Failed to seed companies" });
    }
  });

  // ========== Seed Medical Centers (Development Only) ==========
  app.post("/api/admin/seed-medical-centers", async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      
      const result = await storage.seedMedicalCenters();
      res.json({ 
        message: `Medical centers seeded: ${result.added} added, ${result.skipped} already existed`,
        ...result
      });
    } catch (error) {
      console.error("Seed medical centers error:", error);
      res.status(500).json({ message: "Failed to seed medical centers" });
    }
  });

  // ========== Seed Service Types (Development Only) ==========
  app.post("/api/admin/seed-service-types", async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      
      const result = await storage.seedServiceTypes();
      res.json({ 
        message: `Service types seeded: ${result.added} added, ${result.skipped} already existed`,
        ...result
      });
    } catch (error) {
      console.error("Seed service types error:", error);
      res.status(500).json({ message: "Failed to seed service types" });
    }
  });

  // Seed vendor jobs (development only)
  app.post("/api/seed/vendor-jobs", async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      
      const result = await storage.seedVendorJobs();
      res.json({ 
        message: `Vendor jobs seeded: ${result.added} added, ${result.skipped} already existed`,
        ...result
      });
    } catch (error) {
      console.error("Seed vendor jobs error:", error);
      res.status(500).json({ message: "Failed to seed vendor jobs" });
    }
  });

  // Seed staff (development only)
  app.post("/api/seed/staff", async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "This endpoint is disabled in production" });
      }
      
      const result = await storage.seedStaff();
      res.json({ 
        message: `Staff seeded: ${result.added} added, ${result.skipped} already existed`,
        ...result
      });
    } catch (error) {
      console.error("Seed staff error:", error);
      res.status(500).json({ message: "Failed to seed staff" });
    }
  });

  // ========== Authentication ==========
  app.post("/api/auth/login", async (req, res) => {
    try {
      const validation = validateBody(loginSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const { email, password } = validation.data;
      const user = await storage.getUserByEmail(email);
      
      if (!user || user.passwordHash !== password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const vendorRoles = ["Vendor", "Vendor Accountant", "Vendor Manager"];
      if (vendorRoles.includes(user.role)) {
        return res.status(403).json({ message: "Please use the vendor portal" });
      }

      res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ========== Vendor Portal ==========
  app.post("/api/vendor/auth/login", async (req, res) => {
    try {
      const validation = validateBody(vendorLoginSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const { username, password } = validation.data;
      const user = await storage.getUserByEmail(username);
      
      const vendorRoles = ["Vendor", "Vendor Accountant", "Vendor Manager"];
      if (!user || user.passwordHash !== password || !vendorRoles.includes(user.role)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      res.json({ 
        id: user.id, 
        name: user.name, 
        vendorId: user.vendorId 
      });
    } catch (error) {
      console.error("Vendor login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/vendor/jobs", async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      if (vendors.length === 0) {
        return res.json([]);
      }

      const jobs = await storage.getTypingJobsByVendorId(vendors[0].id);
      
      const result = await Promise.all(
        jobs.map(async (job) => {
          const wo = await storage.getWorkOrderById(job.woId);
          const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
          const files = await storage.getFilesByRelated("TypingJob", job.id);
          const comments = await storage.getTypingJobComments(job.id);
          return { 
            ...job, 
            workOrder: wo, 
            jobType,
            hasInputDocs: files.some((f: { direction: string }) => f.direction === "Input"),
            commentCount: comments.length,
          };
        })
      );
      
      res.json(result);
    } catch (error) {
      console.error("Vendor jobs error:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Get single vendor job with full details
  app.get("/api/vendor/jobs/:id", async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getTypingJobById(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const wo = await storage.getWorkOrderById(job.woId);
      const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
      const files = await storage.getFilesByRelated("TypingJob", job.id);
      const comments = await storage.getTypingJobComments(job.id);

      res.json({
        ...job,
        workOrder: wo,
        jobType,
        files,
        comments,
        instructions: (job as any).vendorNotes || null,
      });
    } catch (error) {
      console.error("Vendor job detail error:", error);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Vendor upload file (output document)
  const vendorFileSchema = z.object({
    fileName: z.string().min(1),
    objectPath: z.string().min(1),
  });

  app.post("/api/vendor/jobs/:id/files", async (req, res) => {
    try {
      const jobId = req.params.id;
      const validation = validateBody(vendorFileSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { fileName, objectPath } = validation.data;
      
      const file = await storage.createFile({
        relatedType: "TypingJob",
        relatedId: jobId,
        direction: "Output",
        fileName,
        workdriveLink: objectPath,
        uploadedByType: "Vendor",
      });

      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: jobId,
        action: "vendor_file_uploaded",
        details: { fileName },
      });

      res.status(201).json(file);
    } catch (error) {
      console.error("Vendor file upload error:", error);
      res.status(500).json({ message: "Failed to save file" });
    }
  });

  // Vendor add comment
  const vendorCommentSchema = z.object({
    message: z.string().min(1).max(2000),
  });

  app.post("/api/vendor/jobs/:id/comments", async (req, res) => {
    try {
      const jobId = req.params.id;
      const validation = validateBody(vendorCommentSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { message } = validation.data;
      
      const comment = await storage.createTypingJobComment({
        typingJobId: jobId,
        authorType: "Vendor",
        message,
      });

      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: jobId,
        action: "vendor_comment_added",
        details: { message: message.substring(0, 100) },
      });

      res.status(201).json(comment);
    } catch (error) {
      console.error("Vendor comment error:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Vendor update job status
  const vendorStatusSchema = z.object({
    status: z.enum(["InProgress", "WaitingForDocs", "Returned"]),
  });

  app.put("/api/vendor/jobs/:id/status", async (req, res) => {
    try {
      const jobId = req.params.id;
      const validation = validateBody(vendorStatusSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { status } = validation.data;

      const job = await storage.getTypingJobById(jobId);
      const previousStatus = job?.status;

      const updateData: Record<string, any> = { status };
      if (status === "Returned") {
        updateData.returnedAt = new Date();
      }

      const updated = await storage.updateTypingJob(jobId, updateData);

      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: jobId,
        action: "status_changed",
        details: { previousStatus, newStatus: status, changedBy: "Vendor" },
      });

      res.json(updated);
    } catch (error) {
      console.error("Vendor status update error:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // ========== Work Order Documents ==========
  app.get("/api/work-orders/:id/documents", async (req, res) => {
    try {
      const { id } = req.params;
      const documents = await storage.getWoDocuments(id);
      res.json(documents);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/work-orders/:id/documents", async (req, res) => {
    try {
      const { id } = req.params;
      const { documentType, fileName, fileUrl, mimeType, fileSize } = req.body;
      
      if (!documentType || !fileName || !fileUrl) {
        return res.status(400).json({ message: "documentType, fileName, and fileUrl are required" });
      }

      const document = await storage.createWoDocument({
        woId: id,
        documentType,
        fileName,
        fileUrl,
        mimeType,
        fileSize,
        status: "Uploaded",
      });

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: id,
        action: "document_uploaded",
        details: { documentType, fileName },
      });

      res.status(201).json(document);
    } catch (error) {
      console.error("Create document error:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.put("/api/documents/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !["Pending", "Uploaded", "Verified"].includes(status)) {
        return res.status(400).json({ message: "Valid status required (Pending, Uploaded, Verified)" });
      }

      const document = await storage.updateWoDocument(id, { status });
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: document.woId,
        action: "document_status_changed",
        details: { documentId: id, newStatus: status },
      });

      res.json(document);
    } catch (error) {
      console.error("Update document status error:", error);
      res.status(500).json({ message: "Failed to update document status" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getWoDocumentById(id);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.deleteWoDocument(id);

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: document.woId,
        action: "document_deleted",
        details: { documentType: document.documentType, fileName: document.fileName },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // ========== Document Requirements ==========
  app.get("/api/document-requirements", async (req, res) => {
    try {
      const requirements = await storage.getDocumentRequirements();
      res.json(requirements);
    } catch (error) {
      console.error("Get document requirements error:", error);
      res.status(500).json({ message: "Failed to fetch document requirements" });
    }
  });

  app.get("/api/document-requirements/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const requirements = await storage.getDocumentRequirementsByCategory(category);
      res.json(requirements);
    } catch (error) {
      console.error("Get document requirements by category error:", error);
      res.status(500).json({ message: "Failed to fetch document requirements" });
    }
  });

  app.post("/api/document-requirements/seed", async (req, res) => {
    try {
      const result = await storage.seedDocumentRequirements();
      res.json(result);
    } catch (error) {
      console.error("Seed document requirements error:", error);
      res.status(500).json({ message: "Failed to seed document requirements" });
    }
  });

  app.post("/api/service-types/update-categories", async (req, res) => {
    try {
      const result = await storage.updateServiceTypeCategories();
      res.json(result);
    } catch (error) {
      console.error("Update service type categories error:", error);
      res.status(500).json({ message: "Failed to update service type categories" });
    }
  });

  // ========== Reschedule ==========
  app.get("/api/reschedule/:token", async (req, res) => {
    try {
      const appointment = await storage.getAppointmentByToken(req.params.token);
      
      if (!appointment) {
        return res.status(404).json({ message: "Invalid or expired reschedule link" });
      }

      const wo = await storage.getWorkOrderById(appointment.woId);
      const center = appointment.centerId ? await storage.getCenterById(appointment.centerId) : null;

      res.json({
        appointment: {
          ...appointment,
          center,
          workOrder: wo ? { applicantName: wo.applicantName, woNumber: wo.woNumber } : null,
        },
        availableTimes: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00"],
      });
    } catch (error) {
      console.error("Reschedule fetch error:", error);
      res.status(500).json({ message: "Failed to fetch reschedule data" });
    }
  });

  app.post("/api/reschedule/:token", async (req, res) => {
    try {
      const validation = validateBody(rescheduleSubmitSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const appointment = await storage.getAppointmentByToken(req.params.token);
      
      if (!appointment) {
        return res.status(404).json({ message: "Invalid or expired reschedule link" });
      }

      const { requestedDatetime, notes } = validation.data;
      
      const request = await storage.createRescheduleRequest({
        appointmentId: appointment.id,
        requestedDatetime: new Date(requestedDatetime),
        notes,
        status: "New",
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Reschedule submit error:", error);
      res.status(500).json({ message: "Failed to submit reschedule request" });
    }
  });

  return httpServer;
}
