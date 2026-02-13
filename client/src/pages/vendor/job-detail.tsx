import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { 
  ArrowLeft, FileText, User, Clock, Calendar, 
  Upload, Download, MessageSquare, Send, LogOut, CheckCircle2
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ObjectUploader } from "@/components/ObjectUploader";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { 
  TypingJob, WorkOrder, JobType, 
  TypingJobComment, File as FileType 
} from "@shared/schema";

interface VendorJobDetails extends TypingJob {
  workOrder?: WorkOrder;
  jobType?: JobType;
  comments?: TypingJobComment[];
  files?: FileType[];
  instructions?: string;
}

const VENDOR_STATUS_OPTIONS = [
  { value: "InProgress", label: "In Progress" },
  { value: "WaitingForDocs", label: "Waiting for Docs" },
  { value: "Returned", label: "Returned (Complete)" },
];

export default function VendorJobDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const { data: job, isLoading } = useQuery<VendorJobDetails>({
    queryKey: ["/api/vendor/jobs", id],
  });

  const fileObjectPathsRef = useRef<Map<string, string>>(new Map());

  const saveFileMutation = useMutation({
    mutationFn: async (data: { fileName: string; objectPath: string }) => {
      return apiRequest("POST", `/api/vendor/jobs/${id}/files`, {
        fileName: data.fileName,
        objectPath: data.objectPath,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      toast({ title: "File uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save file", variant: "destructive" });
    },
  });

  const getUploadParameters = async (file: { name: string; size: number | null; type?: string; id?: string }) => {
    const res = await fetch("/api/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size || 0,
        contentType: file.type || "application/octet-stream",
      }),
    });
    const data = await res.json();
    const key = file.id || `${file.name}-${Date.now()}`;
    fileObjectPathsRef.current.set(key, data.objectPath);
    fileObjectPathsRef.current.set(file.name, data.objectPath);
    return {
      method: "PUT" as const,
      url: data.uploadURL as string,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    };
  };

  const handleUploadComplete = (result: { successful?: Array<{ name: string; id?: string }> }) => {
    if (!result.successful) return;
    result.successful.forEach((file) => {
      const objectPath = file.id 
        ? fileObjectPathsRef.current.get(file.id) 
        : fileObjectPathsRef.current.get(file.name);
      if (objectPath) {
        saveFileMutation.mutate({
          fileName: file.name,
          objectPath,
        });
        if (file.id) fileObjectPathsRef.current.delete(file.id);
        fileObjectPathsRef.current.delete(file.name);
      }
    });
  };

  const addCommentMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", `/api/vendor/jobs/${id}/comments`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PUT", `/api/vendor/jobs/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/jobs"] });
      toast({ title: "Status updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const handleSubmitComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    updateStatusMutation.mutate(status);
  };

  const inputFiles = job?.files?.filter(f => f.direction === "Input") || [];
  const outputFiles = job?.files?.filter(f => f.direction === "Output") || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 glass border-b border-border/50">
          <div className="flex h-16 items-center justify-between gap-2 px-4 lg:px-8">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </header>
        <div className="p-4 lg:p-8 space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Job not found"
          description="This job doesn't exist or you don't have access to it."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="flex h-16 items-center justify-between gap-2 px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/vendor/jobs">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <span className="text-sm font-semibold text-white">V</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Vendor Portal</h1>
              <p className="text-xs text-muted-foreground">The P.R.O. Company™</p>
            </div>
          </div>
          <Link href="/vendor/login">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-vendor-logout">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl" data-testid="text-wo-number">
                      {job.workOrder?.woNumber || "N/A"}
                    </CardTitle>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {job.workOrder?.applicantName}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Applicant:</span>
                <span className="font-medium">{job.workOrder?.applicantName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Sent:</span>
                <span className="font-medium">
                  {job.sentAt ? formatDate(job.sentAt) : "—"}
                </span>
              </div>
            </div>

            {job.jobType && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Job Type:</span>
                <StatusBadge status={job.jobType.category} />
                <span className="font-medium">{job.jobType.name}</span>
              </div>
            )}

            {job.instructions && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-1">Instructions</p>
                <p className="text-sm text-muted-foreground">{job.instructions}</p>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Update Status</p>
              <Select 
                value={selectedStatus || job.status} 
                onValueChange={handleStatusChange}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="w-full md:w-64" data-testid="select-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="documents" className="gap-2" data-testid="tab-documents">
              <Upload className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-2" data-testid="tab-comments">
              <MessageSquare className="h-4 w-4" />
              Comments
              {job.comments && job.comments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {job.comments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Input Documents (From Company)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inputFiles.length > 0 ? (
                  <div className="space-y-2">
                    {inputFiles.map(file => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
                        data-testid={`input-file-${file.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{file.fileName}</span>
                        </div>
                        {file.workdriveLink && (
                          <a 
                            href={`/api/objects/${encodeURIComponent(file.workdriveLink)}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm" className="gap-1">
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </Button>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<FileText className="h-5 w-5" />}
                    title="No input documents"
                    description="No documents have been sent for this job yet."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Output Documents (Upload Completed Work)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {outputFiles.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {outputFiles.map(file => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20"
                        data-testid={`output-file-${file.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-medium">{file.fileName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {file.createdAt ? formatDateTime(file.createdAt) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <ObjectUploader
                  onGetUploadParameters={getUploadParameters}
                  onComplete={handleUploadComplete}
                  maxNumberOfFiles={5}
                >
                  Upload Documents
                </ObjectUploader>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add Comment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a message or ask a question..."
                  className="min-h-24 resize-none"
                  data-testid="input-comment"
                />
                <Button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="gap-2"
                  data-testid="button-send-comment"
                >
                  <Send className="h-4 w-4" />
                  {addCommentMutation.isPending ? "Sending..." : "Send"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Message History</CardTitle>
              </CardHeader>
              <CardContent>
                {job.comments && job.comments.length > 0 ? (
                  <div className="space-y-4">
                    {job.comments.map(comment => (
                      <div
                        key={comment.id}
                        className={`p-3 rounded-lg ${
                          comment.authorType === "Vendor" 
                            ? "bg-violet-50 dark:bg-violet-900/20 ml-8" 
                            : "bg-muted/50 mr-8"
                        }`}
                        data-testid={`comment-${comment.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {comment.authorType === "Vendor" ? "You" : "Company"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {comment.createdAt ? formatDateTime(comment.createdAt) : ""}
                          </span>
                        </div>
                        <p className="text-sm">{comment.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<MessageSquare className="h-5 w-5" />}
                    title="No comments yet"
                    description="Start a conversation about this job."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
