import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityTimeline, type ActivityItem } from "@/components/ui/activity-timeline";
import type { AuditLog } from "@shared/schema";

export function ActivityTimelineSection({ workOrderId }: { workOrderId: string }) {
  const { data: auditLogs, isLoading } = useQuery<(AuditLog & { userName?: string })[]>({
    queryKey: queryKeys.auditLogs("work_order", workOrderId),
    enabled: !!workOrderId,
  });

  const { data: photoMap } = useQuery<Record<string, string>>({
    queryKey: queryKeys.workOrderPhotos,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const activities: ActivityItem[] = (auditLogs || []).map(log => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    userId: log.userId,
    details: log.details as Record<string, unknown> | null,
    createdAt: log.createdAt,
    userName: log.userName,
  }));

  return <ActivityTimeline activities={activities} photoMap={photoMap} />;
}
