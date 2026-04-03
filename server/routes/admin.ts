import type { Express } from "express";
import ExcelJS from "exceljs";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireOpsRole, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";
import { syncFileToWorkDrive, isWorkDriveConfigured, testWorkDriveConnection, getOrCreateExportFolder, uploadFileToWorkDrive, buildWorkDriveFileName } from "../zoho-workdrive";
import { loadAppointmentEmailDataById, renderAppointmentEmailHtml, getPhotoAsSignedUrl } from "../email-templates/preview-data-loader";
import { getTemplateRegistry, getTemplatesWithPreviews, buildTemplatePreview, EMAIL_TEMPLATE_CATEGORIES } from "../email-templates/registry";
import type { Staff, WoDocument } from "@shared/schema";
import type { RouteDeps } from "./types";

function addJsonSheet(workbook: ExcelJS.Workbook, data: Record<string, unknown>[], name: string) {
  const ws = workbook.addWorksheet(name);
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  ws.addRow(headers);
  for (const row of data) {
    ws.addRow(headers.map(h => row[h] ?? ""));
  }
}

const topupSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  amount: z.number().positive(),
  note: z.string().optional(),
});

const rescheduleSubmitSchema = z.object({
  requestedDatetime: z.string(),
  notes: z.string().optional(),
});

