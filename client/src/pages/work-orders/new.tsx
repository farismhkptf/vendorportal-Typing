import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, User, FileText, ClipboardPaste, Check, AlertCircle, X, Phone, Mail, Star, RefreshCw, Home, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { useScrollToError } from "@/hooks/use-scroll-to-error";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Company, ServiceType, WorkOrder } from "@shared/schema";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { toProperCase } from "@/lib/proper-case";

const workOrderSchema = z.object({
  woNumber: z.string().min(1, "Work order number is required").regex(/^[A-Z]\d{5,6}$/, "Format: Letter + 5-6 digits (e.g., J016308)"),
  applicantName: z.string().min(1, "Applicant name is required"),
  applicantPhone: z.string().optional(),
  applicantEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  isVip: z.boolean().default(false),
  companyId: z.string().min(1, "Company is required"),
  serviceTypeId: z.string().optional(),
  notes: z.string().optional(),
});

type WorkOrderForm = z.infer<typeof workOrderSchema>;

interface ParsedWorkOrder {
  woNumber: string | null;
  companyName: string | null;
  matchedCompanyId: string | null;
  applicantName: string | null;
  serviceTypeName: string | null;
  matchedServiceTypeId: string | null;
}

interface ParseResult {
  success: boolean;
  parsed: ParsedWorkOrder;
  warnings: string[];
}

