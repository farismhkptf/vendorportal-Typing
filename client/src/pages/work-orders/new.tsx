import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, User, FileText, ClipboardPaste, Check, AlertCircle, AlertTriangle, X, Phone, Mail, Star, RefreshCw, Home, Loader2, Stethoscope, CreditCard, Info } from "lucide-react";
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
import { ToastAction } from "@/components/ui/toast";
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
  companyConfidence: 'high' | 'medium' | 'low' | null;
  companyCandidates: Array<{ id: string; name: string; score: number }> | null;
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

      const autoCreatedJobs: { id: string; jobCode: string; category: string; label: string }[] = wo.autoCreatedJobs || [];

      if (autoCreatedJobs.length > 0) {
        const jobSummary = autoCreatedJobs.map(j => `${j.label} (${j.jobCode})`).join(", ");
        const woId = wo.id;
        toast({
          title: `Work order ${wo.woNumber} created`,
          description: `Draft typing jobs auto-created: ${jobSummary}.`,
          action: (
            <ToastAction
              altText="View typing jobs"
              onClick={() => setLocation(`/work-orders/${woId}?tab=typing`)}
            >
              View Jobs
            </ToastAction>
          ),
        });
      } else {
        toast({
          title: "Work order created",
          description: `Work order ${wo.woNumber} has been created successfully.`,
        });
      }
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
  const selectedServiceTypeId = form.watch("serviceTypeId");
  const selectedCompany = companies?.find((c) => c.id === selectedCompanyId);
  const selectedServiceType = serviceTypes?.find((s) => s.id === selectedServiceTypeId);

  const getAutoCreatedJobLabels = (st: typeof selectedServiceType): string[] => {
    if (!st) return [];
    const labels: string[] = [];
    if (st.requiresMedicalTyping) labels.push("Medical Typing");
    if (st.requiresIdTyping2Years) labels.push("EID Typing (2 Years)");
    if (st.requiresIdTyping1Year) labels.push("EID Typing (1 Year)");
    if (st.requiresIdTyping10Years) labels.push("EID Typing (10 Years)");
    return labels;
  };

  const autoCreatedJobLabels = getAutoCreatedJobLabels(selectedServiceType);

  const watchedApplicantName = form.watch("applicantName");
  const [debouncedApplicantName, setDebouncedApplicantName] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedApplicantName(watchedApplicantName || "");
    }, 500);
    return () => clearTimeout(timer);
  }, [watchedApplicantName]);

  const { data: duplicateData } = useQuery<{ duplicates: Array<{ id: string; woNumber: string; applicantName: string; companyName: string; status: string; createdAt: string }> }>({
    queryKey: ["/api/work-orders/check-duplicate", debouncedApplicantName],
    queryFn: async () => {
      const res = await fetch(`/api/work-orders/check-duplicate?applicantName=${encodeURIComponent(debouncedApplicantName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check duplicates");
      return res.json();
    },
    enabled: debouncedApplicantName.length >= 3,
  });

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

  // Score a single company against a search string.
  // Score is always in the range 0–100.
  // Scoring is conservative: length asymmetry penalises the score proportionally,
  // so a short company name matching inside a much longer string stays low-confidence.
  const scoreCompany = useCallback((searchText: string, companyName: string): number => {
    const normalizedSearch = normalizeText(searchText);
    const normalizedCompany = normalizeText(companyName);

    // Exact match = 100
    if (normalizedCompany === normalizedSearch) return 100;

    // Substring containment: score = (shorter / longer) * 80
    // Using min/max here (not max alone) ensures length asymmetry is penalised.
    // e.g. "ABC" inside "ABC Trading LLC" → (3/15)*80 ≈ 16 (low)
    // e.g. "ABC Trading" inside "ABC Trading LLC" → (11/15)*80 ≈ 59 (medium)
    if (normalizedCompany.includes(normalizedSearch) || normalizedSearch.includes(normalizedCompany)) {
      const shorter = Math.min(normalizedSearch.length, normalizedCompany.length);
      const longer = Math.max(normalizedSearch.length, normalizedCompany.length);
      return (shorter / longer) * 80;
    }

    // Word-overlap fallback: (matching words / total distinct words) * 60
    // Cap at 60 so word-overlap alone can never reach high-confidence threshold (65).
    const searchWords = normalizedSearch.split(" ");
    const companyWords = normalizedCompany.split(" ");
    const matchingWords = searchWords.filter(w =>
      companyWords.some(cw => cw.includes(w) || w.includes(cw))
    );
    return (matchingWords.length / Math.max(searchWords.length, companyWords.length)) * 60;
  }, []);

  // Return all company matches above a minimum score, sorted by score desc
  const findCompanyMatches = useCallback((searchText: string, minScore = 30): Array<{ id: string; name: string; score: number }> => {
    if (!companies || companies.length === 0) return [];

    const results: Array<{ id: string; name: string; score: number }> = [];

    for (const company of companies) {
      const score = scoreCompany(searchText, company.name);
      if (score >= minScore) {
        results.push({ id: company.id, name: company.name, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }, [companies, scoreCompany]);

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
      companyConfidence: null,
      companyCandidates: null,
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
        const candidates = findCompanyMatches(part, 30);
        const best = candidates[0] ?? null;

        if (best && best.score >= 65) {
          // High confidence — auto-resolve
          parsed.matchedCompanyId = best.id;
          parsed.companyConfidence = 'high';
        } else if (best && best.score >= 40) {
          // Medium confidence — show candidates, require explicit selection
          parsed.companyConfidence = 'medium';
          parsed.companyCandidates = candidates.filter(c => c.score >= 40).slice(0, 5);
        } else {
          // Low confidence — unknown company
          parsed.companyConfidence = 'low';
          warnings.push(`Company not found in system`);
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

    // Step 4: Find Person Name (positional, exclusion-based detection)
    // Prefer parts that appear after the company name and before the service type
    const companyIndex = parsed.companyName ? parts.indexOf(parsed.companyName) : -1;
    const serviceIndex = parsed.serviceTypeName ? parts.indexOf(parsed.serviceTypeName) : parts.length;

    const notName = [
      "SALES", "OFFICER", "MANAGER", "ACCOUNTANT",
      "DRIVER", "CLEANER", "CEO", "ADMIN",
      "INSIDE", "OUTSIDE", "COMPLETED", "INVOICED",
      "SOFTWARE", "DEVELOPER", "ENGINEER", "ANALYST",
      "TECHNICIAN", "COORDINATOR", "SPECIALIST", "CONSULTANT",
      "ASSISTANT", "SUPERVISOR", "EXECUTIVE", "DIRECTOR",
      "CONTROLLER", "SECRETARY", "REPRESENTATIVE", "ASSOCIATE", "INTERN"
    ];

    const isNameCandidate = (part: string): boolean => {
      if (part === parsed.woNumber || part === parsed.companyName || part === parsed.serviceTypeName) return false;
      if (/^\d{1,2}[-/]\w+[-/]\d{2,4}$/.test(part)) return false;

      const words = part.split(/\s+/);
      if (words.length < 2 || words.length > 7) return false;

      const hasUpperWords = words.filter(w => w[0] === w[0]?.toUpperCase() && w.length > 1).length;
      if (hasUpperWords < 2) return false;

      return !notName.some(n => part.toUpperCase().includes(n));
    };

    // Try positional window first (between company and service type)
    const positionalParts = companyIndex >= 0
      ? parts.slice(companyIndex + 1, serviceIndex > 0 ? serviceIndex : undefined)
      : [];

    let foundName = false;
    for (const part of positionalParts) {
      if (isNameCandidate(part)) {
        parsed.applicantName = part;
        foundName = true;
        break;
      }
    }

    // Fall back to full scan if positional search yielded nothing
    if (!foundName) {
      for (const part of parts) {
        if (isNameCandidate(part)) {
          parsed.applicantName = part;
          break;
        }
      }
    }

    const success =
      parsed.matchedCompanyId !== null ||
      parsed.applicantName !== null ||
      parsed.companyConfidence === 'medium' ||
      parsed.woNumber !== null ||
      parsed.matchedServiceTypeId !== null;

    return { success, parsed, warnings };
  }, [findCompanyMatches, findBestServiceTypeMatch]);

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
              <div className="flex items-center justify-between gap-2">
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

                  {/* Company confidence — always rendered when a company part was detected */}
                  {parseResult.parsed.companyConfidence === 'high' && parseResult.parsed.matchedCompanyId && (
                    <Badge variant="secondary" className="gap-1.5" data-testid="badge-company-high">
                      <Building2 className="h-3 w-3" />
                      {companies?.find(c => c.id === parseResult.parsed.matchedCompanyId)?.name.substring(0, 30)}
                    </Badge>
                  )}

                  {parseResult.parsed.companyConfidence === 'medium' && parseResult.parsed.companyCandidates && (
                    <div className="space-y-1.5" data-testid="company-candidates">
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Possible match — select the correct company:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {parseResult.parsed.companyCandidates.map(candidate => (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => setParseResult(prev => prev ? {
                              ...prev,
                              parsed: { ...prev.parsed, matchedCompanyId: candidate.id }
                            } : null)}
                            data-testid={`candidate-company-${candidate.id}`}
                          >
                            <Badge
                              variant={parseResult.parsed.matchedCompanyId === candidate.id ? "default" : "outline"}
                              className="gap-1.5 cursor-pointer hover:bg-secondary/80 transition-colors"
                            >
                              <Building2 className="h-3 w-3" />
                              {candidate.name.substring(0, 30)}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Low confidence — always visible regardless of other detected fields */}
                  {parseResult.parsed.companyConfidence === 'low' && parseResult.parsed.companyName && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive" data-testid="company-not-found">
                      <AlertCircle className="h-3 w-3" />
                      <span>
                        Company not found in system: &ldquo;{parseResult.parsed.companyName.substring(0, 40)}{parseResult.parsed.companyName.length > 40 ? '…' : ''}&rdquo;
                      </span>
                    </div>
                  )}

                  {/* Other detected fields */}
                  {parseResult.success ? (
                    <div className="space-y-2">
                      {(parseResult.parsed.applicantName || parseResult.parsed.matchedServiceTypeId || parseResult.parsed.woNumber) && (
                        <p className="text-sm font-medium text-foreground">Detected Fields:</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {parseResult.parsed.applicantName && (
                          <Badge variant="secondary" className="gap-1.5" data-testid="badge-applicant">
                            <User className="h-3 w-3" />
                            {parseResult.parsed.applicantName}
                          </Badge>
                        )}
                        {parseResult.parsed.matchedServiceTypeId && (
                          <Badge variant="secondary" className="gap-1.5" data-testid="badge-service-type">
                            <FileText className="h-3 w-3" />
                            {serviceTypes?.find(s => s.id === parseResult.parsed.matchedServiceTypeId)?.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : !parseResult.parsed.companyName ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      No usable data detected
                    </div>
                  ) : null}

                  {/* Non-company warnings only (company-not-found is shown inline above) */}
                  {parseResult.warnings.filter(w => !w.startsWith('Company not found')).length > 0 && (
                    <div className="space-y-1">
                      {parseResult.warnings
                        .filter(w => !w.startsWith('Company not found'))
                        .map((warning, i) => (
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
                    <CardTitle className="text-base font-semibold tracking-tight">Work Order Number</CardTitle>
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold tracking-tight">Applicant Details</CardTitle>
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
                      {duplicateData && duplicateData.duplicates.length > 0 && (
                        <div
                          className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 mt-2"
                          data-testid="duplicate-warning"
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div className="space-y-1.5">
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                Possible duplicate: An active work order for this applicant already exists
                              </p>
                              <div className="space-y-1">
                                {duplicateData.duplicates.map((dup) => (
                                  <button
                                    key={dup.id}
                                    type="button"
                                    className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 hover-elevate rounded px-1.5 py-0.5 w-full text-left"
                                    onClick={() => window.open('/work-orders/' + dup.id, '_blank')}
                                    data-testid={`duplicate-link-${dup.id}`}
                                  >
                                    <span className="font-mono font-medium">{dup.woNumber}</span>
                                    <span className="text-amber-600 dark:text-amber-500">{dup.companyName}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{dup.status}</Badge>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
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
                    <CardTitle className="text-base font-semibold tracking-tight">Company</CardTitle>
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
                    <div className="flex items-center justify-between gap-2">
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
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold tracking-tight">Service Details</CardTitle>
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

                {selectedServiceType && (
                  <div
                    className={`p-3 rounded-lg border text-sm ${
                      autoCreatedJobLabels.length > 0
                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                        : "bg-muted/40 border-border/40"
                    }`}
                    data-testid="auto-creation-preview"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-blue-700 dark:text-blue-300 text-xs">Jobs that will be auto-created</span>
                    </div>
                    {autoCreatedJobLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {autoCreatedJobLabels.map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800"
                            data-testid={`auto-job-label-${label.replace(/\s+/g, "-").toLowerCase()}`}
                          >
                            {label.startsWith("Medical") ? <Stethoscope className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No typing jobs will be auto-created for this service type.</p>
                    )}
                  </div>
                )}

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
