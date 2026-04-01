import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatTime12h } from "@/lib/format-date";
import {
  TIME_SLOTS,
  getTomorrow,
  type SchedulingQueueItem,
  type SchedulingQueueResponse,
} from "@/pages/appointments/components/schedule-shared-types";
import type { Center, WorkOrder, Company } from "@shared/schema";
import {
  CalendarClock,
  ArrowLeft,
  Send,
  Stethoscope,
  CreditCard,
  CheckCircle2,
  Building2,
  Calendar,
  Clock,
  User,
  ChevronRight,
  RotateCcw,
  Star,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

type AppointmentType = "Medical" | "EID";

type BotStep =
  | "welcome"
  | "select-type"
  | "select-wo"
  | "select-center"
  | "select-date"
  | "select-time"
  | "application-number"
  | "confirm"
  | "done";

interface BotMessage {
  id: string;
  from: "bot" | "user";
  content: string;
  ts: Date;
}

interface BotState {
  type: AppointmentType | null;
  woItem: SchedulingQueueItem | null;
  center: Center | null;
  date: string;
  time: string;
  applicationNumber: string;
  notes: string;
}

function botId() {
  return Math.random().toString(36).slice(2);
}

function botMsg(content: string): BotMessage {
  return { id: botId(), from: "bot", content, ts: new Date() };
}

function userMsg(content: string): BotMessage {
  return { id: botId(), from: "user", content, ts: new Date() };
}

const WELCOME_MESSAGES = [
  botMsg("Hi! I'm the Appointment Scheduler. I'll guide you through booking a medical or EID appointment step by step."),
  botMsg("What type of appointment would you like to schedule?"),
];

export default function SchedulerBot() {
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<BotMessage[]>(WELCOME_MESSAGES);
  const [step, setStep] = useState<BotStep>("select-type");
  const [state, setState] = useState<BotState>({
    type: null,
    woItem: null,
    center: null,
    date: getTomorrow(),
    time: "11:00",
    applicationNumber: "",
    notes: "",
  });
  const [woSearch, setWoSearch] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [scheduledId, setScheduledId] = useState<string | null>(null);

  const { data: queueData } = useQuery<SchedulingQueueResponse>({ queryKey: ["/api/appointments/scheduling-queue"] });
  const { data: centers } = useQuery<Center[]>({ queryKey: ["/api/centers"] });
  const { data: workOrders } = useQuery<WorkOrder[]>({ queryKey: ["/api/work-orders"] });
  const { data: companies } = useQuery<Company[]>({ queryKey: ["/api/companies"] });

  const medicalQueue = useMemo(() => queueData?.medical || [], [queueData]);
  const eidQueue = useMemo(() => queueData?.eid || [], [queueData]);
  const currentQueue = state.type === "Medical" ? medicalQueue : eidQueue;

  const filteredCenters = useMemo(() => {
    if (!centers || !state.type) return [];
    if (state.type === "Medical") return centers.filter(c => c.type === "Medical" || c.type === "Both");
    return centers.filter(c => c.type === "EID" || c.type === "Both");
  }, [centers, state.type]);

  const filteredWos = useMemo(() => {
    if (!workOrders) return [];
    const q = woSearch.toLowerCase();
    return workOrders
      .filter(wo => wo.woNumber.toLowerCase().includes(q) || wo.applicantName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [workOrders, woSearch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  const push = (...msgs: BotMessage[]) => setMessages(prev => [...prev, ...msgs]);

  const reset = () => {
    setMessages(WELCOME_MESSAGES);
    setStep("select-type");
    setState({ type: null, woItem: null, center: null, date: getTomorrow(), time: "11:00", applicationNumber: "", notes: "" });
    setWoSearch("");
    setInputVal("");
    setScheduledId(null);
  };

  const selectType = (type: AppointmentType) => {
    setState(s => ({ ...s, type }));
    push(
      userMsg(type === "Medical" ? "Medical Examination" : "Emirates ID Biometrics"),
      botMsg(`Great! Let's schedule a ${type === "Medical" ? "Medical Examination" : "Emirates ID Biometrics"} appointment.`),
      botMsg("Which work order is this for? I can show you the queue of ready-to-schedule cases, or you can search manually.")
    );
    setStep("select-wo");
  };

  const selectWo = (item: SchedulingQueueItem) => {
    setState(s => ({ ...s, woItem: item, applicationNumber: item.applicationRefNo || "" }));
    push(
      userMsg(`${item.woNumber} — ${item.applicantName}`),
      botMsg(`Got it! Applicant: ${item.applicantName}${item.companyName ? ` (${item.companyName})` : ""}.`),
      botMsg("Now, which clinic or center should we use?")
    );
    setStep("select-center");
  };

  const selectCenter = (center: Center) => {
    setState(s => ({ ...s, center }));
    push(
      userMsg(center.name),
      botMsg(`Perfect — ${center.name}.`),
      botMsg("What date should the appointment be scheduled for?")
    );
    setStep("select-date");
  };

  const selectDate = (date: string) => {
    setState(s => ({ ...s, date }));
    const formatted = format(new Date(date + "T12:00:00"), "EEEE, MMMM d, yyyy");
    push(
      userMsg(formatted),
      botMsg(`${formatted} — noted! What time?`)
    );
    setStep("select-time");
  };

  const selectTime = (time: string) => {
    setState(s => ({ ...s, time }));
    push(
      userMsg(formatTime12h(time)),
      botMsg(`${formatTime12h(time)}. Almost there!`),
      botMsg("What's the application reference number? (Leave blank to skip)")
    );
    setStep("application-number");
  };

  const submitAppNum = () => {
    const val = inputVal.trim();
    setState(s => ({ ...s, applicationNumber: val }));
    setInputVal("");
    const preview = buildConfirmPreview({ ...state, applicationNumber: val });
    push(
      userMsg(val || "Skip"),
      botMsg("Here's a summary of the appointment I'll schedule:"),
      botMsg(preview),
      botMsg("Ready to confirm and create the appointment?")
    );
    setStep("confirm");
  };

  const buildConfirmPreview = (s: BotState) => {
    const lines = [
      `• Type: ${s.type === "Medical" ? "Medical Examination" : "Emirates ID Biometrics"}`,
      `• Applicant: ${s.woItem?.applicantName || "—"}`,
      `• WO: ${s.woItem?.woNumber || "—"}`,
      `• Center: ${s.center?.name || "—"}`,
      `• Date: ${s.date ? format(new Date(s.date + "T12:00:00"), "EEE, MMM d, yyyy") : "—"}`,
      `• Time: ${formatTime12h(s.time)}`,
    ];
    if (s.applicationNumber) lines.push(`• App #: ${s.applicationNumber}`);
    return lines.join("\n");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        woId: state.woItem!.woId,
        type: state.type,
        centerId: state.center!.id,
        appointmentDate: state.date,
        appointmentTime: state.time,
        isVip: state.woItem?.isVip || false,
        applicationNumber: state.applicationNumber || null,
        notes: state.notes || null,
        status: "Scheduled",
      };
      const res = await apiRequest("POST", "/api/appointments", payload);
      const data = await res.json() as { id: string };
      return data;
    },
    onSuccess: (data) => {
      setScheduledId(data?.id || null);
      push(
        botMsg("✅ Appointment created successfully!"),
        botMsg(`The appointment for ${state.woItem?.applicantName} has been booked at ${state.center?.name} on ${format(new Date(state.date + "T12:00:00"), "EEE, MMM d")} at ${formatTime12h(state.time)}.`),
        botMsg("You can now send the notification email from the Appointments page, or schedule another appointment.")
      );
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/scheduling-queue"] });
    },
    onError: () => {
      toast({ title: "Failed to create appointment", variant: "destructive" });
      push(botMsg("❌ Something went wrong. Please try again or use the standard scheduling page."));
    },
  });

  const confirm = () => {
    push(userMsg("Confirm & Schedule"));
    createMutation.mutate();
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
        {/* Header */}
        <div className="px-4 lg:px-6 pt-4 pb-3 border-b border-border/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">
                Appointment Scheduler
              </h1>
              <p className="text-xs text-muted-foreground">Guided scheduling assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={reset}
              data-testid="button-reset-bot"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </Button>
            <Link href="/bots">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" data-testid="button-back-to-bots">
                <ArrowLeft className="h-3.5 w-3.5" />
                Bots
              </Button>
            </Link>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex", msg.from === "user" ? "justify-end" : "justify-start")}
            >
              {msg.from === "bot" && (
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                  <CalendarClock className="h-4 w-4 text-emerald-600" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] lg:max-w-[60%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line",
                  msg.from === "bot"
                    ? "bg-muted text-foreground rounded-bl-sm"
                    : "bg-primary text-primary-foreground rounded-br-sm"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Interactive options area */}
          <div className="flex justify-start">
            <div className="w-7 mr-2 shrink-0" />
            <div className="max-w-[90%] lg:max-w-[70%]">
              {step === "select-type" && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 h-9 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    onClick={() => selectType("Medical")}
                    data-testid="button-type-medical"
                  >
                    <Stethoscope className="h-4 w-4" />
                    Medical Examination
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 h-9 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    onClick={() => selectType("EID")}
                    data-testid="button-type-eid"
                  >
                    <CreditCard className="h-4 w-4" />
                    Emirates ID Biometrics
                  </Button>
                </div>
              )}

              {step === "select-wo" && (
                <div className="space-y-2 w-full">
                  <p className="text-xs text-muted-foreground font-medium">Ready to schedule ({currentQueue.length})</p>
                  <div className="flex gap-2 mb-2">
                    <input
                      placeholder="Search WO / applicant..."
                      value={woSearch}
                      onChange={e => setWoSearch(e.target.value)}
                      className="flex-1 h-8 text-xs px-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="input-wo-search"
                    />
                  </div>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {(woSearch.trim() ? filteredWos.map(wo => ({
                      typingJobId: "",
                      jobCode: null,
                      woId: wo.id,
                      woNumber: wo.woNumber,
                      applicantName: wo.applicantName,
                      applicantPhone: wo.applicantPhone || null,
                      applicantEmail: wo.applicantEmail || null,
                      isVip: wo.isVip || false,
                      serviceTypeId: wo.serviceTypeId || null,
                      companyId: wo.companyId || null,
                      companyName: companies?.find(c => c.id === wo.companyId)?.name || null,
                      preferredMedicalCenterId: null,
                      preferredMedicalCenterVipId: null,
                      preferredBiometricsCenterId: null,
                      preferredBiometricsCenterVipId: null,
                      assistStaffId: null,
                      rmStaffId: null,
                      applicationRefNo: null,
                      biometricsRequired: false,
                      biometricsDatetime: null,
                      biometricsCenter: null,
                      notes: null,
                      returnedAt: null,
                      completedAt: null,
                    } satisfies SchedulingQueueItem)) : currentQueue).map((item) => (
                      <button
                        key={item.woId}
                        onClick={() => selectWo(item)}
                        className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/50 bg-card hover:bg-muted/60 transition-colors text-sm"
                        data-testid={`button-wo-${item.woId}`}
                      >
                        {item.isVip && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">{item.applicantName}</div>
                          <div className="text-xs text-muted-foreground">{item.woNumber}{item.companyName ? ` · ${item.companyName}` : ""}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      </button>
                    ))}
                  </div>
                  {!woSearch && currentQueue.length === 0 && (
                    <div className="text-xs text-muted-foreground px-1 py-2">
                      No cases in the ready-to-schedule queue. Use the search above to find a work order manually.
                    </div>
                  )}
                </div>
              )}

              {step === "select-center" && (
                <div className="space-y-1 max-h-52 overflow-y-auto w-full">
                  {filteredCenters.map((center) => {
                    const isPreferred =
                      state.type === "Medical"
                        ? center.id === state.woItem?.preferredMedicalCenterId
                        : center.id === state.woItem?.preferredBiometricsCenterId;
                    return (
                      <button
                        key={center.id}
                        onClick={() => selectCenter(center)}
                        className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/50 bg-card hover:bg-muted/60 transition-colors text-sm"
                        data-testid={`button-center-${center.id}`}
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">{center.name}</div>
                          {center.address && <div className="text-xs text-muted-foreground truncate">{center.address}</div>}
                        </div>
                        {isPreferred && (
                          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500 text-white border-0 shrink-0">Preferred</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {step === "select-date" && (
                <div className="space-y-2">
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    defaultValue={state.date}
                    onChange={e => setState(s => ({ ...s, date: e.target.value }))}
                    className="h-9 text-sm px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="input-date"
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => selectDate(state.date)}
                    data-testid="button-confirm-date"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Confirm Date
                  </Button>
                </div>
              )}

              {step === "select-time" && (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => selectTime(slot)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        state.time === slot
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-muted text-foreground"
                      )}
                      data-testid={`button-time-${slot}`}
                    >
                      {formatTime12h(slot)}
                    </button>
                  ))}
                </div>
              )}

              {step === "application-number" && (
                <div className="flex gap-2 items-center">
                  <input
                    placeholder="Application reference number..."
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && submitAppNum()}
                    className="flex-1 h-9 text-sm px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="input-application-number"
                  />
                  <Button size="sm" className="h-9 gap-1.5" onClick={submitAppNum} data-testid="button-submit-appnum">
                    <Send className="h-4 w-4" />
                    {inputVal.trim() ? "Submit" : "Skip"}
                  </Button>
                </div>
              )}

              {step === "confirm" && !createMutation.isPending && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={confirm}
                    data-testid="button-confirm-schedule"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm & Schedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={reset}
                    data-testid="button-start-over"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Start Over
                  </Button>
                </div>
              )}

              {step === "confirm" && createMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Creating appointment...
                </div>
              )}

              {step === "done" && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={reset}
                    data-testid="button-schedule-another"
                  >
                    <CalendarClock className="h-4 w-4" />
                    Schedule Another
                  </Button>
                  <Link href="/appointments">
                    <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="button-view-appointments">
                      View Appointments
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div ref={bottomRef} />
        </div>
      </div>
    </AppLayout>
  );
}
