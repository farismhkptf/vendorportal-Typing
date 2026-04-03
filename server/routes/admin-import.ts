import type { Express, Request, Response, NextFunction } from "express";
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "../storage";
import type { DeletionRequest, InsertDocumentCustodyLog, AttestationSr } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      attestationVendorUserId?: string;
      attestationVendorId?: string;
    }
  }
}
import { requireAuth, requireOpsRole, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { checkAndAutoCompleteWorkOrder } from "../services/transition-service";
import { notifyVendorUsers } from "../services/notification-service";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";
import { toProperCase } from "../proper-case";
import type { RouteDeps } from "./types";

function addAoaSheet(workbook: ExcelJS.Workbook, data: unknown[][], name: string, colWidths?: number[]) {
  const ws = workbook.addWorksheet(name);
  ws.addRows(data);
  if (colWidths) {
    colWidths.forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  }
}

function excelSheetToJson(ws: ExcelJS.Worksheet): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  let headers: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = (row.values as unknown[]).slice(1);
    if (rowNumber === 1) {
      headers = values.map(v => v?.toString() ?? "");
      return;
    }
    const obj: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      const val = values[i] as Record<string, unknown> | null | undefined;
      if (val === null || val === undefined) {
        obj[header] = "";
      } else if (typeof val === 'object' && 'text' in val) {
        obj[header] = val.text;
      } else if (typeof val === 'object' && 'result' in val) {
        obj[header] = val.result?.toString() ?? "";
      } else {
        obj[header] = val;
      }
    });
    rows.push(obj);
  });
  return rows;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current);
        current = '';
        if (row.some(cell => cell.trim())) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    if (row.some(cell => cell.trim())) rows.push(row);
  }
  return rows;
}

