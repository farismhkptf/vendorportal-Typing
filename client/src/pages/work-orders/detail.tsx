import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft, 
  Building2, 
  Calendar, 
  FileText, 
  MessageSquare,
  User,
  MapPin,
  Mail,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { useScrollToError } from "@/hooks/use-scroll-to-error";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ActivityTimeline, type ActivityItem } from "@/components/ui/activity-timeline";
import type { WorkOrder, Company, Appointment, TypingJob, Staff, Center, ServiceType, AuditLog } from "@shared/schema";

const editWorkOrderSchema = z.object({
  woNumber: z.string().min(1, "Work order number is required").regex(/^[A-Z]\d{5,6}$/, "Format: Letter + 5-6 digits"),
  applicantName: z.string().min(1, "Applicant name is required"),
  applicantPhone: z.string().optional(),
  applicantEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  isVip: z.boolean().default(false),
  companyId: z.string().min(1, "Company is required"),
  serviceTypeId: z.string().optional(),
  status: z.string(),
  notes: z.string().optional(),
});

type EditWorkOrderForm = z.infer<typeof editWorkOrderSchema>;

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

function ActivityTimelineSection({ workOrderId }: { workOrderId: string }) {
  const { data: auditLogs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", "work_order", workOrderId],
    enabled: !!workOrderId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const activities: ActivityItem[] = (auditLogs || []).map(log => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    userId: log.userId,
    details: log.details as Record<string, unknown> | null,
    createdAt: log.createdAt,
  }));

  return <ActivityTimeline activities={activities} />;
}

export default function WorkOrderDetail() {
  const [, params] = useRoute("/work-orders/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: workOrder, isLoading } = useQuery<WorkOrderDetail>({
    queryKey: ["/api/work-orders", id],
    enabled: !!id,
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const form = useForm<EditWorkOrderForm>({
    resolver: zodResolver(editWorkOrderSchema),
    defaultValues: {
      woNumber: "",
      applicantName: "",
      applicantPhone: "",
      applicantEmail: "",
      isVip: false,
      companyId: "",
      serviceTypeId: "",
      status: "Draft",
      notes: "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditWorkOrderForm) => {
      return apiRequest("PUT", `/api/work-orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setEditDialogOpen(false);
      toast({ title: "Work order updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/work-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({ title: "Work order deleted" });
      setLocation("/work-orders");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenEdit = () => {
    if (workOrder) {
      form.reset({
        woNumber: workOrder.woNumber,
        applicantName: workOrder.applicantName,
        applicantPhone: workOrder.applicantPhone || "",
        applicantEmail: workOrder.applicantEmail || "",
        isVip: workOrder.isVip || false,
        companyId: workOrder.companyId,
        serviceTypeId: workOrder.serviceTypeId || "",
        status: workOrder.status,
        notes: workOrder.notes || "",
      });
      setEditDialogOpen(true);
    }
  };

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
          <div className="flex items-center gap-2">
            <StatusBadge status={workOrder.status} />
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5" 
              onClick={handleOpenEdit}
              data-testid="button-edit-wo"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive" data-testid="button-delete-wo">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Work Order</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete work order {workOrder.woNumber}? This will also delete all associated appointments and typing jobs. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    className="rounded-xl bg-destructive text-destructive-foreground"
                    onClick={() => deleteMutation.mutate()}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Link href="/work-orders">
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-back">
                <ArrowLeft className="h-3.5 w-3.5" />
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
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Work Order Number</p>
                    <p className="font-medium text-foreground">{workOrder.woNumber}</p>
                  </div>
                  {workOrder.isVip && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-medium">
                      <Star className="h-3 w-3 fill-current" />
                      VIP
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Applicant Name</p>
                  <p className="font-medium text-foreground">{workOrder.applicantName}</p>
                </div>
              </div>
              {(workOrder.applicantPhone || workOrder.applicantEmail) && (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Applicant Contact</p>
                    {workOrder.applicantPhone && (
                      <p className="text-sm text-foreground">{workOrder.applicantPhone}</p>
                    )}
                    {workOrder.applicantEmail && (
                      <p className="text-sm text-foreground">{workOrder.applicantEmail}</p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Service Type</p>
                  <p className="font-medium text-foreground">
                    {workOrder.serviceTypeId 
                      ? serviceTypes?.find(st => st.id === workOrder.serviceTypeId)?.name || "Unknown"
                      : "Not specified"}
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
          <Tabs defaultValue="typing" className="w-full">
            <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto">
              <TabsTrigger 
                value="typing" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
                data-testid="tab-typing"
              >
                <FileText className="h-4 w-4 mr-2" />
                Type Medical & EID Application
              </TabsTrigger>
              <TabsTrigger 
                value="appointments" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
                data-testid="tab-appointments"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Medical
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
                value="activity" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
                data-testid="tab-activity"
              >
                <FileText className="h-4 w-4 mr-2" />
                Activity
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

            <TabsContent value="activity" className="p-6">
              <ActivityTimelineSection workOrderId={id || ""} />
            </TabsContent>

          </Tabs>
        </Card>
      </div>

      {/* Edit Work Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Work Order</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="woNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Order Number</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., J016308" 
                        className="uppercase"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        data-testid="input-edit-wo-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="applicantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Applicant Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Full name" data-testid="input-edit-applicant" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="applicantPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <MaskedInput
                          mask="phone"
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="+971 50 123 4567"
                          aria-label="Applicant phone number"
                          data-testid="input-edit-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="applicantEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="applicant@email.com"
                          aria-label="Applicant email address"
                          data-testid="input-edit-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isVip"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Button
                        type="button"
                        variant={field.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.onChange(!field.value)}
                        className={field.value ? "bg-amber-500 text-white border-amber-500 gap-2" : "gap-2"}
                        data-testid="button-edit-vip"
                      >
                        <Star className={`h-4 w-4 ${field.value ? "fill-current" : ""}`} />
                        {field.value ? "VIP" : "Mark as VIP"}
                      </Button>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-company">
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-service">
                          <SelectValue placeholder="Select service type (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceTypes?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Additional notes..." 
                        className="resize-none"
                        data-testid="input-edit-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-wo">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
