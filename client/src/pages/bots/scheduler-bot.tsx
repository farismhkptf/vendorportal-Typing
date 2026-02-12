import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, User, Building2, Star, Loader2, MapPin, Clock,
  Calendar, Hash, Check, Copy, Stethoscope, CreditCard,
  Mail, MessageCircle, Maximize2, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { toProperCase } from "@/lib/proper-case";
import { MedicalAppointmentEmail, generateMedicalAppointmentEmailHtml } from "@/components/email-templates/medical-appointment-email";
import { EidAppointmentEmail, generateEidAppointmentEmailHtml } from "@/components/email-templates/eid-appointment-email";
import type { Company, ServiceType, WorkOrder, Center, Staff } from "@shared/schema";
import {
  ChatMessage,
  ChatContainer,
  ChatInput,
  OptionButtons,
} from "@/components/ui/bot-chat";

type Step = "search" | "confirm" | "chooseType" | "centerInfo" | "details" | "generateMessages";

let msgId = 0;
function nextId() {
  return `msg-${++msgId}`;
}

const formatTime12h = (time24: string) => {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  const h = parseInt(hours, 10);
  const m = minutes || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

export default function SchedulerBot() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("search");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [appointmentType, setAppointmentType] = useState<"Medical" | "EID" | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [showAllCenters, setShowAllCenters] = useState(false);
  const [filteredCenters, setFilteredCenters] = useState<Center[]>([]);
  const [preferredCenterId, setPreferredCenterId] = useState<string | null>(null);

  const [appNumber, setAppNumber] = useState("");
  const [aptDate, setAptDate] = useState("");
  const [aptTime, setAptTime] = useState("");
  const [aptNotes, setAptNotes] = useState("");

  const [messageCopied, setMessageCopied] = useState<"email" | "whatsapp" | null>(null);
  const [emailFullscreen, setEmailFullscreen] = useState(false);

  const processedStepRef = useRef<string>("");
  const initRef = useRef(false);

  const { data: workOrders } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
  });
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });
  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });
  const { data: centers } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
  });
  const { data: staffList } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const getCompany = useCallback(
    (id: string | null | undefined) => {
      if (!id || !companies) return null;
      return companies.find((c) => c.id === id) || null;
    },
    [companies]
  );

  const getCompanyName = useCallback(
    (id: string | null | undefined) => getCompany(id)?.name || "Unknown",
    [getCompany]
  );

  const getServiceTypeName = useCallback(
    (id: string | null | undefined) => {
      if (!id || !serviceTypes) return "N/A";
      return serviceTypes.find((s) => s.id === id)?.name || "N/A";
    },
    [serviceTypes]
  );

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
        addBotMessage("Enter a WO number or applicant name to find the work order.");
      }, 300);
    }
  }, [addBotMessage]);

  const handleConfirmWO = useCallback((wo: WorkOrder) => {
    setSelectedWO(wo);
    setStep("confirm");
  }, []);

  const handleSearch = useCallback(
    (searchText: string) => {
      if (!workOrders) {
        addBotMessage("Still loading work orders. Please try again in a moment.");
        return;
      }
      const text = searchText.toLowerCase().trim();
      const matches = workOrders.filter(
        (wo) =>
          wo.woNumber.toLowerCase().includes(text) ||
          wo.applicantName.toLowerCase().includes(text)
      );
      if (matches.length === 0) {
        addBotMessage("No work order found. Try again.");
        return;
      }
      if (matches.length === 1) {
        handleConfirmWO(matches[0]);
        return;
      }
      addBotMessage(
        <div>
          <p className="mb-3">I found {matches.length} work orders. Please pick one:</p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {matches.slice(0, 10).map((wo) => (
              <Button
                key={wo.id}
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-left"
                onClick={() => {
                  addUserMessage(`Selected ${wo.woNumber}`);
                  handleConfirmWO(wo);
                }}
                data-testid={`button-select-wo-${wo.id}`}
              >
                <span className="font-mono text-xs">{wo.woNumber}</span>
                <span className="text-muted-foreground">-</span>
                <span className="truncate">{toProperCase(wo.applicantName)}</span>
                {wo.isVip && (
                  <Badge variant="secondary" className="ml-auto shrink-0">
                    <Star className="h-3 w-3 mr-0.5" />
                    VIP
                  </Badge>
                )}
              </Button>
            ))}
            {matches.length > 10 && (
              <p className="text-xs text-muted-foreground">
                Showing first 10 of {matches.length} results. Try a more specific search.
              </p>
            )}
          </div>
        </div>
      );
    },
    [workOrders, addBotMessage, addUserMessage, handleConfirmWO]
  );

  // Step: confirm WO
  useEffect(() => {
    if (step === "confirm" && selectedWO && processedStepRef.current !== `confirm-${selectedWO.id}`) {
      processedStepRef.current = `confirm-${selectedWO.id}`;
      const wo = selectedWO;
      const timer = setTimeout(() => {
        addBotMessage(
          <div>
            <p className="mb-3">Is this the correct work order?</p>
            <Card className="border border-border/50" data-testid="card-wo-confirm">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">WO Number:</span>
                  <span className="text-sm font-medium font-mono">{wo.woNumber}</span>
                  {wo.isVip && (
                    <Badge variant="secondary" className="ml-1">
                      <Star className="h-3 w-3 mr-0.5" />
                      VIP
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Applicant:</span>
                  <span className="text-sm font-medium">{toProperCase(wo.applicantName)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Company:</span>
                  <span className="text-sm font-medium">{getCompanyName(wo.companyId)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Service:</span>
                  <span className="text-sm font-medium">{getServiceTypeName(wo.serviceTypeId)}</span>
                </div>
              </CardContent>
            </Card>
            <OptionButtons
              options={[
                { label: "Correct, proceed", value: "proceed", variant: "default" },
                { label: "Search again", value: "search", variant: "outline" },
              ]}
              onSelect={(val) => {
                if (val === "proceed") {
                  addUserMessage("Correct, proceed");
                  setStep("chooseType");
                } else {
                  addUserMessage("Search again");
                  setSelectedWO(null);
                  setStep("search");
                  processedStepRef.current = "";
                  setTimeout(() => {
                    addBotMessage("Enter a WO number or applicant name to find the work order.");
                  }, 500);
                }
              }}
            />
          </div>
        );
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, selectedWO, addBotMessage, addUserMessage, getCompanyName, getServiceTypeName]);

  // Step: choose type
  useEffect(() => {
    if (step === "chooseType" && processedStepRef.current !== "chooseType") {
      processedStepRef.current = "chooseType";
      const timer = setTimeout(() => {
        addBotMessage(
          <div>
            <p>What type of appointment would you like to schedule?</p>
            <OptionButtons
              options={[
                { label: "Medical Appointment", value: "Medical", variant: "default" },
                { label: "Emirates ID Appointment", value: "EID", variant: "default" },
              ]}
              onSelect={(type) => {
                const aptType = type as "Medical" | "EID";
                addUserMessage(aptType === "Medical" ? "Medical Appointment" : "Emirates ID Appointment");
                setAppointmentType(aptType);
                setStep("centerInfo");
              }}
            />
          </div>
        );
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, addBotMessage, addUserMessage]);

  // Step: center selection — show preferred center only, with option to change
  useEffect(() => {
    if (step === "centerInfo" && appointmentType && selectedWO && centers && companies && processedStepRef.current !== `centerInfo-${appointmentType}`) {
      processedStepRef.current = `centerInfo-${appointmentType}`;

      const filtered = centers.filter((c) => {
        const typeMatch = appointmentType === "Medical"
          ? c.type === "Medical" || c.type === "Both"
          : c.type === "EID" || c.type === "Both";
        const tierMatch = selectedWO.isVip ? c.tier === "VIP" : c.tier === "Normal";
        return typeMatch && tierMatch && c.active;
      });

      setFilteredCenters(filtered);

      const company = getCompany(selectedWO.companyId);
      let prefId: string | null = null;
      if (company) {
        if (appointmentType === "Medical") {
          prefId = (selectedWO.isVip ? company.preferredMedicalCenterVipId : company.preferredMedicalCenterId) || null;
        } else {
          prefId = (selectedWO.isVip ? company.preferredBiometricsCenterVipId : company.preferredBiometricsCenterId) || null;
        }
      }
      setPreferredCenterId(prefId);

      const preferredCenter = prefId ? filtered.find(c => c.id === prefId) : null;
      if (preferredCenter) {
        setSelectedCenter(preferredCenter);
        setShowAllCenters(false);
      } else if (filtered.length > 0) {
        setShowAllCenters(true);
      }

      const timer = setTimeout(() => {
        if (preferredCenter) {
          addBotMessage(
            <div>
              <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                <Star className="h-4 w-4 text-primary fill-primary shrink-0" />
                <span className="text-sm">
                  Preferred center: <span className="font-medium">{preferredCenter.name}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <MapPin className="h-3 w-3" />
                {preferredCenter.area || "N/A"}
              </div>
              {preferredCenter.timingText && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                  <Clock className="h-3 w-3" />
                  {preferredCenter.timingText}
                </div>
              )}
              <p className="text-sm text-muted-foreground">Enter the appointment details below, or change the center if needed.</p>
            </div>
          );
        } else if (filtered.length > 0) {
          addBotMessage("No preferred center set. Please select a center, then enter the appointment details.");
        } else {
          addBotMessage("No matching centers found for this configuration. Enter the appointment details below.");
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setAptDate(tomorrow.toISOString().split("T")[0]);
        setAptTime("11:00");

        setStep("details");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, appointmentType, selectedWO, centers, companies, addBotMessage, getCompany]);

  // Generate the same email/WhatsApp content as the scheduling pages
  const generateContent = useCallback(() => {
    if (!selectedWO || !appointmentType) return null;

    const company = getCompany(selectedWO.companyId);
    const assist = company?.assistStaffId ? staffList?.find(s => s.id === company.assistStaffId) : null;
    const crm = company?.rmStaffId ? staffList?.find(s => s.id === company.rmStaffId) : null;
    const serviceTypeName = getServiceTypeName(selectedWO.serviceTypeId);

    const formattedDate = aptDate ? new Date(aptDate + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    }) : "TBD";
    const formattedTime = aptTime ? formatTime12h(aptTime) : "TBD";

    const contactLines: string[] = [];
    if (assist) {
      const label = appointmentType === "Medical" ? "Medical Assistant" : "Field Assistant";
      contactLines.push(`${label}: ${assist.name}${assist.phone ? ` - ${assist.phone}` : ""}`);
    }
    if (crm) {
      contactLines.push(`Client Relations: ${crm.name}${crm.phone ? ` - ${crm.phone}` : ""}`);
    }
    const contactSection = contactLines.length > 0 ? `Your P.R.O. Team:\n${contactLines.join("\n")}` : "";

    const centerLabel = appointmentType === "Medical" ? "Medical Center" : "Emirates ID Center";
    const locationLink = selectedCenter?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedCenter.address)}`
      : "";
    const assistanceSection = assist
      ? `\u{1F464} Assistance: ${assist.name}\n\u{1F4DE} ${assist.phone || ""}`
      : "";

    const emailBody = `Dear ${toProperCase(company?.name || "")} Team,

We have scheduled ${appointmentType === "Medical" ? "a medical" : "an Emirates ID"} appointment for your employee:

Applicant: ${toProperCase(selectedWO.applicantName)}
${selectedWO.applicantPhone ? `Contact: ${selectedWO.applicantPhone}` : ""}

Appointment Details:
- Date: ${formattedDate}
- Time: ${formattedTime}
- ${centerLabel}: ${selectedCenter?.name || "TBD"}
${selectedCenter?.address ? `- Address: ${selectedCenter.address}` : ""}
${selectedCenter?.googleMapsUrl ? `- Location: ${selectedCenter.googleMapsUrl}` : ""}
${appNumber ? `- Application Number: ${appNumber}` : ""}

${contactSection}

${aptNotes ? `Note: ${aptNotes}\n` : ""}Please ensure the applicant arrives 15 minutes before the scheduled time with all required documents.
${appointmentType === "EID" ? "\nOnce the Emirates ID process is completed, we will update you with the status.\n" : ""}
Best regards,
The P.R.O. Company\u2122`;

    const whatsappBody = `Hello \u{1F44B}

Your ${appointmentType === "Medical" ? "medical" : "Emirates ID"} appointment has been scheduled successfully for the following work.

\u{1F4C4} WO: ${selectedWO.woNumber}
\u{1F464} Applicant: ${toProperCase(selectedWO.applicantName)}
\u{1F3E2} Company: ${toProperCase(company?.name || "")}
\u{1F9FE} Service: ${toProperCase(serviceTypeName)}
${appNumber ? `\u{1F522} Application No: ${appNumber}` : ""}

${appointmentType === "Medical" ? "\u{1F3E5}" : "\u{1FAAA}"} ${centerLabel}: ${selectedCenter?.name || "TBD"}
\u{1F4C5} Date: ${formattedDate}
\u23F0 Time: ${formattedTime}
${selectedCenter?.address ? `\u{1F4CD} Location: ${selectedCenter.address}` : ""}
${locationLink ? `\u{1F5FA}\uFE0F Map: ${locationLink}` : ""}

${assistanceSection}

\u26A0\uFE0F *Important:*
\u2022 Please arrive at least *10 minutes before* the scheduled time.
\u2022 Please ensure the applicant brings their *original passport*.
${aptNotes ? `\u2022 ${aptNotes}` : ""}
${appointmentType === "EID" ? "\nOnce the Emirates ID process is completed, we will update you with the status.\n" : ""}
Thank you,
*The P.R.O. Company\u2122*`;

    const emailHtmlProps = {
      woNumber: selectedWO.woNumber,
      companyName: toProperCase(company?.name || ""),
      applicantName: toProperCase(selectedWO.applicantName),
      serviceType: toProperCase(serviceTypeName),
      centerName: selectedCenter?.name || "TBD",
      centerAddress: selectedCenter?.address || undefined,
      centerType: (selectedCenter?.tier === "VIP" ? "VIP" : "Normal") as "Normal" | "VIP",
      appointmentDate: aptDate ? new Date(aptDate + "T00:00:00").toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric"
      }) : "TBD",
      appointmentTime: formattedTime,
      applicationNumber: appNumber || undefined,
      crmName: crm?.name,
      crmPhone: crm?.phone || undefined,
      notes: aptNotes || undefined,
    };

    const medicalEmailProps = {
      ...emailHtmlProps,
      medicalAssistName: assist?.name,
      medicalAssistPhone: assist?.phone || undefined,
    };

    const eidEmailProps = {
      ...emailHtmlProps,
      assistName: assist?.name,
      assistPhone: assist?.phone || undefined,
    };

    return { emailBody, whatsappBody, medicalEmailProps, eidEmailProps };
  }, [selectedWO, appointmentType, selectedCenter, appNumber, aptDate, aptTime, aptNotes, getCompany, getServiceTypeName, staffList]);

  const handleCopyMessage = async (type: "email" | "whatsapp") => {
    const content = generateContent();
    if (!content) return;

    if (type === "whatsapp") {
      await navigator.clipboard.writeText(content.whatsappBody);
    } else {
      const emailHtml = appointmentType === "Medical"
        ? generateMedicalAppointmentEmailHtml(content.medicalEmailProps)
        : generateEidAppointmentEmailHtml(content.eidEmailProps);
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([emailHtml], { type: "text/html" }),
            "text/plain": new Blob([content.emailBody], { type: "text/plain" }),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(content.emailBody);
      }
    }
    setMessageCopied(type);
    setTimeout(() => setMessageCopied(null), 2000);
    toast({
      title: "Copied!",
      description: `${type === "email" ? "Email (with formatting)" : "WhatsApp"} message copied to clipboard.`,
    });
  };

  const handleSubmitDetails = useCallback(() => {
    if (!aptDate || !aptTime) return;
    const parts = [];
    if (appNumber.trim()) parts.push(`App No: ${appNumber}`);
    parts.push(`Date: ${aptDate}`, `Time: ${formatTime12h(aptTime)}`);
    addUserMessage(parts.join(", "));
    setStep("generateMessages");
  }, [appNumber, aptDate, aptTime, addUserMessage]);

  // Step: show generated messages
  useEffect(() => {
    if (step === "generateMessages" && processedStepRef.current !== "generateMessages") {
      processedStepRef.current = "generateMessages";
      const timer = setTimeout(() => {
        addBotMessage("Your messages are ready below. Copy the email or WhatsApp draft.");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, addBotMessage]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return;
    const text = input.trim();
    setInput("");
    addUserMessage(text);
    if (step === "search") {
      setIsProcessing(true);
      setTimeout(() => {
        handleSearch(text);
        setIsProcessing(false);
      }, 500);
    }
  }, [input, isProcessing, step, addUserMessage, handleSearch]);

  const handleStartOver = useCallback(() => {
    addUserMessage("Schedule Another");
    setSelectedWO(null);
    setAppointmentType(null);
    setSelectedCenter(null);
    setShowAllCenters(false);
    setFilteredCenters([]);
    setPreferredCenterId(null);
    setAppNumber("");
    setAptDate("");
    setAptTime("");
    setAptNotes("");
    setMessageCopied(null);
    setStep("search");
    processedStepRef.current = "";
    setTimeout(() => {
      addBotMessage("Enter a WO number or applicant name to find the work order.");
    }, 500);
  }, [addBotMessage, addUserMessage]);

  const inputDisabled = step !== "search" || isProcessing;
  const content = step === "generateMessages" ? generateContent() : null;

  return (
    <AppLayout>
      <PageHeader
        title="Appointment Scheduler"
        subtitle="Schedule medical or EID appointments step by step"
        breadcrumbs={[
          { label: "Bots", href: "/bots" },
          { label: "Appointment Scheduler" },
        ]}
      />
      <div className="flex flex-col h-[calc(100vh-72px-105px)]">
        <ChatContainer messages={messages}>
          {isProcessing && (
            <div className="flex justify-start" data-testid="bot-thinking">
              <div className="max-w-[80%] rounded-2xl bg-muted/50 px-4 py-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Bot</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              </div>
            </div>
          )}
        </ChatContainer>

        {step === "details" && (
          <div className="border-t border-border/50 bg-muted/20 p-4 space-y-3">
            {selectedCenter && !showAllCenters && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/50 bg-background">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{selectedCenter.name}</span>
                  {selectedCenter.id === preferredCenterId && (
                    <Star className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => setShowAllCenters(true)}
                  data-testid="button-change-center"
                >
                  Change
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {showAllCenters && (
              <div className="space-y-2 max-h-[200px] overflow-y-auto rounded-lg border border-border/50 bg-background p-2">
                {filteredCenters.map((center) => {
                  const isPreferred = center.id === preferredCenterId;
                  const isSelected = center.id === selectedCenter?.id;
                  return (
                    <div
                      key={center.id}
                      className={`rounded-lg border p-2.5 cursor-pointer hover-elevate ${
                        isSelected ? "border-primary/40 bg-primary/5" : "border-border/30"
                      }`}
                      onClick={() => {
                        setSelectedCenter(center);
                        setShowAllCenters(false);
                      }}
                      data-testid={`center-item-${center.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          <span className="text-sm font-medium truncate">{center.name}</span>
                          {isPreferred && <Star className="h-3 w-3 text-primary fill-primary shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPreferred && <Badge variant="secondary" className="text-xs">Preferred</Badge>}
                          {center.authority && <Badge variant="secondary" className="text-xs">{center.authority}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {center.area || "N/A"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" />
                Application Number
              </label>
              <Input
                value={appNumber}
                onChange={(e) => setAppNumber(e.target.value)}
                placeholder="e.g., 201-2025-1234567"
                data-testid="input-app-number"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Date
                </label>
                <Input
                  type="date"
                  value={aptDate}
                  onChange={(e) => setAptDate(e.target.value)}
                  data-testid="input-app-date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Time
                </label>
                <Input
                  type="time"
                  value={aptTime}
                  onChange={(e) => setAptTime(e.target.value)}
                  data-testid="input-app-time"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Notes (optional)
              </label>
              <Textarea
                value={aptNotes}
                onChange={(e) => setAptNotes(e.target.value)}
                placeholder="Any additional notes..."
                className="resize-none min-h-[60px]"
                data-testid="input-apt-notes"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSubmitDetails}
              disabled={!aptDate || !aptTime}
              className="w-full"
              data-testid="button-submit-appointment"
            >
              Generate Messages
            </Button>
          </div>
        )}

        {step === "generateMessages" && content && (
          <div className="border-t border-border/50 bg-muted/20 p-4 space-y-4 overflow-y-auto max-h-[60vh]">
            <Tabs defaultValue="email">
              <TabsList className="w-full">
                <TabsTrigger value="email" className="flex-1 gap-1.5" data-testid="tab-bot-email">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="flex-1 gap-1.5" data-testid="tab-bot-whatsapp">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-3 mt-3">
                <div className="rounded-lg border border-border/50 overflow-hidden max-h-[35vh] overflow-y-auto bg-background">
                  <div className="p-1 scale-[0.85] origin-top-left" style={{ width: "117.6%" }}>
                    {appointmentType === "Medical" ? (
                      <MedicalAppointmentEmail {...content.medicalEmailProps} />
                    ) : (
                      <EidAppointmentEmail {...content.eidEmailProps} />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleCopyMessage("email")}
                    className="gap-2"
                    data-testid="button-bot-copy-email"
                  >
                    {messageCopied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {messageCopied === "email" ? "Copied!" : "Copy Email"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setEmailFullscreen(true)}
                    data-testid="button-bot-email-fullscreen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="whatsapp" className="space-y-3 mt-3">
                <div className="rounded-lg border border-border/50 bg-background p-4 max-h-[35vh] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground">
                    {content.whatsappBody}
                  </pre>
                </div>
                <Button
                  onClick={() => handleCopyMessage("whatsapp")}
                  className="gap-2"
                  data-testid="button-bot-copy-whatsapp"
                >
                  {messageCopied === "whatsapp" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {messageCopied === "whatsapp" ? "Copied!" : "Copy WhatsApp"}
                </Button>
              </TabsContent>
            </Tabs>

            <Button
              variant="outline"
              size="sm"
              onClick={handleStartOver}
              data-testid="button-schedule-another"
            >
              Schedule Another
            </Button>
          </div>
        )}

        {step !== "details" && step !== "generateMessages" && (
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            placeholder={
              step === "search"
                ? "Enter WO number or applicant name..."
                : "Follow the steps above..."
            }
            disabled={inputDisabled}
          />
        )}
      </div>

      <Dialog open={emailFullscreen} onOpenChange={setEmailFullscreen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className={`px-6 py-4 border-b ${appointmentType === "Medical" ? "bg-gradient-to-r from-[#4a7c59] to-[#2d5a3d]" : "bg-gradient-to-r from-[#2563eb] to-[#1e40af]"}`}>
            <DialogTitle className="text-white flex items-center gap-2">
              {appointmentType === "Medical" ? (
                <Stethoscope className="h-5 w-5" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
              Email Preview
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {content && appointmentType === "Medical" ? (
              <MedicalAppointmentEmail {...content.medicalEmailProps} />
            ) : content ? (
              <EidAppointmentEmail {...content.eidEmailProps} />
            ) : null}
          </div>
          <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
            <Button
              onClick={() => handleCopyMessage("email")}
              className="gap-2"
              data-testid="button-bot-fullscreen-copy-email"
            >
              {messageCopied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {messageCopied === "email" ? "Copied!" : "Copy Email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
