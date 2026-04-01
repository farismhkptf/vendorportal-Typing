import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpiryBadge, getExpiryStatus } from "@/components/documents/document-expiry";
import { Link } from "wouter";
import { FileText, AlertTriangle, Clock, ExternalLink } from "lucide-react";

interface ExpiringDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  expiresAt: string;
  status: string;
  woId: string;
  source?: "work_order" | "file";
  relatedType?: string;
  relatedId?: string;
  workOrder?: {
    id: string;
    woNumber: string;
    applicantName: string;
  } | null;
}

export default function ExpiringDocuments() {
  const { data: documents = [], isLoading } = useQuery<ExpiringDocument[]>({
    queryKey: ["/api/documents/expiring-soon", 30],
    queryFn: async () => {
      const res = await fetch("/api/documents/expiring-soon?days=30");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const expired = documents.filter((d) => getExpiryStatus(d.expiresAt) === "expired");
  const expiringSoon = documents.filter((d) => getExpiryStatus(d.expiresAt) === "expiring");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-page-title">Expiring Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Documents across all work orders that are expired or expiring within 30 days
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="loading-state">
            Loading...
          </div>
        ) : documents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground" data-testid="empty-state">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm text-muted-foreground">No expiring documents</p>
              <p className="text-sm text-muted-foreground">All documents are up to date.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-expired-count">
                        {expired.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Expired</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-200 dark:border-amber-800">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-expiring-count">
                        {expiringSoon.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Expiring Soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Expiring Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 py-3" data-testid={`row-document-${doc.id}`}>
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{doc.fileName}</p>
                          <ExpiryBadge expiresAt={doc.expiresAt} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{doc.documentType}</span>
                          {doc.workOrder?.applicantName && (
                            <>
                              <span>·</span>
                              <span>{doc.workOrder.applicantName}</span>
                            </>
                          )}
                          {doc.workOrder?.woNumber && (
                            <>
                              <span>·</span>
                              <span>WO #{doc.workOrder.woNumber}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>Expires {new Date(doc.expiresAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {doc.source === "file" && doc.relatedType === "TypingJob" && doc.relatedId ? (
                        <Link
                          href={`/typing-jobs/${doc.relatedId}`}
                          className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
                          data-testid={`link-typing-job-${doc.relatedId}`}
                        >
                          View Job
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : doc.woId ? (
                        <Link
                          href={`/work-orders/${doc.woId}`}
                          className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
                          data-testid={`link-wo-${doc.woId}`}
                        >
                          View WO
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
