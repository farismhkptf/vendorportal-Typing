import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, Building2, User, FileText, Star, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toProperCase } from "@/lib/proper-case";
import type { Company, ServiceType } from "@shared/schema";
import {
  ChatMessage,
  ChatContainer,
  ChatInput,
  OptionButtons,
} from "@/components/ui/bot-chat";

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

let msgId = 0;
function nextId() {
  return `msg-${++msgId}`;
}

export default function QuickPasteBot() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const initRef = useRef(false);

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const addBotMessage = useCallback((content: string | React.ReactNode) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "bot", content, timestamp: new Date() },
    ]);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content, timestamp: new Date() },
    ]);
  }, []);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      setTimeout(() => {
        addBotMessage(
          "Paste your work order row from the spreadsheet. I'll parse and create it for you."
        );
      }, 300);
    }
  }, [addBotMessage]);

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const findBestCompanyMatch = useCallback(
    (
      searchText: string
    ): { id: string; name: string; score: number } | null => {
      if (!companies || companies.length === 0) return null;
      const normalizedSearch = normalizeText(searchText);
      let bestMatch: { id: string; name: string; score: number } | null = null;

      for (const company of companies) {
        const normalizedCompany = normalizeText(company.name);
        if (normalizedCompany === normalizedSearch) {
          return { id: company.id, name: company.name, score: 100 };
        }

        let score = 0;
        if (
          normalizedCompany.includes(normalizedSearch) ||
          normalizedSearch.includes(normalizedCompany)
        ) {
          score = Math.max(
            (normalizedSearch.length / normalizedCompany.length) * 80,
            (normalizedCompany.length / normalizedSearch.length) * 80
          );
        } else {
          const searchWords = normalizedSearch.split(" ");
          const companyWords = normalizedCompany.split(" ");
          const matchingWords = searchWords.filter((w) =>
            companyWords.some((cw) => cw.includes(w) || w.includes(cw))
          );
          score =
            (matchingWords.length /
              Math.max(searchWords.length, companyWords.length)) *
            70;
        }

        if (score > (bestMatch?.score || 0)) {
          bestMatch = { id: company.id, name: company.name, score };
        }
      }

      return bestMatch && bestMatch.score >= 40 ? bestMatch : null;
    },
    [companies]
  );

  const findBestServiceTypeMatch = useCallback(
    (
      searchText: string
    ): { id: string; name: string; score: number } | null => {
      if (!serviceTypes || serviceTypes.length === 0) return null;
      const normalizedSearch = normalizeText(searchText);
      let bestMatch: { id: string; name: string; score: number } | null = null;

      for (const serviceType of serviceTypes) {
        const normalizedType = normalizeText(serviceType.name);
        if (normalizedType === normalizedSearch) {
          return { id: serviceType.id, name: serviceType.name, score: 100 };
        }

        let score = 0;
        if (
          normalizedType.includes(normalizedSearch) ||
          normalizedSearch.includes(normalizedType)
        ) {
          score = Math.max(
            (normalizedSearch.length / normalizedType.length) * 80,
            (normalizedType.length / normalizedSearch.length) * 80
          );
        } else {
          const searchWords = normalizedSearch.split(" ");
          const typeWords = normalizedType.split(" ");
          const matchingWords = searchWords.filter((w) =>
            typeWords.some((tw) => tw.includes(w) || w.includes(tw))
          );
          score =
            (matchingWords.length /
              Math.max(searchWords.length, typeWords.length)) *
            70;
        }

        if (score > (bestMatch?.score || 0)) {
          bestMatch = { id: serviceType.id, name: serviceType.name, score };
        }
      }

      return bestMatch && bestMatch.score >= 40 ? bestMatch : null;
    },
    [serviceTypes]
  );

  const parsePastedData = useCallback(
    (text: string): ParseResult => {
      const parsed: ParsedWorkOrder = {
        woNumber: null,
        companyName: null,
        matchedCompanyId: null,
        applicantName: null,
        serviceTypeName: null,
        matchedServiceTypeId: null,
      };
      const warnings: string[] = [];

      const parts = text
        .split("\t")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (parts.length < 2) {
        return {
          success: false,
          parsed,
          warnings: [
            "Please paste a full row from your spreadsheet (tab-separated)",
          ],
        };
      }

      const woPattern = /^[JFMASOND]\d{2}\d{3,5}$/i;
      for (const part of parts) {
        if (woPattern.test(part)) {
          parsed.woNumber = part.toUpperCase();
          break;
        }
      }

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
            warnings.push(
              `Company "${part.substring(0, 30)}${part.length > 30 ? "..." : ""}" not found in system`
            );
          }
          break;
        }
      }

      const serviceKeywords = [
        "VISA",
        "PERMIT",
        "EMPLOYMENT",
        "DEPENDENT",
        "CANCEL",
        "RENEW",
        "AMEND",
        "GOLDEN",
        "NEW",
        "INSIDE",
        "OUTSIDE",
      ];
      for (const part of parts) {
        const upperPart = part.toUpperCase();
        const matchCount = serviceKeywords.filter((k) =>
          upperPart.includes(k)
        ).length;

        if (matchCount >= 2) {
          parsed.serviceTypeName = part;
          const match = findBestServiceTypeMatch(part);
          if (match) {
            parsed.matchedServiceTypeId = match.id;
          }
          break;
        }
      }

      for (const part of parts) {
        if (
          part === parsed.woNumber ||
          part === parsed.companyName ||
          part === parsed.serviceTypeName
        )
          continue;
        if (/^\d{1,2}[-/]\w+[-/]\d{2,4}$/.test(part)) continue;

        const words = part.split(/\s+/);
        const hasUpperWords = words.filter(
          (w) => w[0] === w[0]?.toUpperCase() && w.length > 1
        ).length;

        if (words.length >= 2 && words.length <= 5 && hasUpperWords >= 2) {
          const notName = [
            "SALES",
            "OFFICER",
            "MANAGER",
            "ACCOUNTANT",
            "DRIVER",
            "CLEANER",
            "CEO",
            "ADMIN",
            "INSIDE",
            "OUTSIDE",
            "COMPLETED",
            "INVOICED",
          ];
          if (!notName.some((n) => part.toUpperCase().includes(n))) {
            parsed.applicantName = part;
            break;
          }
        }
      }

      const success =
        parsed.matchedCompanyId !== null || parsed.applicantName !== null;
      return { success, parsed, warnings };
    },
    [findBestCompanyMatch, findBestServiceTypeMatch]
  );

  const createMutation = useMutation({
    mutationFn: async (data: {
      woNumber: string;
      applicantName: string;
      companyId: string;
      serviceTypeId?: string;
      isVip: boolean;
    }) => {
      return apiRequest("POST", "/api/work-orders", data);
    },
    onSuccess: async (response) => {
      const wo = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setParseResult(null);
      setTimeout(() => {
        addBotMessage(
          <div>
            <p className="mb-2">Work order created successfully.</p>
            <Link href={`/work-orders/${wo.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-view-wo">
                <ExternalLink className="h-3.5 w-3.5" />
                View {wo.woNumber}
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground mt-3">
              Paste another row to create more, or go back.
            </p>
          </div>
        );
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create work order",
        variant: "destructive",
      });
      setTimeout(() => {
        addBotMessage(
          "Something went wrong creating the work order. Please try pasting again."
        );
      }, 500);
    },
  });

  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return;
    const text = input.trim();
    setInput("");
    addUserMessage(text);
    setIsProcessing(true);

    setTimeout(() => {
      const result = parsePastedData(text);

      if (!result.success) {
        addBotMessage(
          <div>
            <p>I couldn't parse that data.</p>
            {result.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {w}
              </p>
            ))}
            <p className="text-xs text-muted-foreground mt-2">
              Try pasting a full row from your spreadsheet.
            </p>
          </div>
        );
        setIsProcessing(false);
        return;
      }

      setParseResult(result);

      const companyName = result.parsed.matchedCompanyId
        ? companies?.find((c) => c.id === result.parsed.matchedCompanyId)?.name
        : result.parsed.companyName;

      const serviceTypeName = result.parsed.matchedServiceTypeId
        ? serviceTypes?.find(
            (s) => s.id === result.parsed.matchedServiceTypeId
          )?.name
        : result.parsed.serviceTypeName;

      addBotMessage(
        <div>
          <p className="mb-3">Here is what I found:</p>
          <Card className="border border-border/50" data-testid="card-parsed-result">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">WO Number:</span>
                <span className="text-sm font-medium font-mono">
                  {result.parsed.woNumber || "Not detected"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Applicant:</span>
                <span className="text-sm font-medium">
                  {result.parsed.applicantName
                    ? toProperCase(result.parsed.applicantName)
                    : "Not detected"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Company:</span>
                <span className="text-sm font-medium">
                  {companyName || "Not matched"}
                </span>
                {!result.parsed.matchedCompanyId && result.parsed.companyName && (
                  <Badge variant="secondary" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not found
                  </Badge>
                )}
              </div>
              {serviceTypeName && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Service:</span>
                  <span className="text-sm font-medium">{serviceTypeName}</span>
                </div>
              )}
            </CardContent>
          </Card>
          {result.warnings.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          )}
          <OptionButtons
            options={[
              {
                label: "Create Work Order",
                value: "create",
                variant: "default",
              },
              { label: "Cancel", value: "cancel", variant: "outline" },
            ]}
            onSelect={(val) => {
              if (val === "create") {
                handleCreateWorkOrder(result);
              } else {
                handleCancel();
              }
            }}
          />
        </div>
      );
      setIsProcessing(false);
    }, 500);
  }, [
    input,
    isProcessing,
    addUserMessage,
    addBotMessage,
    parsePastedData,
    companies,
    serviceTypes,
  ]);

  const handleCreateWorkOrder = useCallback(
    (result: ParseResult) => {
      const { parsed } = result;

      if (!parsed.woNumber || !parsed.matchedCompanyId) {
        addBotMessage(
          "I need at least a WO number and a matched company to create a work order. Please paste again with more data."
        );
        return;
      }

      addUserMessage("Create Work Order");

      createMutation.mutate({
        woNumber: parsed.woNumber,
        applicantName: parsed.applicantName
          ? toProperCase(parsed.applicantName)
          : "Unknown Applicant",
        companyId: parsed.matchedCompanyId,
        serviceTypeId: parsed.matchedServiceTypeId || undefined,
        isVip: false,
      });
    },
    [addUserMessage, addBotMessage, createMutation]
  );

  const handleCancel = useCallback(() => {
    addUserMessage("Cancel");
    setParseResult(null);
    setTimeout(() => {
      addBotMessage(
        "No problem. Paste another row whenever you're ready."
      );
    }, 500);
  }, [addUserMessage, addBotMessage]);

  return (
    <AppLayout>
      <PageHeader
        title="Quick Paste WO"
        subtitle="Paste spreadsheet data to create work orders"
        breadcrumbs={[
          { label: "Bots", href: "/bots" },
          { label: "Quick Paste WO" },
        ]}
      />
      <div className="flex flex-col h-[calc(100vh-72px-105px)]">
        <ChatContainer messages={messages}>
          {(isProcessing || createMutation.isPending) && (
            <div className="flex justify-start" data-testid="bot-thinking">
              <div className="max-w-[80%] rounded-2xl bg-muted/50 px-4 py-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Bot</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {createMutation.isPending
                    ? "Creating work order..."
                    : "Parsing..."}
                </div>
              </div>
            </div>
          )}
        </ChatContainer>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          placeholder="Paste a row from your spreadsheet..."
          disabled={isProcessing || createMutation.isPending}
          multiline
        />
      </div>
    </AppLayout>
  );
}
