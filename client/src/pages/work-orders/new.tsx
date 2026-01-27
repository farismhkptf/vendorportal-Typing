import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, User, FileText } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Company, ServiceType } from "@shared/schema";
import { Link } from "wouter";

const workOrderSchema = z.object({
  applicantName: z.string().min(1, "Applicant name is required"),
  companyId: z.string().min(1, "Company is required"),
  serviceTypeId: z.string().optional(),
  notes: z.string().optional(),
});

type WorkOrderForm = z.infer<typeof workOrderSchema>;

export default function NewWorkOrder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const form = useForm<WorkOrderForm>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      applicantName: "",
      companyId: "",
      serviceTypeId: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: WorkOrderForm) => {
      return apiRequest("POST", "/api/work-orders", data);
    },
    onSuccess: async (response) => {
      const wo = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Work order created",
        description: `Work order ${wo.woNumber} has been created successfully.`,
      });
      setLocation(`/work-orders/${wo.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create work order",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WorkOrderForm) => {
    createMutation.mutate(data);
  };

  const selectedCompanyId = form.watch("companyId");
  const selectedCompany = companies?.find((c) => c.id === selectedCompanyId);

  return (
    <AppLayout>
      <PageHeader
        title="New Work Order"
        subtitle="Create a new work order for an applicant"
        actions={
          <Link href="/work-orders">
            <Button variant="outline" className="gap-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        }
      />

      <div className="p-4 lg:p-8 max-w-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Applicant Details */}
            <SectionCard title="Applicant Details" required>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="applicantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Full Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            placeholder="Enter applicant's full name"
                            className="pl-10 h-12 rounded-xl"
                            data-testid="input-applicant-name"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </SectionCard>

            {/* Company Selection */}
            <SectionCard title="Company" required>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Select Company</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl" data-testid="select-company">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <SelectValue placeholder="Choose a company" />
                            </div>
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

                {/* Company Snapshot */}
                {selectedCompany && (
                  <div className="p-4 rounded-xl bg-muted/50 space-y-2" data-testid="company-snapshot">
                    <p className="text-sm font-medium text-foreground">{selectedCompany.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Company details will be displayed here
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Service Type */}
            <SectionCard title="Service Type">
              <FormField
                control={form.control}
                name="serviceTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm text-muted-foreground">Type of Service</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl" data-testid="select-service-type">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Select service type (optional)" />
                          </div>
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
            </SectionCard>

            {/* Notes */}
            <SectionCard title="Additional Notes">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm text-muted-foreground">Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add any additional notes or instructions..."
                        className="min-h-24 rounded-xl resize-none"
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SectionCard>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Link href="/work-orders">
                <Button variant="outline" type="button" data-testid="button-cancel">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-create-work-order"
              >
                {createMutation.isPending ? "Creating..." : "Create Work Order"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
