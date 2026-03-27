import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Company } from "@shared/schema";

interface QuickCreateWoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  woForm: UseFormReturn<{
    woNumber: string;
    applicantName: string;
    applicantPhone?: string;
    isVip: boolean;
    companyId: string;
  }>;
  companies: Company[] | undefined;
  onSubmit: (data: {
    woNumber: string;
    applicantName: string;
    applicantPhone?: string;
    isVip: boolean;
    companyId: string;
  }) => void;
  isPending: boolean;
}

export function QuickCreateWoDialog({
  open,
  onOpenChange,
  woForm,
  companies,
  onSubmit,
  isPending,
}: QuickCreateWoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>
        <Form {...woForm}>
          <form onSubmit={woForm.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={woForm.control}
              name="woNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WO Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="A12345" data-testid="input-new-wo-number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={woForm.control}
              name="applicantName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applicant Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Full name" data-testid="input-new-applicant" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={woForm.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-new-company">
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies?.filter(c => c.active).map((company) => (
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
              control={woForm.control}
              name="isVip"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-new-vip"
                    />
                  </FormControl>
                  <FormLabel>VIP Service</FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
