import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Send, Calendar, Plus, CheckCircle2, ArrowRight } from "lucide-react";
import { VendorGroupedJobsView, type VendorJobItem } from "@/components/vendor-grouped-jobs-view";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LaneHeader, SubSection, JobRow } from "./shared";
import type { TypingJobsSummary } from "./types";

export function TypingJobsLane({ data, isLoading, photoMap }: { data?: TypingJobsSummary; isLoading: boolean; photoMap?: Record<string, string> }) {
  const [, navigate] = useLocation();
  const totalActive = (data?.counts.unaccepted || 0) + (data?.counts.inProgress || 0) + (data?.counts.returned || 0);

  const vendorJobs: VendorJobItem[] = useMemo(() => {
    if (!data) return [];
    const jobs: VendorJobItem[] = [];
    for (const job of data.returned || []) {
      jobs.push({ ...job, status: "returned", jobStatus: job.status });
    }
    for (const job of data.inProgress) {
      jobs.push({ ...job, status: "inProgress" });
    }
    for (const job of data.unaccepted) {
      jobs.push({ ...job, status: "unaccepted" });
    }
    return jobs;
  }, [data]);

  return (
    <div className="premium-card p-4 opacity-0 animate-fade-in animate-delay-2" data-testid="lane-typing-jobs">
      <LaneHeader
        icon={<Send className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
        title="Typing Jobs by Vendor"
        count={totalActive}
        color="bg-amber-100 dark:bg-amber-900/40"
        action={
          <Link href="/typing-jobs">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7" data-testid="link-view-all-jobs">
              View All
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-2 mt-3">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : !data || (totalActive === 0 && data.counts.readyToSchedule === 0 && (data.counts.returned || 0) === 0) ? (
        <div className="mt-3">
          <EmptyState
            icon={<Send className="h-6 w-6" />}
            title="No active jobs"
            description="All typing jobs have been processed."
            action={
              <Link href="/work-orders/new">
                <Button size="sm" className="gap-2" data-testid="button-new-wo-from-jobs">
                  <Plus className="h-4 w-4" />
                  New Work Order
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <VendorGroupedJobsView jobs={vendorJobs} photoMap={photoMap} />

          {data.counts.readyToSchedule > 0 && (
            <SubSection
              title="Ready to Schedule"
              count={data.counts.readyToSchedule}
              icon={<CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
              color="bg-emerald-100 dark:bg-emerald-900/40"
              testId="section-ready-to-schedule-jobs"
            >
              {data.readyToSchedule.map((job) => (
                <JobRow
                  key={job.id}
                  item={job}
                  photoUrl={photoMap?.[job.woId]}
                  onClick={() => navigate(
                    job.type === "Medical" 
                      ? `/appointments/schedule-medical?woId=${job.woId}` 
                      : `/appointments/schedule-eid?woId=${job.woId}`
                  )}
                  rightContent={
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(
                          job.type === "Medical" 
                            ? `/appointments/schedule-medical?woId=${job.woId}` 
                            : `/appointments/schedule-eid?woId=${job.woId}`
                        );
                      }}
                      data-testid={`button-schedule-${job.id}`}
                    >
                      <Calendar className="h-3 w-3" />
                      Schedule
                    </Button>
                  }
                />
              ))}
            </SubSection>
          )}
        </div>
      )}
    </div>
  );
}
