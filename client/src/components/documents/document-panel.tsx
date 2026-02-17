import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentUploadZone } from "./document-upload-zone";
import { DOCUMENT_TYPE_LABELS, SERVICE_CATEGORY_LABELS, type DocumentType, type ServiceCategory } from "./document-types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  const { data: documents = [], isLoading: loadingDocs } = useQuery<WoDocument[]>({
    queryKey: ["/api/work-orders", woId, "documents"],
    queryFn: () => fetch(`/api/work-orders/${woId}/documents`).then(r => r.json()),
    enabled: !!woId,
  });

  const { data: allRequirements = [] } = useQuery<DocumentRequirement[]>({
    queryKey: ["/api/document-requirements"],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: DocumentType }) => {
      // Step 1: Get presigned URL
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

      // Step 2: Upload file directly to storage
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Step 3: Save document record with object path as URL
      return apiRequest("POST", `/api/work-orders/${woId}/documents`, {
        documentType,
        fileName: file.name,
        fileUrl: objectPath,
        mimeType: file.type,
        fileSize: file.size,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", woId, "documents"] });
      toast({ title: "Document uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to upload document", variant: "destructive" });
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
            disabled={uploadMutation.isPending || deleteMutation.isPending}
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
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded border overflow-hidden flex-shrink-0 bg-muted">
                          <img src={fileUrl} alt={doc.fileName} className="h-full w-full object-cover" />
                        </a>
                      ) : isPdf && fileUrl ? (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted hover-elevate cursor-pointer">
                          <FileText className="h-5 w-5 text-red-500" />
                        </a>
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
    </Card>
  );
}
