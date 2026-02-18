import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, X, File, FileText, Image, CheckCircle, AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "./document-types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

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
  onPreviewFile?: (fileUrl: string, fileName: string) => void;
  disabled?: boolean;
  externalProgress?: number | null;
  externalUploading?: boolean;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Invalid file type "${file.type || "unknown"}". Only images (JPG, PNG, GIF, WebP) and PDFs are allowed.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File size (${formatFileSize(file.size)}) exceeds the 10MB limit.`;
  }
  return null;
}

export function DocumentUploadZone({
  woId,
  documents,
  documentType,
  isRequired = false,
  onUpload,
  onDelete,
  onStatusChange,
  onPreviewFile,
  disabled = false,
  externalProgress = null,
  externalUploading = false,
}: DocumentUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "failed">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const existingDoc = documents.find((d) => d.documentType === documentType);

  const isUploading = uploadStatus === "uploading" || externalUploading;
  const displayProgress = externalProgress !== null && externalProgress !== undefined ? externalProgress : uploadProgress;

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const startSimulatedProgress = useCallback(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setUploadProgress(0);
    let p = 0;
    progressTimerRef.current = setInterval(() => {
      p += Math.random() * 8 + 2;
      if (p >= 90) {
        p = 90;
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      }
      setUploadProgress(Math.round(p));
    }, 200);
  }, []);

  const stopSimulatedProgress = useCallback(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
  }, []);

  const processFile = useCallback(async (file: File) => {
    setUploadError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setLastFile(file);
    setUploadingFileName(file.name);
    setUploadStatus("uploading");
    startSimulatedProgress();

    try {
      await onUpload(file, documentType);
      stopSimulatedProgress();
      setUploadProgress(100);
      setUploadStatus("success");
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadProgress(0);
        setUploadingFileName(null);
        setLastFile(null);
      }, 2000);
    } catch {
      stopSimulatedProgress();
      setUploadStatus("failed");
      setUploadError("Upload failed. Please try again.");
    }
  }, [onUpload, documentType, startSimulatedProgress, stopSimulatedProgress]);

  const handleRetry = useCallback(() => {
    if (lastFile) {
      processFile(lastFile);
    }
  }, [lastFile, processFile]);

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
      await processFile(files[0]);
    }
  }, [disabled, isUploading, processFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || disabled || isUploading) return;

    await processFile(files[0]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [disabled, isUploading, processFile]);

  const handleDelete = useCallback(async () => {
    if (!existingDoc || disabled) return;
    await onDelete(existingDoc.id);
  }, [existingDoc, disabled, onDelete]);

  const handlePreview = useCallback(() => {
    if (!existingDoc?.fileUrl) return;
    if (onPreviewFile) {
      onPreviewFile(existingDoc.fileUrl, existingDoc.fileName);
    } else {
      window.open(existingDoc.fileUrl, "_blank");
    }
  }, [existingDoc, onPreviewFile]);

  const isImageDoc = existingDoc?.mimeType?.startsWith("image/");
  const isPdf = existingDoc?.mimeType === "application/pdf";
  const fileProxyUrl = existingDoc?.fileUrl || "";
  const label = DOCUMENT_TYPE_LABELS[documentType] || documentType;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
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
            {isImageDoc ? (
              <div
                className="h-16 w-16 rounded border overflow-hidden flex-shrink-0 bg-muted cursor-pointer"
                onClick={handlePreview}
                data-testid={`preview-image-${documentType}`}
              >
                <img
                  src={fileProxyUrl}
                  alt={existingDoc.fileName}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : isPdf ? (
              <div
                className="h-16 w-16 rounded border flex items-center justify-center flex-shrink-0 bg-muted hover-elevate cursor-pointer"
                onClick={handlePreview}
                data-testid={`preview-pdf-${documentType}`}
              >
                <FileText className="h-6 w-6 text-red-500" />
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
            !isDragging && !isUploading && "border-muted-foreground/25 hover:border-muted-foreground/50",
            isUploading && "border-primary/50",
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
            {uploadStatus === "uploading" ? (
              <>
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <div className="w-full max-w-[200px]">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${displayProgress}%` }}
                      data-testid={`progress-bar-${documentType}`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploading{uploadingFileName ? ` ${uploadingFileName}` : ""}... {displayProgress}%
                  </p>
                </div>
              </>
            ) : uploadStatus === "success" ? (
              <>
                <CheckCircle className="h-8 w-8 text-green-500" />
                <p className="text-sm text-green-600">Upload complete</p>
              </>
            ) : uploadStatus === "failed" ? (
              <>
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-destructive">Upload failed</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetry();
                  }}
                  data-testid={`button-retry-upload-${documentType}`}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Drop file here or click to upload
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Images (JPG, PNG, GIF, WebP) and PDFs only. Max 10MB.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {uploadError && uploadStatus !== "uploading" && (
        <p className="text-xs text-destructive" data-testid={`error-upload-${documentType}`}>
          {uploadError}
        </p>
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