export function registerAdminRoutes(app: Express, deps: RouteDeps): void {
  const { walletService, upload } = deps;
  // ========== Vendor Wallet ==========
  app.get("/api/vendor-wallet/summary", requireAuth, async (req, res) => {
    try {
      const vendorId = req.query.vendorId as string;
      if (!vendorId) {
        return res.json({
          balance: 0,
          monthTopups: 0,
          monthSpend: 0,
          lowBalanceWarning: false,
        });
      }

      const settings = await storage.getAppSettings();
      const summary = await walletService.getSummary(vendorId, settings?.lowBalanceThreshold || 1000);
      res.json(summary);
    } catch (error) {
      console.error("Wallet summary error:", error);
      res.status(500).json({ message: "Failed to fetch wallet summary" });
    }
  });

  app.get("/api/vendor-wallet/ledger", requireAuth, async (req, res) => {
    try {
      const vendorId = req.query.vendorId as string;
      if (!vendorId) {
        return res.json([]);
      }

      const ledger = await storage.getWalletLedger(vendorId);
      const enriched = await Promise.all(ledger.map(async (entry) => {
        let typingJob = undefined;
        if (entry.typingJobId) {
          const job = await storage.getTypingJobById(entry.typingJobId);
          if (job) {
            const wo = await storage.getWorkOrderById(job.woId);
            typingJob = {
              woNumber: wo?.woNumber || null,
              applicantName: wo?.applicantName || null,
            };
          }
        }
        return { ...entry, typingJob };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Wallet ledger error:", error);
      res.status(500).json({ message: "Failed to fetch wallet ledger" });
    }
  });

  app.post("/api/vendor-wallet/topup", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const validation = validateBody(topupSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      
      const { vendorId, amount, note } = validation.data;

      const entry = await walletService.topup({
        vendorId,
        amount,
        note,
        createdBy: req.session?.userId,
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error("Wallet topup error:", error);
      res.status(500).json({ message: "Failed to process top-up" });
    }
  });

  // ========== Settings ==========
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      const isAdmin = user?.role === "Admin";
      const settings = await storage.getAppSettings();
      const base = settings || {
        fromEmail: "notifications@procompany.ae",
        fromName: "The P.R.O. Company",
        replyToEmail: "operations@procompany.ae",
        alwaysCc: ["faris@procompany.ae", "yasin@procompany.ae"],
        lowBalanceThreshold: 1000,
        followUpCenter: null,
        vendorDelayThresholdHours: 48,
      };
      // Mask sensitive integration secrets for non-admin users
      if (!isAdmin) {
        const { clientPortalOutboundApiKey: _masked, ...safe } = base as Record<string, unknown>;
        return res.json(safe);
      }
      res.json(base);
    } catch (error) {
      console.error("Settings error:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", requireRole("Admin"), async (req, res) => {
    try {
      const settings = await storage.updateAppSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error("Update settings error:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.post("/api/settings/logo", requireRole("Admin"), upload.single('logo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const ext = (req.file.originalname.split('.').pop() || 'png').toLowerCase();
      const objectStorageService = new ObjectStorageService();
      const logoUrl = await objectStorageService.uploadObjectEntityFile(
        `company-logo/email-logo.${ext}`,
        req.file.buffer,
        req.file.mimetype
      );
      await storage.updateAppSettings({ logoUrl });
      res.json({ logoUrl });
    } catch (error) {
      console.error("Company logo upload error:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  app.delete("/api/settings/logo", requireRole("Admin"), async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      if (settings?.logoUrl) {
        const objectStorageService = new ObjectStorageService();
        const storagePath = settings.logoUrl.replace(/^\/objects\//, '');
        if (storagePath) {
          try {
            await objectStorageService.deleteObjectEntityFile(storagePath);
          } catch (e) {
            console.warn("Could not delete logo from storage:", e);
          }
        }
      }
      await storage.updateAppSettings({ logoUrl: null });
      res.json({ success: true });
    } catch (error) {
      console.error("Remove company logo error:", error);
      res.status(500).json({ message: "Failed to remove logo" });
    }
  });

  // ========== Seed Real Companies (Development Only) ==========
  app.post("/api/admin/seed-companies", requireRole("Admin"), async (req, res) => {
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
  app.post("/api/admin/seed-medical-centers", requireRole("Admin"), async (req, res) => {
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
  app.post("/api/admin/seed-service-types", requireRole("Admin"), async (req, res) => {
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
  app.post("/api/seed/vendor-jobs", requireRole("Admin"), async (req, res) => {
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
  app.post("/api/seed/staff", requireRole("Admin"), async (req, res) => {
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

  app.get("/api/admin/email-templates", requireRole("Admin"), async (_req, res) => {
    try {
      const templates = getTemplatesWithPreviews();
      res.json({
        categories: EMAIL_TEMPLATE_CATEGORIES,
        templates,
      });
    } catch (error) {
      console.error("Email templates list error:", error);
      res.status(500).json({ message: "Failed to fetch email templates" });
    }
  });

  app.get("/api/admin/email-templates/:id/preview", requireRole("Admin"), async (req, res) => {
    try {
      const registry = getTemplateRegistry();
      const exists = registry.some(t => t.id === req.params.id);
      if (!exists) {
        return res.status(404).json({ message: "Template not found" });
      }
      const html = buildTemplatePreview(req.params.id);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (error) {
      console.error("Email template preview error:", error);
      res.status(500).json({ message: "Failed to generate template preview" });
    }
  });

  app.get("/api/admin/email-preview/appointment/:id", requireRole("Admin"), async (req, res) => {
    try {
      const data = await loadAppointmentEmailDataById(req.params.id, req);
      if (!data) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      const html = renderAppointmentEmailHtml(data);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (error) {
      console.error("Email preview error:", error);
      res.status(500).json({ message: "Failed to generate email preview" });
    }
  });

  // ========== Work Order Documents ==========
  app.get("/api/work-orders/:id/documents", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const documents = await storage.getWoDocuments(id);
      res.json(documents);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/work-orders/:id/documents", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { documentType, fileName, fileUrl, mimeType, fileSize, expiresAt } = req.body;
      
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
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: id,
        action: "document_uploaded",
        details: { documentType, fileName },
      });

      if (isWorkDriveConfigured()) {
        (async () => {
          try {
            const wo = await storage.getWorkOrderById(id);
            if (!wo) return;
            const company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;
            if (!company) return;

            const objectStorageService = new ObjectStorageService();
            const objectFile = await objectStorageService.getObjectEntityFile(fileUrl);
            const [fileBuffer] = await objectFile.download();

            const workDriveFileName = buildWorkDriveFileName(documentType, wo.applicantName, fileName);
            const result = await syncFileToWorkDrive(
              company.name,
              wo.applicantName,
              fileBuffer,
              workDriveFileName,
            );

            await storage.updateWoDocument(document.id, {
              workdriveFileId: result.fileId,
              workdriveLink: result.permalink,
            });

            console.log(`WorkDrive sync complete for document ${document.id}: ${result.permalink}`);
          } catch (err) {
            console.error(`WorkDrive sync failed for document ${document.id}:`, err);
          }
        })();
      }

      res.status(201).json(document);
    } catch (error) {
      console.error("Create document error:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.put("/api/documents/:id/status", requireAuth, async (req, res) => {
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

  app.put("/api/documents/:id/expiry", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { expiresAt } = req.body;

      if (expiresAt !== null && expiresAt !== undefined) {
        const parsed = new Date(expiresAt);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ message: "Invalid date format for expiresAt" });
        }
      }

      const document = await storage.updateWoDocument(id, {
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.createAuditLog({
        entityType: "work_order",
        entityId: document.woId,
        action: "document_expiry_updated",
        details: { documentId: id, expiresAt: expiresAt || null },
      });

      res.json(document);
    } catch (error) {
      console.error("Update document expiry error:", error);
      res.status(500).json({ message: "Failed to update document expiry" });
    }
  });

  app.get("/api/documents/expiring-soon", requireAuth, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const expiringWoDocs = await storage.getExpiringWoDocuments(threshold);

      const woIds = [...new Set(expiringWoDocs.map(d => d.woId))];
      const workOrders = woIds.length > 0 ? await storage.getWorkOrdersByIds(woIds) : [];
      const woMap = new Map(workOrders.map(wo => [wo.id, wo]));

      const enrichedWoDocs = expiringWoDocs.map(doc => ({
        ...doc,
        source: "work_order" as const,
        workOrder: woMap.get(doc.woId) ? {
          id: woMap.get(doc.woId)!.id,
          woNumber: woMap.get(doc.woId)!.woNumber,
          applicantName: woMap.get(doc.woId)!.applicantName,
        } : null,
      }));

      const expiringFiles = await storage.getExpiringFiles(threshold);

      const enrichedFiles = expiringFiles.map(f => ({
        id: f.id,
        documentType: f.direction || "File",
        fileName: f.fileName,
        fileUrl: f.workdriveLink || "",
        expiresAt: f.expiresAt,
        status: "Uploaded",
        woId: "",
        source: "file" as const,
        relatedType: f.relatedType,
        relatedId: f.relatedId,
        workOrder: null,
      }));

      const combined = [...enrichedWoDocs, ...enrichedFiles];
      combined.sort((a, b) => {
        const aDate = new Date(a.expiresAt!).getTime();
        const bDate = new Date(b.expiresAt!).getTime();
        return aDate - bDate;
      });

      res.json(combined);
    } catch (error) {
      console.error("Expiring documents error:", error);
      res.status(500).json({ message: "Failed to fetch expiring documents" });
    }
  });

  app.delete("/api/documents/:id", requireRole("Admin"), async (req, res) => {
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

  app.get("/api/workdrive/status", requireRole("Admin"), async (req, res) => {
    try {
      const configured = isWorkDriveConfigured();
      if (!configured) {
        return res.json({ configured: false, connected: false, error: "WorkDrive credentials not configured" });
      }
      const result = await testWorkDriveConnection();
      res.json({ configured: true, connected: result.success, error: result.error });
    } catch (error: unknown) {
      res.json({ configured: true, connected: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/workdrive/document-stats", requireRole("Admin"), async (req, res) => {
    try {
      const allDocs = await storage.getAllWoDocuments();
      const synced = allDocs.filter(d => d.workdriveLink);
      const unsynced = allDocs.filter(d => !d.workdriveLink);
      res.json({ total: allDocs.length, synced: synced.length, unsynced: unsynced.length });
    } catch (error: unknown) {
      res.status(500).json({ message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/admin/sync-all-documents", requireRole("Admin"), async (req, res) => {
    try {
      if (!isWorkDriveConfigured()) {
        return res.status(400).json({ message: "WorkDrive not configured" });
      }

      const unsyncedDocs = await storage.getUnsyncedWoDocuments();
      if (unsyncedDocs.length === 0) {
        return res.json({ total: 0, synced: 0, failed: 0, errors: [] });
      }

      const objectStorageService = new ObjectStorageService();
      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const doc of unsyncedDocs) {
        try {
          const wo = await storage.getWorkOrderById(doc.woId);
          if (!wo) { errors.push(`${doc.fileName}: work order not found`); failed++; continue; }
          const company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;
          if (!company) { errors.push(`${doc.fileName}: company not found`); failed++; continue; }

          const objectFile = await objectStorageService.getObjectEntityFile(doc.fileUrl);
          const [fileBuffer] = await objectFile.download();

          const workDriveFileName = buildWorkDriveFileName(doc.documentType, wo.applicantName, doc.fileName);
          const result = await syncFileToWorkDrive(company.name, wo.applicantName, fileBuffer, workDriveFileName);

          await storage.updateWoDocument(doc.id, {
            workdriveFileId: result.fileId,
            workdriveLink: result.permalink,
          });

          synced++;
        } catch (err: unknown) {
          failed++;
          errors.push(`${doc.fileName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      res.json({ total: unsyncedDocs.length, synced, failed, errors: errors.slice(0, 20) });
    } catch (error: unknown) {
      console.error("Bulk sync error:", error);
      res.status(500).json({ message: `Bulk sync failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  app.post("/api/admin/export-data-to-workdrive", requireRole("Admin"), async (req, res) => {
    try {
      if (!isWorkDriveConfigured()) {
        return res.status(400).json({ message: "WorkDrive not configured" });
      }

      const parentFolderId = process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID;
      if (!parentFolderId) {
        return res.status(400).json({ message: "Parent folder ID not configured" });
      }

      const [workOrders, companies, typingJobs, appointments, vendors] = await Promise.all([
        storage.getWorkOrders(),
        storage.getCompanies(),
        storage.getTypingJobs(),
        storage.getAllAppointments(),
        storage.getVendors(),
      ]);

      const companyMap = new Map(companies.map(c => [c.id, c.name]));
      const vendorMap = new Map(vendors.map(v => [v.id, v.name]));
      const serviceTypes = await storage.getServiceTypes();
      const serviceTypeMap = new Map(serviceTypes.map(s => [s.id, s.name]));
      const centers = await storage.getCenters();
      const centerMap = new Map(centers.map(c => [c.id, c.name]));

      const woSheet = workOrders.map(wo => ({
        "WO Number": wo.woNumber,
        "Applicant": wo.applicantName,
        "Phone": wo.applicantPhone || "",
        "Email": wo.applicantEmail || "",
        "Company": companyMap.get(wo.companyId) || "",
        "Service Type": wo.serviceTypeId ? serviceTypeMap.get(wo.serviceTypeId) || "" : "",
        "Status": wo.status,
        "VIP": wo.isVip ? "Yes" : "No",
        "Created": wo.createdAt ? new Date(wo.createdAt).toLocaleDateString() : "",
      }));

      const companySheet = companies.map(c => ({
        "Name": c.name,
        "Trade License": c.tradeLicenseNumber || "",
        "Coordinator": (c.clientCoordinator as Record<string, string> | null)?.name || "",
        "Coordinator Phone": (c.clientCoordinator as Record<string, string> | null)?.mobile || "",
        "Manager": (c.clientManager as Record<string, string> | null)?.name || "",
        "Delivery Address": c.deliveryAddress || "",
      }));

      const jobSheet = typingJobs.map(j => ({
        "Job Code": j.jobCode || "",
        "WO Number": workOrders.find(w => w.id === j.woId)?.woNumber || "",
        "Applicant": workOrders.find(w => w.id === j.woId)?.applicantName || "",
        "Vendor": j.vendorId ? vendorMap.get(j.vendorId) || "" : "",
        "Status": j.status,
        "Cost": j.costSnapshot || "",
        "Sent At": j.sentAt ? new Date(j.sentAt).toLocaleDateString() : "",
        "Returned At": j.returnedAt ? new Date(j.returnedAt).toLocaleDateString() : "",
      }));

      const apptSheet = appointments.map(a => ({
        "WO Number": workOrders.find(w => w.id === a.woId)?.woNumber || "",
        "Applicant": workOrders.find(w => w.id === a.woId)?.applicantName || "",
        "Type": a.type,
        "Date": a.datetime ? new Date(a.datetime).toLocaleDateString() : "",
        "Time": a.datetime ? new Date(a.datetime).toLocaleTimeString() : "",
        "Center": a.centerId ? centerMap.get(a.centerId) || "" : "",
        "Status": a.status,
        "Application #": a.applicationNumber || "",
      }));

      const vendorSheet = vendors.map(v => ({
        "Name": v.name,
        "Contact Person": v.contactPerson || "",
        "Phone": v.phone || "",
        "Email": v.email || "",
        "Active": v.active ? "Yes" : "No",
      }));

      const wb = new ExcelJS.Workbook();
      addJsonSheet(wb, woSheet, "Work Orders");
      addJsonSheet(wb, companySheet, "Companies");
      addJsonSheet(wb, jobSheet, "Typing Jobs");
      addJsonSheet(wb, apptSheet, "Appointments");
      addJsonSheet(wb, vendorSheet, "Vendors");

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const dateStr = new Date().toISOString().split("T")[0];
      const fileName = `PRO_Data_Export_${dateStr}.xlsx`;

      const exportFolderId = await getOrCreateExportFolder();
      const result = await uploadFileToWorkDrive(exportFolderId, buffer, fileName);

      res.json({ success: true, fileName, permalink: result.permalink, fileId: result.fileId });
    } catch (error: unknown) {
      console.error("Data export to WorkDrive error:", error);
      res.status(500).json({ message: `Export failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  app.post("/api/documents/:id/sync-workdrive", requireAuth, async (req, res) => {
    try {
      if (!isWorkDriveConfigured()) {
        return res.status(400).json({ message: "WorkDrive not configured" });
      }

      const document = await storage.getWoDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const wo = await storage.getWorkOrderById(document.woId);
      if (!wo) {
        return res.status(404).json({ message: "Work order not found" });
      }

      const company = wo.companyId ? await storage.getCompanyById(wo.companyId) : null;
      if (!company) {
        return res.status(400).json({ message: "Company not found for work order" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(document.fileUrl);
      const [fileBuffer] = await objectFile.download();

      const workDriveFileName = buildWorkDriveFileName(document.documentType, wo.applicantName, document.fileName);
      const result = await syncFileToWorkDrive(
        company.name,
        wo.applicantName,
        fileBuffer,
        workDriveFileName,
      );

      const updated = await storage.updateWoDocument(document.id, {
        workdriveFileId: result.fileId,
        workdriveLink: result.permalink,
      });

      res.json(updated);
    } catch (error: unknown) {
      console.error("WorkDrive sync error:", error);
      res.status(500).json({ message: `WorkDrive sync failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  // ========== Document Requirements ==========
  app.get("/api/document-requirements", requireAuth, async (req, res) => {
    try {
      const requirements = await storage.getDocumentRequirements();
      res.json(requirements);
    } catch (error) {
      console.error("Get document requirements error:", error);
      res.status(500).json({ message: "Failed to fetch document requirements" });
    }
  });

  app.get("/api/document-requirements/:category", requireAuth, async (req, res) => {
    try {
      const { category } = req.params;
      const requirements = await storage.getDocumentRequirementsByCategory(category);
      res.json(requirements);
    } catch (error) {
      console.error("Get document requirements by category error:", error);
      res.status(500).json({ message: "Failed to fetch document requirements" });
    }
  });

  app.post("/api/document-requirements/seed", requireRole("Admin"), async (req, res) => {
    try {
      const result = await storage.seedDocumentRequirements();
      res.json(result);
    } catch (error) {
      console.error("Seed document requirements error:", error);
      res.status(500).json({ message: "Failed to seed document requirements" });
    }
  });

  app.post("/api/service-types/update-categories", requireOpsRole, async (req, res) => {
    try {
      const result = await storage.updateServiceTypeCategories();
      res.json(result);
    } catch (error) {
      console.error("Update service type categories error:", error);
      res.status(500).json({ message: "Failed to update service type categories" });
    }
  });

  // ========== Appointment Card (public) ==========
  app.get("/api/card/:token", async (req, res) => {
    try {
      const appointment = await storage.getAppointmentByToken(req.params.token);
      if (!appointment) {
        return res.status(404).json({ message: "Invalid or expired card link" });
      }

      const wo = await storage.getWorkOrderById(appointment.woId);
      const center = appointment.centerId ? await storage.getCenterById(appointment.centerId) : null;
      const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
      const assignedStaff = appointment.assignedStaffId ? await storage.getStaffById(appointment.assignedStaffId) : null;

      let rmStaff: import("@shared/schema").Staff | null = null;
      if (company?.rmStaffId) {
        rmStaff = await storage.getStaffById(company.rmStaffId) || null;
      }

      let applicantPhotoUrl: string | null = null;
      if (wo) {
        const docs = await storage.getWoDocuments(wo.id);
        const photoDoc = docs.find(d => d.documentType === "Photo" && d.fileUrl);
        if (photoDoc?.fileUrl) {
          applicantPhotoUrl = await getPhotoAsSignedUrl(photoDoc.fileUrl) || null;
        }
      }

      let serviceTypeName: string | null = null;
      if (wo?.serviceTypeId) {
        const serviceType = await storage.getServiceTypeById(wo.serviceTypeId);
        serviceTypeName = serviceType?.name ?? null;
      }

      res.json({
        appointment,
        workOrder: wo || null,
        company: company || null,
        center: center || null,
        assignedStaff: assignedStaff || null,
        rmStaff: rmStaff || null,
        applicantPhotoUrl,
        serviceTypeName,
      });
    } catch (error) {
      console.error("Card fetch error:", error);
      res.status(500).json({ message: "Failed to fetch card data" });
    }
  });

  app.head("/api/card/:token/wallet", async (_req, res) => {
    const certBase64 = process.env.APPLE_PASS_CERT;
    const keyBase64 = process.env.APPLE_PASS_KEY;
    const wwdrBase64 = process.env.APPLE_PASS_WWDR;
    const passphrase = process.env.APPLE_PASS_PASSPHRASE;
    const teamId = process.env.APPLE_TEAM_ID;

    if (!certBase64 || !keyBase64 || !wwdrBase64 || !passphrase || !teamId) {
      const missing = [
        !certBase64 && "APPLE_PASS_CERT",
        !keyBase64 && "APPLE_PASS_KEY",
        !wwdrBase64 && "APPLE_PASS_WWDR",
        !passphrase && "APPLE_PASS_PASSPHRASE",
        !teamId && "APPLE_TEAM_ID",
      ].filter(Boolean).join(", ");
      console.log(`[apple-wallet] Wallet pass not available — missing env vars: ${missing}`);
      return res.status(503).end();
    }
    return res.status(200).end();
  });

  app.get("/api/card/:token/wallet", async (req, res) => {
    const certBase64 = process.env.APPLE_PASS_CERT;
    const keyBase64 = process.env.APPLE_PASS_KEY;
    const wwdrBase64 = process.env.APPLE_PASS_WWDR;
    const passphrase = process.env.APPLE_PASS_PASSPHRASE;

    const teamId = process.env.APPLE_TEAM_ID;

    if (!certBase64 || !keyBase64 || !wwdrBase64 || !passphrase || !teamId) {
      const missing = [
        !certBase64 && "APPLE_PASS_CERT",
        !keyBase64 && "APPLE_PASS_KEY",
        !wwdrBase64 && "APPLE_PASS_WWDR",
        !passphrase && "APPLE_PASS_PASSPHRASE",
        !teamId && "APPLE_TEAM_ID",
      ].filter(Boolean).join(", ");
      console.log(`[apple-wallet] Wallet pass generation skipped — missing env vars: ${missing}`);
      return res.status(503).json({ message: "Apple Wallet not configured" });
    }

    try {
      const token = req.params.token;
      const appointment = await storage.getAppointmentByToken(token);
      if (!appointment) {
        return res.status(404).json({ message: "Invalid or expired card link" });
      }

      const [wo, center, assignedStaff] = await Promise.all([
        storage.getWorkOrderById(appointment.woId),
        appointment.centerId ? storage.getCenterById(appointment.centerId) : Promise.resolve(null),
        appointment.assignedStaffId ? storage.getStaffById(appointment.assignedStaffId) : Promise.resolve(null),
      ]);

      const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;

      const { PKPass } = await import("passkit-generator");

      const dt = new Date(appointment.datetime);
      const dateStr = dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const timeStr = dt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

      const arrivalDt = new Date(dt.getTime() - 15 * 60 * 1000);
      const arrivalTimeStr = arrivalDt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
      const recommendedArrival = `${arrivalTimeStr} (15 min before appointment)`;

      const isEID = appointment.type === "EID";
      const passDescription = isEID ? "Emirates ID Biometrics" : "Medical Fitness Appointment";

      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      const cardUrl = `${baseUrl}/card/${token}`;

      const navyRgb = "rgb(26, 58, 107)";

      const pass = new PKPass({}, {
        signerCert: Buffer.from(certBase64, "base64"),
        signerKey: Buffer.from(keyBase64, "base64"),
        wwdr: Buffer.from(wwdrBase64, "base64"),
        signerKeyPassphrase: passphrase,
      }, {
        serialNumber: appointment.id,
        description: passDescription,
        organizationName: "The P.R.O. Company™",
        passTypeIdentifier: "pass.ae.procompany.appointment",
        teamIdentifier: teamId,
        foregroundColor: navyRgb,
        backgroundColor: "rgb(255, 255, 255)",
        labelColor: navyRgb,
      });

      pass.type = "generic";

      pass.setBarcodes({
        message: cardUrl,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
      });

      const centerName = center?.name || "—";
      const centerArea = center?.area;
      const centerDisplay = centerArea ? `${centerName} — ${centerArea}` : centerName;

      if (isEID) {
        // EID layout: time primary, date secondary, center + applicant auxiliary
        pass.primaryFields.push({
          key: "time",
          label: "Appointment Time",
          value: timeStr,
        });

        pass.secondaryFields.push({
          key: "date",
          label: "Date",
          value: dateStr,
        });

        pass.auxiliaryFields.push({
          key: "center",
          label: "Biometrics Center",
          value: centerDisplay,
        });

        pass.auxiliaryFields.push({
          key: "applicant",
          label: "Applicant",
          value: wo?.applicantName || "—",
        });

        if (company?.name) {
          pass.auxiliaryFields.push({
            key: "company",
            label: "Company",
            value: company.name,
          });
        }
      } else {
        // Medical layout: appointment type in header, applicant primary, date + time secondary, center auxiliary
        pass.headerFields.push({
          key: "type",
          label: "Appointment",
          value: "Medical Fitness",
        });

        pass.primaryFields.push({
          key: "applicant",
          label: "Applicant",
          value: wo?.applicantName || "—",
        });

        pass.secondaryFields.push({
          key: "date",
          label: "Date",
          value: dateStr,
        });

        pass.secondaryFields.push({
          key: "time",
          label: "Time",
          value: timeStr,
        });

        pass.auxiliaryFields.push({
          key: "center",
          label: "Medical Center",
          value: centerDisplay,
        });

        if (company?.name) {
          pass.auxiliaryFields.push({
            key: "company",
            label: "Company",
            value: company.name,
          });
        }
      }

      pass.backFields.push({
        key: "ref",
        label: "Reference",
        value: wo?.woNumber || "—",
      });

      pass.backFields.push({
        key: "arrival",
        label: "Recommended Arrival",
        value: recommendedArrival,
      });

      pass.backFields.push({
        key: "duration",
        label: "Estimated Duration",
        value: "15 – 30 minutes",
      });

      if (isEID) {
        pass.backFields.push({
          key: "document",
          label: "Required Documents",
          value: "Original passport and original Emirates ID (no copies accepted)",
        });

        const assistContact = assignedStaff
          ? (assignedStaff.phone ? `${assignedStaff.name} — ${assignedStaff.phone}` : assignedStaff.name)
          : "Will be assigned before your appointment";
        pass.backFields.push({
          key: "guide",
          label: "On-Site Guide",
          value: assistContact,
        });

        pass.backFields.push({
          key: "guide_note",
          label: "Guide Assistance",
          value: "Your guide will meet you on arrival and handle the queue and registration on your behalf.",
        });
      } else {
        pass.backFields.push({
          key: "document",
          label: "Required Document",
          value: "Original passport (must be valid)",
        });

        pass.backFields.push({
          key: "attire",
          label: "Attire",
          value: "Smart casual. Shoulders and knees must be covered.",
        });

        pass.backFields.push({
          key: "jewellery",
          label: "Jewellery & Accessories",
          value: "Please remove all metal jewellery and accessories before your appointment.",
        });

        const assistContact = assignedStaff
          ? (assignedStaff.phone ? `${assignedStaff.name} — ${assignedStaff.phone}` : assignedStaff.name)
          : "Will be assigned before your appointment";
        pass.backFields.push({
          key: "assist",
          label: "On-Site Assist",
          value: assistContact,
        });
      }

      const buf = await pass.getAsBuffer();
      res.set({
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="appointment.pkpass"`,
      });
      res.send(buf);
    } catch (error) {
      console.error("Wallet pass error:", error);
      res.status(500).json({ message: "Failed to generate wallet pass" });
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

}
