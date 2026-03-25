import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, FileCheck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Company, Vendor, AttestationService, AttestationServiceVariant } from "@shared/schema";

const srSchema = z.object({
  externalWoNumber: z.string().min(1, "External WO number is required"),
  companyId: z.string().min(1, "Company is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  attestationServiceId: z.string().min(1, "Service is required"),
  serviceVariantId: z.string().optional(),
  applicantName: z.string().optional(),
  documentType: z.string().min(1, "Document type is required"),
  documentNameDescription: z.string().min(1, "Document description is required"),
  documentClass: z.enum(["Personal", "Business"]),
  homeCountry: z.string().optional(),
  originalDocumentInvolved: z.boolean().default(false),
  serviceFeeAed: z.string().optional(),
  internalNotes: z.string().optional(),
});

type SRForm = z.infer<typeof srSchema>;

interface ServiceWithVariants extends AttestationService {
  variants?: AttestationServiceVariant[];
}

export default function NewAttestationSR() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: companies } = useQuery<Company[]>({ queryKey: ["/api/companies"] });
  const { data: vendors } = useQuery<Vendor[]>({ queryKey: ["/api/attestation/vendors"] });
  const { data: services } = useQuery<ServiceWithVariants[]>({ queryKey: ["/api/attestation/services"] });

  const form = useForm<SRForm>({
    resolver: zodResolver(srSchema),
    defaultValues: {
      externalWoNumber: "",
      companyId: "",
      vendorId: "",
      attestationServiceId: "",
      serviceVariantId: "",
      applicantName: "",
      documentType: "",
      documentNameDescription: "",
      documentClass: "Personal",
      homeCountry: "",
      originalDocumentInvolved: false,
      serviceFeeAed: "",
      internalNotes: "",
    },
  });

  const selectedServiceId = useWatch({ control: form.control, name: "attestationServiceId" });
  const selectedService = services?.find(s => s.id === selectedServiceId);
  const variants = selectedService?.variants || [];

  useEffect(() => {
    form.setValue("serviceVariantId", "");
    if (selectedService) {
      form.setValue("serviceFeeAed", selectedService.basePriceAed || "");
    }
  }, [selectedServiceId]);

  const selectedVariantId = useWatch({ control: form.control, name: "serviceVariantId" });
  useEffect(() => {
    if (selectedVariantId && variants.length > 0) {
      const variant = variants.find(v => v.id === selectedVariantId);
      if (variant) {
        form.setValue("serviceFeeAed", variant.priceAed || "");
      }
    }
  }, [selectedVariantId]);

  const createMutation = useMutation({
    mutationFn: async (data: SRForm) => {
      const payload: Record<string, unknown> = {
        externalWoNumber: data.externalWoNumber,
        companyId: data.companyId,
        vendorId: data.vendorId,
        attestationServiceId: data.attestationServiceId,
        documentType: data.documentType,
        documentNameDescription: data.documentNameDescription,
        documentClass: data.documentClass,
        originalDocumentInvolved: data.originalDocumentInvolved,
      };
      if (data.serviceVariantId) payload.serviceVariantId = data.serviceVariantId;
      if (data.applicantName) payload.applicantName = data.applicantName;
      if (data.homeCountry) payload.homeCountry = data.homeCountry;
      if (data.serviceFeeAed) payload.serviceFeeAed = data.serviceFeeAed;
      if (data.internalNotes) payload.internalNotes = data.internalNotes;
      return apiRequest("POST", "/api/attestation/service-requests", payload);
    },
    onSuccess: async (res: Response) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/attestation/service-requests"] });
      toast({ title: "Service request created" });
      const data = await res.json() as { id: string };
      navigate(`/attestation-sr/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/attestation-sr")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="heading-new-sr">New Attestation SR</h1>
            <p className="text-sm text-muted-foreground">Create a new attestation service request</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reference & Client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="externalWoNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>External WO Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. WO-2024-001" {...field} data-testid="input-external-wo" />
                      </FormControl>
                      <FormDescription>Reference number from the external system (no WO is created here).</FormDescription>
                      <FormMessage />
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
                          <SelectTrigger data-testid="select-company">
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies?.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        <Input placeholder="Full name of applicant" {...field} data-testid="input-applicant-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Service & Vendor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="attestationServiceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attestation Service</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-service">
                            <SelectValue placeholder="Select service" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {services?.filter(s => s.active).map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} — {s.category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {variants.length > 0 && (
                  <FormField
                    control={form.control}
                    name="serviceVariantId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Variant</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-variant">
                              <SelectValue placeholder="Select variant (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">— None —</SelectItem>
                            {variants.filter(v => v.active).map(v => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.variantLabel} — AED {v.priceAed}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attestation Vendor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-vendor">
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendors?.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serviceFeeAed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Fee (AED)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} data-testid="input-service-fee" />
                      </FormControl>
                      <FormDescription>Auto-filled from service/variant pricing. Adjust if needed.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Document Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Educational Certificate, Marriage Certificate" {...field} data-testid="input-document-type" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="documentNameDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Name / Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Specific document name or description" {...field} data-testid="input-document-desc" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="documentClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Class</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-document-class">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Personal">Personal</SelectItem>
                          <SelectItem value="Business">Business</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {selectedService?.category === "MofaHomeCountry" && (
                  <FormField
                    control={form.control}
                    name="homeCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Home Country</FormLabel>
                        <FormControl>
                          <Input placeholder="Country of document origin" {...field} data-testid="input-home-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="originalDocumentInvolved"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-original-doc"
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">Original document involved</FormLabel>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="internalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Internal notes (not visible to vendor)"
                          rows={3}
                          {...field}
                          data-testid="textarea-internal-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pb-4">
              <Button type="button" variant="outline" onClick={() => navigate("/attestation-sr")} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-sr">
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-4 w-4 mr-2" />
                    Create SR
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
