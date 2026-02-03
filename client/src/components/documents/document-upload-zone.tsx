import { useState, useCallback, useRef } from "react";
import { Upload, X, File, Image, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "./document-types";

interface WoDocument {
  id: string;
  woId: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  status: "Pending" | "Uploaded" | "Verified";
  uploadedAt: string;
}

interface DocumentUploadZoneProps {
  woId: string;
  documents: WoDocument[];
  documentType: DocumentType;
  isRequired?: boolean;
  onUpload: (file: File, documentType: DocumentType) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onStatusChange?: (documentId: string, status: "Pending" | "Uploaded" | "Verified") => Promise<void>;
  disabled?: boolean;
}

export function DocumentUploadZone({
  woId,
  documents,
  documentType,
  isRequired = false,
  onUpload,
  onDelete,
  onStatusChange,
  disabled = false,
}: DocumentUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingDoc = documents.find((d) => d.documentType === documentType);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setIsUploading(true);
      try {
        await onUpload(files[0], documentType);
      } finally {
        setIsUploading(false);
      }
    }
  }, [disabled, isUploading, onUpload, documentType]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || disabled || isUploading) return;

    setIsUploading(true);
    try {
      await onUpload(files[0], documentType);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [disabled, isUploading, onUpload, documentType]);

  const handleDelete = useCallback(async () => {
    if (!existingDoc || disabled) return;
    await onDelete(existingDoc.id);
  }, [existingDoc, disabled, onDelete]);

  const isImage = existingDoc?.mimeType?.startsWith("image/");
  const label = DOCUMENT_TYPE_LABELS[documentType] || documentType;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {label}
          {isRequired && <span className="text-destructive ml-1">*</span>}
        </span>
        {existingDoc && (
          <StatusBadge status={existingDoc.status} />
        )}
      </div>

      {existingDoc ? (
        <div className="border rounded-lg p-3 bg-card">
          <div className="flex items-center gap-3">
            {isImage ? (
              <div className="h-16 w-16 rounded border overflow-hidden flex-shrink-0 bg-muted">
                <img
                  src={existingDoc.fileUrl}
                  alt={existingDoc.fileName}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-16 w-16 rounded border flex items-center justify-center flex-shrink-0 bg-muted">
                <File className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{existingDoc.fileName}</p>
              {existingDoc.fileSize && (
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(existingDoc.fileSize)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                disabled={disabled}
                data-testid={`button-delete-document-${documentType}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
            isDragging && "border-primary bg-primary/5",
            !isDragging && "border-muted-foreground/25 hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          data-testid={`dropzone-${documentType}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf"
            disabled={disabled || isUploading}
          />
          <div className="flex flex-col items-center gap-2 text-center">
            {isUploading ? (
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm text-muted-foreground">
                {isUploading ? "Uploading..." : "Drop file here or click to upload"}
              </p>
              <p className="text-xs text-muted-foreground/60">
                Supports images and PDFs
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "Pending" | "Uploaded" | "Verified" }) {
  const config = {
    Pending: { icon: AlertCircle, className: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20" },
    Uploaded: { icon: CheckCircle, className: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
    Verified: { icon: CheckCircle, className: "text-green-600 bg-green-50 dark:bg-green-900/20" },
  };
  
  const { icon: Icon, className } = config[status];
  
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", className)}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
