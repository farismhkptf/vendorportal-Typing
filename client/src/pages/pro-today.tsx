import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, QrCode, CheckCircle2, AlertTriangle, Clock, Building2, MapPin, User, X, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TodayCycle {
  id: string;
  caseId: string;
  cycleNumber: number;
  cycleType: string;
  status: string;
  appointmentTime: string;
  centerId: string | null;
  assignedProId: string | null;
  confirmedAt: string | null;
  confirmMethod: string | null;
  workOrder: { id: string; woNumber: string; applicantName: string; companyId: string } | null;
  company: { id: string; name: string } | null;
  center: { id: string; name: string } | null;
}

function formatTime(dt: string | Date): string {
  const d = new Date(dt);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    SCHEDULED: { label: "Upcoming", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    AWAITING_MEETING: { label: "Awaiting Meeting", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    IN_PROCESS: { label: "Test In Progress", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    COMPLETED: { label: "Completed", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    NO_SHOW: { label: "No Show", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  };
  const v = variants[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", v.className)}>
      {v.label}
    </span>
  );
}

interface QRConfirmResult {
  message: string;
  alreadyConfirmed?: boolean;
  cycleMismatch?: boolean;
  cycle?: TodayCycle;
}

function QRScannerModal({
  cycleId,
  applicantName,
  onClose,
  onSuccess,
}: {
  cycleId: string;
  applicantName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<import("@zxing/browser").BrowserQRCodeReader | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const { toast } = useToast();

  const extractCardToken = useCallback((url: string): string | null => {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/");
      const cardIdx = parts.indexOf("card");
      if (cardIdx >= 0 && parts[cardIdx + 1]) {
        return parts[cardIdx + 1];
      }
    } catch {
      if (url.includes("/card/")) {
        const match = url.match(/\/card\/([^/?#]+)/);
        if (match) return match[1];
      }
    }
    return null;
  }, []);

  const handleScanResult = useCallback(async (text: string) => {
    if (scanResult || confirming) return;
    setScanResult(text);
    setConfirming(true);

    const token = extractCardToken(text);
    if (!token) {
      setScanError("QR code not recognised — please scan the applicant's appointment card.");
      setConfirming(false);
      setScanResult(null);
      return;
    }

    try {
      const res = await fetch("/api/confirm-by-card-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cardToken: token, expectedCycleId: cycleId }),
      });

      const body: QRConfirmResult = await res.json().catch(() => ({ message: "Unknown error" }));

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/pro/today-cycles"] });
        toast({ title: "Meeting confirmed", description: "Test in progress — cycle status updated." });
        onSuccess();
        return;
      }

      if (res.status === 409 && body.alreadyConfirmed) {
        queryClient.invalidateQueries({ queryKey: ["/api/pro/today-cycles"] });
        toast({ title: "Already confirmed", description: body.message, variant: "default" });
        onSuccess();
        return;
      }

      if (res.status === 409 && body.cycleMismatch) {
        setScanError(body.message);
        setScanResult(null);
        setConfirming(false);
        return;
      }

      setScanError(body.message || "Could not confirm via QR code.");
      setScanResult(null);
      setConfirming(false);
    } catch {
      setScanError("Network error — please try again.");
      setScanResult(null);
      setConfirming(false);
    }
  }, [scanResult, confirming, cycleId, extractCardToken, toast, onSuccess]);

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | null = null;

    const startScanner = async () => {
      try {
        setScanError(null);

        const { BrowserQRCodeReader, BrowserCodeReader } = await import("@zxing/browser");

        const devices = await BrowserCodeReader.listVideoInputDevices();
        const preferredDevice = devices.find(d =>
          d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear")
        ) || devices[0];

        if (!preferredDevice) {
          setScanError("No camera found. Please allow camera access.");
          return;
        }

        readerRef.current = new BrowserQRCodeReader();

        if (!videoRef.current || stopped) return;

        controls = await readerRef.current.decodeFromVideoDevice(
          preferredDevice.deviceId,
          videoRef.current,
          (result) => {
            if (result && !stopped) {
              handleScanResult(result.getText());
            }
          }
        );

        if (stopped) controls.stop();
      } catch {
        if (!stopped) {
          setScanError("Could not access camera. Please check permissions and try again.");
        }
      }
    };

    startScanner();

    return () => {
      stopped = true;
      if (controls) controls.stop();
      readerRef.current = null;
    };
  }, [handleScanResult]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="qr-scanner-modal">
      <div className="bg-card rounded-t-2xl sm:rounded-2xl border shadow-2xl w-full sm:max-w-md mx-0 sm:mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <div>
            <h2 className="text-base font-semibold text-foreground">Scan Appointment QR</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{applicantName}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            data-testid="button-close-qr-scanner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative bg-black rounded-xl overflow-hidden aspect-square max-h-[280px]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
              data-testid="video-qr-scanner"
            />
            {!confirming && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-48 h-48">
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-white rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-white rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-white rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-white rounded-br-lg" />
                </div>
              </div>
            )}
            {confirming && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center space-y-2">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
                  <p className="text-sm font-medium">Confirming...</p>
                </div>
              </div>
            )}
          </div>

          {scanError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg" data-testid="alert-scan-error">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{scanError}</p>
            </div>
          )}

          {!scanError && !confirming && (
            <p className="text-sm text-muted-foreground text-center">
              Point camera at the applicant's appointment card QR code
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CycleRow({
  cycle,
  onRefresh,
}: {
  cycle: TodayCycle;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const isConfirmed = ["IN_PROCESS", "COMPLETED"].includes(cycle.status);
  const canConfirm = cycle.status === "AWAITING_MEETING";
  const isUpcoming = cycle.status === "SCHEDULED";

  const manualConfirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appointment-cycles/${cycle.id}/confirm-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const body = await res.json().catch(() => ({ message: "Unknown error" }));
      if (!res.ok) throw body;
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pro/today-cycles"] });
      toast({ title: "Meeting confirmed", description: "Test in progress — cycle status updated." });
      onRefresh();
    },
    onError: (err: { message?: string }) => {
      toast({ title: "Confirmation failed", description: err.message || "Could not confirm meeting.", variant: "destructive" });
    },
  });

  const applicantName = cycle.workOrder?.applicantName ?? "—";
  const confirmedAtFormatted = cycle.confirmedAt
    ? new Date(cycle.confirmedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })
    : null;

  return (
    <>
      <div
        className={cn(
          "premium-card p-4 transition-all",
          isConfirmed && "opacity-75"
        )}
        data-testid={`cycle-row-${cycle.id}`}
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            isConfirmed ? "bg-green-50 dark:bg-green-950/30" : "bg-primary/5"
          )}>
            {isConfirmed
              ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              : <User className="h-5 w-5 text-primary" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate" data-testid={`text-applicant-name-${cycle.id}`}>
                  {applicantName}
                </p>
                {cycle.workOrder?.woNumber && (
                  <p className="text-xs text-muted-foreground" data-testid={`text-wo-number-${cycle.id}`}>
                    {cycle.workOrder.woNumber}
                  </p>
                )}
              </div>
              <StatusBadge status={cycle.status} />
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span data-testid={`text-appt-time-${cycle.id}`}>{formatTime(cycle.appointmentTime)}</span>
              </div>
              {cycle.company && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate" data-testid={`text-company-${cycle.id}`}>{cycle.company.name}</span>
                </div>
              )}
              {cycle.center && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate" data-testid={`text-center-${cycle.id}`}>{cycle.center.name}</span>
                </div>
              )}
            </div>

            {isConfirmed && confirmedAtFormatted && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium" data-testid={`text-confirmed-at-${cycle.id}`}>
                Confirmed at {confirmedAtFormatted} via {cycle.confirmMethod || "unknown"}
              </p>
            )}

            {isUpcoming && (
              <p className="mt-2 text-xs text-muted-foreground">
                Confirm actions will appear when the appointment is ready
              </p>
            )}

            {canConfirm && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8"
                  onClick={() => setScannerOpen(true)}
                  data-testid={`button-scan-qr-${cycle.id}`}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Scan QR
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8"
                  onClick={() => setConfirmDialogOpen(true)}
                  disabled={manualConfirmMutation.isPending}
                  data-testid={`button-confirm-manual-${cycle.id}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm Manually
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {scannerOpen && (
        <QRScannerModal
          cycleId={cycle.id}
          applicantName={applicantName}
          onClose={() => setScannerOpen(false)}
          onSuccess={() => {
            setScannerOpen(false);
            onRefresh();
          }}
        />
      )}

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that you have met <strong>{applicantName}</strong> in person and the test is now in progress?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-confirm-${cycle.id}`}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => manualConfirmMutation.mutate()}
              disabled={manualConfirmMutation.isPending}
              data-testid={`button-confirm-action-${cycle.id}`}
            >
              {manualConfirmMutation.isPending ? "Confirming..." : "Confirm Meeting"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function ProTodayPage() {
  useEffect(() => {
    document.title = "Today's Appointments — PRO";
    return () => { document.title = "Keystone"; };
  }, []);

  const { data: cycles, isLoading, isError, refetch } = useQuery<TodayCycle[]>({
    queryKey: ["/api/pro/today-cycles"],
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const awaitingMeeting = cycles?.filter(c => c.status === "AWAITING_MEETING") ?? [];
  const scheduled = cycles?.filter(c => c.status === "SCHEDULED") ?? [];
  const inProgress = cycles?.filter(c => ["IN_PROCESS", "COMPLETED"].includes(c.status)) ?? [];
  const noShows = cycles?.filter(c => c.status === "NO_SHOW") ?? [];

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-today-date">{today}</p>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Today's Appointments
            </h1>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => refetch()}
            data-testid="button-refresh-today"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-6">
        {isError && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg" data-testid="alert-load-error">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">Failed to load today's appointments.</p>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => refetch()}>Retry</Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {(!cycles || cycles.length === 0) && (
              <div className="text-center py-16 text-muted-foreground" data-testid="empty-state-no-appointments">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No appointments scheduled for today</p>
                <p className="text-sm mt-1">Check back later or contact the CRM team.</p>
              </div>
            )}

            {awaitingMeeting.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3" data-testid="section-awaiting-meeting">
                  Ready to Confirm ({awaitingMeeting.length})
                </h2>
                <div className="space-y-3">
                  {awaitingMeeting.map(cycle => (
                    <CycleRow key={cycle.id} cycle={cycle} onRefresh={refetch} />
                  ))}
                </div>
              </section>
            )}

            {scheduled.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3" data-testid="section-scheduled">
                  Upcoming ({scheduled.length})
                </h2>
                <div className="space-y-3">
                  {scheduled.map(cycle => (
                    <CycleRow key={cycle.id} cycle={cycle} onRefresh={refetch} />
                  ))}
                </div>
              </section>
            )}

            {inProgress.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3" data-testid="section-in-progress">
                  In Progress / Completed ({inProgress.length})
                </h2>
                <div className="space-y-3">
                  {inProgress.map(cycle => (
                    <CycleRow key={cycle.id} cycle={cycle} onRefresh={refetch} />
                  ))}
                </div>
              </section>
            )}

            {noShows.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3" data-testid="section-no-show">
                  No Shows ({noShows.length})
                </h2>
                <div className="space-y-3">
                  {noShows.map(cycle => (
                    <CycleRow key={cycle.id} cycle={cycle} onRefresh={refetch} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
