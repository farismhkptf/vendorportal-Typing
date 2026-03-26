import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertTypingJobSchema, insertTypingJobCommentSchema, insertFileSchema, ROLE_CATEGORIES } from "@shared/schema";
import { requireAuth, requireOpsRole } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { executeTransition, validateTransition, type TypingJobStatus } from "../typing-job-machine";
import { checkAndAutoTransitionWorkOrder } from "../services/transition-service";
import type { RouteDeps } from "./types";

export function registerTypingJobRoutes(app: Express, deps: RouteDeps): void {
  const { notifyVendorUsers, notifyStaffByRoles, notifySingleUser } = deps;

// ========== Typing Jobs ==========
app.post("/api/typing-jobs", requireOpsRole, async (req, res) => {
  try {
    const validation = validateBody(insertTypingJobSchema.omit({ jobCode: true }), req.body);
    if ("error" in validation) {
      return res.status(400).json({ message: validation.error });
    }
    
    // Get job type to determine category for job code generation
    const jobType = await storage.getJobTypeById(validation.data.jobTypeId);
    const category = jobType?.category || "Medical";
    
    // Check for existing active job of same type for this work order
    const existingJobs = await storage.getTypingJobsByWoId(validation.data.woId);
    const activeJobOfSameType = existingJobs.find(
      j => j.jobTypeId === validation.data.jobTypeId && j.status !== "Aborted"
    );
    if (activeJobOfSameType) {
      return res.status(409).json({ 
        message: `A ${category} typing job already exists for this work order (${activeJobOfSameType.jobCode}). Only one per type is allowed.` 
      });
    }
    
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

app.get("/api/typing-jobs", requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const jobs = await storage.getTypingJobs(status as string | undefined);

    if (jobs.length === 0) {
      return res.json([]);
    }

    const woIds = Array.from(new Set(jobs.map(j => j.woId)));
    const [allWorkOrders, allJobTypes] = await Promise.all([
      storage.getWorkOrdersByIds(woIds),
      storage.getJobTypes(),
    ]);

    const woMap = new Map(allWorkOrders.map(wo => [wo.id, wo]));
    const jobTypeMap = new Map(allJobTypes.map(jt => [jt.id, jt]));

    const result = jobs.map(job => ({
      ...job,
      workOrder: woMap.get(job.woId),
      jobType: job.jobTypeId ? jobTypeMap.get(job.jobTypeId) || null : null,
    }));

    res.json(result);
  } catch (error) {
    console.error("Typing jobs error:", error);
    res.status(500).json({ message: "Failed to fetch typing jobs" });
  }
});

app.post("/api/typing-jobs/bulk-assign-vendor", requireOpsRole, async (req, res) => {
  try {
    const bulkAssignSchema = z.object({
      ids: z.array(z.string()).min(1),
      vendorId: z.string(),
    });
    const validation = validateBody(bulkAssignSchema, req.body);
    if ("error" in validation) {
      return res.status(400).json({ message: validation.error });
    }
    const { ids, vendorId } = validation.data;

    const vendor = await storage.getVendorById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const job = await storage.getTypingJobById(id);
        if (!job) {
          failed++;
          errors.push(`Typing job ${id} not found`);
          continue;
        }

        const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
        const cost = jobType?.cost || 0;

        const result = await executeTransition({
          action: "submit_to_vendor",
          jobId: id,
          actor: "team",
          actorId: req.session?.userId,
          storage,
          notifyVendorUsers,
        notifyStaffByRoles,
        notifySingleUser,
          updateFields: { vendorId, costSnapshot: cost },
        });

        if (!result.success) {
          failed++;
          errors.push(`Job ${id}: ${result.error}`);
          continue;
        }

        updated++;
      } catch (err: unknown) {
        failed++;
        errors.push(`Failed to assign job ${id}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    res.json({ updated, failed, errors });
  } catch (error) {
    console.error("Bulk assign vendor error:", error);
    res.status(500).json({ message: "Failed to bulk assign vendor" });
  }
});

app.get("/api/typing-jobs/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const job = await storage.getTypingJobById(id);
    
    if (!job) {
      return res.status(404).json({ message: "Typing job not found" });
    }
    
    const wo = await storage.getWorkOrderById(job.woId);
    const company = wo?.companyId ? await storage.getCompanyById(wo.companyId) : null;
    const serviceType = wo?.serviceTypeId ? await storage.getServiceTypeById(wo.serviceTypeId) : null;
    const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
    const vendor = job.vendorId ? await storage.getVendorById(job.vendorId) : null;
    const result = await storage.getTypingJobResult(id);
    const comments = await storage.getTypingJobComments(id);
    const jobFiles = await storage.getFilesByRelated("TypingJob", id);
    const approval = await storage.getVendorApprovalByJobId(id);
    
    res.json({ 
      ...job, 
      workOrder: wo ? { ...wo, company, serviceType } : null, 
      jobType, 
      vendor,
      result,
      comments,
      files: jobFiles,
      approval,
    });
  } catch (error) {
    console.error("Typing job detail error:", error);
    res.status(500).json({ message: "Failed to fetch typing job" });
  }
});

app.post("/api/typing-jobs/:id/reassign", requireOpsRole, async (req, res) => {
  try {
    const { vendorId } = req.body;
    if (!vendorId) {
      return res.status(400).json({ message: "Vendor ID is required" });
    }
    
    const result = await executeTransition({
      action: "reassign",
      jobId: req.params.id,
      actor: "team",
      actorId: req.session?.userId,
      storage,
      notifyVendorUsers,
        notifyStaffByRoles,
        notifySingleUser,
      updateFields: { vendorId },
    });
    if (!result.success) return res.status(400).json({ message: result.error });
    res.json(result.job);
  } catch (error) {
    console.error("Reassign error:", error);
    res.status(500).json({ message: "Failed to reassign job" });
  }
});

app.patch("/api/typing-jobs/:id/assign-staff", requireOpsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToUserId } = req.body;
    const job = await storage.getTypingJobById(id);
    if (!job) return res.status(404).json({ message: "Typing job not found" });

    if (assignedToUserId) {
      const assignee = await storage.getUser(assignedToUserId);
      if (!assignee) return res.status(400).json({ message: "User not found" });
      if (!assignee.active) return res.status(400).json({ message: "Cannot assign to an inactive user" });
      const staffRoles = ROLE_CATEGORIES["Our Team"] as readonly string[];
      if (!staffRoles.includes(assignee.role)) {
        return res.status(400).json({ message: "User is not a staff member" });
      }
    }

    const updated = await storage.updateTypingJob(id, { assignedToUserId: assignedToUserId || null });
    if (!updated) return res.status(404).json({ message: "Typing job not found" });

    await storage.createAuditLog({
      entityType: "typing_job",
      entityId: id,
      action: "assigned_to_staff",
      userId: req.session?.userId,
      details: { assignedToUserId: assignedToUserId || null },
    });

    if (assignedToUserId) {
      await storage.createStaffNotification({
        userId: assignedToUserId,
        type: "typing_job_assigned",
        title: "Typing Job Assigned",
        message: `Job ${job.jobCode || id} has been assigned to you.`,
        relatedEntityType: "typing_job",
        relatedEntityId: id,
      });
    }

    res.json(updated);
  } catch (error) {
    console.error("Assign staff error:", error);
    res.status(500).json({ message: "Failed to assign staff member" });
  }
});

app.put("/api/typing-jobs/:id", requireAuth, async (req, res) => {
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
      if (job.woId) {
        await checkAndAutoTransitionWorkOrder(job.woId);
      }
    }
    
    res.json(job);
  } catch (error) {
    console.error("Typing job update error:", error);
    res.status(500).json({ message: "Failed to update typing job" });
  }
});

// Typing Job Comments
app.post("/api/typing-jobs/:id/comments", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const validation = validateBody(insertTypingJobCommentSchema.omit({ typingJobId: true }), req.body);
    if ("error" in validation) return res.status(400).json({ message: validation.error });
    const comment = await storage.createTypingJobComment({
      typingJobId: id,
      ...validation.data
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

    if ((req.body.authorType || "Internal") === "Internal") {
      const relatedJob = await storage.getTypingJobById(id);
      if (relatedJob?.vendorId) {
        await notifyVendorUsers(relatedJob.vendorId, {
          type: "new_comment",
          title: "New Comment",
          message: `New message on job ${relatedJob.jobCode || ''}`,
          relatedJobId: id,
          isRead: false,
        });
      }
    }
    
    res.status(201).json(comment);
  } catch (error) {
    console.error("Typing job comment error:", error);
    res.status(500).json({ message: "Failed to create comment" });
  }
});

// Submit typing job to vendor
app.post("/api/typing-jobs/:id/submit-to-vendor", requireOpsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body;
    
    if (!vendorId) {
      return res.status(400).json({ message: "Vendor ID is required" });
    }
    
    const vendor = await storage.getVendorById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const job = await storage.getTypingJobById(id);
    if (!job) {
      return res.status(404).json({ message: "Typing job not found" });
    }

    // Validate the transition is permitted before running any side-effect checks
    const transitionCheck = validateTransition("submit_to_vendor", job.status as TypingJobStatus, "team");
    if (!transitionCheck.valid) {
      return res.status(400).json({ message: transitionCheck.error });
    }

    // Document completeness gate
    if (job.woId) {
      const wo = await storage.getWorkOrderById(job.woId);
      if (wo?.serviceTypeId) {
        const serviceType = await storage.getServiceTypeById(wo.serviceTypeId);
        if (serviceType?.category) {
          const requirements = await storage.getDocumentRequirementsByCategory(serviceType.category);
          const requiredDocTypes = requirements
            .filter(r => r.isRequired)
            .map(r => r.documentType);

          if (requiredDocTypes.length > 0) {
            const uploadedDocs = await storage.getWoDocuments(job.woId);
            const uploadedTypes = new Set(
              uploadedDocs
                .filter(d => d.status === "Uploaded" || d.status === "Verified")
                .map(d => d.documentType)
            );

            const missingTypes = requiredDocTypes.filter(t => !uploadedTypes.has(t));
            if (missingTypes.length > 0) {
              return res.status(422).json({
                message: "Required documents are missing for this work order",
                missingDocumentTypes: missingTypes,
              });
            }
          }
        }
      }
    }

    const jobType = job.jobTypeId ? await storage.getJobTypeById(job.jobTypeId) : null;
    const cost = jobType?.cost || 0;
    
    const result = await executeTransition({
      action: "submit_to_vendor",
      jobId: id,
      actor: "team",
      actorId: req.session?.userId,
      storage,
      notifyVendorUsers,
        notifyStaffByRoles,
        notifySingleUser,
      updateFields: { vendorId, costSnapshot: cost },
      reason: undefined,
    });
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    res.json(result.job);

    if (result.job?.woId) {
      checkAndAutoTransitionWorkOrder(result.job.woId).catch(console.error);
    }
  } catch (error) {
    console.error("Submit to vendor error:", error);
    res.status(500).json({ message: "Failed to submit job to vendor" });
  }
});

app.post("/api/typing-jobs/:id/on-hold", requireAuth, async (req, res) => {
  try {
    const result = await executeTransition({
      action: "on_hold",
      jobId: req.params.id,
      actor: "team",
      actorId: req.session?.userId,
      storage,
      notifyVendorUsers,
        notifyStaffByRoles,
        notifySingleUser,
      reason: req.body.reason,
    });
    if (!result.success) return res.status(400).json({ message: result.error });
    res.json(result.job);
  } catch (error) {
    console.error("On hold error:", error);
    res.status(500).json({ message: "Failed to put job on hold" });
  }
});

app.post("/api/typing-jobs/:id/resume", requireAuth, async (req, res) => {
  try {
    const result = await executeTransition({
      action: "resume",
      jobId: req.params.id,
      actor: "team",
      actorId: req.session?.userId,
      storage,
      notifyVendorUsers,
        notifyStaffByRoles,
        notifySingleUser,
    });
    if (!result.success) return res.status(400).json({ message: result.error });
    res.json(result.job);
  } catch (error) {
    console.error("Resume error:", error);
    res.status(500).json({ message: "Failed to resume job" });
  }
});

app.post("/api/typing-jobs/:id/abort", requireAuth, async (req, res) => {
  try {
    const result = await executeTransition({
      action: "abort",
      jobId: req.params.id,
      actor: "team",
      actorId: req.session?.userId,
      storage,
      notifyVendorUsers,
        notifyStaffByRoles,
        notifySingleUser,
      reason: req.body.reason,
    });
    if (!result.success) return res.status(400).json({ message: result.error });
    res.json(result.job);
  } catch (error) {
    console.error("Abort error:", error);
    res.status(500).json({ message: "Failed to abort job" });
  }
});

app.post("/api/typing-jobs/:id/deliver-to-client", requireAuth, async (req, res) => {
  try {
    const result = await executeTransition({
      action: "deliver_to_client",
      jobId: req.params.id,
      actor: "team",
      actorId: req.session?.userId,
      storage,
      notifyVendorUsers,
        notifyStaffByRoles,
        notifySingleUser,
    });
    if (!result.success) return res.status(400).json({ message: result.error });
    res.json(result.job);
  } catch (error) {
    console.error("Deliver to client error:", error);
    res.status(500).json({ message: "Failed to deliver to client" });
  }
});

// Files API
app.get("/api/files/:relatedType/:relatedId", requireAuth, async (req, res) => {
  try {
    const { relatedType, relatedId } = req.params;
    const filesList = await storage.getFilesByRelated(relatedType, relatedId);
    res.json(filesList);
  } catch (error) {
    console.error("Files fetch error:", error);
    res.status(500).json({ message: "Failed to fetch files" });
  }
});

app.post("/api/files", requireAuth, async (req, res) => {
  try {
    const validation = validateBody(insertFileSchema, req.body);
    if ("error" in validation) return res.status(400).json({ message: validation.error });
    const file = await storage.createFile(validation.data);
    
    if (validation.data.relatedType === "TypingJob") {
      await storage.createAuditLog({
        entityType: "typing_job",
        entityId: validation.data.relatedId,
        action: "file_uploaded",
        details: { 
          fileName: validation.data.fileName, 
          direction: validation.data.direction,
          uploadedBy: validation.data.uploadedByType 
        },
      });
    }
    
    res.status(201).json(file);
  } catch (error) {
    console.error("File create error:", error);
    res.status(500).json({ message: "Failed to create file" });
  }
});

app.delete("/api/files/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteFile(id);
    res.status(204).end();
  } catch (error) {
    console.error("File delete error:", error);
    res.status(500).json({ message: "Failed to delete file" });
  }
});

}
