import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ClipboardList, Building2, Users, BarChart3 } from "lucide-react";

interface ReportSummary {
  overview: {
    totalWorkOrders: number;
    activeWorkOrders: number;
    completedWorkOrders: number;
    totalTypingJobs: number;
    completedTypingJobs: number;
    totalCompanies: number;
    totalVendors: number;
  };
  monthly: {
    labels: string[];
    workOrders: number[];
    typingJobs: number[];
  };
  turnaroundByVendor: Array<{
    vendorName: string;
    avgHours: number;
    totalJobs: number;
    completionRate: number;
  }>;
  jobsByCategory: Record<string, number>;
  statusDistribution: {
    wo: Record<string, number>;
    tj: Record<string, number>;
  };
  topCompanies: Array<{ name: string; woCount: number }>;
}

export default function ReportsPage() {
  const { data, isLoading } = useQuery<ReportSummary>({
    queryKey: ["/api/reports/summary"],
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-10 space-y-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!data) return null;

  const maxMonthly = Math.max(...data.monthly.workOrders, ...data.monthly.typingJobs, 1);

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-reports-title">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of work orders, typing jobs, and vendor performance</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Work Orders</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-wo">{data.overview.totalWorkOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.overview.completedWorkOrders} completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Work Orders</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-wo">{data.overview.activeWorkOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Typing Jobs</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tj">{data.overview.totalTypingJobs}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.overview.completedTypingJobs} completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-companies">{data.overview.totalCompanies}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.overview.totalVendors} vendor{data.overview.totalVendors !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Volume ({new Date().getFullYear()})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-blue-500" />
                <span className="text-xs text-muted-foreground">Work Orders</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-violet-500" />
                <span className="text-xs text-muted-foreground">Typing Jobs</span>
              </div>
            </div>
            <div className="space-y-3">
              {data.monthly.labels.map((label, i) => (
                <div key={label} className="flex items-center gap-3" data-testid={`chart-month-${label}`}>
                  <span className="text-xs text-muted-foreground w-8 text-right">{label}</span>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 rounded-sm bg-blue-500 transition-all"
                        style={{ width: `${Math.max((data.monthly.workOrders[i] / maxMonthly) * 100, 0)}%`, minWidth: data.monthly.workOrders[i] > 0 ? "8px" : "0px" }}
                      />
                      {data.monthly.workOrders[i] > 0 && (
                        <span className="text-xs text-muted-foreground">{data.monthly.workOrders[i]}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 rounded-sm bg-violet-500 transition-all"
                        style={{ width: `${Math.max((data.monthly.typingJobs[i] / maxMonthly) * 100, 0)}%`, minWidth: data.monthly.typingJobs[i] > 0 ? "8px" : "0px" }}
                      />
                      {data.monthly.typingJobs[i] > 0 && (
                        <span className="text-xs text-muted-foreground">{data.monthly.typingJobs[i]}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Work Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data.statusDistribution.wo).length === 0 ? (
                <p className="text-sm text-muted-foreground">No work orders yet</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(data.statusDistribution.wo).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between" data-testid={`status-wo-${status}`}>
                      <span className="text-sm">{status}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Typing Job Status</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data.statusDistribution.tj).length === 0 ? (
                <p className="text-sm text-muted-foreground">No typing jobs yet</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(data.statusDistribution.tj).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between" data-testid={`status-tj-${status}`}>
                      <span className="text-sm">{status}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {data.turnaroundByVendor.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendor Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Avg Turnaround (hrs)</TableHead>
                    <TableHead className="text-right">Total Jobs</TableHead>
                    <TableHead>Completion Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.turnaroundByVendor.map((v) => (
                    <TableRow key={v.vendorName} data-testid={`vendor-row-${v.vendorName}`}>
                      <TableCell className="font-medium">{v.vendorName}</TableCell>
                      <TableCell className="text-right">{v.avgHours}</TableCell>
                      <TableCell className="text-right">{v.totalJobs}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[120px]">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${v.completionRate}%`,
                                backgroundColor: v.completionRate >= 80 ? "hsl(var(--chart-2))" : v.completionRate >= 50 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))",
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">{v.completionRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {data.topCompanies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Companies by Work Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topCompanies.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between" data-testid={`top-company-${i}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-5">{i + 1}.</span>
                      <span className="text-sm">{c.name}</span>
                    </div>
                    <Badge variant="secondary">{c.woCount} WOs</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}