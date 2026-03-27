import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toProperCase } from "@/lib/proper-case";
import { queryKeys } from "@/lib/query-keys";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SaveStatusIndicator } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Company, ServiceType } from "@shared/schema";
import type { WorkOrderDetail } from "./types";

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

interface WoEditDialogProps {
  workOrder: WorkOrderDetail;
  companies?: Company[];
  serviceTypes?: ServiceType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WoEditDialog({ workOrder, companies, serviceTypes, open, onOpenChange }: WoEditDialogProps) {
  const { toast } = useToast();
  const id = workOrder.id;

  const form = useForm<EditWorkOrderForm>({
    resolver: zodResolver(editWorkOrderSchema),
    defaultValues: {
      woNumber: workOrder.woNumber || "",
      applicantName: workOrder.applicantName || "",
      applicantPhone: workOrder.applicantPhone || "",
      applicantEmail: workOrder.applicantEmail || "",
      isVip: workOrder.isVip || false,
      companyId: workOrder.companyId || "",
      serviceTypeId: workOrder.serviceTypeId || "",
      status: workOrder.status || "Draft",
      notes: workOrder.notes || "",
    },
  });

  const watchedValues = useWatch({ control: form.control });

  const handleAutosave = useCallback(async (data: EditWorkOrderForm) => {
    const valid = editWorkOrderSchema.safeParse(data);
    if (!valid.success) throw new Error("Validation failed");
    await apiRequest("PUT", `/api/work-orders/${id}`, valid.data);
    queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
  }, [id]);

  const { status: autosaveStatus, retry: autosaveRetry, flush: flushAutosave } = useAutosave({
    data: watchedValues as EditWorkOrderForm,
    onSave: handleAutosave,
    debounceMs: 1500,
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditWorkOrderForm) => {
      return apiRequest("PUT", `/api/work-orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
      onOpenChange(false);
      toast({ title: "Work order updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenChange = async (newOpen: boolean) => {
    if (!newOpen) await flushAutosave();
    onOpenChange(newOpen);
  };

  const resetForm = useCallback(() => {
    form.reset({
      woNumber: workOrder.woNumber || "",
      applicantName: workOrder.applicantName || "",
      applicantPhone: workOrder.applicantPhone || "",
      applicantEmail: workOrder.applicantEmail || "",
      isVip: workOrder.isVip || false,
      companyId: workOrder.companyId || "",
      serviceTypeId: workOrder.serviceTypeId || "",
      status: workOrder.status || "Draft",
      notes: workOrder.notes || "",
    });
  }, [workOrder, form]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Edit Work Order</DialogTitle>
            <SaveStatusIndicator status={autosaveStatus} onRetry={autosaveRetry} />
          </div>
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
                    <Input {...field} placeholder="Full name" data-testid="input-edit-applicant" onBlur={(e) => { field.onBlur(); if (e.target.value) form.setValue("applicantName", toProperCase(e.target.value)); }} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
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
              <Button type="button" variant="outline" onClick={async () => { await flushAutosave(); onOpenChange(false); }} data-testid="button-close-edit-wo">
                Close
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-wo">
                {updateMutation.isPending ? "Saving..." : "Save & Close"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export { editWorkOrderSchema };
export type { EditWorkOrderForm };
