import { useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, Camera, User, Phone, CheckCircle2, 
  AlertCircle, ChevronDown, ChevronUp, FileImage
} from "lucide-react";
import { cn } from "@/lib/utils";

const DIRECTION_LABELS: Record<string, { title: string; description: string; counterpartyLabel: string }> = {
  ClientToUs: {
    title: "Client handing documents to your team",
    description: "Collect documents from the client",
    counterpartyLabel: "Client / Representative",
  },
  UsToVendor: {
    title: "Your team handing documents to vendor",
    description: "Hand documents to the attestation vendor",
    counterpartyLabel: "Vendor Representative",
  },
  VendorToUs: {
    title: "Vendor returning documents to your team",
    description: "Confirm document return from vendor (dual signature required)",
    counterpartyLabel: "Vendor Handover Person",
  },
  UsToClient: {
    title: "Your team returning documents to client",
    description: "Return documents to the client",
    counterpartyLabel: "Client / Representative",
  },
};

const formSchema = z.object({
  counterpartyName: z.string().min(1, "Name is required"),
  counterpartyContact: z.string().min(1, "Contact is required"),
  isRegularContact: z.boolean(),
  approverName: z.string().optional(),
  approverContact: z.string().optional(),
  approverDesignation: z.string().optional(),
  receivingStaffName: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface HandoverFormProps {
  srId: string;
  srNumber: string;
  direction: "ClientToUs" | "UsToVendor" | "VendorToUs" | "UsToClient";
  defaultStaffName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  apiEndpoint?: string;
}

type Stage = "form" | "confirm" | "done";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function HandoverForm({
  srId,
  srNumber,
  direction,
  defaultStaffName = "",
  onSuccess,
  onCancel,
  apiEndpoint,
}: HandoverFormProps) {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>("form");
  const [idPhotoDataUrl, setIdPhotoDataUrl] = useState<string | null>(null);
  const [approverOpen, setApproverOpen] = useState(false);

  const cpSigRef = useRef<SignaturePadHandle>(null);
  const staffSigRef = useRef<SignaturePadHandle>(null);

  const [cpSigDataUrl, setCpSigDataUrl] = useState<string | null>(null);
  const [staffSigDataUrl, setStaffSigDataUrl] = useState<string | null>(null);

  const idPhotoInputRef = useRef<HTMLInputElement>(null);

  const isVendorToUs = direction === "VendorToUs";
  const directionInfo = DIRECTION_LABELS[direction];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      counterpartyName: "",
      counterpartyContact: "",
      isRegularContact: true,
      approverName: "",
      approverContact: "",
      approverDesignation: "",
      receivingStaffName: defaultStaffName,
      notes: "",
    },
  });

  const isRegularContact = form.watch("isRegularContact");

  const endpoint = apiEndpoint || `/api/attestation/sr/${srId}/custody`;

  const submitMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const fd = new FormData();
      fd.append("handoverDirection", direction);
      fd.append("counterpartyName", values.counterpartyName);
      fd.append("counterpartyContact", values.counterpartyContact);
      if (values.notes) fd.append("notes", values.notes);

      if (!isRegularContact) {
        if (values.approverName) fd.append("approverName", values.approverName);
        if (values.approverContact) fd.append("approverContact", values.approverContact);
        if (values.approverDesignation) fd.append("approverDesignation", values.approverDesignation);
      }

      if (isVendorToUs && values.receivingStaffName) {
        fd.append("receivingStaffName", values.receivingStaffName);
      }

      if (idPhotoDataUrl) {
        const blob = dataUrlToBlob(idPhotoDataUrl);
        fd.append("counterpartyIdPhoto", blob, "id_photo.jpg");
      }

      if (cpSigDataUrl) {
        const blob = dataUrlToBlob(cpSigDataUrl);
        fd.append("counterpartySignature", blob, "cp_signature.png");
      }

      if (isVendorToUs && staffSigDataUrl) {
        const blob = dataUrlToBlob(staffSigDataUrl);
        fd.append("receivingStaffSignature", blob, "staff_signature.png");
      }

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to submit" }));
        throw new Error(err.message || "Failed to submit");
      }

      return res.json();
    },
    onSuccess: () => {
      setStage("done");
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/sr"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/sr", srId] });
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/sr", srId, "custody"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/jobs"] });
    },
    onError: (err: any) => {
      toast({
        title: "Submission failed",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleIdPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setIdPhotoDataUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProceedToConfirm = () => {
    const values = form.getValues();
    const errors: string[] = [];

    if (!values.counterpartyName) errors.push("Counterparty name is required");
    if (!values.counterpartyContact) errors.push("Counterparty contact is required");
    if (!idPhotoDataUrl) errors.push("ID photo is required");
    if (!cpSigDataUrl) errors.push("Counterparty signature is required");
    if (!isRegularContact && !values.approverName) errors.push("Approver name is required when not regular contact");
    if (!isRegularContact && values.approverName && !values.approverContact) errors.push("Approver contact is required");
    if (isVendorToUs) {
      if (!values.receivingStaffName) errors.push("Receiving staff name is required");
      if (!staffSigDataUrl) errors.push("Receiving staff signature is required");
    }

    if (errors.length > 0) {
      toast({
        title: "Please complete all required fields",
        description: errors[0],
        variant: "destructive",
      });
      return;
    }

    setStage("confirm");
  };

  const handleSubmit = () => {
    submitMutation.mutate(form.getValues());
  };

  if (stage === "done") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6 text-center" data-testid="handover-success">
        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Handover Recorded</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Custody acknowledgement for {srNumber} has been saved successfully.
          </p>
        </div>
        {onSuccess && (
          <Button onClick={onSuccess} data-testid="button-done">
            Done
          </Button>
        )}
      </div>
    );
  }

  if (stage === "confirm") {
    const values = form.getValues();
    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6" data-testid="confirm-screen">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStage("form")} data-testid="button-back-from-confirm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-foreground">Review & Confirm</h2>
            <p className="text-xs text-muted-foreground">Review before submitting</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm">
          <div>
            <span className="font-medium text-foreground">Direction:</span>{" "}
            <span className="text-muted-foreground">{directionInfo.title}</span>
          </div>
          <div>
            <span className="font-medium text-foreground">{directionInfo.counterpartyLabel}:</span>{" "}
            <span className="text-muted-foreground">{values.counterpartyName}</span>
          </div>
          <div>
            <span className="font-medium text-foreground">Contact:</span>{" "}
            <span className="text-muted-foreground">{values.counterpartyContact}</span>
          </div>
          {!isRegularContact && values.approverName && (
            <div>
              <span className="font-medium text-foreground">Approved By:</span>{" "}
              <span className="text-muted-foreground">
                {values.approverName} ({values.approverDesignation || "—"}) · {values.approverContact}
              </span>
            </div>
          )}
          {idPhotoDataUrl && (
            <div>
              <span className="font-medium text-foreground block mb-1">ID Photo:</span>
              <img src={idPhotoDataUrl} alt="ID" className="h-24 w-auto rounded-lg border border-border object-cover" data-testid="img-confirm-id-photo" />
            </div>
          )}
          <div>
            <span className="font-medium text-foreground block mb-1">Counterparty Signature:</span>
            {cpSigDataUrl && (
              <img src={cpSigDataUrl} alt="Signature" className="h-16 w-auto rounded-lg border border-border bg-white dark:bg-slate-900 object-contain" data-testid="img-confirm-cp-sig" />
            )}
          </div>
          {isVendorToUs && (
            <>
              <div>
                <span className="font-medium text-foreground">Receiving PRO:</span>{" "}
                <span className="text-muted-foreground">{values.receivingStaffName}</span>
              </div>
              {staffSigDataUrl && (
                <div>
                  <span className="font-medium text-foreground block mb-1">PRO Signature:</span>
                  <img src={staffSigDataUrl} alt="PRO Signature" className="h-16 w-auto rounded-lg border border-border bg-white dark:bg-slate-900 object-contain" data-testid="img-confirm-staff-sig" />
                </div>
              )}
            </>
          )}
          {values.notes && (
            <div>
              <span className="font-medium text-foreground">Notes:</span>{" "}
              <span className="text-muted-foreground">{values.notes}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStage("form")} className="flex-1" data-testid="button-edit-form">
            Edit
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
            disabled={submitMutation.isPending}
            data-testid="button-confirm-submit"
          >
            {submitMutation.isPending ? "Submitting..." : "Confirm & Submit"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6" data-testid="handover-form">
      <div className="flex items-center gap-3">
        {onCancel && (
          <Button variant="ghost" size="icon" onClick={onCancel} data-testid="button-cancel-handover">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h2 className="font-semibold text-foreground">{directionInfo.title}</h2>
          <p className="text-xs text-muted-foreground">SR: {srNumber} · {directionInfo.description}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4" />
            {directionInfo.counterpartyLabel}
          </h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="input-cp-name">Full Name *</Label>
              <Input
                id="input-cp-name"
                {...form.register("counterpartyName")}
                placeholder="Enter full name"
                data-testid="input-counterparty-name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="input-cp-contact">
                <Phone className="h-3.5 w-3.5 inline mr-1" />
                Phone / Contact *
              </Label>
              <Input
                id="input-cp-contact"
                {...form.register("counterpartyContact")}
                placeholder="+971 50 ..."
                data-testid="input-counterparty-contact"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileImage className="h-4 w-4" />
            ID Photo *
          </h3>
          <p className="text-xs text-muted-foreground">Required for external parties. Take a photo or upload.</p>
          <input
            ref={idPhotoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleIdPhotoChange}
            className="hidden"
            data-testid="input-id-photo"
          />
          {idPhotoDataUrl ? (
            <div className="relative">
              <img
                src={idPhotoDataUrl}
                alt="ID"
                className="w-full max-h-48 rounded-lg object-cover border border-border"
                data-testid="img-id-photo-preview"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setIdPhotoDataUrl(null); if (idPhotoInputRef.current) idPhotoInputRef.current.value = ""; }}
                className="mt-2"
                data-testid="button-retake-id-photo"
              >
                Retake
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => idPhotoInputRef.current?.click()}
              className="w-full gap-2"
              data-testid="button-capture-id-photo"
            >
              <Camera className="h-4 w-4" />
              Capture / Upload ID Photo
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <button
            type="button"
            onClick={() => {
              const newVal = !isRegularContact;
              form.setValue("isRegularContact", newVal);
              setApproverOpen(!newVal);
            }}
            className="w-full flex items-center justify-between text-sm font-medium text-foreground"
            data-testid="button-toggle-approver"
          >
            <span>Is this the regular authorized contact?</span>
            {isRegularContact ? (
              <span className="text-green-600 dark:text-green-400 text-xs font-semibold">YES</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold">NO</span>
            )}
          </button>

          {!isRegularContact && (
            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Approver details are required when the person is not the regular authorized contact.
                </p>
              </div>
              <div>
                <Label htmlFor="input-approver-name">Approver Name *</Label>
                <Input
                  id="input-approver-name"
                  {...form.register("approverName")}
                  placeholder="Approver full name"
                  data-testid="input-approver-name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="input-approver-contact">Approver Contact *</Label>
                <Input
                  id="input-approver-contact"
                  {...form.register("approverContact")}
                  placeholder="+971 50 ..."
                  data-testid="input-approver-contact"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="input-approver-designation">Approver Designation / Role</Label>
                <Input
                  id="input-approver-designation"
                  {...form.register("approverDesignation")}
                  placeholder="e.g. HR Manager"
                  data-testid="input-approver-designation"
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Counterparty Signature *</h3>
          <p className="text-xs text-muted-foreground">Ask the person to sign using finger or stylus.</p>
          <SignaturePad
            ref={cpSigRef}
            onSignatureChange={setCpSigDataUrl}
            data-testid="signature-pad-counterparty"
          />
        </div>

        {isVendorToUs && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Receiving PRO (Your Team)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Dual-signatory required for document return from vendor.</p>
            </div>
            <div>
              <Label htmlFor="input-staff-name">Receiving Staff Name *</Label>
              <Input
                id="input-staff-name"
                {...form.register("receivingStaffName")}
                placeholder="Your name"
                data-testid="input-receiving-staff-name"
                className="mt-1"
              />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">PRO Signature *</h4>
              <SignaturePad
                ref={staffSigRef}
                onSignatureChange={setStaffSigDataUrl}
                data-testid="signature-pad-staff"
              />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card/50 p-4">
          <Label htmlFor="input-notes">Notes (optional)</Label>
          <Textarea
            id="input-notes"
            {...form.register("notes")}
            placeholder="Any additional notes..."
            data-testid="input-notes"
            className="mt-1 resize-none"
            rows={2}
          />
        </div>
      </div>

      <div className="flex gap-3 pb-4">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1" data-testid="button-cancel">
            Cancel
          </Button>
        )}
        <Button onClick={handleProceedToConfirm} className="flex-1" data-testid="button-proceed-confirm">
          Review & Confirm
        </Button>
      </div>
    </div>
  );
}
