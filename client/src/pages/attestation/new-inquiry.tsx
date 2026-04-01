import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AppLayout } from "@/components/layout/app-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Company, Vendor } from "@shared/schema";

const inquirySchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  applicantName: z.string().optional(),
  vendorId: z.string().min(1, "Vendor is required"),
  documentType: z.string().min(1, "Document type is required"),
  documentNameDescription: z.string().min(1, "Document name/description is required"),
  documentClass: z.enum(["Personal", "Business"], { required_error: "Document class is required" }),
  homeCountry: z.string().optional(),
  descriptionOfNeed: z.string().min(1, "Description of need is required"),
  externalWoNumber: z.string().optional(),
});

type InquiryFormValues = z.infer<typeof inquirySchema>;

interface AttestationVendor {
  id: string;
  name: string;
  vendorType: string;
}

export default function NewAttestationInquiry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: attestationVendors = [] } = useQuery<AttestationVendor[]>({
    queryKey: ["/api/attestation/vendors"],
    queryFn: async () => {
      const res = await fetch("/api/attestation/vendors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load vendors");
      return res.json();
    },
  });

  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      companyId: "",
      applicantName: "",
      vendorId: "",
      documentType: "",
      documentNameDescription: "",
      documentClass: undefined,
      homeCountry: "",
      descriptionOfNeed: "",
      externalWoNumber: "",
    },
  });

  const documentClass = form.watch("documentClass");

  const createMutation = useMutation({
    mutationFn: async (data: InquiryFormValues) => {
      const res = await apiRequest("POST", "/api/attestation/inquiries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/inquiries"] });
      toast({ title: "Inquiry created", description: "The attestation inquiry has been created and sent to the vendor." });
      setLocation("/attestation/inquiries");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create inquiry", variant: "destructive" });
    },
  });

  const selectedCompanyId = form.watch("companyId");
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  ).slice(0, 10);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/attestation/inquiries")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="page-title-new-inquiry">New Attestation Inquiry</h1>
            <p className="text-sm text-muted-foreground">Create an inquiry for attestation services</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-5">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Company & Vendor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company *</FormLabel>
                      <div className="relative">
                        <Input
                          placeholder="Search company..."
                          value={selectedCompany ? selectedCompany.name : companySearch}
                          onChange={e => {
                            setCompanySearch(e.target.value);
                            field.onChange("");
                            setShowCompanyDropdown(true);
                          }}
                          onFocus={() => setShowCompanyDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                          data-testid="input-company-search"
                        />
                        {showCompanyDropdown && companySearch && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {filteredCompanies.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                                onMouseDown={() => {
                                  field.onChange(c.id);
                                  setCompanySearch(c.name);
                                  setShowCompanyDropdown(false);
                                }}
                                data-testid={`company-option-${c.id}`}
                              >
                                {c.name}
                              </button>
                            ))}
                            {filteredCompanies.length === 0 && (
                              <div className="px-4 py-3 text-sm text-muted-foreground">No companies found</div>
                            )}
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attestation Vendor *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-testid="select-vendor">
                          <SelectValue placeholder="Select attestation vendor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {attestationVendors.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                          ))}
                          {attestationVendors.length === 0 && (
                            <SelectItem value="none" disabled>No attestation vendors available</SelectItem>
                          )}
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
                      <FormLabel>Applicant Name (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Applicant's full name" {...field} data-testid="input-applicant-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Document Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Birth Certificate, Degree, Marriage Certificate" {...field} data-testid="input-document-type" />
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
                      <FormLabel>Document Name / Description *</FormLabel>
                      <FormControl>
                        <Input placeholder="Full document title or description" {...field} data-testid="input-document-name" />
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
                      <FormLabel>Document Class *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-testid="select-document-class">
                          <SelectValue placeholder="Select class..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Personal">Personal</SelectItem>
                          <SelectItem value="Business">Business</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {documentClass === "Personal" && (
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
                  name="descriptionOfNeed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description of Need *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the attestation requirement..."
                          rows={3}
                          {...field}
                          data-testid="textarea-description-of-need"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="externalWoNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>External WO Number (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="External work order reference" {...field} data-testid="input-external-wo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setLocation("/attestation/inquiries")} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-inquiry">
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Inquiry
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
