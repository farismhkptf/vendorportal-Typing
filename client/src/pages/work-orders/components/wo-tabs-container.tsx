import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Calendar,
  FileText,
  StickyNote,
  History,
  Plus,
  Stethoscope,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentPanel } from "@/components/documents/document-panel";
import { WoCustodyPanel } from "@/components/custody/wo-custody-panel";
import { MedicalSchedulingTab } from "@/components/medical-scheduling/MedicalSchedulingTab";
import { BiometricsSchedulingTab } from "@/components/biometrics-scheduling/BiometricsSchedulingTab";
import type { ServiceCategory } from "@/components/documents/document-types";
import type { ServiceType, Center, Staff, Vendor, JobType, Company, Appointment } from "@shared/schema";
import { ExpandedAppointmentCard } from "./expanded-appointment-card";
import { InternalNotesSection } from "./internal-notes-section";
import { ActivityTimelineSection } from "./activity-timeline-section";
import { WoTypingTab } from "./wo-typing-tab";
import { WoAptConfirmDialog } from "./wo-dialogs";
import type { AptConfirmDialogState } from "./wo-dialogs";
import type { WorkOrderDetail } from "./types";
import { ResendEmailDialog } from "../../appointments/components/resend-email-dialog";
import type { AppointmentWithRelations } from "../../appointments/components/types";

interface WoTabsContainerProps {
  workOrder: WorkOrderDetail;
  id: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  serviceTypes?: ServiceType[];
  allCenters: Center[];
  allStaff: Staff[];
  vendors: Vendor[];
  jobTypes?: JobType[];
  openTypingJobForm?: boolean;
  onTypingJobFormOpened?: () => void;
}

export function WoTabsContainer({
  workOrder,
  id,
  activeTab,
  setActiveTab,
  serviceTypes,
  allCenters,
  allStaff,
  vendors,
  jobTypes,
  openTypingJobForm,
  onTypingJobFormOpened,
}: WoTabsContainerProps) {
  const [aptConfirmDialog, setAptConfirmDialog] = useState<AptConfirmDialogState>({ open: false, type: "complete", appointment: null });
  const [resendEmailApt, setResendEmailApt] = useState<AppointmentWithRelations | null>(null);

  const { data: companies } = useQuery<Company[]>({ queryKey: ["/api/companies"] });

  const existingMedicalJob = workOrder.typingJobs?.find(j => j.jobType?.category === "Medical" && j.status !== "Aborted") || null;

  return (
    <>
      <Card className="border border-border/50 shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto overflow-x-auto">
            <TabsTrigger 
              value="typing" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
              data-testid="tab-typing"
            >
              <FileText className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Create </span>Typing
            </TabsTrigger>
            <TabsTrigger 
              value="appointments" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
              data-testid="tab-appointments"
            >
              <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Schedule </span>Appt
            </TabsTrigger>
            <TabsTrigger 
              value="notes" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
              data-testid="tab-notes"
            >
              <StickyNote className="h-4 w-4 mr-1 sm:mr-2" />
              Notes
            </TabsTrigger>
            <TabsTrigger 
              value="activity" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
              data-testid="tab-activity"
            >
              <History className="h-4 w-4 mr-1 sm:mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
              data-testid="tab-documents"
            >
              <FileText className="h-4 w-4 mr-1 sm:mr-2" />
              Docs
            </TabsTrigger>
            <TabsTrigger 
              value="medical-scheduling" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
              data-testid="tab-medical-scheduling"
            >
              <Stethoscope className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Medical </span>Sched
            </TabsTrigger>
            <TabsTrigger 
              value="biometrics-scheduling" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 text-xs sm:text-sm"
              data-testid="tab-biometrics-scheduling"
            >
              <CreditCard className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">EID </span>Biometrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-medium text-foreground">Scheduled Appointments</h3>
              <div className="flex gap-2">
                <Link href={`/appointments/schedule-medical?wo=${id}`}>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-schedule-medical">
                    <Plus className="h-4 w-4" />
                    Medical
                  </Button>
                </Link>
                <Link href={`/appointments/schedule-eid?wo=${id}`}>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-schedule-eid">
                    <Plus className="h-4 w-4" />
                    Emirates ID
                  </Button>
                </Link>
              </div>
            </div>

            {workOrder.appointments && workOrder.appointments.length > 0 ? (
              <div className="space-y-3">
                {workOrder.appointments.map((apt) => (
                  <ExpandedAppointmentCard
                    key={apt.id}
                    apt={apt}
                    centers={allCenters}
                    staffList={allStaff}
                    onComplete={() => setAptConfirmDialog({ open: true, type: "complete", appointment: apt })}
                    onReschedule={() => setAptConfirmDialog({ open: true, type: "reschedule", appointment: apt })}
                    onCancel={() => setAptConfirmDialog({ open: true, type: "cancel", appointment: apt })}
                    onResendEmail={() => {
                      const aptWithRelations: AppointmentWithRelations = {
                        ...apt,
                        workOrder: workOrder as AppointmentWithRelations["workOrder"],
                      };
                      setResendEmailApt(aptWithRelations);
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Calendar className="h-6 w-6" />}
                title="No appointments scheduled"
                description="Schedule a medical or Emirates ID appointment for this work order."
              />
            )}
          </TabsContent>

          <WoTypingTab
            workOrder={workOrder}
            id={id}
            vendors={vendors}
            jobTypes={jobTypes}
            openNewJobForm={openTypingJobForm}
            onNewJobFormOpened={onTypingJobFormOpened}
          />

          <TabsContent value="notes" className="p-3 sm:p-6">
            <InternalNotesSection workOrderId={id} />
          </TabsContent>

          <TabsContent value="activity" className="p-3 sm:p-6">
            <ActivityTimelineSection workOrderId={id} />
          </TabsContent>

          <TabsContent value="documents" className="p-3 sm:p-6 space-y-6">
            <DocumentPanel 
              woId={id}
              serviceCategory={serviceTypes?.find(st => st.id === workOrder.serviceTypeId)?.category as ServiceCategory | undefined}
              title="Work Order Documents"
            />
            <div className="border-t border-border pt-4">
              <WoCustodyPanel woId={id} companyId={workOrder.companyId} />
            </div>
          </TabsContent>

          <TabsContent value="medical-scheduling" className="p-3 sm:p-6">
            <MedicalSchedulingTab
              woId={id}
              centers={allCenters}
              staffList={allStaff}
              typingReady={!!(existingMedicalJob && (existingMedicalJob.status === "ReadyForScheduling" || existingMedicalJob.status === "Returned"))}
            />
          </TabsContent>

          <TabsContent value="biometrics-scheduling" className="p-3 sm:p-6">
            <BiometricsSchedulingTab
              woId={id}
              centers={allCenters}
              staffList={allStaff}
            />
          </TabsContent>

        </Tabs>
      </Card>

      <WoAptConfirmDialog
        aptConfirmDialog={aptConfirmDialog}
        setAptConfirmDialog={setAptConfirmDialog}
        workOrderId={id}
        applicantName={workOrder.applicantName || ""}
      />

      <ResendEmailDialog
        appointment={resendEmailApt}
        onClose={() => setResendEmailApt(null)}
        companies={companies}
      />
    </>
  );
}