export default function NewWorkOrder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const form = useForm<WorkOrderForm>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      woNumber: "",
      applicantName: "",
      applicantPhone: "",
      applicantEmail: "",
      isVip: false,
      companyId: "",
      serviceTypeId: "",
      notes: "",
    },
  });

  useScrollToError(form.formState.errors, form.formState.isSubmitted);

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

  const { data: lastWorkOrder } = useQuery<WorkOrder | null>({
    queryKey: ["/api/companies", selectedCompanyId, "last-work-order"],
    enabled: !!selectedCompanyId,
  });

  const handleAutoFill = () => {
    if (lastWorkOrder) {
      if (lastWorkOrder.serviceTypeId) {
        form.setValue("serviceTypeId", lastWorkOrder.serviceTypeId);
      }
      if (lastWorkOrder.isVip !== undefined) {
        form.setValue("isVip", lastWorkOrder.isVip);
      }
      toast({
        title: "Auto-filled",
        description: "Form pre-filled with defaults from last work order.",
      });
    }
  };

  // Normalize text for fuzzy matching
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Find best company match using fuzzy matching
  const findBestCompanyMatch = useCallback((searchText: string): { id: string; name: string; score: number } | null => {
    if (!companies || companies.length === 0) return null;

    const normalizedSearch = normalizeText(searchText);
    let bestMatch: { id: string; name: string; score: number } | null = null;

    for (const company of companies) {
      const normalizedCompany = normalizeText(company.name);

      // Exact match = 100 points
      if (normalizedCompany === normalizedSearch) {
        return { id: company.id, name: company.name, score: 100 };
      }

      // Substring match = up to 80 points
      let score = 0;
      if (normalizedCompany.includes(normalizedSearch) || normalizedSearch.includes(normalizedCompany)) {
        score = Math.max(
          (normalizedSearch.length / normalizedCompany.length) * 80,
          (normalizedCompany.length / normalizedSearch.length) * 80
        );
      } else {
        // Word overlap match = up to 70 points
        const searchWords = normalizedSearch.split(" ");
        const companyWords = normalizedCompany.split(" ");
        const matchingWords = searchWords.filter(w =>
          companyWords.some(cw => cw.includes(w) || w.includes(cw))
        );
        score = (matchingWords.length / Math.max(searchWords.length, companyWords.length)) * 70;
      }

      if (score > (bestMatch?.score || 0)) {
        bestMatch = { id: company.id, name: company.name, score };
      }
    }

    // Minimum threshold: 40 points required
    return bestMatch && bestMatch.score >= 40 ? bestMatch : null;
  }, [companies]);

  // Find best service type match
  const findBestServiceTypeMatch = useCallback((searchText: string): { id: string; name: string; score: number } | null => {
    if (!serviceTypes || serviceTypes.length === 0) return null;

    const normalizedSearch = normalizeText(searchText);
    let bestMatch: { id: string; name: string; score: number } | null = null;

    for (const serviceType of serviceTypes) {
      const normalizedType = normalizeText(serviceType.name);

      if (normalizedType === normalizedSearch) {
        return { id: serviceType.id, name: serviceType.name, score: 100 };
      }

      let score = 0;
      if (normalizedType.includes(normalizedSearch) || normalizedSearch.includes(normalizedType)) {
        score = Math.max(
          (normalizedSearch.length / normalizedType.length) * 80,
          (normalizedType.length / normalizedSearch.length) * 80
        );
      } else {
        const searchWords = normalizedSearch.split(" ");
        const typeWords = normalizedType.split(" ");
        const matchingWords = searchWords.filter(w =>
          typeWords.some(tw => tw.includes(w) || w.includes(tw))
        );
        score = (matchingWords.length / Math.max(searchWords.length, typeWords.length)) * 70;
      }

      if (score > (bestMatch?.score || 0)) {
        bestMatch = { id: serviceType.id, name: serviceType.name, score };
      }
    }

    return bestMatch && bestMatch.score >= 40 ? bestMatch : null;
  }, [serviceTypes]);

  // Parse pasted data
  const parsePastedData = useCallback((text: string): ParseResult => {
    const parsed: ParsedWorkOrder = {
      woNumber: null,
      companyName: null,
      matchedCompanyId: null,
      applicantName: null,
      serviceTypeName: null,
      matchedServiceTypeId: null,
    };
    const warnings: string[] = [];

    // Split by tabs (Google Sheets/Excel format)
    const parts = text.split("\t").map(p => p.trim()).filter(p => p.length > 0);

    if (parts.length < 2) {
      return { success: false, parsed, warnings: ["Please paste a full row from your spreadsheet (tab-separated)"] };
    }

    // Step 1: Find WO Number (pattern: J016308, M250001, etc.)
    const woPattern = /^[JFMASOND]\d{2}\d{3,5}$/i;
    for (const part of parts) {
      if (woPattern.test(part)) {
        parsed.woNumber = part.toUpperCase();
        break;
      }
    }

    // Step 2: Find Company Name (look for business entity suffixes)
    for (const part of parts) {
      const upperPart = part.toUpperCase();
      if (
        upperPart.includes("L.L.C") ||
        upperPart.includes("LLC") ||
        upperPart.includes("EST") ||
        upperPart.includes("FZE") ||
        upperPart.includes("FZCO") ||
        upperPart.includes("CO.") ||
        upperPart.includes("COMPANY") ||
        (upperPart === part && part.length > 10)
      ) {
        parsed.companyName = part;
        const match = findBestCompanyMatch(part);
        if (match) {
          parsed.matchedCompanyId = match.id;
        } else {
          warnings.push(`Company "${part.substring(0, 30)}${part.length > 30 ? '...' : ''}" not found in system`);
        }
        break;
      }
    }

    // Step 3: Find Service Type (multiple keywords)
    const serviceKeywords = [
      "VISA", "PERMIT", "EMPLOYMENT", "DEPENDENT",
      "CANCEL", "RENEW", "AMEND", "GOLDEN",
      "NEW", "INSIDE", "OUTSIDE"
    ];
    for (const part of parts) {
      const upperPart = part.toUpperCase();
      const matchCount = serviceKeywords.filter(k => upperPart.includes(k)).length;

      if (matchCount >= 2) {
        parsed.serviceTypeName = part;
        const match = findBestServiceTypeMatch(part);
        if (match) {
          parsed.matchedServiceTypeId = match.id;
        }
        break;
      }
    }

    // Step 4: Find Person Name (exclusion-based detection)
    for (const part of parts) {
      // Skip already-identified fields
      if (part === parsed.woNumber || part === parsed.companyName || part === parsed.serviceTypeName) continue;

      // Skip dates (like "5-Jan-26")
      if (/^\d{1,2}[-/]\w+[-/]\d{2,4}$/.test(part)) continue;

      const words = part.split(/\s+/);

      // Check: 2-5 words, at least 2 starting with uppercase
      const hasUpperWords = words.filter(w =>
        w[0] === w[0]?.toUpperCase() && w.length > 1
      ).length;

      if (words.length >= 2 && words.length <= 5 && hasUpperWords >= 2) {
        // Exclude job titles and status words
        const notName = [
          "SALES", "OFFICER", "MANAGER", "ACCOUNTANT",
          "DRIVER", "CLEANER", "CEO", "ADMIN",
          "INSIDE", "OUTSIDE", "COMPLETED", "INVOICED"
        ];

        if (!notName.some(n => part.toUpperCase().includes(n))) {
          parsed.applicantName = part;
          break;
        }
      }
    }

    const success = parsed.matchedCompanyId !== null || parsed.applicantName !== null;

    return { success, parsed, warnings };
  }, [findBestCompanyMatch, findBestServiceTypeMatch]);

  // Handle parse button click
  const handleParse = useCallback(() => {
    const result = parsePastedData(pasteValue);
    setParseResult(result);
  }, [pasteValue, parsePastedData]);

  // Handle Enter key in textarea
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleParse();
    }
  }, [handleParse]);

  // Apply parsed data to form
  const applyParsedData = useCallback(() => {
    if (!parseResult?.parsed) return;

    const { parsed } = parseResult;

    if (parsed.woNumber) form.setValue("woNumber", parsed.woNumber);
    if (parsed.applicantName) form.setValue("applicantName", toProperCase(parsed.applicantName));
    if (parsed.matchedCompanyId) form.setValue("companyId", parsed.matchedCompanyId);
    if (parsed.matchedServiceTypeId) form.setValue("serviceTypeId", parsed.matchedServiceTypeId);

    // Close paste area and reset
    setShowPasteArea(false);
    setPasteValue("");
    setParseResult(null);

    toast({ title: "Form auto-filled from pasted data" });
  }, [parseResult, form, toast]);

  return (
    <AppLayout>
      <PageHeader
        title="New Work Order"
        subtitle="Create a new work order for an applicant"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={showPasteArea ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setShowPasteArea(!showPasteArea);
                if (!showPasteArea) {
                  setPasteValue("");
                  setParseResult(null);
                }
              }}
              className="gap-1.5"
              data-testid="button-toggle-paste"
            >
              <ClipboardPaste className="h-4 w-4" />
              {showPasteArea ? "Hide Quick Paste" : "Quick Paste"}
            </Button>
            <div className="flex items-center gap-1">
              <Link href="/work-orders">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-home">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        }
      />

      <div className="p-4 lg:p-8 max-w-3xl space-y-6">
        {/* Quick Paste Area */}
        {showPasteArea && (
          <Card className="border-primary/30 bg-primary/5" data-testid="card-quick-paste">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Quick Paste from Google Sheet</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowPasteArea(false);
                    setPasteValue("");
                    setParseResult(null);
                  }}
                  data-testid="button-close-paste"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Textarea
                  placeholder="Paste a row from your spreadsheet here and press Enter..."
                  value={pasteValue}
                  onChange={(e) => {
                    setPasteValue(e.target.value);
                    setParseResult(null);
                  }}
                  onKeyDown={handleKeyDown}
                  className="min-h-20 resize-none text-sm"
                  data-testid="textarea-quick-paste"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Copy a row from your Google Sheet and paste it here. The system will detect the company, applicant name, and service type.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleParse}
                  disabled={!pasteValue.trim()}
                  data-testid="button-parse-data"
                >
                  Parse Data
                </Button>

                {parseResult?.success && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={applyParsedData}
                    className="gap-1.5"
                    data-testid="button-apply-parsed"
                  >
                    <Check className="h-4 w-4" />
                    Apply to Form
                  </Button>
                )}
              </div>

              {/* Parse Results */}
              {parseResult && (
                <div className="space-y-3" data-testid="parse-results">
                  {parseResult.success ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Detected Fields:</p>
                      <div className="flex flex-wrap gap-2">
                        {parseResult.parsed.matchedCompanyId && (
                          <Badge variant="secondary" className="gap-1.5">
                            <Building2 className="h-3 w-3" />
                            {companies?.find(c => c.id === parseResult.parsed.matchedCompanyId)?.name.substring(0, 30)}
                          </Badge>
                        )}
                        {parseResult.parsed.applicantName && (
                          <Badge variant="secondary" className="gap-1.5">
                            <User className="h-3 w-3" />
                            {parseResult.parsed.applicantName}
                          </Badge>
                        )}
                        {parseResult.parsed.matchedServiceTypeId && (
                          <Badge variant="secondary" className="gap-1.5">
                            <FileText className="h-3 w-3" />
                            {serviceTypes?.find(s => s.id === parseResult.parsed.matchedServiceTypeId)?.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      No usable data detected
                    </div>
                  )}

                  {parseResult.warnings.length > 0 && (
                    <div className="space-y-1">
                      {parseResult.warnings.map((warning, i) => (
                        <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3" />
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Work Order Number */}
            <Card className="border border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Work Order Number</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Unique identifier for this order</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="woNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">WO Number <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., J016308"
                          className="h-11 uppercase font-mono text-lg tracking-wider"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          data-testid="input-wo-number"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">Format: Letter + 5-6 digits (e.g., J016308)</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Applicant Details */}
            <Card className="border border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">Applicant Details</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Personal information and contact</p>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="isVip"
                    render={({ field }) => (
                      <Button
                        type="button"
                        variant={field.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.onChange(!field.value)}
                        className={cn(
                          "gap-2 rounded-full transition-all",
                          field.value && "bg-amber-500 text-white border-amber-500"
                        )}
                        data-testid="button-vip-toggle"
                      >
                        <Star className={cn("h-4 w-4", field.value && "fill-current")} />
                        {field.value ? "VIP" : "Mark VIP"}
                      </Button>
                    )}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="applicantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Full Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter applicant's full name"
                          className="h-11"
                          data-testid="input-applicant-name"
                          onBlur={(e) => {
                            field.onBlur();
                            if (e.target.value) {
                              form.setValue("applicantName", toProperCase(e.target.value));
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="applicantPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Contact Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <MaskedInput
                              mask="phone"
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="+971 50 123 4567"
                              className="pl-10 h-11"
                              aria-label="Applicant phone number"
                              data-testid="input-applicant-phone"
                            />
                          </div>
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
                        <FormLabel className="text-sm font-medium">Email Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="email"
                              inputMode="email"
                              autoComplete="email"
                              placeholder="applicant@email.com"
                              className="pl-10 h-11"
                              aria-label="Applicant email address"
                              data-testid="input-applicant-email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Company Selection */}
            <Card className="border border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Company</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Client organization for this work order</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Select Company <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11" data-testid="select-company">
                            <SelectValue placeholder="Choose a company" />
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

                {selectedCompany && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/30" data-testid="company-snapshot">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{selectedCompany.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Company preferences and staff will apply to this work order
                        </p>
                      </div>
                      {lastWorkOrder && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAutoFill}
                          className="gap-1.5"
                          data-testid="button-auto-fill"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Auto-fill
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Type & Notes - Combined Card */}
            <Card className="border border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Service Details</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Type of service and additional notes</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="serviceTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Service Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11" data-testid="select-service-type">
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
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Add any additional notes or instructions..."
                          className="min-h-20 resize-none"
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

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
                className="gap-2"
                data-testid="button-create-work-order"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {createMutation.isPending ? "Creating..." : "Create Work Order"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
