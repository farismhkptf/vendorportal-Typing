import { useState } from "react";
import { FileText, Upload, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { WoDocument } from "@shared/schema";
import { DOCUMENT_TYPE_LABELS } from "./types";

interface ResubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  woDocuments: WoDocument[];
  onSubmit: (data: { documentTypes: string[]; remarks: string; screenshotUrl?: string; screenshotName?: string }) => void;
  isPending: boolean;
}

export function ResubmissionDialog({ open, onOpenChange, woDocuments, onSubmit, isPending }: ResubmissionDialogProps) {
  const { toast } = useToast();
  const [resubmissionDocs, setResubmissionDocs] = useState<string[]>([]);
  const [resubmissionRemarks, setResubmissionRemarks] = useState("");
  const [resubmissionScreenshotUrl, setResubmissionScreenshotUrl] = useState("");
  const [resubmissionScreenshotName, setResubmissionScreenshotName] = useState("");
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setResubmissionDocs([]);
      setResubmissionRemarks("");
      setResubmissionScreenshotUrl("");
      setResubmissionScreenshotName("");
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingScreenshot(true);
    try {
      const res = await fetch("/api/uploads/request-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const data = await res.json();
      await fetch(data.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      setResubmissionScreenshotUrl(data.objectPath);
      setResubmissionScreenshotName(file.name);
    } catch {
      toast({ title: "Failed to upload screenshot", variant: "destructive" });
    } finally {
      setUploadingScreenshot(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Document Resubmission</DialogTitle>
          <DialogDescription>Select which documents need to be changed and explain what's wrong.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Which documents need to be changed?</p>
            {Array.isArray(woDocuments) && woDocuments.length > 0 ? (
              woDocuments.map((doc) => {
                const label = DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType;
                const isImage = doc.mimeType?.startsWith("image/");
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                    <Checkbox
                      id={`v2-resub-doc-${doc.id}`}
                      checked={resubmissionDocs.includes(doc.documentType)}
                      onCheckedChange={(checked) => {
                        if (checked) setResubmissionDocs(prev => prev.includes(doc.documentType) ? prev : [...prev, doc.documentType]);
                        else setResubmissionDocs(prev => prev.filter(d => d !== doc.documentType));
                      }}
                      data-testid={`v2-checkbox-doc-${doc.documentType}`}
                    />
                    <label htmlFor={`v2-resub-doc-${doc.id}`} className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                      {isImage && doc.fileUrl ? (
                        <img src={doc.fileUrl} alt={doc.fileName} className="h-8 w-8 rounded object-cover border shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded border flex items-center justify-center bg-muted shrink-0"><FileText className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{label}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                      </div>
                    </label>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Reason for resubmission</p>
            <textarea
              value={resubmissionRemarks}
              onChange={(e) => setResubmissionRemarks(e.target.value)}
              placeholder="Explain what needs to be corrected..."
              className="w-full min-h-20 resize-none border rounded-md p-2 text-sm bg-background"
              data-testid="v2-input-resubmission-remarks"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Attach screenshot <span className="text-muted-foreground font-normal">(optional)</span></p>
            {resubmissionScreenshotUrl ? (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                <img src={resubmissionScreenshotUrl} alt="Screenshot" className="h-12 w-12 rounded object-cover border shrink-0" />
                <span className="text-sm truncate flex-1">{resubmissionScreenshotName}</span>
                <Button variant="ghost" size="icon" onClick={() => { setResubmissionScreenshotUrl(""); setResubmissionScreenshotName(""); }} data-testid="v2-button-remove-screenshot">
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <input type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" id="v2-screenshot-upload" data-testid="v2-input-screenshot-upload" />
                <label htmlFor="v2-screenshot-upload">
                  <Button variant="outline" asChild disabled={uploadingScreenshot}>
                    <span className="gap-2 cursor-pointer"><Upload className="h-4 w-4" />{uploadingScreenshot ? "Uploading..." : "Choose file"}</span>
                  </Button>
                </label>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="v2-button-cancel-resubmission">Cancel</Button>
          <Button
            onClick={() => onSubmit({
              documentTypes: resubmissionDocs, remarks: resubmissionRemarks,
              ...(resubmissionScreenshotUrl ? { screenshotUrl: resubmissionScreenshotUrl, screenshotName: resubmissionScreenshotName } : {})
            })}
            disabled={resubmissionDocs.length === 0 || !resubmissionRemarks.trim() || isPending || uploadingScreenshot}
            data-testid="v2-button-confirm-resubmission"
          >
            {isPending ? "Sending..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
