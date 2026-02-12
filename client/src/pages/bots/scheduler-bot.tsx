import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  FileText, User, Building2, Star, Loader2, MapPin, Clock, 
  Calendar, Hash, AlertCircle, AlertTriangle, Check 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { toProperCase } from "@/lib/proper-case";
import type { Company, ServiceType, WorkOrder, Center } from "@shared/schema";
import {
  ChatMessage,
  ChatContainer,
  ChatInput,
  OptionButtons,
  CopyBlock,
} from "@/components/ui/bot-chat";

type Step = "search" | "confirm" | "chooseType" | "centerInfo" | "generateMessages";

let msgId = 0;
function nextId() {
  return `msg-${++msgId}`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00");
    return new Intl.DateTimeFormat("en-AE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours, 10);
    const m = minutes || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch {
    return timeStr;
  }
}

function CenterList({ centers, preferredCenterId, onSelect }: { 
  centers: Center[]; 
  preferredCenterId: string | null | undefined;
  onSelect: (center: Center) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(preferredCenterId || null);
  useEffect(() => {
    if (preferredCenterId) {
      setSelectedId(preferredCenterId);
    }
  }, [preferredCenterId]);
  return (
    <div className="space-y-2 max-h-[250px] overflow-y-auto">
      {centers.map((center) => {
        const isPreferred = center.id === preferredCenterId;
        const isSelected = center.id === selectedId;
        return (
          <div
            key={center.id}
            className={`rounded-lg border p-3 cursor-pointer hover-elevate ${
              isSelected
                ? "border-primary/40 bg-primary/5"
                : "border-border/50"
            }`}
            onClick={() => {
              setSelectedId(center.id);
              onSelect(center);
            }}
            data-testid={`center-item-${center.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">{center.name}</p>
                    {isPreferred && (
                      <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {center.area || "N/A"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {isPreferred && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    Preferred
                  </Badge>
                )}
                {center.authority && (
                  <Badge variant="secondary" className="shrink-0">
                    {center.authority}
                  </Badge>
                )}
              </div>
            </div>
            {center.timingText && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {center.timingText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SchedulerBot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("search");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [appointmentType, setAppointmentType] = useState<"Medical" | "EID" | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const appointmentDataRef = useRef<{ appNumber: string; date: string; time: string } | null>(null);
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

  const getCompanyName = useCallback(
    (id: string | null | undefined) => {
      if (!id || !companies) return "Unknown";
      return companies.find((c) => c.id === id)?.name || "Unknown";
    },
    [companies]
  );

  const getServiceTypeName = useCallback(
    (id: string | null | undefined) => {
      if (!id || !serviceTypes) return "N/A";
      return serviceTypes.find((s) => s.id === id)?.name || "N/A";
    },
    [serviceTypes]
  );

  const getCompany = useCallback(
    (id: string | null | undefined) => {
      if (!id || !companies) return null;
      return companies.find((c) => c.id === id) || null;
    },
    [companies]
  );

  const getPreferredCenterId = useCallback(
    (wo: WorkOrder, type: "Medical" | "EID") => {
      const company = getCompany(wo.companyId);
      if (!company) return null;
      if (type === "Medical") {
        return wo.isVip
          ? company.preferredMedicalCenterVipId
          : company.preferredMedicalCenterId;
      }
      return wo.isVip
        ? company.preferredBiometricsCenterVipId
        : company.preferredBiometricsCenterId;
    },
    [getCompany]
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
        addBotMessage(
          "Enter a WO number or applicant name to find the work order."
        );
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
          <p className="mb-3">
            I found {matches.length} work orders. Please pick one:
          </p>
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
                  <span className="text-sm font-medium">
                    {toProperCase(wo.applicantName)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Company:</span>
                  <span className="text-sm font-medium">
                    {getCompanyName(wo.companyId)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Service:</span>
                  <span className="text-sm font-medium">
                    {getServiceTypeName(wo.serviceTypeId)}
                  </span>
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
                    addBotMessage(
                      "Enter a WO number or applicant name to find the work order."
                    );
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
                addUserMessage(
                  aptType === "Medical" ? "Medical Appointment" : "Emirates ID Appointment"
                );
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

  useEffect(() => {
    if (step === "centerInfo" && appointmentType && selectedWO && centers && companies && processedStepRef.current !== `centerInfo-${appointmentType}`) {
      processedStepRef.current = `centerInfo-${appointmentType}`;
      const timer = setTimeout(() => {

        const filtered = centers.filter((c) => {
          const typeMatch =
            appointmentType === "Medical"
              ? c.type === "Medical" || c.type === "Both"
              : c.type === "EID" || c.type === "Both";
          const tierMatch = selectedWO.isVip
            ? c.tier === "VIP"
            : c.tier === "Normal";
          return typeMatch && tierMatch && c.active;
        });

        const preferredId = getPreferredCenterId(selectedWO, appointmentType);
        const preferredCenter = preferredId ? filtered.find(c => c.id === preferredId) : null;

        if (preferredCenter) {
          setSelectedCenter(preferredCenter);
        }

        if (filtered.length === 0) {
          addBotMessage(
            <div>
              <p>No matching centers found for this configuration.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please enter the appointment details below anyway.
              </p>
            </div>
          );
        } else {
          const companyObj = getCompany(selectedWO.companyId);
          const sortedCenters = preferredId
            ? [...filtered].sort((a, b) => {
                if (a.id === preferredId) return -1;
                if (b.id === preferredId) return 1;
                return 0;
              })
            : filtered;

          addBotMessage(
            <div>
              {preferredCenter && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-primary/5 border border-primary/10">
                  <Star className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">
                    {companyObj?.name || "Company"}'s preferred center auto-selected
                  </span>
                </div>
              )}
              <p className="mb-3">Available centers:</p>
              <CenterList
                centers={sortedCenters}
                preferredCenterId={preferredId}
                onSelect={(center) => {
                  if (preferredId && center.id !== preferredId && preferredCenter) {
                    setSelectedCenter(center);
                    addBotMessage(
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-700 dark:text-amber-400">Not the preferred center</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            You selected <span className="font-medium">{center.name}</span> instead of the preferred <span className="font-medium">{preferredCenter.name}</span>.
                          </p>
                        </div>
                      </div>
                    );
                  } else {
                    setSelectedCenter(center);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-3">
                {preferredCenter
                  ? "Preferred center pre-selected. Tap another to change."
                  : "Select a center above (optional), then enter the details below."}
              </p>
            </div>
          );
        }

        setTimeout(() => {
          addBotMessage(
            <div>
              <p className="mb-3">Please enter the appointment details:</p>
              <AppointmentForm
                onSubmit={(data) => {
                  appointmentDataRef.current = data;
                  addUserMessage(
                    `App No: ${data.appNumber}, Date: ${data.date}, Time: ${data.time}`
                  );
                  setStep("generateMessages");
                }}
              />
            </div>
          );
        }, 800);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, appointmentType, selectedWO, centers, companies, addBotMessage, addUserMessage, getPreferredCenterId, getCompany]);

  useEffect(() => {
    if (step === "generateMessages" && selectedWO && appointmentType && appointmentDataRef.current && processedStepRef.current !== "generateMessages") {
      processedStepRef.current = "generateMessages";
      const aptData = appointmentDataRef.current;
      const timer = setTimeout(() => {
        const typeLabel =
          appointmentType === "Medical" ? "Medical" : "Emirates ID";
        const applicantName = toProperCase(selectedWO.applicantName);
        const woNumber = selectedWO.woNumber;
        const centerName = selectedCenter?.name || "To be confirmed";
        const centerArea = selectedCenter?.area || "";
        const mapsUrl = selectedCenter?.googleMapsUrl || "";

        const appNum = aptData.appNumber;
        const fDate = formatDate(aptData.date);
        const fTime = formatTime(aptData.time);

        const emailContent = `Subject: ${typeLabel} Appointment - ${applicantName} - ${woNumber}

Dear ${applicantName},

Your ${typeLabel} appointment has been scheduled.

Details:
- Application Number: ${appNum}
- Date: ${fDate}
- Time: ${fTime}
- Center: ${centerName}${centerArea ? `\n- Location: ${centerArea}` : ""}${mapsUrl ? `\n- Google Maps: ${mapsUrl}` : ""}

Please arrive 15 minutes before your scheduled time.

Best regards,
The P.R.O. Company`;

        const whatsappContent = `Hi ${applicantName},

Your ${typeLabel} appointment:
App No: ${appNum}
Date: ${fDate}
Time: ${fTime}
Center: ${centerName}${centerArea ? `, ${centerArea}` : ""}${mapsUrl ? `\nMaps: ${mapsUrl}` : ""}

Please arrive 15 mins early.

- The P.R.O. Company`;

        addBotMessage(
          <div>
            <p className="mb-3">
              Here are your messages ready to copy:
            </p>
            <CopyBlock
              title="Email"
              content={emailContent}
              testId="copy-block-email"
            />
            <CopyBlock
              title="WhatsApp"
              content={whatsappContent}
              testId="copy-block-whatsapp"
            />
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  addUserMessage("Schedule Another");
                  setSelectedWO(null);
                  setAppointmentType(null);
                  setSelectedCenter(null);
                  setStep("search");
                  appointmentDataRef.current = null;
                  processedStepRef.current = "";
                  setTimeout(() => {
                    addBotMessage(
                      "Enter a WO number or applicant name to find the work order."
                    );
                  }, 500);
                }}
                data-testid="button-schedule-another"
              >
                Schedule Another
              </Button>
            </div>
          </div>
        );
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, selectedWO, appointmentType, selectedCenter, addBotMessage, addUserMessage]);

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

  const inputDisabled = step !== "search" || isProcessing;

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
      </div>
    </AppLayout>
  );
}

function AppointmentForm({
  onSubmit,
}: {
  onSubmit: (data: { appNumber: string; date: string; time: string }) => void;
}) {
  const [appNumber, setAppNumber] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const handleSubmit = () => {
    if (!appNumber.trim() || !date || !time) return;
    onSubmit({ appNumber: appNumber.trim(), date, time });
  };

  return (
    <div className="space-y-3" data-testid="appointment-form">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Date
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
            value={time}
            onChange={(e) => setTime(e.target.value)}
            data-testid="input-app-time"
          />
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!appNumber.trim() || !date || !time}
        data-testid="button-submit-appointment"
      >
        Submit
      </Button>
    </div>
  );
}
