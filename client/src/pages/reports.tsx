import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ClipboardList, Building2, Users, BarChart3, TrendingUp, Award } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border/50 rounded-lg shadow-lg px-3 py-2 text-sm">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }} className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: entry.color }} />
            {entry.name}: <span className="font-semibold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ReportsPage() {
  const { data, isLoading } = useQuery<ReportSummary>({
    queryKey: ["/api/reports/summary"],
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-10 space-y-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      </AppLayout>
    );
  }

  if (!data) return null;

  const monthlyChartData = data.monthly.labels.map((label, i) => ({
    month: label,
    "Work Orders": data.monthly.workOrders[i],
    "Typing Jobs": data.monthly.typingJobs[i],
  }));

  const woStatusData = Object.entries(data.statusDistribution.wo).map(([status, count]) => ({
    status,
    count,
  }));

  const tjStatusData = Object.entries(data.statusDistribution.tj).map(([status, count]) => ({
    status,
    count,
  }));

  const topCompaniesData = data.topCompanies.map(c => ({
    name: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name,
    fullName: c.name,
    "Work Orders": c.woCount,
  }));

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-reports-title">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Overview of work orders, typing jobs, and vendor performance</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Work Orders</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums" data-testid="text-total-wo">{data.overview.totalWorkOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.overview.completedWorkOrders} completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Work Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums" data-testid="text-active-wo">{data.overview.activeWorkOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Typing Jobs</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums" data-testid="text-total-tj">{data.overview.totalTypingJobs}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.overview.completedTypingJobs} completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums" data-testid="text-total-companies">{data.overview.totalCompanies}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.overview.totalVendors} vendor{data.overview.totalVendors !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-tight">Monthly Volume ({new Date().getFullYear()})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                <Legend
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                />
                <Bar dataKey="Work Orders" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Typing Jobs" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight">Work Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              {woStatusData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No work orders yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={woStatusData} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                    <Bar dataKey="count" name="Work Orders" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight">Typing Job Status</CardTitle>
            </CardHeader>
            <CardContent>
              {tjStatusData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No typing jobs yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={tjStatusData} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={130} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                    <Bar dataKey="count" name="Typing Jobs" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {data.turnaroundByVendor.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                Vendor Performance
              </CardTitle>
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

        {topCompaniesData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight">Top Companies by Work Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(180, topCompaniesData.length * 36)}>
                <BarChart data={topCompaniesData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-card border border-border/50 rounded-lg shadow-lg px-3 py-2 text-sm">
                          <p className="font-medium text-foreground">{d.fullName}</p>
                          <p className="text-muted-foreground">{d["Work Orders"]} Work Orders</p>
                        </div>
                      );
                    }}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  />
                  <Bar dataKey="Work Orders" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
