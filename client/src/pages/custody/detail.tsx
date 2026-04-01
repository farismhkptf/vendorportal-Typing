import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, Calendar, Camera, User, Phone,
  Clock, CheckCircle2, ArrowRight, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  CUSTODY_DOC_CATEGORY_LABELS, CUSTODY_DOC_SUBTYPE_LABELS, CUSTODY_DOC_STAGE_LABELS
} from "@shared/schema";

interface DocumentCustodyHandoff {
  id: string;
  recordId: string;
  fromStage: string;
  toStage: string;
  counterpartyName: string;
  counterpartyContact: string;
  counterpartyIdPhotoUrl: string | null;
  notes: string | null;
  performedBy: string;
  performedAt: string;
}

interface CustodyRecordDetail {
  id: string;
  referenceNumber: string;
  companyId: string;
  companyName: string | null;
  woId: string | null;
  woNumber: string | null;
  srId: string | null;
  docCategory: string;
  docSubtype: string;
  docCustomName: string | null;
  custodyStage: string;
  notifyEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  handoffs: DocumentCustodyHandoff[];
}

const STAGE_ORDER = ["WithClient", "WithUs", "WithVendor", "ReturnedToClient"];
const STAGE_COLORS: Record<string, string> = {
  WithClient: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  WithUs: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  WithVendor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ReturnedToClient: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

function getNextStage(current: string): string | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-AE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface HandoffFormProps {
  recordId: string;
  currentStage: string;
  onClose: () => void;
}

function HandoffForm({ recordId, currentStage, onClose }: HandoffFormProps) {
  const { toast } = useToast();
  const nextStage = getNextStage(currentStage);
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyContact, setCounterpartyContact] = useState("");
  const [notes, setNotes] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdPhoto(file);
    const reader = new FileReader();
    reader.onload = ev => setIdPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handoffMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("toStage", nextStage!);
      fd.append("counterpartyName", counterpartyName);
      fd.append("counterpartyContact", counterpartyContact);
      if (notes) fd.append("notes", notes);
      if (idPhoto) fd.append("counterpartyIdPhoto", idPhoto);

      const res = await fetch(`/api/custody/records/${recordId}/handoff`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed" }));
        throw new Error(err.message || "Failed to record handoff");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custody/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custody/records", recordId] });
      queryClient.invalidateQueries({ queryKey: ["/api/custody/records/summary"] });
      toast({ title: "Handoff recorded" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (!nextStage) return null;

  return (
    <div className="space-y-4" data-testid="handoff-form">
      <div className="rounded-xl bg-muted/30 border border-border p-3 text-sm">
        <span className="text-muted-foreground">Transitioning: </span>
        <span className="font-medium">{CUSTODY_DOC_STAGE_LABELS[currentStage]}</span>
        <ArrowRight className="h-3.5 w-3.5 inline mx-2 text-muted-foreground" />
        <span className="font-medium text-primary">{CUSTODY_DOC_STAGE_LABELS[nextStage]}</span>
      </div>

      <div>
        <Label htmlFor="input-cp-name">
          <User className="h-3.5 w-3.5 inline mr-1" />
          Contact Name *
        </Label>
        <Input
          id="input-cp-name"
          value={counterpartyName}
          onChange={e => setCounterpartyName(e.target.value)}
          placeholder="Full name of person"
          className="mt-1"
          data-testid="input-cp-name"
        />
      </div>

      <div>
        <Label htmlFor="input-cp-contact">
          <Phone className="h-3.5 w-3.5 inline mr-1" />
          Phone / Contact *
        </Label>
        <Input
          id="input-cp-contact"
          value={counterpartyContact}
          onChange={e => setCounterpartyContact(e.target.value)}
          placeholder="+971 50 ..."
          className="mt-1"
          data-testid="input-cp-contact"
        />
      </div>

      <div>
        <Label>
          <Camera className="h-3.5 w-3.5 inline mr-1" />
          ID Photo (optional)
        </Label>
        <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" id="id-photo-input" data-testid="input-id-photo" />
        {idPhotoPreview ? (
          <div className="mt-1">
            <img src={idPhotoPreview} alt="ID" className="h-28 w-auto rounded-lg border border-border object-cover" data-testid="img-id-preview" />
            <button className="text-xs text-destructive mt-1" onClick={() => { setIdPhoto(null); setIdPhotoPreview(null); }}>Remove</button>
          </div>
        ) : (
          <label htmlFor="id-photo-input" className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors" data-testid="label-upload-photo">
            <Camera className="h-4 w-4" /> Capture or upload ID photo
          </label>
        )}
      </div>

      <div>
        <Label htmlFor="textarea-handoff-notes">Notes (optional)</Label>
        <Textarea
          id="textarea-handoff-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any notes about this handoff"
          rows={2}
          className="mt-1"
          data-testid="textarea-handoff-notes"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button variant="outline" onClick={onClose} className="flex-1" data-testid="button-cancel-handoff">Cancel</Button>
        <Button
          onClick={() => handoffMutation.mutate()}
          disabled={!counterpartyName || !counterpartyContact || handoffMutation.isPending}
          className="flex-1"
          data-testid="button-confirm-handoff"
        >
          {handoffMutation.isPending ? "Recording..." : `Move to ${CUSTODY_DOC_STAGE_LABELS[nextStage]}`}
        </Button>
      </div>
    </div>
  );
}

function TimelineDot({ stage, current }: { stage: string; current: string }) {
  const currentIdx = STAGE_ORDER.indexOf(current);
  const stageIdx = STAGE_ORDER.indexOf(stage);
  const isCompleted = stageIdx < currentIdx;
  const isCurrent = stageIdx === currentIdx;

  return (
    <div className={cn(
      "h-7 w-7 rounded-full flex items-center justify-center shrink-0 border-2",
      isCompleted ? "bg-green-500 border-green-500" : isCurrent ? "bg-primary border-primary" : "bg-muted border-border"
    )}>
      {isCompleted ? (
        <CheckCircle2 className="h-4 w-4 text-white" />
      ) : isCurrent ? (
        <Clock className="h-3.5 w-3.5 text-white" />
      ) : (
        <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
      )}
    </div>
  );
}

export default function CustodyDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showHandoffForm, setShowHandoffForm] = useState(false);

  const { data: record, isLoading } = useQuery<CustodyRecordDetail>({
    queryKey: ["/api/custody/records", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/custody/records/${params.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!record) {
    return (
      <AppLayout>
        <div className="p-4 text-center text-muted-foreground">Record not found.</div>
      </AppLayout>
    );
  }

  const docLabel = record.docSubtype === "Other" && record.docCustomName
    ? record.docCustomName
    : (CUSTODY_DOC_SUBTYPE_LABELS[record.docSubtype] || record.docSubtype);
  const categoryLabel = CUSTODY_DOC_CATEGORY_LABELS[record.docCategory] || record.docCategory;
  const stageLabel = CUSTODY_DOC_STAGE_LABELS[record.custodyStage] || record.custodyStage;
  const stageColor = STAGE_COLORS[record.custodyStage] || "";
  const nextStage = getNextStage(record.custodyStage);
  const isOverdue = (record.custodyStage === "WithUs" || record.custodyStage === "WithVendor")
    && (Date.now() - new Date(record.updatedAt).getTime()) > 14 * 24 * 60 * 60 * 1000;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/custody-queue")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-mono text-lg font-semibold" data-testid="heading-ref">{record.referenceNumber}</h1>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", stageColor)} data-testid="status-stage">
                {stageLabel}
              </span>
              {isOverdue && (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" data-testid="badge-overdue">
                  <AlertTriangle className="h-3 w-3" /> Overdue
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-doc-label">{docLabel}</p>
          </div>
        </div>

        {/* Stage progress */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Custody Journey</p>
          <div className="flex items-center gap-0">
            {STAGE_ORDER.map((stage, idx) => (
              <div key={stage} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <TimelineDot stage={stage} current={record.custodyStage} />
                  <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[60px]">
                    {CUSTODY_DOC_STAGE_LABELS[stage]}
                  </span>
                </div>
                {idx < STAGE_ORDER.length - 1 && (
                  <div className={cn("flex-1 h-0.5 mb-5 mx-1", STAGE_ORDER.indexOf(record.custodyStage) > idx ? "bg-green-400" : "bg-border")} />
                )}
              </div>
            ))}
          </div>
          {nextStage && (
            <Button
              className="w-full mt-4 gap-2"
              onClick={() => setShowHandoffForm(true)}
              data-testid="button-advance-stage"
            >
              <ArrowRight className="h-4 w-4" />
              Move to {CUSTODY_DOC_STAGE_LABELS[nextStage]}
            </Button>
          )}
        </div>

        {/* Record Details */}
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Document Information</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium text-right" data-testid="text-category">{categoryLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Document Type</span>
                <span className="font-medium text-right" data-testid="text-doc-type">{docLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium text-right" data-testid="text-company">{record.companyName || "—"}</span>
              </div>
              {record.woNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Work Order</span>
                  <span className="font-mono font-medium" data-testid="text-wo-number">{record.woNumber}</span>
                </div>
              )}
              {record.notifyEmail && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Notification Email</span>
                  <span className="font-medium text-right truncate max-w-[60%]" data-testid="text-notify-email">{record.notifyEmail}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium text-right" data-testid="text-created-at">{formatTs(record.createdAt)}</span>
              </div>
            </div>
          </div>
          {record.notes && (
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Notes</p>
              <p className="text-sm text-muted-foreground" data-testid="text-notes">{record.notes}</p>
            </div>
          )}
        </div>

        {/* Custody Timeline */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Custody Timeline</p>
          {record.handoffs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic" data-testid="no-handoffs">No handoffs recorded yet. Document is with the client.</p>
          ) : (
            <div className="space-y-3" data-testid="handoff-timeline">
              {record.handoffs.map((handoff) => (
                <div key={handoff.id} className="flex gap-3" data-testid={`handoff-${handoff.id}`}>
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                      <ArrowRight className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="w-px flex-1 bg-border min-h-[12px]" />
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {CUSTODY_DOC_STAGE_LABELS[handoff.fromStage]} → {CUSTODY_DOC_STAGE_LABELS[handoff.toStage]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {formatTs(handoff.performedAt)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <User className="h-3 w-3 inline mr-1" />
                      {handoff.counterpartyName} · {handoff.counterpartyContact}
                    </p>
                    {handoff.counterpartyIdPhotoUrl && (
                      <a href={handoff.counterpartyIdPhotoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
                        <img src={handoff.counterpartyIdPhotoUrl} alt="ID" className="h-16 w-auto rounded-lg border border-border object-cover" data-testid={`img-id-${handoff.id}`} />
                      </a>
                    )}
                    {handoff.notes && (
                      <p className="text-xs text-muted-foreground italic mt-1">{handoff.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showHandoffForm} onOpenChange={setShowHandoffForm}>
        <DialogContent className="max-w-md" data-testid="dialog-handoff">
          <DialogHeader>
            <DialogTitle>Record Handoff</DialogTitle>
          </DialogHeader>
          {record && (
            <HandoffForm
              recordId={record.id}
              currentStage={record.custodyStage}
              onClose={() => setShowHandoffForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