export function registerAdminImportRoutes(app: Express, deps: RouteDeps): void {
  const { walletService, upload } = deps;
  // ========== Admin Excel Template & Import ==========
  app.get("/api/admin/template", requireRole("Admin"), async (req, res) => {
    try {
      const workbook = new ExcelJS.Workbook();

      const centersData = [
        ["Name", "Type (Medical/EID/Both)", "Authority (DHA/EHS/ICP)", "Tier (Normal/VIP)", "Address", "Area", "Google Maps URL", "Timing Text", "Notes"],
        ["Example Medical Center", "Medical", "DHA", "Normal", "123 Street, Dubai", "Deira", "", "Sun-Thu: 7AM-9PM", "Walk-in available"],
      ];
      addAoaSheet(workbook, centersData, "Centers", [30, 20, 20, 15, 35, 15, 30, 25, 25]);

      const companiesData = [
        ["Name", "Trade License Number", "Delivery Address"],
        ["Example Trading LLC", "TL-123456", "P.O. Box 12345, Dubai"],
      ];
      addAoaSheet(workbook, companiesData, "Companies", [30, 25, 35]);

      const staffData = [
        ["Name", "Role Title", "Staff Type (Permanent/Temporary)", "Phone", "Email", "Status (Active/OnLeave/Cancelled/TempActive/TempInactive)"],
        ["John Doe", "Relationship Manager", "Permanent", "050-123-4567", "john@example.com", "Active"],
      ];
      addAoaSheet(workbook, staffData, "Staff", [25, 25, 30, 18, 25, 45]);

      const serviceTypesData = [
        ["Name", "Category (NewVisaInside/NewVisaOutside/GoldenVisa/RenewVisa/NewbornDependent/LostReplaceEid)", "Requires Medical Typing (Yes/No)", "Requires Medical Scheduling (Yes/No)", "Requires ID Typing 2 Years (Yes/No)", "Requires ID Typing 1 Year (Yes/No)", "Requires ID Typing 10 Years (Yes/No)", "Requires ID Biometrics (Yes/No)"],
        ["New Employment Visa", "NewVisaInside", "Yes", "Yes", "Yes", "No", "No", "Yes"],
      ];
      addAoaSheet(workbook, serviceTypesData, "Service Types", [25, 60, 30, 35, 30, 30, 30, 28]);

      const jobTypesData = [
        ["Name", "Category (Medical/EID)", "Cost"],
        ["Medical Typing", "Medical", "150"],
      ];
      addAoaSheet(workbook, jobTypesData, "Job Types", [25, 22, 10]);

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="PRO_Company_Import_Template.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error("Template download error:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  app.get("/api/admin/export", requireRole("Admin"), async (req, res) => {
    try {
      const [allCompanies, allCenters, allStaff, allServiceTypes, allVendors, allJobTypes, allDocReqs, allUsers] = await Promise.all([
        storage.getCompanies(),
        storage.getCenters(),
        storage.getStaff(),
        storage.getServiceTypes(),
        storage.getVendors(),
        storage.getJobTypes(),
        storage.getDocumentRequirements(),
        storage.getUsers(),
      ]);

      const centerMap = new Map(allCenters.map(c => [c.id, c.name]));
      const staffMap = new Map(allStaff.map(s => [s.id, s.name]));
      const vendorMap = new Map(allVendors.map(v => [v.id, v.name]));
      const boolToYesNo = (val: unknown) => val ? "Yes" : "No";

      const workbook = new ExcelJS.Workbook();

      const companiesRows = allCompanies.map(c => [
        c.name || "",
        c.tradeLicenseNumber || "",
        c.preferredMedicalCenterId ? centerMap.get(c.preferredMedicalCenterId) || "" : "",
        c.preferredMedicalCenterVipId ? centerMap.get(c.preferredMedicalCenterVipId) || "" : "",
        c.preferredBiometricsCenterId ? centerMap.get(c.preferredBiometricsCenterId) || "" : "",
        c.preferredBiometricsCenterVipId ? centerMap.get(c.preferredBiometricsCenterVipId) || "" : "",
        c.rmStaffId ? staffMap.get(c.rmStaffId) || "" : "",
        c.assistStaffId ? staffMap.get(c.assistStaffId) || "" : "",
        (c.clientCoordinator as Record<string, string> | null)?.name || "",
        (c.clientCoordinator as Record<string, string> | null)?.mobile || "",
        (c.clientCoordinator as Record<string, string> | null)?.email || "",
        (c.clientManager as Record<string, string> | null)?.name || "",
        (c.clientManager as Record<string, string> | null)?.mobile || "",
        (c.clientManager as Record<string, string> | null)?.email || "",
        c.deliveryAddress || "",
        boolToYesNo(c.active),
      ]);
      const companiesData = [
        ["Name", "Trade License", "Preferred Medical Center", "Preferred Medical Center (VIP)", "Preferred Biometrics Center", "Preferred Biometrics Center (VIP)", "RM Staff", "Assistant Staff", "Coordinator Name", "Coordinator Phone", "Coordinator Email", "Manager Name", "Manager Phone", "Manager Email", "Delivery Address", "Active"],
        ...companiesRows,
      ];
      addAoaSheet(workbook, companiesData, "Companies", [30, 20, 30, 30, 30, 30, 20, 20, 20, 18, 25, 20, 18, 25, 35, 8]);

      const centersRows = allCenters.map(c => [
        c.name || "", c.type || "", c.authority || "", c.tier || "",
        c.address || "", c.area || "", c.googleMapsUrl || "",
        c.timingText || "", c.notes || "", boolToYesNo(c.active),
      ]);
      const centersData = [
        ["Name", "Type", "Authority", "Tier", "Address", "Area", "Google Maps URL", "Timing Text", "Notes", "Active"],
        ...centersRows,
      ];
      addAoaSheet(workbook, centersData, "Centers", [30, 15, 12, 10, 35, 15, 35, 25, 25, 8]);

      const staffRows = allStaff.map(s => [
        s.name || "", s.roleTitle || "", s.staffType || "",
        s.phone || "", s.email || "", s.status || "",
        s.replacementId ? staffMap.get(s.replacementId) || "" : "",
        s.leaveEndDate || "", boolToYesNo(s.active),
      ]);
      const staffData = [
        ["Name", "Role Title", "Staff Type", "Phone", "Email", "Status", "Replacement", "Leave End Date", "Active"],
        ...staffRows,
      ];
      addAoaSheet(workbook, staffData, "Staff", [25, 25, 15, 18, 25, 15, 25, 15, 8]);

      const serviceTypesRows = allServiceTypes.map(st => [
        st.name || "", st.category || "",
        boolToYesNo(st.requiresMedicalTyping), boolToYesNo(st.requiresMedicalScheduling),
        boolToYesNo(st.requiresIdTyping2Years), boolToYesNo(st.requiresIdTyping1Year),
        boolToYesNo(st.requiresIdTyping10Years), boolToYesNo(st.requiresIdBiometrics),
        boolToYesNo(st.isDependent), boolToYesNo(st.active),
      ]);
      const serviceTypesData = [
        ["Name", "Category", "Requires Medical Typing", "Requires Medical Scheduling", "Requires ID Typing 2 Years", "Requires ID Typing 1 Year", "Requires ID Typing 10 Years", "Requires ID Biometrics", "Is Dependent", "Active"],
        ...serviceTypesRows,
      ];
      addAoaSheet(workbook, serviceTypesData, "Service Types", [25, 22, 25, 28, 25, 22, 25, 22, 14, 8]);

      const vendorsRows = allVendors.map(v => [
        v.name || "", v.contactPerson || "", v.phone || "", v.email || "", boolToYesNo(v.active),
      ]);
      const vendorsData = [
        ["Name", "Contact Person", "Phone", "Email", "Active"],
        ...vendorsRows,
      ];
      addAoaSheet(workbook, vendorsData, "Vendors", [25, 20, 18, 25, 8]);

      const jobTypesRows = allJobTypes.map(jt => [
        jt.name || "", jt.category || "", jt.cost ?? "", boolToYesNo(jt.active),
      ]);
      const jobTypesData = [
        ["Name", "Category", "Cost", "Active"],
        ...jobTypesRows,
      ];
      addAoaSheet(workbook, jobTypesData, "Vendor Jobs", [25, 15, 10, 8]);

      const docReqsRows = allDocReqs.map(dr => [
        dr.serviceCategory || "", dr.documentType || "",
        boolToYesNo(dr.isRequired), boolToYesNo(dr.appliesToMedical), boolToYesNo(dr.appliesToEid),
      ]);
      const docReqsData = [
        ["Service Category", "Document Type", "Is Required", "Applies to Medical", "Applies to EID"],
        ...docReqsRows,
      ];
      addAoaSheet(workbook, docReqsData, "Document Requirements", [22, 25, 14, 20, 16]);

      const usersRows = allUsers.map(u => [
        u.name || "", u.email || "", u.role || "",
        u.staffId ? staffMap.get(u.staffId) || "" : "",
        u.vendorId ? vendorMap.get(u.vendorId) || "" : "",
        boolToYesNo(u.active),
        u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
      ]);
      const usersData = [
        ["Name", "Email", "Role", "Linked Staff", "Linked Vendor", "Active", "Created At"],
        ...usersRows,
      ];
      addAoaSheet(workbook, usersData, "User Accounts", [25, 30, 22, 25, 25, 8, 14]);

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="PRO_Company_Data_Export.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error("Data export error:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.post("/api/admin/import", requireRole("Admin"), upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheetNames = workbook.worksheets.map(ws => ws.name);
      const results: Record<string, { imported: number; failed: number; errors: string[] }> = {};
      let totalImported = 0;
      let totalFailed = 0;

      const yesNoToBool = (val: unknown): boolean => {
        if (typeof val === 'string') return val.trim().toLowerCase() === 'yes';
        return !!val;
      };

      if (sheetNames.includes("Centers")) {
        const sheet = workbook.getWorksheet("Centers")!;
        const rows: Record<string, unknown>[] = excelSheetToJson(sheet);
        const sheetResult = { imported: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = row["Name"]?.toString().trim();
          if (!name) continue;
          try {
            const typeVal = row["Type (Medical/EID/Both)"]?.toString().trim();
            const authorityVal = row["Authority (DHA/EHS/ICP)"]?.toString().trim();
            const tierVal = row["Tier (Normal/VIP)"]?.toString().trim();
            await storage.createCenter({
              name,
              type: (typeVal || "Medical") as "Medical" | "EID" | "Both",
              authority: (authorityVal || undefined) as "DHA" | "EHS" | "ICP" | undefined,
              tier: (tierVal || "Normal") as "Normal" | "VIP",
              address: row["Address"]?.toString().trim() || undefined,
              area: row["Area"]?.toString().trim() || undefined,
              googleMapsUrl: row["Google Maps URL"]?.toString().trim() || undefined,
              timingText: row["Timing Text"]?.toString().trim() || undefined,
              notes: row["Notes"]?.toString().trim() || undefined,
            });
            sheetResult.imported++;
          } catch (err: unknown) {
            sheetResult.failed++;
            sheetResult.errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
        results["Centers"] = sheetResult;
        totalImported += sheetResult.imported;
        totalFailed += sheetResult.failed;
      }

      if (sheetNames.includes("Companies")) {
        const sheet = workbook.getWorksheet("Companies")!;
        const rows: Record<string, unknown>[] = excelSheetToJson(sheet);
        const sheetResult = { imported: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = row["Name"]?.toString().trim();
          if (!name) continue;
          try {
            await storage.createCompany({
              name,
              tradeLicenseNumber: row["Trade License Number"]?.toString().trim() || undefined,
              deliveryAddress: row["Delivery Address"]?.toString().trim() || undefined,
            });
            sheetResult.imported++;
          } catch (err: unknown) {
            sheetResult.failed++;
            sheetResult.errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
        results["Companies"] = sheetResult;
        totalImported += sheetResult.imported;
        totalFailed += sheetResult.failed;
      }

      if (sheetNames.includes("Staff")) {
        const sheet = workbook.getWorksheet("Staff")!;
        const rows: Record<string, unknown>[] = excelSheetToJson(sheet);
        const sheetResult = { imported: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = row["Name"]?.toString().trim();
          if (!name) continue;
          try {
            await storage.createStaff({
              name,
              roleTitle: row["Role Title"]?.toString().trim() || "Staff",
              staffType: (row["Staff Type (Permanent/Temporary)"]?.toString().trim() || "Permanent") as "Permanent" | "Temporary",
              phone: row["Phone"]?.toString().trim() || undefined,
              email: row["Email"]?.toString().trim() || undefined,
              status: (row["Status (Active/OnLeave/Cancelled/TempActive/TempInactive)"]?.toString().trim() || "Active") as "Active" | "OnLeave" | "Cancelled" | "TempActive" | "TempInactive",
            });
            sheetResult.imported++;
          } catch (err: unknown) {
            sheetResult.failed++;
            sheetResult.errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
        results["Staff"] = sheetResult;
        totalImported += sheetResult.imported;
        totalFailed += sheetResult.failed;
      }

      if (sheetNames.includes("Service Types")) {
        const sheet = workbook.getWorksheet("Service Types")!;
        const rows: Record<string, unknown>[] = excelSheetToJson(sheet);
        const sheetResult = { imported: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = row["Name"]?.toString().trim();
          if (!name) continue;
          try {
            await storage.createServiceType({
              name,
              category: row["Category (NewVisaInside/NewVisaOutside/GoldenVisa/RenewVisa/NewbornDependent/LostReplaceEid)"]?.toString().trim() || undefined,
              requiresMedicalTyping: yesNoToBool(row["Requires Medical Typing (Yes/No)"]),
              requiresMedicalScheduling: yesNoToBool(row["Requires Medical Scheduling (Yes/No)"]),
              requiresIdTyping2Years: yesNoToBool(row["Requires ID Typing 2 Years (Yes/No)"]),
              requiresIdTyping1Year: yesNoToBool(row["Requires ID Typing 1 Year (Yes/No)"]),
              requiresIdTyping10Years: yesNoToBool(row["Requires ID Typing 10 Years (Yes/No)"]),
              requiresIdBiometrics: yesNoToBool(row["Requires ID Biometrics (Yes/No)"]),
            });
            sheetResult.imported++;
          } catch (err: unknown) {
            sheetResult.failed++;
            sheetResult.errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
        results["Service Types"] = sheetResult;
        totalImported += sheetResult.imported;
        totalFailed += sheetResult.failed;
      }

      if (sheetNames.includes("Job Types")) {
        const sheet = workbook.getWorksheet("Job Types")!;
        const rows: Record<string, unknown>[] = excelSheetToJson(sheet);
        const sheetResult = { imported: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = row["Name"]?.toString().trim();
          if (!name) continue;
          try {
            const costVal = parseInt(row["Cost"]?.toString().trim() || "0", 10);
            await storage.createJobType({
              name,
              category: row["Category (Medical/EID)"]?.toString().trim() || "Medical",
              cost: isNaN(costVal) ? 0 : costVal,
            });
            sheetResult.imported++;
          } catch (err: unknown) {
            sheetResult.failed++;
            sheetResult.errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
        results["Job Types"] = sheetResult;
        totalImported += sheetResult.imported;
        totalFailed += sheetResult.failed;
      }

      res.json({ results, totalImported, totalFailed });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Failed to import data" });
    }
  });

  app.post("/api/admin/preview-gsheet", requireRole("Admin"), async (req, res) => {
    try {
      let { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "Google Sheet URL is required" });
      }

      url = url.trim().replace(/\/+$/, '');

      const isUploadedExcel = url.includes('rtpof=true') || url.includes('sd=true');

      const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (!sheetMatch) {
        return res.status(400).json({ message: "Invalid Google Sheet URL. Please paste a valid Google Sheets link." });
      }
      const sheetId = sheetMatch[1];

      let gid = "0";
      const gidMatch = url.match(/gid=(\d+)/);
      if (gidMatch) gid = gidMatch[1];

      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      console.log(`[gsheet] Fetching CSV from: ${csvUrl}`);
      const csvResponse = await fetch(csvUrl, { redirect: 'follow' });
      console.log(`[gsheet] Response status: ${csvResponse.status}, URL: ${csvResponse.url}`);
      if (!csvResponse.ok) {
        if (isUploadedExcel) {
          return res.status(400).json({ message: "This looks like an uploaded Excel file on Google Drive, not a native Google Sheet. Please open it in Google Sheets, then go to File → Save as Google Sheets, and use the new link instead." });
        }
        if (csvResponse.status === 400) {
          return res.status(400).json({ message: "Google blocked the export. This usually means downloading is disabled on this sheet. Please ask the sheet owner to enable downloading: Share → Advanced → uncheck 'Disable options to download, print and copy for commenters and viewers'." });
        }
        if (csvResponse.status === 404) {
          return res.status(400).json({ message: "Google Sheet not found. Please check the URL is correct and the sheet has not been deleted." });
        }
        if (csvResponse.status === 401 || csvResponse.status === 403) {
          return res.status(400).json({ message: "This sheet requires sign-in or is restricted. Please change the sharing settings to 'Anyone with the link can view'." });
        }
        try {
          const errorBody = await csvResponse.text();
          if (errorBody.includes('Page not found') || errorBody.includes('not found')) {
            return res.status(400).json({ message: "Google Sheet not found. Please check the URL is correct and the sheet has not been deleted." });
          }
          if (errorBody.includes('accounts.google.com') || errorBody.includes('ServiceLogin')) {
            return res.status(400).json({ message: "This sheet requires sign-in. Please change the sharing settings to 'Anyone with the link can view'." });
          }
        } catch (parseErr) {
          console.error("Failed to parse Google Sheets error response:", parseErr);
        }
        return res.status(400).json({ message: "Could not fetch the Google Sheet. Make sure it is shared as 'Anyone with the link can view' and the URL is correct." });
      }
      const csvText = await csvResponse.text();

      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
        if (isUploadedExcel) {
          return res.status(400).json({ message: "This looks like an uploaded Excel file on Google Drive, not a native Google Sheet. Please open it in Google Sheets, then go to File → Save as Google Sheets, and use the new link instead." });
        }
        const isNotFound = csvText.includes('Page not found') || csvText.includes('not found');
        const isSignIn = csvText.includes('accounts.google.com') || csvText.includes('ServiceLogin');
        if (isNotFound) {
          return res.status(400).json({ message: "Google Sheet not found. Please check the URL is correct and the sheet has not been deleted." });
        }
        if (isSignIn) {
          return res.status(400).json({ message: "This sheet requires sign-in. Please change the sharing settings to 'Anyone with the link can view'." });
        }
        return res.status(400).json({ message: "Could not access the sheet. Make sure it is shared as 'Anyone with the link can view' and the URL is correct." });
      }

      const cleanCsvText = csvText.replace(/^\uFEFF/, '');
      const rows = parseCSV(cleanCsvText);
      if (rows.length < 2) {
        return res.status(400).json({ message: "The sheet appears to be empty or has no data rows." });
      }

      const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, '').toLowerCase());
      const woColIdx = headers.findIndex(h => h === 'work order' || h === 'workorder' || h === 'wo' || h === 'wo number');
      const companyColIdx = headers.findIndex(h => h === 'company name' || h === 'company' || h === 'client');
      const staffColIdx = headers.findIndex(h => h === 'staff name' || h === 'staff' || h === 'applicant' || h === 'name' || h === 'employee name' || h === 'employee');
      const workColIdx = headers.findIndex(h => h === 'work' || h === 'service' || h === 'service type' || h === 'type of work');
      const dateColIdx = headers.findIndex(h => h === 'date');
      const designationColIdx = headers.findIndex(h => h === 'designation' || h === 'position' || h === 'job title');

      if (woColIdx === -1) {
        return res.status(400).json({ message: "Could not find a 'Work Order' column in the sheet. Expected headers: Work Order, Company Name, Staff Name, Work" });
      }

      const serviceTypes = await storage.getServiceTypes();
      const companies = await storage.getCompanies();

      const normalizeStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

      const fuzzyMatch = (input: string, candidates: { id: string; name: string }[]): { id: string; name: string; confidence: 'exact' | 'fuzzy' | 'none' } => {
        const normInput = normalizeStr(input);
        if (!normInput) return { id: '', name: '', confidence: 'none' };
        
        const exact = candidates.find(c => normalizeStr(c.name) === normInput);
        if (exact) return { id: exact.id, name: exact.name, confidence: 'exact' };
        
        const contains = candidates.find(c => normalizeStr(c.name).includes(normInput) || normInput.includes(normalizeStr(c.name)));
        if (contains) return { id: contains.id, name: contains.name, confidence: 'fuzzy' };
        
        const inputWords = normInput.split(/\s+/).filter(Boolean);
        let bestMatch: typeof candidates[0] | null = null;
        let bestScore = 0;
        for (const candidate of candidates) {
          const candidateNorm = normalizeStr(candidate.name);
          let score = 0;
          for (const word of inputWords) {
            if (candidateNorm.includes(word)) score++;
          }
          const ratio = score / Math.max(inputWords.length, 1);
          if (ratio > bestScore && ratio >= 0.5) {
            bestScore = ratio;
            bestMatch = candidate;
          }
        }
        if (bestMatch) return { id: bestMatch.id, name: bestMatch.name, confidence: 'fuzzy' };
        
        return { id: '', name: '', confidence: 'none' };
      };

      const previewRows: Array<{
        rowNum: number;
        woNumber: string;
        companyName: string;
        staffName: string;
        workValue: string;
        date: string;
        designation: string;
        serviceTypeMatch: { id: string; name: string; confidence: 'exact' | 'fuzzy' | 'none' };
        companyMatch: { id: string; name: string; confidence: 'exact' | 'fuzzy' | 'none' };
        canImport: boolean;
        skipReason?: string;
      }> = [];

      const existingWos = new Set<string>();
      const allWos = await storage.getWorkOrders();
      for (const wo of allWos) {
        existingWos.add(wo.woNumber.toUpperCase());
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const woNumber = (row[woColIdx] || '').trim();
        const companyName = companyColIdx >= 0 ? (row[companyColIdx] || '').trim() : '';
        const staffName = staffColIdx >= 0 ? (row[staffColIdx] || '').trim() : '';
        const workValue = workColIdx >= 0 ? (row[workColIdx] || '').trim() : '';
        const date = dateColIdx >= 0 ? (row[dateColIdx] || '').trim() : '';
        const designation = designationColIdx >= 0 ? (row[designationColIdx] || '').trim() : '';

        if (!woNumber && !staffName) continue;

        const serviceTypeMatch = workValue 
          ? fuzzyMatch(workValue, serviceTypes.filter(s => s.active).map(s => ({ id: s.id, name: s.name })))
          : { id: '', name: '', confidence: 'none' as const };

        const companyMatch = companyName
          ? fuzzyMatch(companyName, companies.map(c => ({ id: c.id, name: c.name })))
          : { id: '', name: '', confidence: 'none' as const };

        let canImport = true;
        let skipReason: string | undefined;

        if (!woNumber) {
          canImport = false;
          skipReason = 'Missing WO number';
        } else if (existingWos.has(woNumber.toUpperCase())) {
          canImport = false;
          skipReason = 'Already imported';
        } else if (!workValue) {
          canImport = false;
          skipReason = 'Empty work column';
        } else if (serviceTypeMatch.confidence === 'none') {
          canImport = false;
          skipReason = 'Service type not recognized';
        } else if (!staffName) {
          canImport = false;
          skipReason = 'Missing applicant name';
        } else if (companyMatch.confidence === 'none' && companyName) {
          canImport = false;
          skipReason = 'Company not found';
        } else if (!companyName) {
          canImport = false;
          skipReason = 'Missing company name';
        }

        previewRows.push({
          rowNum: i + 1,
          woNumber,
          companyName,
          staffName,
          workValue,
          date,
          designation,
          serviceTypeMatch,
          companyMatch,
          canImport,
          skipReason,
        });
      }

      res.json({
        totalRows: previewRows.length,
        importableCount: previewRows.filter(r => r.canImport).length,
        skippedCount: previewRows.filter(r => !r.canImport).length,
        headers: rows[0],
        rows: previewRows,
      });
    } catch (error: unknown) {
      console.error("Google Sheet preview error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to preview Google Sheet" });
    }
  });

  app.post("/api/admin/import-gsheet", requireRole("Admin"), async (req, res) => {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows to import" });
      }

      const companies = await storage.getCompanies();
      const serviceTypes = await storage.getServiceTypes();
      const companyIds = new Set(companies.map(c => c.id));
      const serviceTypeIds = new Set(serviceTypes.filter(s => s.active).map(s => s.id));

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const row of rows) {
        try {
          const woNumber = (row.woNumber || '').toString().trim();
          const staffName = (row.staffName || '').toString().trim();
          const companyId = (row.companyMatch?.id || '').toString().trim();
          const serviceTypeId = (row.serviceTypeMatch?.id || '').toString().trim();
          const designation = (row.designation || '').toString().trim();
          const rowNum = row.rowNum || '?';

          if (!woNumber) {
            failed++;
            errors.push(`Row ${rowNum}: Missing WO number`);
            continue;
          }
          if (!staffName) {
            failed++;
            errors.push(`Row ${rowNum}: Missing applicant name`);
            continue;
          }
          if (!companyId || !companyIds.has(companyId)) {
            failed++;
            errors.push(`Row ${rowNum} (${woNumber}): Invalid or missing company`);
            continue;
          }

          const existingWo = await storage.getWorkOrderByWoNumber(woNumber);
          if (existingWo) {
            failed++;
            errors.push(`Row ${rowNum} (${woNumber}): WO already exists`);
            continue;
          }

          const validServiceTypeId = serviceTypeId && serviceTypeIds.has(serviceTypeId) ? serviceTypeId : undefined;

          const newWo = await storage.createWorkOrder({
            woNumber,
            applicantName: toProperCase(staffName),
            companyId,
            serviceTypeId: validServiceTypeId,
            status: "Draft",
            notes: designation ? `Designation: ${designation}` : undefined,
          });
          await storage.createAuditLog({
            entityType: "work_order",
            entityId: newWo.id,
            action: "created",
            details: { source: "gsheet_import", woNumber },
          });
          imported++;
        } catch (err: unknown) {
          failed++;
          errors.push(`Row ${row.rowNum || '?'} (${row.woNumber || '?'}): ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      res.json({ imported, failed, errors });
    } catch (error: unknown) {
      console.error("Google Sheet import error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to import from Google Sheet" });
    }
  });

  // ========== Sheet Months (Monthly Google Sheet Tracking) ==========

  app.get("/api/admin/sheet-months", requireOpsRole, async (req, res) => {
    try {
      const months = await storage.getSheetMonths();
      res.json(months);
    } catch (error: unknown) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch sheet months" });
    }
  });

  app.post("/api/admin/sheet-months/upsert", requireOpsRole, async (req, res) => {
    try {
      const { monthYear, sheetUrl } = req.body;
      if (!monthYear) return res.status(400).json({ message: "monthYear is required" });
      const month = await storage.upsertSheetMonth(monthYear, { sheetUrl });
      res.json(month);
    } catch (error: unknown) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to save sheet month" });
    }
  });

  app.post("/api/admin/sheet-months/:id/close", requireOpsRole, async (req, res) => {
    try {
      const month = await storage.getSheetMonth(req.params.id);
      if (!month) return res.status(404).json({ message: "Sheet month not found" });
      if (month.status === "closed") return res.status(400).json({ message: "Month is already closed" });
      const updated = await storage.closeSheetMonth(req.params.id);
      res.json(updated);
    } catch (error: unknown) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to close sheet month" });
    }
  });

  app.post("/api/admin/sheet-months/:id/refresh", requireOpsRole, async (req, res) => {
    try {
      const month = await storage.getSheetMonth(req.params.id);
      if (!month) return res.status(404).json({ message: "Sheet month not found" });
      if (month.status === "closed") return res.status(400).json({ message: "This month is closed. No further parsing is allowed." });
      if (!month.sheetUrl) return res.status(400).json({ message: "No Google Sheet URL saved for this month." });

      let url = month.sheetUrl.trim().replace(/\/+$/, '');
      const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (!sheetMatch) return res.status(400).json({ message: "Invalid Google Sheet URL stored for this month." });
      const sheetId = sheetMatch[1];
      let gid = "0";
      const gidMatch = url.match(/gid=(\d+)/);
      if (gidMatch) gid = gidMatch[1];

      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      const csvResponse = await fetch(csvUrl, { redirect: 'follow' });
      if (!csvResponse.ok) {
        if (csvResponse.status === 401 || csvResponse.status === 403) return res.status(400).json({ message: "Sheet requires sign-in. Change sharing to 'Anyone with the link can view'." });
        return res.status(400).json({ message: "Could not fetch the Google Sheet. Make sure it is shared publicly." });
      }
      const csvText = await csvResponse.text();
      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
        return res.status(400).json({ message: "Could not access the sheet. Make sure it is shared as 'Anyone with the link can view'." });
      }

      const cleanCsvText = csvText.replace(/^\uFEFF/, '');
      const rows = parseCSV(cleanCsvText);
      if (rows.length < 2) return res.status(400).json({ message: "The sheet appears to be empty or has no data rows." });

      const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, '').toLowerCase());
      const woColIdx = headers.findIndex(h => h === 'work order' || h === 'workorder' || h === 'wo' || h === 'wo number');
      const companyColIdx = headers.findIndex(h => h === 'company name' || h === 'company' || h === 'client');
      const staffColIdx = headers.findIndex(h => h === 'staff name' || h === 'staff' || h === 'applicant' || h === 'name' || h === 'employee name' || h === 'employee');
      const workColIdx = headers.findIndex(h => h === 'work' || h === 'service' || h === 'service type' || h === 'type of work');
      const dateColIdx = headers.findIndex(h => h === 'date');
      const designationColIdx = headers.findIndex(h => h === 'designation' || h === 'position' || h === 'job title');

      if (woColIdx === -1) return res.status(400).json({ message: "Could not find a 'Work Order' column. Expected headers: Work Order, Company Name, Staff Name, Work" });

      const serviceTypeList = await storage.getServiceTypes();
      const companies = await storage.getCompanies();

      const normalizeStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const fuzzyMatch = (input: string, candidates: { id: string; name: string }[]): { id: string; name: string; confidence: 'exact' | 'fuzzy' | 'none' } => {
        const normInput = normalizeStr(input);
        if (!normInput) return { id: '', name: '', confidence: 'none' };
        const exact = candidates.find(c => normalizeStr(c.name) === normInput);
        if (exact) return { id: exact.id, name: exact.name, confidence: 'exact' };
        const contains = candidates.find(c => normalizeStr(c.name).includes(normInput) || normInput.includes(normalizeStr(c.name)));
        if (contains) return { id: contains.id, name: contains.name, confidence: 'fuzzy' };
        const inputWords = normInput.split(/\s+/).filter(Boolean);
        let bestMatch: typeof candidates[0] | null = null;
        let bestScore = 0;
        for (const candidate of candidates) {
          const candidateNorm = normalizeStr(candidate.name);
          let score = 0;
          for (const word of inputWords) { if (candidateNorm.includes(word)) score++; }
          const ratio = score / Math.max(inputWords.length, 1);
          if (ratio > bestScore && ratio >= 0.5) { bestScore = ratio; bestMatch = candidate; }
        }
        if (bestMatch) return { id: bestMatch.id, name: bestMatch.name, confidence: 'fuzzy' };
        return { id: '', name: '', confidence: 'none' };
      };

      const existingWos = new Set<string>();
      const allWos = await storage.getWorkOrders();
      for (const wo of allWos) existingWos.add(wo.woNumber.toUpperCase());

      const previewRows: Record<string, unknown>[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const woNumber = (row[woColIdx] || '').trim();
        const companyName = companyColIdx >= 0 ? (row[companyColIdx] || '').trim() : '';
        const staffName = staffColIdx >= 0 ? (row[staffColIdx] || '').trim() : '';
        const workValue = workColIdx >= 0 ? (row[workColIdx] || '').trim() : '';
        const date = dateColIdx >= 0 ? (row[dateColIdx] || '').trim() : '';
        const designation = designationColIdx >= 0 ? (row[designationColIdx] || '').trim() : '';

        if (!woNumber && !staffName) continue;

        const serviceTypeMatch = workValue
          ? fuzzyMatch(workValue, serviceTypeList.filter(s => s.active).map(s => ({ id: s.id, name: s.name })))
          : { id: '', name: '', confidence: 'none' as const };
        const companyMatch = companyName
          ? fuzzyMatch(companyName, companies.map(c => ({ id: c.id, name: c.name })))
          : { id: '', name: '', confidence: 'none' as const };

        let canImport = true;
        let skipReason: string | undefined;

        if (!woNumber) {
          canImport = false; skipReason = 'Missing WO number';
        } else if (existingWos.has(woNumber.toUpperCase())) {
          canImport = false; skipReason = 'Already imported';
        } else if (!workValue) {
          canImport = false; skipReason = 'Empty work column';
        } else if (serviceTypeMatch.confidence === 'none') {
          canImport = false; skipReason = 'Service type not recognized';
        } else if (!staffName) {
          canImport = false; skipReason = 'Missing applicant name';
        } else if (companyMatch.confidence === 'none' && companyName) {
          canImport = false; skipReason = 'Company not found';
        } else if (!companyName) {
          canImport = false; skipReason = 'Missing company name';
        }

        previewRows.push({ rowNum: i + 1, woNumber, companyName, staffName, workValue, date, designation, serviceTypeMatch, companyMatch, canImport, skipReason });
      }

      await storage.touchSheetMonthRefresh(req.params.id);

      res.json({
        totalRows: previewRows.length,
        importableCount: previewRows.filter(r => r.canImport).length,
        skippedCount: previewRows.filter(r => !r.canImport).length,
        headers: rows[0],
        rows: previewRows,
      });
    } catch (error: unknown) {
      console.error("Sheet month refresh error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to refresh sheet" });
    }
  });

  app.post("/api/admin/sheet-months/:id/import", requireOpsRole, async (req, res) => {
    try {
      const month = await storage.getSheetMonth(req.params.id);
      if (!month) return res.status(404).json({ message: "Sheet month not found" });
      if (month.status === "closed") return res.status(400).json({ message: "This month is closed. Importing is not allowed." });

      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: "No rows to import" });

      const companies = await storage.getCompanies();
      const serviceTypeList = await storage.getServiceTypes();
      const companyIds = new Set(companies.map(c => c.id));
      const serviceTypeIds = new Set(serviceTypeList.filter(s => s.active).map(s => s.id));

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const row of rows) {
        try {
          const woNumber = (row.woNumber || '').toString().trim();
          const staffName = (row.staffName || '').toString().trim();
          const companyId = (row.companyMatch?.id || '').toString().trim();
          const serviceTypeId = (row.serviceTypeMatch?.id || '').toString().trim();
          const designation = (row.designation || '').toString().trim();
          const rowNum = row.rowNum || '?';

          if (!woNumber || !staffName || !companyId || !companyIds.has(companyId)) {
            failed++; errors.push(`Row ${rowNum}: Invalid or missing required fields`); continue;
          }
          const existingWo = await storage.getWorkOrderByWoNumber(woNumber);
          if (existingWo) {
            failed++; errors.push(`Row ${rowNum} (${woNumber}): WO already exists`); continue;
          }
          const validServiceTypeId = serviceTypeId && serviceTypeIds.has(serviceTypeId) ? serviceTypeId : undefined;
          const newWo = await storage.createWorkOrder({
            woNumber, applicantName: toProperCase(staffName), companyId,
            serviceTypeId: validServiceTypeId, status: "Draft",
            notes: designation ? `Designation: ${designation}` : undefined,
          });
          await storage.createAuditLog({
            entityType: "work_order", entityId: newWo.id, action: "created",
            details: { source: "gsheet_import", woNumber, sheetMonthId: req.params.id, monthYear: month.monthYear },
          });
          imported++;
        } catch (err: unknown) {
          failed++; errors.push(`Row ${row.rowNum || '?'} (${row.woNumber || '?'}): ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      if (imported > 0) {
        await storage.incrementSheetMonthImportedCount(req.params.id, imported);
      }

      res.json({ imported, failed, errors });
    } catch (error: unknown) {
      console.error("Sheet month import error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to import from sheet" });
    }
  });

  // ========== Admin Approvals ==========
  app.get("/api/admin/approvals", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const approvals = await storage.getPendingVendorApprovals();
      
      const enriched = await Promise.all(approvals.map(async (approval) => {
        const job = await storage.getTypingJobById(approval.typingJobId);
        const wo = job ? await storage.getWorkOrderById(job.woId) : null;
        const vendor = approval.vendorId ? await storage.getVendorById(approval.vendorId) : null;
        const jobType = job?.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
        return {
          ...approval,
          job: job ? { id: job.id, jobCode: job.jobCode, status: job.status } : null,
          workOrder: wo ? { woNumber: wo.woNumber, applicantName: wo.applicantName } : null,
          vendor: vendor ? { id: vendor.id, name: vendor.name } : null,
          jobType: jobType ? { name: jobType.name, category: jobType.category } : null,
        };
      }));
      
      res.json(enriched);
    } catch (error) {
      console.error("Get approvals error:", error);
      res.status(500).json({ message: "Failed to get approvals" });
    }
  });

  const approveSchema = z.object({
    adjustedAmount: z.number().optional(),
  });

  app.post("/api/admin/approvals/:id/approve", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const approvalId = req.params.id;
      const approvalRecord = await storage.getVendorApprovalById(approvalId);
      if (!approvalRecord) {
        return res.status(404).json({ message: "Approval not found" });
      }
      if (approvalRecord.status !== "Pending") {
        return res.status(400).json({ message: "Approval already processed" });
      }
      
      const validation = validateBody(approveSchema, req.body);
      const adjustedAmount = ('data' in validation && validation.data.adjustedAmount !== undefined) 
        ? validation.data.adjustedAmount 
        : undefined;
      
      const finalAmount = adjustedAmount ?? approvalRecord.calculatedAmount;

      // Atomically: update approval + job status + insert wallet debit in one DB transaction.
      // Balance is re-checked inside the transaction to close the TOCTOU window.
      try {
        await storage.approveJobAndDebit(
          approvalId,
          {
            status: "Approved",
            adjustedAmount: adjustedAmount !== undefined ? adjustedAmount : null,
            approvedBy: req.session.userId,
            resolvedAt: new Date(),
          },
          approvalRecord.typingJobId,
          { status: "ReadyForScheduling", sentToClientAt: new Date() },
          finalAmount > 0
            ? {
                vendorId: approvalRecord.vendorId,
                entryType: "Debit",
                typingJobId: approvalRecord.typingJobId,
                amount: -finalAmount,
                note: `Job approved - deduction for ${approvalRecord.typingJobId}`,
                createdBy: req.session.userId || undefined,
              }
            : null
        );
      } catch (txErr: unknown) {
        const msg = txErr instanceof Error ? txErr.message : "Approval failed";
        return res.status(402).json({ message: msg });
      }
      
      await storage.createAuditLog({
        entityType: "vendor_approval", entityId: approvalId,
        action: "approved", userId: req.session.userId,
        details: { finalAmount, typingJobId: approvalRecord.typingJobId },
      });

      await notifyVendorUsers(approvalRecord.vendorId, {
        type: "approval_approved",
        title: "Job Approved",
        message: `Your submission has been approved. AED ${finalAmount} has been deducted.`,
        relatedJobId: approvalRecord.typingJobId,
        isRead: false,
      });
      
      res.json({ message: "Approved successfully" });
    } catch (error) {
      console.error("Approve error:", error);
      res.status(500).json({ message: "Failed to approve" });
    }
  });

  const approvalRejectSchema = z.object({
    reason: z.string().min(1, "Reason required"),
  });

  app.post("/api/admin/approvals/:id/reject", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const approvalId = req.params.id;
      const approvalRecord = await storage.getVendorApprovalById(approvalId);
      if (!approvalRecord) {
        return res.status(404).json({ message: "Approval not found" });
      }
      if (approvalRecord.status !== "Pending") {
        return res.status(400).json({ message: "Approval already processed" });
      }
      
      const validation = validateBody(approvalRejectSchema, req.body);
      if ('error' in validation) {
        return res.status(400).json({ message: validation.error });
      }
      const { reason } = validation.data;
      
      await storage.updateVendorApproval(approvalId, {
        status: "Rejected",
        rejectedReason: reason,
        resolvedAt: new Date(),
      });
      
      await storage.updateTypingJob(approvalRecord.typingJobId, {
        status: "InProcess",
        returnedAt: null,
      });
      
      await storage.createTypingJobComment({
        typingJobId: approvalRecord.typingJobId,
        authorType: "Internal",
        message: `Submission rejected: ${reason}`,
      });
      
      await storage.createAuditLog({
        entityType: "vendor_approval", entityId: approvalId,
        action: "rejected", userId: req.session.userId,
        details: { reason, typingJobId: approvalRecord.typingJobId },
      });

      await notifyVendorUsers(approvalRecord.vendorId, {
        type: "approval_rejected",
        title: "Submission Rejected",
        message: `Your submission was rejected: ${reason}`,
        relatedJobId: approvalRecord.typingJobId,
        isRead: false,
      });
      
      res.json({ message: "Rejected successfully" });
    } catch (error) {
      console.error("Reject error:", error);
      res.status(500).json({ message: "Failed to reject" });
    }
  });

  // GET /api/admin/idle-draft-jobs — typing jobs in Draft for > 24 hours
  app.get("/api/admin/idle-draft-jobs", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const allDraftJobs = await storage.getTypingJobs("Draft");
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const idleJobs = allDraftJobs.filter(j => j.createdAt && new Date(j.createdAt) < cutoff);

      const enriched = await Promise.all(idleJobs.map(async (job) => {
        const wo = await storage.getWorkOrderById(job.woId);
        const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
        const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
        return {
          ...job,
          woNumber: wo?.woNumber || null,
          applicantName: wo?.applicantName || null,
          companyName: company?.name || null,
          jobTypeName: jobType?.name || null,
          jobTypeCategory: jobType?.category || null,
          hoursIdle: job.createdAt ? Math.floor((Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60)) : null,
        };
      }));

      enriched.sort((a, b) => (a.hoursIdle || 0) > (b.hoursIdle || 0) ? -1 : 1);
      res.json(enriched);
    } catch (error) {
      console.error("Idle draft jobs error:", error);
      res.status(500).json({ message: "Failed to fetch idle draft jobs" });
    }
  });

  // ========== Deletion Requests ==========

  const deletionRequestSchema = z.object({
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    entityLabel: z.string().min(1),
    reason: z.string().min(1, "Please provide a reason for the deletion request"),
  });

  const deletionReviewSchema = z.object({
    reviewNote: z.string().optional(),
  });

  // CRM submits a deletion request
  app.post("/api/deletion-requests", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const validation = validateBody(deletionRequestSchema, req.body);
      if ('error' in validation) return res.status(400).json({ message: validation.error });
      const { entityType, entityId, entityLabel, reason } = validation.data;

      const request = await storage.createDeletionRequest({
        entityType,
        entityId,
        entityLabel,
        requestedBy: user.id,
        requestedByName: user.name,
        reason,
        status: "pending",
      });

      await storage.createAuditLog({
        entityType,
        entityId,
        action: "deletion_requested",
        userId: user.id,
        details: { reason, entityLabel },
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Deletion request create error:", error);
      res.status(500).json({ message: "Failed to create deletion request" });
    }
  });

  // List deletion requests (Admin sees all, CRM sees their own)
  app.get("/api/deletion-requests", requireAuth, requireOpsRole, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const status = req.query.status as string | undefined;
      let requests: DeletionRequest[];

      if (user.role === "Admin") {
        requests = await storage.getDeletionRequests(status);
      } else {
        const all = await storage.getDeletionRequestsByUser(user.id);
        requests = status ? all.filter(r => r.status === status) : all;
      }

      res.json(requests);
    } catch (error) {
      console.error("Deletion requests list error:", error);
      res.status(500).json({ message: "Failed to fetch deletion requests" });
    }
  });

  // Get pending deletion request count (for badge)
  app.get("/api/deletion-requests/pending-count", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const count = await storage.getPendingDeletionRequestCount();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to get count" });
    }
  });

  // Admin approves a deletion request — marks approved AND performs the actual deletion
  app.patch("/api/deletion-requests/:id/approve", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const request = await storage.getDeletionRequestById(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.status !== "pending") return res.status(400).json({ message: "Request already reviewed" });

      const validation = validateBody(deletionReviewSchema, req.body);
      const reviewNote = ('data' in validation) ? validation.data.reviewNote : undefined;

      // Perform the actual deletion based on entity type
      let deleteError: string | null = null;
      try {
        if (request.entityType === "document") {
          await storage.deleteWoDocument(request.entityId);
        } else if (request.entityType === "work_order") {
          await storage.deleteWorkOrder(request.entityId);
        } else if (request.entityType === "wo_note") {
          await storage.deleteWoNote(request.entityId);
        } else if (request.entityType === "company_email") {
          await storage.deleteCompanyEmail(request.entityId);
        }
      } catch (delErr: unknown) {
        // Entity may already be gone; log but don't fail
        deleteError = delErr instanceof Error ? delErr.message : "Entity may already be deleted";
        console.warn("Deletion request entity delete warning:", deleteError);
      }

      const updated = await storage.updateDeletionRequest(req.params.id, {
        status: "approved",
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      });

      await storage.createAuditLog({
        entityType: request.entityType,
        entityId: request.entityId,
        action: "deletion_request_approved",
        userId: user.id,
        details: { requestedBy: request.requestedByName, entityLabel: request.entityLabel, deleteError },
      });

      res.json(updated);
    } catch (error) {
      console.error("Deletion request approve error:", error);
      res.status(500).json({ message: "Failed to approve deletion request" });
    }
  });

  // ==============================
  // Attestation Custody Routes
  // ==============================

  // requireAttestationVendor middleware — checks session.attestationVendorUserId
  async function requireAttestationVendor(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.attestationVendorUserId) {
      return res.status(401).json({ message: "Attestation vendor authentication required" });
    }
    try {
      const user = await storage.getUser(req.session.attestationVendorUserId);
      if (!user || !user.vendorId) {
        return res.status(401).json({ message: "Attestation vendor authentication required" });
      }
      req.attestationVendorUserId = user.id;
      req.attestationVendorId = user.vendorId;
      next();
    } catch (err) {
      return res.status(500).json({ message: "Authentication error" });
    }
  }

  const custodyLogUploadSchema = z.object({
    handoverDirection: z.enum(["ClientToUs", "UsToVendor", "VendorToUs", "UsToClient"]),
    counterpartyName: z.string().min(1),
    counterpartyContact: z.string().min(1),
    approverName: z.string().optional().nullable(),
    approverContact: z.string().optional().nullable(),
    approverDesignation: z.string().optional().nullable(),
    receivingStaffName: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });

  // GET /api/attestation/sr — list attestation SRs (Admin, CRM, PRO filtered)
  app.get("/api/attestation/sr", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const allowedRoles = ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      let srs = await storage.getAttestationSrs();

      if (user.role === "PRO" || user.role === "PRO - Temporary") {
        if (user.staffId) {
          srs = srs.filter(sr => sr.assignedProId === user.staffId);
        } else {
          srs = [];
        }
      }

      res.json(srs);
    } catch (error) {
      console.error("Get attestation SRs error:", error);
      res.status(500).json({ message: "Failed to get attestation service requests" });
    }
  });

  // GET /api/attestation/sr/:id — get single SR
  app.get("/api/attestation/sr/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const sr = await storage.getAttestationSrById(req.params.id);
      if (!sr) return res.status(404).json({ message: "SR not found" });

      const allowedRoles = ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if ((user.role === "PRO" || user.role === "PRO - Temporary") && user.staffId) {
        if (sr.assignedProId !== user.staffId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(sr);
    } catch (error) {
      console.error("Get attestation SR error:", error);
      res.status(500).json({ message: "Failed to get attestation service request" });
    }
  });

  // POST /api/attestation/sr — create SR (Admin, CRM)
  app.post("/api/attestation/sr", requireAuth, requireRole("Admin", "Client Relationship Manager"), async (req, res) => {
    try {
      const srNumber = await storage.getNextSrNumber();
      const sr = await storage.createAttestationSr({
        ...req.body,
        srNumber,
        createdBy: req.session.userId,
      });
      res.status(201).json(sr);
    } catch (error) {
      console.error("Create attestation SR error:", error);
      res.status(500).json({ message: "Failed to create attestation service request" });
    }
  });

  // PATCH /api/attestation/sr/:id — update SR (Admin, CRM)
  app.patch("/api/attestation/sr/:id", requireAuth, requireRole("Admin", "Client Relationship Manager"), async (req, res) => {
    try {
      const sr = await storage.updateAttestationSr(req.params.id, req.body);
      if (!sr) return res.status(404).json({ message: "SR not found" });
      res.json(sr);
    } catch (error) {
      console.error("Update attestation SR error:", error);
      res.status(500).json({ message: "Failed to update attestation service request" });
    }
  });

  // GET /api/attestation/sr/:id/custody — get custody chain for an SR
  app.get("/api/attestation/sr/:id/custody", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const allowedRoles = ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const sr = await storage.getAttestationSrById(req.params.id);
      if (!sr) return res.status(404).json({ message: "SR not found" });

      if ((user.role === "PRO" || user.role === "PRO - Temporary") && user.staffId) {
        if (sr.assignedProId !== user.staffId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const logs = await storage.getCustodyLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Get custody logs error:", error);
      res.status(500).json({ message: "Failed to get custody logs" });
    }
  });

  // POST /api/attestation/sr/:id/custody — record a custody handover (PRO via staff auth)
  app.post(
    "/api/attestation/sr/:id/custody",
    upload.fields([
      { name: "counterpartyIdPhoto", maxCount: 1 },
      { name: "counterpartySignature", maxCount: 1 },
      { name: "receivingStaffSignature", maxCount: 1 },
    ]),
    requireAuth,
    async (req, res) => {
      try {
        const user = await storage.getUser(req.session.userId);
        if (!user) return res.status(401).json({ message: "Not authenticated" });

        const allowedRoles = ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"];
        if (!allowedRoles.includes(user.role)) {
          return res.status(403).json({ message: "Access denied" });
        }

        const sr = await storage.getAttestationSrById(req.params.id);
        if (!sr) return res.status(404).json({ message: "SR not found" });

        const validation = validateBody(custodyLogUploadSchema, req.body);
        if ("error" in validation) return res.status(400).json({ message: validation.error });
        const data = validation.data;

        const files = req.files as Record<string, Express.Multer.File[]>;
        const objectStorageService = new ObjectStorageService();

        // Upload counterparty ID photo if provided
        let counterpartyIdPhotoUrl: string | null = null;
        const externalDirections = ["ClientToUs", "UsToVendor", "VendorToUs", "UsToClient"];
        if (files?.counterpartyIdPhoto?.[0]) {
          const file = files.counterpartyIdPhoto[0];
          const ext = file.originalname.split(".").pop() || "jpg";
          const objectPath = `attestation/custody/${sr.id}/${Date.now()}_cp_id.${ext}`;
          counterpartyIdPhotoUrl = await objectStorageService.uploadObjectEntityFile(objectPath, file.buffer, file.mimetype);
        } else if (externalDirections.includes(data.handoverDirection)) {
          return res.status(400).json({ message: "ID photo is required for external counterparty handovers" });
        }

        // Upload counterparty signature (required)
        if (!files?.counterpartySignature?.[0]) {
          return res.status(400).json({ message: "Counterparty signature is required" });
        }
        const cpSigFile = files.counterpartySignature[0];
        const cpSigExt = cpSigFile.originalname.split(".").pop() || "png";
        const cpSigPath = `attestation/custody/${sr.id}/${Date.now()}_cp_sig.${cpSigExt}`;
        const counterpartySignatureUrl = await objectStorageService.uploadObjectEntityFile(cpSigPath, cpSigFile.buffer, cpSigFile.mimetype);

        // For VendorToUs: upload receiving staff signature (required)
        let receivingStaffSignatureUrl: string | null = null;
        if (data.handoverDirection === "VendorToUs") {
          if (!data.receivingStaffName) {
            return res.status(400).json({ message: "Receiving staff name is required for VendorToUs handover" });
          }
          if (!files?.receivingStaffSignature?.[0]) {
            return res.status(400).json({ message: "Receiving staff signature is required for VendorToUs handover" });
          }
          const staffSigFile = files.receivingStaffSignature[0];
          const staffSigExt = staffSigFile.originalname.split(".").pop() || "png";
          const staffSigPath = `attestation/custody/${sr.id}/${Date.now()}_staff_sig.${staffSigExt}`;
          receivingStaffSignatureUrl = await objectStorageService.uploadObjectEntityFile(staffSigPath, staffSigFile.buffer, staffSigFile.mimetype);
        }

        // Approver fields: if approverName set, contact and designation required
        if (data.approverName && !data.approverContact) {
          return res.status(400).json({ message: "Approver contact is required when approver is specified" });
        }

        // Determine new custody status and custodian from direction
        const custodyMap: Record<string, { physicalCustodyStatus: "WithClient" | "WithUs" | "WithVendor" | "ReturnedToClient"; currentCustodian: string | null }> = {
          ClientToUs: { physicalCustodyStatus: "WithUs", currentCustodian: "Keystone Team" },
          UsToVendor: { physicalCustodyStatus: "WithVendor", currentCustodian: data.counterpartyName },
          VendorToUs: { physicalCustodyStatus: "WithUs", currentCustodian: data.receivingStaffName || "Keystone Team" },
          UsToClient: { physicalCustodyStatus: "ReturnedToClient", currentCustodian: data.counterpartyName },
        };
        const custodyUpdate = custodyMap[data.handoverDirection];

        const logData: InsertDocumentCustodyLog = {
          srId: req.params.id,
          handoverDirection: data.handoverDirection,
          counterpartyName: data.counterpartyName,
          counterpartyContact: data.counterpartyContact,
          counterpartyIdPhotoUrl,
          counterpartySignatureUrl,
          approverName: data.approverName || null,
          approverContact: data.approverContact || null,
          approverDesignation: data.approverDesignation || null,
          receivingStaffName: data.receivingStaffName || null,
          receivingStaffSignatureUrl,
          recordedBy: user.id,
          notes: data.notes || null,
        };

        const srUpdate: Partial<AttestationSr> = {
          physicalCustodyStatus: custodyUpdate.physicalCustodyStatus,
          currentCustodian: custodyUpdate.currentCustodian,
          currentResponsibleStaffId: user.staffId || null,
        };

        const { log, sr: updatedSr } = await storage.createCustodyLogWithSrUpdate(logData, srUpdate);

        await storage.createAuditLog({
          action: "custody_handover_recorded",
          entityType: "attestation_sr",
          entityId: req.params.id,
          userId: user.id,
          details: { direction: data.handoverDirection, counterpartyName: data.counterpartyName, srNumber: sr.srNumber },
        });

        res.status(201).json({ log, sr: updatedSr });
      } catch (error) {
        console.error("Create custody log error:", error);
        res.status(500).json({ message: "Failed to record custody handover" });
      }
    }
  );

  // Attestation vendor portal — GET /api/attestation-vendor/auth/me
  app.get("/api/attestation-vendor/auth/me", async (req, res) => {
    try {
      if (!req.session?.attestationVendorUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.attestationVendorUserId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!user.vendorId) return res.status(401).json({ message: "Not authenticated" });
      const vendor = await storage.getVendorById(user.vendorId);
      if (!vendor || vendor.vendorType !== "Attestation") {
        return res.status(403).json({ message: "Access restricted to attestation vendors" });
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorId: user.vendorId,
        vendorName: vendor.name,
        vendorType: vendor.vendorType,
      });
    } catch (error) {
      console.error("Attestation vendor me error:", error);
      res.status(500).json({ message: "Error" });
    }
  });

  // Attestation vendor portal — POST /api/attestation-vendor/auth/login
  app.post("/api/attestation-vendor/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password required" });

      const user = await storage.getUserByEmail(username);
      if (!user || user.role !== "Vendor") {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });

      req.session.attestationVendorUserId = user.id;
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role, vendorId: user.vendorId });
    } catch (error) {
      console.error("Attestation vendor login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Attestation vendor portal — POST /api/attestation-vendor/auth/logout
  app.post("/api/attestation-vendor/auth/logout", (req, res) => {
    delete req.session.attestationVendorUserId;
    res.json({ message: "Logged out" });
  });

  // Attestation vendor portal — GET /api/attestation-vendor/jobs (SRs assigned to vendor)
  app.get("/api/attestation-vendor/jobs", requireAttestationVendor, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.attestationVendorUserId);
      if (!user || !user.vendorId) return res.status(401).json({ message: "Not authenticated" });
      const srs = await storage.getAttestationSrs({ vendorId: user.vendorId });
      res.json(srs);
    } catch (error) {
      console.error("Attestation vendor jobs error:", error);
      res.status(500).json({ message: "Failed to get jobs" });
    }
  });

  // Attestation vendor portal — GET /api/attestation-vendor/jobs/:id/custody
  app.get("/api/attestation-vendor/jobs/:id/custody", requireAttestationVendor, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.attestationVendorUserId);
      if (!user || !user.vendorId) return res.status(401).json({ message: "Not authenticated" });

      const sr = await storage.getAttestationSrById(req.params.id);
      if (!sr) return res.status(404).json({ message: "SR not found" });
      if (sr.vendorId !== user.vendorId) return res.status(403).json({ message: "Access denied" });

      const logs = await storage.getCustodyLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Attestation vendor custody logs error:", error);
      res.status(500).json({ message: "Failed to get custody logs" });
    }
  });

  // Attestation vendor portal — POST /api/attestation-vendor/jobs/:id/accept
  app.post("/api/attestation-vendor/jobs/:id/accept", requireAttestationVendor, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.attestationVendorUserId);
      if (!user || !user.vendorId) return res.status(401).json({ message: "Not authenticated" });

      const sr = await storage.getAttestationSrById(req.params.id);
      if (!sr) return res.status(404).json({ message: "SR not found" });
      if (sr.vendorId !== user.vendorId) return res.status(403).json({ message: "Access denied" });
      if (sr.status !== "SentToVendor") return res.status(400).json({ message: "SR is not in SentToVendor status" });

      const updated = await storage.updateAttestationSr(req.params.id, { status: "AcceptedByVendor" });
      res.json(updated);
    } catch (error) {
      console.error("Accept attestation SR error:", error);
      res.status(500).json({ message: "Failed to accept SR" });
    }
  });

  // Attestation vendor portal — POST /api/attestation-vendor/jobs/:id/custody (vendor collecting docs)
  app.post(
    "/api/attestation-vendor/jobs/:id/custody",
    upload.fields([
      { name: "counterpartyIdPhoto", maxCount: 1 },
      { name: "counterpartySignature", maxCount: 1 },
      { name: "receivingStaffSignature", maxCount: 1 },
    ]),
    requireAttestationVendor,
    async (req, res) => {
      try {
        const user = await storage.getUser(req.session.attestationVendorUserId);
        if (!user || !user.vendorId) return res.status(401).json({ message: "Not authenticated" });

        const sr = await storage.getAttestationSrById(req.params.id);
        if (!sr) return res.status(404).json({ message: "SR not found" });
        if (sr.vendorId !== user.vendorId) return res.status(403).json({ message: "Access denied" });

        const validation = validateBody(custodyLogUploadSchema, req.body);
        if ("error" in validation) return res.status(400).json({ message: validation.error });
        const data = validation.data;

        const files = req.files as Record<string, Express.Multer.File[]>;
        const objectStorageService = new ObjectStorageService();

        let counterpartyIdPhotoUrl: string | null = null;
        if (files?.counterpartyIdPhoto?.[0]) {
          const file = files.counterpartyIdPhoto[0];
          const ext = file.originalname.split(".").pop() || "jpg";
          const objectPath = `attestation/custody/${sr.id}/${Date.now()}_cp_id.${ext}`;
          counterpartyIdPhotoUrl = await objectStorageService.uploadObjectEntityFile(objectPath, file.buffer, file.mimetype);
        }

        if (!files?.counterpartySignature?.[0]) {
          return res.status(400).json({ message: "Counterparty signature is required" });
        }
        const cpSigFile = files.counterpartySignature[0];
        const cpSigPath = `attestation/custody/${sr.id}/${Date.now()}_cp_sig.png`;
        const counterpartySignatureUrl = await objectStorageService.uploadObjectEntityFile(cpSigPath, cpSigFile.buffer, cpSigFile.mimetype);

        const custodyMap: Record<string, { physicalCustodyStatus: "WithClient" | "WithUs" | "WithVendor" | "ReturnedToClient"; currentCustodian: string | null }> = {
          ClientToUs: { physicalCustodyStatus: "WithUs", currentCustodian: "Keystone Team" },
          UsToVendor: { physicalCustodyStatus: "WithVendor", currentCustodian: data.counterpartyName },
          VendorToUs: { physicalCustodyStatus: "WithUs", currentCustodian: data.receivingStaffName || "Keystone Team" },
          UsToClient: { physicalCustodyStatus: "ReturnedToClient", currentCustodian: data.counterpartyName },
        };
        const custodyUpdate = custodyMap[data.handoverDirection];

        const logData: InsertDocumentCustodyLog = {
          srId: req.params.id,
          handoverDirection: data.handoverDirection,
          counterpartyName: data.counterpartyName,
          counterpartyContact: data.counterpartyContact,
          counterpartyIdPhotoUrl,
          counterpartySignatureUrl,
          approverName: data.approverName || null,
          approverContact: data.approverContact || null,
          approverDesignation: data.approverDesignation || null,
          receivingStaffName: data.receivingStaffName || null,
          receivingStaffSignatureUrl: null,
          recordedBy: user.id,
          notes: data.notes || null,
        };

        const srUpdateData: Partial<AttestationSr> = {
          physicalCustodyStatus: custodyUpdate.physicalCustodyStatus,
          currentCustodian: custodyUpdate.currentCustodian,
        };

        if (data.handoverDirection === "UsToVendor") {
          srUpdateData.status = "InProgress";
        }

        const { log, sr: updatedSr } = await storage.createCustodyLogWithSrUpdate(logData, srUpdateData);
        res.status(201).json({ log, sr: updatedSr });
      } catch (error) {
        console.error("Attestation vendor custody error:", error);
        res.status(500).json({ message: "Failed to record custody handover" });
      }
    }
  );

  // Attestation vendor portal — POST /api/attestation-vendor/jobs/:id/start
  app.post("/api/attestation-vendor/jobs/:id/start", requireAttestationVendor, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.attestationVendorUserId);
      if (!user || !user.vendorId) return res.status(401).json({ message: "Not authenticated" });

      const sr = await storage.getAttestationSrById(req.params.id);
      if (!sr) return res.status(404).json({ message: "SR not found" });
      if (sr.vendorId !== user.vendorId) return res.status(403).json({ message: "Access denied" });
      if (sr.status !== "AcceptedByVendor") {
        return res.status(400).json({ message: "SR is not in AcceptedByVendor status" });
      }

      const updated = await storage.updateAttestationSr(req.params.id, { status: "InProgress" });
      res.json(updated);
    } catch (error) {
      console.error("Start attestation SR error:", error);
      res.status(500).json({ message: "Failed to start SR" });
    }
  });

  // Attestation vendor portal — POST /api/attestation-vendor/jobs/:id/complete
  app.post("/api/attestation-vendor/jobs/:id/complete", requireAttestationVendor, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.attestationVendorUserId);
      if (!user || !user.vendorId) return res.status(401).json({ message: "Not authenticated" });

      const sr = await storage.getAttestationSrById(req.params.id);
      if (!sr) return res.status(404).json({ message: "SR not found" });
      if (sr.vendorId !== user.vendorId) return res.status(403).json({ message: "Access denied" });
      if (sr.status !== "InProgress" && sr.status !== "AcceptedByVendor") {
        return res.status(400).json({ message: "SR is not in a valid status to complete" });
      }

      const updated = await storage.updateAttestationSr(req.params.id, { status: "Completed" });

      if (sr.externalWoNumber) {
        const wo = await storage.getWorkOrderByWoNumber(sr.externalWoNumber);
        if (wo) {
          await checkAndAutoCompleteWorkOrder(wo.id);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Complete attestation SR error:", error);
      res.status(500).json({ message: "Failed to complete SR" });
    }
  });

  // Attestation vendor portal — GET /api/attestation-vendor/dashboard
  app.get("/api/attestation-vendor/dashboard", requireAttestationVendor, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.attestationVendorUserId);
      if (!user || !user.vendorId) return res.status(401).json({ message: "Not authenticated" });

      const [inquiries, srs] = await Promise.all([
        storage.getAttestationInquiries({ vendorId: user.vendorId }),
        storage.getAttestationSrs({ vendorId: user.vendorId }),
      ]);

      const openInquiries = inquiries.filter(i => i.status === "Open").length;
      const pendingQuote = inquiries.filter(i => i.status === "Open" || i.status === "QuoteReceived").length;
      const pendingAcceptance = srs.filter(s => s.status === "SentToVendor").length;
      const activeJobs = srs.filter(s => s.status === "AcceptedByVendor" || s.status === "InProgress").length;
      const completedJobs = srs.filter(s => s.status === "Completed").length;

      const recentActivity = [
        ...inquiries.slice(0, 5).map(i => ({
          id: i.id,
          type: "inquiry" as const,
          title: `Inquiry: ${i.documentType}`,
          description: `${i.documentClass} document — ${i.status}`,
          timestamp: i.createdAt,
        })),
        ...srs.slice(0, 5).map(s => ({
          id: s.id,
          type: "job" as const,
          title: `Job: ${s.documentType}`,
          description: `WO ${s.externalWoNumber} — ${s.status}`,
          timestamp: s.createdAt,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8);

      res.json({
        stats: { openInquiries, pendingQuote, pendingAcceptance, activeJobs, completedJobs },
        recentActivity,
      });
    } catch (error) {
      console.error("Attestation vendor dashboard error:", error);
      res.status(500).json({ message: "Failed to get dashboard" });
    }
  });

  // Admin denies a deletion request
  app.patch("/api/deletion-requests/:id/deny", requireAuth, requireRole("Admin"), async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const request = await storage.getDeletionRequestById(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.status !== "pending") return res.status(400).json({ message: "Request already reviewed" });

      const validation = validateBody(deletionReviewSchema, req.body);
      const reviewNote = ('data' in validation) ? validation.data.reviewNote : undefined;

      const updated = await storage.updateDeletionRequest(req.params.id, {
        status: "denied",
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      });

      await storage.createAuditLog({
        entityType: request.entityType,
        entityId: request.entityId,
        action: "deletion_request_denied",
        userId: user.id,
        details: { requestedBy: request.requestedByName, entityLabel: request.entityLabel },
      });

      res.json(updated);
    } catch (error) {
      console.error("Deletion request deny error:", error);
      res.status(500).json({ message: "Failed to deny deletion request" });
    }
  });

}
