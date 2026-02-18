import { useState, useCallback, useRef } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Image,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  fileName: string;
  fileUrl?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  createdAt?: string;
}

interface EnhancedUploaderProps {
  existingFiles?: UploadedFile[];
  onUploadComplete: (file: { fileName: string; objectPath: string }) => void;
  onDelete?: (fileId: string) => void;
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  disabled?: boolean;
  onPreviewFile?: (file: UploadedFile) => void;
  showRequirements?: boolean;
  requirementsList?: { label: string; fulfilled: boolean }[];
}

type QueueItemStatus = "uploading" | "success" | "failed";

interface QueueItem {
  id: string;
  file: File;
  status: QueueItemStatus;
  progress: number;
  error?: string;
  objectPath?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null | undefined) {
  if (mimeType && mimeType.startsWith("image/")) {
    return <Image className="h-5 w-5 text-muted-foreground" />;
  }
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];
const ACCEPT_STRING = ".jpg,.jpeg,.png,.gif,.webp,.pdf";

let queueIdCounter = 0;

export function EnhancedUploader({
  existingFiles = [],
  onUploadComplete,
  onDelete,
  maxFiles = 5,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  disabled = false,
  onPreviewFile,
  showRequirements = false,
  requirementsList = [],
}: EnhancedUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalFileCount =
    existingFiles.length + queue.filter((q) => q.status === "success").length;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxFileSize) {
        return `"${file.name}" exceeds the ${formatFileSize(maxFileSize)} limit (${formatFileSize(file.size)})`;
      }
      if (!allowedTypes.includes(file.type)) {
        return `"${file.name}" is not an accepted file type. Only images (JPG, PNG, GIF, WebP) and PDFs are allowed.`;
      }
      return null;
    },
    [maxFileSize, allowedTypes]
  );

  const uploadFile = useCallback(
    async (queueItem: QueueItem) => {
      const { file, id } = queueItem;

      setQueue((prev) =>
        prev.map((q) =>
          q.id === id ? { ...q, status: "uploading" as const, progress: 0, error: undefined } : q
        )
      );

      try {
        const urlResponse = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type || "application/octet-stream",
          }),
        });

        if (!urlResponse.ok) {
          const errData = await urlResponse.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to get upload URL");
        }

        const { uploadURL, objectPath } = await urlResponse.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setQueue((prev) =>
                prev.map((q) => (q.id === id ? { ...q, progress: pct } : q))
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error("Upload failed"));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.onabort = () => reject(new Error("Upload aborted"));

          xhr.open("PUT", uploadURL);
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream"
          );
          xhr.send(file);
        });

        setQueue((prev) =>
          prev.map((q) =>
            q.id === id
              ? { ...q, status: "success" as const, progress: 100, objectPath }
              : q
          )
        );

        onUploadComplete({ fileName: file.name, objectPath });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        setQueue((prev) =>
          prev.map((q) =>
            q.id === id
              ? { ...q, status: "failed" as const, error: message }
              : q
          )
        );
      }
    },
    [onUploadComplete]
  );

  const processFiles = useCallback(
    (files: File[]) => {
      setValidationErrors([]);
      const errors: string[] = [];
      const validFiles: File[] = [];
      const slotsAvailable = maxFiles - totalFileCount;

      for (const file of files) {
        const validationError = validateFile(file);
        if (validationError) {
          errors.push(validationError);
        } else {
          validFiles.push(file);
        }
      }

      if (validFiles.length > slotsAvailable) {
        errors.push(
          `Only ${slotsAvailable} more file(s) can be uploaded (max ${maxFiles}).`
        );
        validFiles.splice(slotsAvailable);
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
      }

      const newItems: QueueItem[] = validFiles.map((file) => ({
        id: `upload-${++queueIdCounter}`,
        file,
        status: "uploading" as const,
        progress: 0,
      }));

      if (newItems.length > 0) {
        setQueue((prev) => [...prev, ...newItems]);
        newItems.forEach((item) => uploadFile(item));
      }
    },
    [maxFiles, totalFileCount, validateFile, uploadFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) processFiles(files);
    },
    [disabled, processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || disabled) return;
      processFiles(Array.from(files));
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [disabled, processFiles]
  );

  const retryUpload = useCallback(
    (id: string) => {
      const item = queue.find((q) => q.id === id);
      if (item) uploadFile(item);
    },
    [queue, uploadFile]
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  return (
    <div className="space-y-4" data-testid="enhanced-uploader">
      {showRequirements && requirementsList.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Required Documents</p>
          <div className="space-y-1">
            {requirementsList.map((req, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm"
                data-testid={`requirement-item-${idx}`}
              >
                {req.fulfilled ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span
                  className={cn(
                    req.fulfilled
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  )}
                >
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="space-y-1" data-testid="validation-errors">
          {validationErrors.map((err, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
          isDragging && "border-primary bg-primary/5",
          !isDragging && "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        data-testid="dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept={ACCEPT_STRING}
          multiple
          disabled={disabled}
          data-testid="file-input"
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground/60">
              Images (JPG, PNG, GIF, WebP) and PDFs up to{" "}
              {formatFileSize(maxFileSize)}
            </p>
          </div>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="space-y-2" data-testid="upload-queue">
          {queue.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border p-3"
              data-testid={`queue-item-${item.id}`}
            >
              <div className="flex-shrink-0">
                {getFileIcon(item.file.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(item.file.size)}
                </p>
                {item.status === "uploading" && (
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                      data-testid={`progress-bar-${item.id}`}
                    />
                  </div>
                )}
                {item.status === "failed" && item.error && (
                  <p className="text-xs text-destructive mt-1">{item.error}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {item.status === "uploading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {item.status === "success" && (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
                {item.status === "failed" && (
                  <>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        retryUpload(item.id);
                      }}
                      data-testid={`retry-button-${item.id}`}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {item.status !== "uploading" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(item.id);
                    }}
                    data-testid={`remove-queue-item-${item.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {existingFiles.length > 0 && (
        <div className="space-y-2" data-testid="existing-files">
          {existingFiles.map((file) => {
            const isImage =
              file.mimeType?.startsWith("image/") ||
              /\.(jpg|jpeg|png|gif|webp)$/i.test(file.fileName);
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-lg border p-3"
                data-testid={`existing-file-${file.id}`}
              >
                <div className="flex-shrink-0">
                  {isImage && file.fileUrl ? (
                    <div
                      className="h-10 w-10 rounded border overflow-hidden bg-muted cursor-pointer"
                      onClick={() => onPreviewFile?.(file)}
                      data-testid={`preview-file-${file.id}`}
                    >
                      <img
                        src={file.fileUrl}
                        alt={file.fileName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="h-10 w-10 rounded border flex items-center justify-center bg-muted cursor-pointer"
                      onClick={() => onPreviewFile?.(file)}
                      data-testid={`preview-file-${file.id}`}
                    >
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {file.fileName}
                  </p>
                  {file.fileSize != null && (
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.fileSize)}
                    </p>
                  )}
                </div>
                {onDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(file.id);
                    }}
                    disabled={disabled}
                    data-testid={`delete-file-${file.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
