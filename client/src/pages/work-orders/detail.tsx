import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { getPipelineInfo } from "@/lib/pipeline-stage";
import { queryKeys } from "@/lib/query-keys";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import type { Company, Staff, Center, ServiceType, JobType, Vendor, WoDocument } from "@shared/schema";
import { PipelineBar } from "./components/pipeline-bar";
import { NextActionBanner } from "./components/next-action-banner";
import { WoDetailHeader } from "./components/wo-detail-header";
import { WoEditDialog } from "./components/wo-edit-dialog";
import { WoApplicantInfo } from "./components/wo-applicant-info";
import { WoSummaryPanel } from "./components/wo-summary-panel";
import { WoBanners } from "./components/wo-banners";
import { WoTabsContainer } from "./components/wo-tabs-container";
import { WoLoadingSkeleton, WoNotFound } from "./components/wo-loading-states";
import type { WorkOrderDetail as WorkOrderDetailType } from "./components/types";

export default function WorkOrderDetail() {
  const [, params] = useRoute("/work-orders/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { user } = useAuth();
  const isCrm = user?.role === "Client Relationship Manager";
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("typing");
  const [openTypingJobForm, setOpenTypingJobForm] = useState(false);
  const handleTypingJobFormOpened = useCallback(() => setOpenTypingJobForm(false), []);

  const { data: workOrder, isLoading } = useQuery<WorkOrderDetailType>({
    queryKey: queryKeys.workOrder(id!),
    enabled: !!id,
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: queryKeys.companies,
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: queryKeys.serviceTypes,
  });

  const { data: jobTypes } = useQuery<JobType[]>({
    queryKey: queryKeys.jobTypes,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: queryKeys.vendors,
  });

  const { data: allCenters = [] } = useQuery<Center[]>({
    queryKey: queryKeys.centers,
  });

  const { data: allStaff = [] } = useQuery<Staff[]>({
    queryKey: queryKeys.staff,
  });

  const { data: woDocuments = [] } = useQuery<WoDocument[]>({
    queryKey: queryKeys.workOrderDocuments(id!),
    queryFn: async () => {
      const r = await fetch(`/api/work-orders/${id}/documents`);
      if (!r.ok) throw new Error("Failed to fetch documents");
      return r.json();
    },
    enabled: !!id,
  });

  const { data: docCompleteness } = useQuery<{ complete: boolean; missingDocumentTypes: string[] }>({
    queryKey: queryKeys.workOrderDocumentCompleteness(id!),
    enabled: !!id && !!workOrder && workOrder.status !== "Completed" && workOrder.status !== "Cancelled",
  });

  const expiringOrExpiredDocs = Array.isArray(woDocuments) ? woDocuments.filter((d) => {
    if (!d.expiresAt) return false;
    const now = new Date();
    const expiryDate = new Date(d.expiresAt);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiryDate <= thirtyDaysFromNow;
  }) : [];

  const effectiveTypingJobs = workOrder
    ? workOrder.isMinor
      ? (workOrder.typingJobs || []).filter(j => j.jobType?.category !== "Medical")
      : workOrder.typingJobs || []
    : [];
  const pipeline = workOrder ? getPipelineInfo(effectiveTypingJobs, workOrder.appointments || []) : null;

  const handleNextAction = (actionType: string) => {
    switch (actionType) {
      case "create_typing":
      case "send_vendor":
      case "attention":
        setActiveTab("typing");
        break;
      case "schedule_medical":
        setActiveTab("appointments");
        setLocation(`/appointments/schedule-medical?wo=${id}`);
        break;
      case "schedule_eid":
        setActiveTab("appointments");
        setLocation(`/appointments/schedule-eid?wo=${id}`);
        break;
      case "deliver":
        break;
    }
  };

  if (isLoading) {
    return <WoLoadingSkeleton />;
  }

  if (!workOrder) {
    return <WoNotFound />;
  }

  return (
    <AppLayout>
      <WoDetailHeader
        workOrder={workOrder}
        serviceTypes={serviceTypes}
        isCrm={isCrm}
        onEdit={() => setEditDialogOpen(true)}
      />

      <div className="p-4 lg:p-8 space-y-6">
        <WoBanners
          workOrder={workOrder}
          expiringOrExpiredDocs={expiringOrExpiredDocs}
          missingDocumentTypes={docCompleteness?.missingDocumentTypes ?? []}
          setActiveTab={setActiveTab}
          onCreateMissingJobs={() => setOpenTypingJobForm(true)}
        />

        {pipeline && (
          <div className="space-y-3">
            <PipelineBar
              pipeline={pipeline}
              serviceType={workOrder.serviceType}
              isMinor={workOrder.isMinor}
              onTrackClick={(track) => {
                const stage = track === "medical" ? pipeline.medical.stage : pipeline.eid.stage;
                if (stage === "at_vendor" || stage === "new" || stage === "needs_attention") {
                  setActiveTab("typing");
                } else {
                  setActiveTab("appointments");
                }
              }}
            />
            <NextActionBanner
              pipeline={pipeline}
              typingJobs={effectiveTypingJobs}
              appointments={workOrder.appointments || []}
              onAction={handleNextAction}
            />
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <WoApplicantInfo workOrder={workOrder} serviceTypes={serviceTypes} />
          <WoSummaryPanel workOrder={workOrder} companies={companies} />
        </div>

        <WoTabsContainer
          workOrder={workOrder}
          id={id || ""}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          serviceTypes={serviceTypes}
          allCenters={allCenters}
          allStaff={allStaff}
          vendors={vendors}
          jobTypes={jobTypes}
          openTypingJobForm={openTypingJobForm}
          onTypingJobFormOpened={handleTypingJobFormOpened}
        />
      </div>

      <WoEditDialog
        workOrder={workOrder}
        companies={companies}
        serviceTypes={serviceTypes}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </AppLayout>
  );
}
