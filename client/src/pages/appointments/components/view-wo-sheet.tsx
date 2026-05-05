import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Briefcase, User, Building2, FileText, ChevronRight,
  ExternalLink, Stethoscope, CreditCard,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toProperCase } from "@/lib/proper-case";
import type { WorkOrder, Company, ServiceType } from "@shared/schema";

interface ViewWoSheetProps {
  woId: string | null;
  onClose: () => void;
}

interface WoDetails extends WorkOrder {
  company?: Company;
  serviceType?: ServiceType;
  typingJobs?: Array<{ id: string; status: string; jobType?: { name: string; category: string } }>;
  documents?: Array<{ id: string }>;
}

export function ViewWoSheet({ woId, onClose }: ViewWoSheetProps) {
  const [, navigate] = useLocation();

  const { data: wo, isLoading } = useQuery<WoDetails>({
    queryKey: ["/api/work-orders", woId],
    queryFn: async () => {
      if (!woId) return null;
      const res = await fetch(`/api/work-orders/${woId}`);
      return res.ok ? res.json() : null;
    },
    enabled: !!woId,
  });

  const handleOpenFullPage = () => {
    if (woId) {
      navigate(`/work-orders/${woId}`);
      onClose();
    }
  };

  const typingStatus = (() => {
    if (!wo?.typingJobs?.length) return null;
    const medJob = wo.typingJobs.find(j => j.jobType?.category === "Medical");
    const eidJob = wo.typingJobs.find(j => j.jobType?.category === "EID");
    return { medical: medJob?.status || null, eid: eidJob?.status || null };
  })();

  return (
    <Sheet open={!!woId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Work Order
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3 mt-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : wo ? (
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold font-mono">{wo.woNumber}</span>
              <Badge variant={
                wo.status === "Completed" ? "secondary" :
                wo.status === "Cancelled" ? "destructive" :
                wo.status === "Scheduled" ? "default" :
                "outline"
              }>{wo.status}</Badge>
              {wo.isVip && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  VIP
                </Badge>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Applicant</div>
                  <div className="font-medium">{toProperCase(wo.applicantName)}</div>
                  {wo.applicantPhone && <div className="text-muted-foreground">{wo.applicantPhone}</div>}
                </div>
              </div>

              {(wo.company || wo.companyId) && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Company</div>
                    <div className="font-medium">{toProperCase(wo.company?.name || "")}</div>
                  </div>
                </div>
              )}

              {wo.serviceType && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Service</div>
                    <div className="font-medium">{wo.serviceType.name}</div>
                  </div>
                </div>
              )}

              {typingStatus && (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground font-medium">Typing Jobs</div>
                  {typingStatus.medical && (
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">Medical: <span className="font-medium">{typingStatus.medical}</span></span>
                    </div>
                  )}
                  {typingStatus.eid && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">EID: <span className="font-medium">{typingStatus.eid}</span></span>
                    </div>
                  )}
                </div>
              )}

              {wo.documents !== undefined && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Documents</div>
                    <div className="font-medium">{wo.documents.length} file{wo.documents.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
              )}

              {wo.notes && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-xs text-muted-foreground">
                  {wo.notes}
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={handleOpenFullPage}
                className="w-full gap-2"
                data-testid="button-wo-open-full-page"
              >
                Open full page
                <ChevronRight className="h-4 w-4" />
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm mt-4">
            Work order not found.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
