import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { 
  ArrowLeft, 
  Building2, 
  Calendar, 
  FileText, 
  MessageSquare,
  Inbox,
  Clock,
  User,
  MapPin,
  Mail,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkOrder, Company, Appointment, TypingJob, Staff, Center } from "@shared/schema";

interface WorkOrderDetail extends WorkOrder {
  company?: Company & {
    rmStaff?: Staff;
    assistStaff?: Staff;
    emails?: Array<{ label: string; email: string; active: boolean }>;
    preferredMedicalCenter?: Center;
    preferredEidCenter?: Center;
  };
  appointments?: Appointment[];
  typingJobs?: TypingJob[];
}

export default function WorkOrderDetail() {
  const [, params] = useRoute("/work-orders/:id");
  const id = params?.id;

  const { data: workOrder, isLoading } = useQuery<WorkOrderDetail>({
    queryKey: ["/api/work-orders", id],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader
          title="Loading..."
          actions={
            <Link href="/work-orders">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          }
        />
        <div className="p-4 lg:p-8 space-y-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!workOrder) {
    return (
      <AppLayout>
        <PageHeader
          title="Work Order Not Found"
          actions={
            <Link href="/work-orders">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          }
        />
        <div className="p-4 lg:p-8">
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Work order not found"
            description="The work order you're looking for doesn't exist or has been deleted."
            action={
              <Link href="/work-orders">
                <Button>View All Work Orders</Button>
              </Link>
            }
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={workOrder.woNumber}
        subtitle={workOrder.applicantName}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={workOrder.status} />
            <Link href="/work-orders">
              <Button variant="outline" className="gap-2" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Work Order Summary */}
          <SectionCard title="Work Order Summary">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Applicant</p>
                  <p className="font-medium text-foreground">{workOrder.applicantName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">WO Number</p>
                  <p className="font-medium text-foreground">{workOrder.woNumber}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium text-foreground">
                    {new Date(workOrder.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              {workOrder.notes && (
                <div className="pt-3 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{workOrder.notes}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Company Snapshot */}
          <SectionCard title="Company Snapshot">
            {workOrder.company ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="font-medium text-foreground">{workOrder.company.name}</p>
                  </div>
                </div>

                {workOrder.company.emails && workOrder.company.emails.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Client Emails</p>
                      <div className="space-y-1">
                        {workOrder.company.emails.filter(e => e.active).map((email, i) => (
                          <p key={i} className="text-sm text-foreground">
                            <span className="text-muted-foreground">{email.label}:</span> {email.email}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {(workOrder.company.preferredMedicalCenter || workOrder.company.preferredEidCenter) && (
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Preferred Centers</p>
                      {workOrder.company.preferredMedicalCenter && (
                        <p className="text-sm text-foreground">
                          <span className="text-muted-foreground">Medical:</span> {workOrder.company.preferredMedicalCenter.name}
                        </p>
                      )}
                      {workOrder.company.preferredEidCenter && (
                        <p className="text-sm text-foreground">
                          <span className="text-muted-foreground">EID:</span> {workOrder.company.preferredEidCenter.name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {(workOrder.company.rmStaff || workOrder.company.assistStaff) && (
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Assigned Staff</p>
                      {workOrder.company.rmStaff && (
                        <p className="text-sm text-foreground">
                          <span className="text-muted-foreground">RM:</span> {workOrder.company.rmStaff.name}
                        </p>
                      )}
                      {workOrder.company.assistStaff && (
                        <p className="text-sm text-foreground">
                          <span className="text-muted-foreground">Assist:</span> {workOrder.company.assistStaff.name}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Company information not available</p>
            )}
          </SectionCard>
        </div>

        {/* Tabs */}
        <Card className="border border-border/50 shadow-sm">
          <Tabs defaultValue="appointments" className="w-full">
            <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto">
              <TabsTrigger 
                value="appointments" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
                data-testid="tab-appointments"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Appointments
              </TabsTrigger>
              <TabsTrigger 
                value="typing" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
                data-testid="tab-typing"
              >
                <FileText className="h-4 w-4 mr-2" />
                Vendor Typing
              </TabsTrigger>
              <TabsTrigger 
                value="messages" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
                data-testid="tab-messages"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </TabsTrigger>
              <TabsTrigger 
                value="reschedule" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
                data-testid="tab-reschedule"
              >
                <Inbox className="h-4 w-4 mr-2" />
                Reschedule Inbox
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appointments" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-foreground">Scheduled Appointments</h3>
                <div className="flex gap-2">
                  <Link href={`/schedule/medical?wo=${id}`}>
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-schedule-medical">
                      <Plus className="h-4 w-4" />
                      Medical
                    </Button>
                  </Link>
                  <Link href={`/schedule/eid?wo=${id}`}>
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
                    <Card key={apt.id} className="border border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <StatusBadge status={apt.type} />
                            <div>
                              <p className="font-medium text-foreground">
                                {new Date(apt.datetime).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(apt.datetime).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={apt.status} />
                        </div>
                      </CardContent>
                    </Card>
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

            <TabsContent value="typing" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-foreground">Typing Jobs</h3>
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-new-typing-job">
                  <Plus className="h-4 w-4" />
                  New Typing Job
                </Button>
              </div>

              {workOrder.typingJobs && workOrder.typingJobs.length > 0 ? (
                <div className="space-y-3">
                  {workOrder.typingJobs.map((job) => (
                    <Link key={job.id} href={`/typing-jobs/${job.id}`}>
                      <Card className="border border-border/50 hover-elevate cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-foreground">Typing Job</p>
                              <p className="text-sm text-muted-foreground">
                                Created {new Date(job.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <StatusBadge status={job.status} />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No typing jobs"
                  description="Create a typing job to send to the vendor."
                />
              )}
            </TabsContent>

            <TabsContent value="messages" className="p-6">
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title="No messages yet"
                description="Messages and drafts will appear here once you schedule appointments."
              />
            </TabsContent>

            <TabsContent value="reschedule" className="p-6">
              <EmptyState
                icon={<Inbox className="h-6 w-6" />}
                title="No reschedule requests"
                description="Client reschedule requests will appear here."
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AppLayout>
  );
}
