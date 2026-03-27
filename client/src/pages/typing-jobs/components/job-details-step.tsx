import { useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { Stethoscope, CreditCard, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentPanel } from "@/components/documents/document-panel";
import type { ServiceCategory } from "@/components/documents/document-types";
import { toProperCase } from "@/lib/proper-case";
import type { WorkOrder, Company, Center, ServiceType } from "@shared/schema";

interface WorkOrderWithDetails extends WorkOrder {
  company?: Company;
}

interface JobDetailsStepProps {
  form: UseFormReturn<any>;
  selectedWo: WorkOrderWithDetails;
  selectedCompany: Company | null;
  serviceTypes: ServiceType[] | undefined;
  typeMedical: boolean;
  typeEid: boolean;
  isVip: boolean;
  centerAuthority: string | undefined;
  isRenewal: boolean;
  filteredMedicalCenters: Center[];
  eidCenters: Center[];
  woServiceCategory: ServiceCategory | null;
  docContext: "medical" | "eid" | "all";
}

export function JobDetailsStep({
  form,
  selectedWo,
  selectedCompany,
  serviceTypes,
  typeMedical,
  typeEid,
  isVip,
  centerAuthority,
  isRenewal,
  filteredMedicalCenters,
  eidCenters,
  woServiceCategory,
  docContext,
}: JobDetailsStepProps) {
  return (
    <div className="space-y-6">
      <Card className="border border-border/50 shadow-sm bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Work Order Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">WO Number</p>
              <p className="font-medium text-foreground" data-testid="text-wo-number">{selectedWo.woNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Applicant</p>
              <p className="font-medium text-foreground" data-testid="text-applicant-name">{toProperCase(selectedWo.applicantName)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Company</p>
              <p className="font-medium text-foreground" data-testid="text-company-name">{selectedCompany?.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Service Type</p>
              <p className="font-medium text-foreground" data-testid="text-service-type">
                {serviceTypes?.find(st => st.id === selectedWo.serviceTypeId)?.name || "-"}
              </p>
            </div>
            {selectedWo.isVip && (
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" data-testid="badge-vip">
                  VIP
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Job Type Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <FormField
              control={form.control}
              name="typeMedical"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox 
                      checked={field.value} 
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-medical"
                    />
                  </FormControl>
                  <FormLabel className="font-medium cursor-pointer">
                    Medical Application
                  </FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="typeEid"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox 
                      checked={field.value} 
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-eid"
                    />
                  </FormControl>
                  <FormLabel className="font-medium cursor-pointer">
                    Emirates ID Application
                  </FormLabel>
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {typeMedical && (
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-green-600" />
              Medical Application
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="isVip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical Type</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={!field.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange(false)}
                      data-testid="button-normal-medical"
                    >
                      Normal
                    </Button>
                    <Button
                      type="button"
                      variant={field.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange(true)}
                      data-testid="button-vip-medical"
                    >
                      VIP
                    </Button>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="centerAuthority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Center Type</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-authority">
                        <SelectValue placeholder="Select authority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DHA">DHA (Dubai Health Authority)</SelectItem>
                      <SelectItem value="EHS">EHS (Emirates Health Services)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="medicalCenterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical Center</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-medical-center">
                        <SelectValue placeholder="Select medical center" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredMedicalCenters.map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.name}
                          {center.area && ` (${center.area})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {filteredMedicalCenters.length} centers available
                  </FormDescription>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      )}

      {typeEid && (
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Emirates ID Application
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="hadIdBefore"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox 
                      checked={field.value} 
                      onCheckedChange={field.onChange}
                      disabled={isRenewal}
                      data-testid="checkbox-had-id"
                    />
                  </FormControl>
                  <div>
                    <FormLabel className="font-medium cursor-pointer">
                      Had Emirates ID before
                    </FormLabel>
                    {isRenewal && (
                      <FormDescription>
                        Auto-checked for renewal services
                      </FormDescription>
                    )}
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="biometricsCenterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Biometrics Center</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-biometrics-center">
                        <SelectValue placeholder="Select biometrics center" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {eidCenters.map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.name}
                          {center.area && ` (${center.area})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCompany?.preferredBiometricsCenterId && (
                    <FormDescription>
                      Company's preferred center pre-selected
                    </FormDescription>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deliveryAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Address</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field}
                      placeholder="Enter delivery address for Emirates ID card..."
                      className="min-h-[80px]"
                      data-testid="textarea-delivery-address"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      )}

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Additional Notes</FormLabel>
            <FormControl>
              <Textarea 
                {...field}
                placeholder="Any special instructions for the vendor..."
                className="min-h-[60px]"
                data-testid="textarea-notes"
              />
            </FormControl>
          </FormItem>
        )}
      />

      {selectedWo && (typeMedical || typeEid) && (
        <DocumentPanel
          woId={selectedWo.id}
          serviceCategory={woServiceCategory}
          context={docContext}
          title={
            typeMedical && typeEid
              ? "Documents (Medical & EIDA)"
              : typeMedical
                ? "Documents (Medical)"
                : "Documents (EIDA)"
          }
        />
      )}
    </div>
  );
}
