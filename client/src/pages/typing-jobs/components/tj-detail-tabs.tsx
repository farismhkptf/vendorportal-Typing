import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileText, Upload, Download, MessageSquare, Send,
  User, History
} from "lucide-react";
import { formatDateTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { EnhancedUploader } from "@/components/enhanced-uploader";
import { ImageLightbox, type LightboxFile } from "@/components/image-lightbox";
import { DocumentPanel } from "@/components/documents/document-panel";
import type { ServiceCategory } from "@/components/documents/document-types";
import { ActivityTimeline, type ActivityItem } from "@/components/ui/activity-timeline";
import { queryKeys } from "@/lib/query-keys";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { File as FileType, TypingJobComment } from "@shared/schema";
import type { TypingJobWithDetails } from "./job-header";

interface TjDetailTabsProps {
  job: TypingJobWithDetails;
  activities: ActivityItem[];
  photoMap: Record<string, string> | undefined;
}

export function TjDetailTabs({ job, activities, photoMap }: TjDetailTabsProps) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxFiles, setLightboxFiles] = useState<LightboxFile[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const inputFiles = job.files?.filter((f) => f.direction === "Input") || [];
  const outputFiles = job.files?.filter((f) => f.direction === "Output") || [];

  const openLightbox = (files: FileType[], index: number) => {
    const lbFiles: LightboxFile[] = files
      .filter((f) => f.workdriveLink)
      .map((f) => ({
        id: f.id,
        fileName: f.fileName || "File",
        fileUrl: f.workdriveLink || "",
        mimeType: f.mimeType || null,
      }));
    setLightboxFiles(lbFiles);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const saveFileMutation = useMutation({
    mutationFn: async (data: { fileName: string; objectPath: string; direction: "Input" | "Output"; expiresAt?: string | null }) => {
      return apiRequest("POST", "/api/files", {
        relatedType: "TypingJob",
        relatedId: job.id,
        direction: data.direction,
        fileName: data.fileName,
        workdriveLink: data.objectPath,
        uploadedByType: "Internal",
        ...(data.expiresAt ? { expiresAt: data.expiresAt } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.typingJob(job.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs("typing_job", job.id) });
      toast({ title: "File uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save file", variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest("DELETE", `/api/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.typingJob(job.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs("typing_job", job.id) });
      toast({ title: "File deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete file", variant: "destructive" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", `/api/typing-jobs/${job.id}/comments`, {
        message,
        authorType: "Internal",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.typingJob(job.id) });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  return (
    <>
      <Tabs defaultValue="files" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="files" className="gap-2" data-testid="tab-files">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="comments" className="gap-2" data-testid="tab-comments">
            <MessageSquare className="h-4 w-4" />
            Comments ({job.comments?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2" data-testid="tab-activity">
            <History className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="mt-4 space-y-4">
          {job.workOrder && (
            <DocumentPanel
              woId={job.woId}
              serviceCategory={(job.workOrder.serviceType?.category as ServiceCategory) || null}
              context={job.jobType?.category === "Medical" ? "medical" : job.jobType?.category === "EID" ? "eid" : "all"}
              title="Work Order Documents"
            />
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4 text-blue-500" />
                  Sent to Vendor ({inputFiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EnhancedUploader
                  existingFiles={inputFiles.map(f => ({
                    id: f.id,
                    fileName: f.fileName || "File",
                    fileUrl: f.workdriveLink || undefined,
                    mimeType: f.mimeType,
                    fileSize: null,
                    createdAt: f.createdAt ? String(f.createdAt) : undefined,
                    expiresAt: f.expiresAt ? String(f.expiresAt) : null,
                  }))}
                  onUploadComplete={(file) => {
                    saveFileMutation.mutate({ fileName: file.fileName, objectPath: file.objectPath, direction: "Input", expiresAt: file.expiresAt });
                  }}
                  showExpiryDate
                  onDelete={(fileId) => deleteFileMutation.mutate(fileId)}
                  maxFiles={10}
                  onPreviewFile={(file) => {
                    if (file.fileUrl) {
                      const idx = inputFiles.findIndex(f => f.id === file.id);
                      openLightbox(inputFiles, idx >= 0 ? idx : 0);
                    }
                  }}
                />
              </CardContent>
            </Card>

            <Card className="border border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Download className="h-4 w-4 text-green-500" />
                  Received from Vendor ({outputFiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {outputFiles.length > 0 ? (
                  <div className="space-y-2">
                    {outputFiles.map((file, idx) => {
                      const fileUrl = file.workdriveLink || "";
                      const isImg = file.fileName?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
                      const isPdfFile = file.fileName?.match(/\.pdf$/i);
                      return (
                        <div key={file.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3 min-w-0">
                            {isImg && fileUrl ? (
                              <button
                                type="button"
                                onClick={() => openLightbox(outputFiles, idx)}
                                className="h-10 w-10 rounded border overflow-hidden flex-shrink-0 bg-muted cursor-pointer"
                                data-testid={`preview-output-${file.id}`}
                              >
                                <img src={fileUrl} alt={file.fileName} className="h-full w-full object-cover" />
                              </button>
                            ) : isPdfFile && fileUrl ? (
                              <button
                                type="button"
                                onClick={() => openLightbox(outputFiles, idx)}
                                className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted cursor-pointer"
                                data-testid={`preview-output-${file.id}`}
                              >
                                <FileText className="h-5 w-5 text-red-500" />
                              </button>
                            ) : (
                              <div className="h-10 w-10 rounded border flex items-center justify-center flex-shrink-0 bg-muted">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-sm truncate">{file.fileName}</span>
                          </div>
                          {fileUrl && (
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-download-output-${file.id}`}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No documents received yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          <Card className="border border-border/50">
            <CardContent className="pt-4">
              <div className="flex gap-2 mb-4">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[80px] resize-none"
                  data-testid="textarea-comment"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  onClick={() => addCommentMutation.mutate(newComment)}
                  data-testid="button-add-comment"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </Button>
              </div>

              <div className="mt-6 space-y-4">
                {job.comments && job.comments.length > 0 ? (
                  job.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          comment.authorType === "Vendor"
                            ? "bg-orange-100 text-orange-600"
                            : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {comment.authorType === "Vendor" ? "Vendor" : "Team"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{comment.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<MessageSquare className="h-5 w-5" />}
                    title="No comments yet"
                    description="Add a comment to start a conversation about this job."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="border border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={activities} photoMap={photoMap} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ImageLightbox
        files={lightboxFiles}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
