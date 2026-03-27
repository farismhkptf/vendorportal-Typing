import { Link } from "wouter";
import { ArrowLeft, FileText, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export function WoLoadingSkeleton() {
  return (
    <AppLayout>
      <PageHeader
        title="Loading work order…"
        breadcrumbs={[{ label: "Work Orders", href: "/work-orders" }]}
      />
      <div className="p-4 lg:p-8 space-y-6">
        <div className="premium-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="premium-card p-5 space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
          <div className="premium-card p-5 space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export function WoNotFound() {
  return (
    <AppLayout>
      <PageHeader
        title="Work Order Not Found"
        actions={
          <div className="flex items-center gap-1">
            <Link href="/work-orders">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-home">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />
      <div className="p-4 lg:p-8">
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Work order not found"
          description="The work order you're looking for doesn't exist or has been deleted."
          action={
            <Link href="/work-orders">
              <Button>View All Work Orders</Button>
            </Link>
          }
        />
      </div>
    </AppLayout>
  );
}
