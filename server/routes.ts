import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { z } from "zod";
import { 
  insertWorkOrderSchema, insertCompanySchema, insertStaffSchema,
  insertCenterSchema, insertServiceTypeSchema, insertJobTypeSchema, loginSchema,
  insertAppointmentSchema,
  type CenterTimings
} from "@shared/schema";
import { validateAppointmentTime, getAvailableTimeSlots, isCenterOpenOnDate } from "@shared/scheduling";

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
  
  // Seed database on startup
  await storage.seedData();

  // ========== Dashboard ==========
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const workOrders = await storage.getWorkOrders();
      const todayAppointments = await storage.getTodayAppointments();
      const pendingJobs = await storage.getTypingJobs("SentToVendor");
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
      const typingJobs = await storage.getTypingJobsByWoId(wo.id);

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
        
        companyWithDetails = {
          ...company,
          emails,
          rmStaff,
          assistStaff,
          preferredMedicalCenter,
          preferredMedicalCenterVip,
          preferredBiometricsCenter,
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
        status: "Draft",
      });
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
      
      const wo = await storage.updateWorkOrder(id, validation.data);
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

  // ========== Appointments ==========
  app.get("/api/appointments", async (req, res) => {
    try {
      const { woId } = req.query;
      if (woId && typeof woId === "string") {
        const appointments = await storage.getAppointmentsByWoId(woId);
        res.json(appointments);
      } else {
        const appointments = await storage.getTodayAppointments();
        res.json(appointments);
      }
    } catch (error) {
      console.error("Appointments error:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      const validation = validateBody(insertAppointmentSchema.omit({ messageSentAt: true, messageSentBy: true }), req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
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
          
          return {
            ...company,
            emails,
            rmStaff,
            assistStaff,
            preferredMedicalCenter,
            preferredMedicalCenterVip,
            preferredBiometricsCenter,
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
      const company = await storage.createCompany(validation.data);
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

      res.json({
        ...company,
        emails,
        rmStaff,
        assistStaff,
        preferredMedicalCenter,
        preferredMedicalCenterVip,
        preferredBiometricsCenter,
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
      const company = await storage.updateCompany(id, validation.data);
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
      const member = await storage.createStaff(validation.data);
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
      const member = await storage.updateStaff(id, validation.data);
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
      const center = await storage.createCenter(validation.data);
      res.status(201).json(center);
    } catch (error) {
      console.error("Create center error:", error);
      res.status(500).json({ message: "Failed to create center" });
    }
  });

  app.put("/api/centers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const center = await storage.updateCenter(id, req.body);
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
      const type = await storage.createServiceType(validation.data);
      res.status(201).json(type);
    } catch (error) {
      console.error("Create service type error:", error);
      res.status(500).json({ message: "Failed to create service type" });
    }
  });

  app.put("/api/service-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const type = await storage.updateServiceType(id, req.body);
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
      const type = await storage.createJobType(validation.data);
      res.status(201).json(type);
    } catch (error) {
      console.error("Create job type error:", error);
      res.status(500).json({ message: "Failed to create job type" });
    }
  });

  app.put("/api/job-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const type = await storage.updateJobType(id, req.body);
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
          return { 
            ...job, 
            workOrder: wo, 
            jobType,
            hasInputDocs: false,
            commentCount: 0,
          };
        })
      );
      
      res.json(result);
    } catch (error) {
      console.error("Vendor jobs error:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
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
