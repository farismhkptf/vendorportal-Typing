import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentUploadZone } from "./document-upload-zone";
import { DOCUMENT_TYPE_LABELS, SERVICE_CATEGORY_LABELS, type DocumentType, type ServiceCategory } from "./document-types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageLightbox, type LightboxFile } from "@/components/image-lightbox";

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

interface DocumentRequirement {
  id: string;
  serviceCategory: string;
  documentType: string;
  isRequired: boolean;
  appliesToMedical: boolean;
  appliesToEid: boolean;
}

interface DocumentPanelProps {
  woId: string;
  serviceCategory?: ServiceCategory | null;
  context?: "medical" | "eid" | "all";
  title?: string;
}

export function DocumentPanel({
  woId,
  serviceCategory,
  context = "all",
  title = "Documents",
}: DocumentPanelProps) {
  const { toast } = useToast();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxFiles, setLightboxFiles] = useState<LightboxFile[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: documents = [], isLoading: loadingDocs } = useQuery<WoDocument[]>({
    queryKey: ["/api/work-orders", woId, "documents"],
    queryFn: () => fetch(`/api/work-orders/${woId}/documents`).then(r => r.json()),
    enabled: !!woId,
  });

  const { data: allRequirements = [] } = useQuery<DocumentRequirement[]>({
    queryKey: ["/api/document-requirements"],
  });

  const openLightbox = (fileUrl: string, _fileName: string) => {
    const allFiles: LightboxFile[] = documents
      .filter(d => d.fileUrl)
      .map(d => ({
        id: d.id,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        mimeType: d.mimeType,
      }));
    const idx = allFiles.findIndex(f => f.fileUrl === fileUrl);
    setLightboxFiles(allFiles);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const uploadMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: DocumentType }) => {
      setUploadingDocType(documentType);
      setUploadProgress(0);

      const presignResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!presignResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await presignResponse.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadURL, true);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 90);
            setUploadProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(95);
            resolve();
          } else {
            reject(new Error("Failed to upload file"));
          }
        };

        xhr.onerror = () => reject(new Error("Failed to upload file"));
        xhr.send(file);
      });

      setUploadProgress(98);

      const result = await apiRequest("POST", `/api/work-orders/${woId}/documents`, {
        documentType,
        fileName: file.name,
        fileUrl: objectPath,
        mimeType: file.type,
        fileSize: file.size,
      });

      setUploadProgress(100);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", woId, "documents"] });
      toast({ title: "Document uploaded successfully" });
      setUploadingDocType(null);
      setUploadProgress(0);
    },
    onError: () => {
      toast({ title: "Failed to upload document", variant: "destructive" });
      setUploadingDocType(null);
      setUploadProgress(0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiRequest("DELETE", `/api/documents/${documentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", woId, "documents"] });
      toast({ title: "Document deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
    },
  });

  const requirements = serviceCategory
    ? allRequirements.filter((r) => {
        if (r.serviceCategory !== serviceCategory) return false;
        if (context === "medical" && !r.appliesToMedical) return false;
        if (context === "eid" && !r.appliesToEid) return false;
        return true;
      })
    : [];

  const documentTypesToShow = serviceCategory
    ? requirements.map((r) => r.documentType as DocumentType)
    : (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]);

  const requiredTypes = requirements.filter((r) => r.isRequired).map((r) => r.documentType);
  const optionalTypes = requirements.filter((r) => !r.isRequired).map((r) => r.documentType);

  const uploadedTypes = documents.map((d) => d.documentType);
  const missingRequired = requiredTypes.filter((t) => !uploadedTypes.includes(t));
  const hasAllRequired = missingRequired.length === 0;

  const handleUpload = async (file: File, documentType: DocumentType) => {
    await uploadMutation.mutateAsync({ file, documentType });
  };

  const handleDelete = async (documentId: string) => {
    await deleteMutation.mutateAsync(documentId);
  };

  if (loadingDocs) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </CardTitle>
          {serviceCategory && (
            <Badge variant="outline">
              {SERVICE_CATEGORY_LABELS[serviceCategory] || serviceCategory}
            </Badge>
          )}
        </div>

        {serviceCategory && requirements.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            {hasAllRequired ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                All required documents uploaded
              </span>
            ) : (
              <span className="text-sm text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                {missingRequired.length} required document{missingRequired.length !== 1 ? "s" : ""} missing
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!serviceCategory && (
          <p className="text-sm text-muted-foreground">
            Select a service type on the work order to see required documents.
          </p>
        )}

        {serviceCategory && documentTypesToShow.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No document requirements for this service type.
          </p>
        )}

        {documentTypesToShow.map((docType) => (
          <DocumentUploadZone
            key={docType}
            woId={woId}
            documents={documents}
            documentType={docType}
            isRequired={requiredTypes.includes(docType)}
            onUpload={handleUpload}
            onDelete={handleDelete}
            onPreviewFile={(fileUrl, fileName) => openLightbox(fileUrl, fileName)}
            disabled={uploadMutation.isPending || deleteMutation.isPending}
            externalProgress={uploadingDocType === docType ? uploadProgress : null}
            externalUploading={uploadingDocType === docType && uploadMutation.isPending}
          />
        ))}

        {documents.filter((d) => !documentTypesToShow.includes(d.documentType as DocumentType)).length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2 text-muted-foreground">Other Uploaded Documents</p>
            {documents
              .filter((d) => !documentTypesToShow.includes(d.documentType as DocumentType))
              .map((doc) => {
                const fileUrl = doc.fileUrl || "";
                const isImage = doc.mimeType?.startsWith("image/") || doc.fileName?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
                const isPdf = doc.mimeType === "application/pdf" || doc.fileName?.match(/\.pdf$/i);
                return (
                  <div key={doc.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      {isImage && fileUrl ? (
                        <div
                          className="h-10 w-10 rounded border overflow-hidden flex-shrink-0 bg-muted cursor-pointer"
                          onClick={() => openLightbox(fileUrl, doc.fileName)}
                          data-testid={`preview-other-image-${doc.id}`}
                        >
                          <img src={fileUrl} alt={doc.fileName} className="h-full w-full object-cover" />
                        </div>
                      ) : isPdf && fileUrl ? (
                        <div
                          className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted hover-elevate cursor-pointer"
                          onClick={() => openLightbox(fileUrl, doc.fileName)}
                          data-testid={`preview-other-pdf-${doc.id}`}
                        >
                          <FileText className="h-5 w-5 text-red-500" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="truncate">{doc.fileName}</span>
                    </div>
                    <Badge variant="secondary">{doc.documentType}</Badge>
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>

      <ImageLightbox
        files={lightboxFiles}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </Card>
  );
}
