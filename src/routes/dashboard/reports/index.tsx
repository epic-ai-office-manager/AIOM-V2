import * as React from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Filter,
  Plus,
  RefreshCw,
  Settings,
  Clock,
  FileText,
  Send,
  Trash2,
  Edit,
  Eye,
  Target,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import type { UserRole } from "~/db/schema";

export const Route = createFileRoute("/dashboard/reports/")({
  beforeLoad: async () => {
    const sessionResult = await authClient.getSession();
    if (!sessionResult || !sessionResult.data) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: "/dashboard/reports" },
      });
    }
    // Reports accessible to admin, MD, and sales roles
    const user = sessionResult.data.user as { role?: UserRole; isAdmin?: boolean } | undefined;
    if (!user || (user.role !== "admin" && user.role !== "md" && user.role !== "sales" && !user.isAdmin)) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  component: ReportsDashboardPage,
});

// =============================================================================
// Types
// =============================================================================

interface KpiItem {
  id: string;
  name: string;
  value: number;
  previousValue?: number;
  targetValue?: number;
  format: "number" | "currency" | "percentage" | "duration";
  trend?: "up" | "down" | "flat";
  trendPercentage?: number;
  status?: "success" | "warning" | "critical" | "neutral";
}

interface ChartDataPoint {
  name: string;
  [key: string]: string | number;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  lastRun?: Date;
  schedule?: string;
}

// =============================================================================
// Sample Data
// =============================================================================

const kpiData: KpiItem[] = [
  {
    id: "1",
    name: "Total Revenue",
    value: 1245000,
    previousValue: 1150000,
    targetValue: 1500000,
    format: "currency",
    trend: "up",
    trendPercentage: 8.3,
    status: "success",
  },
  {
    id: "2",
    name: "Active Users",
    value: 24500,
    previousValue: 23800,
    format: "number",
    trend: "up",
    trendPercentage: 2.9,
    status: "success",
  },
  {
    id: "3",
    name: "Conversion Rate",
    value: 3.2,
    previousValue: 3.5,
    targetValue: 4.0,
    format: "percentage",
    trend: "down",
    trendPercentage: -8.6,
    status: "warning",
  },
  {
    id: "4",
    name: "Avg Response Time",
    value: 125,
    previousValue: 140,
    targetValue: 100,
    format: "duration",
    trend: "up",
    trendPercentage: 10.7,
    status: "neutral",
  },
];

const revenueChartData: ChartDataPoint[] = [
  { name: "Jan", revenue: 124000, expenses: 84000, profit: 40000 },
  { name: "Feb", revenue: 156000, expenses: 92000, profit: 64000 },
  { name: "Mar", revenue: 182000, expenses: 101000, profit: 81000 },
  { name: "Apr", revenue: 178000, expenses: 98000, profit: 80000 },
  { name: "May", revenue: 210000, expenses: 112000, profit: 98000 },
  { name: "Jun", revenue: 245000, expenses: 120000, profit: 125000 },
];

const expenseBreakdownData = [
  { name: "Salaries", value: 45000, color: "#6366f1" },
  { name: "Marketing", value: 25000, color: "#8b5cf6" },
  { name: "Operations", value: 18000, color: "#ec4899" },
  { name: "Equipment", value: 12000, color: "#f43f5e" },
  { name: "Other", value: 8000, color: "#f97316" },
];

const taskCompletionData: ChartDataPoint[] = [
  { name: "Mon", completed: 45, pending: 12, overdue: 3 },
  { name: "Tue", completed: 52, pending: 8, overdue: 2 },
  { name: "Wed", completed: 38, pending: 15, overdue: 5 },
  { name: "Thu", completed: 61, pending: 6, overdue: 1 },
  { name: "Fri", completed: 55, pending: 10, overdue: 2 },
];

const reportTemplates: ReportTemplate[] = [
  {
    id: "1",
    name: "Monthly Financial Summary",
    description: "Comprehensive monthly financial overview with revenue, expenses, and profit analysis",
    type: "financial_overview",
    lastRun: new Date(Date.now() - 86400000),
    schedule: "Monthly",
  },
  {
    id: "2",
    name: "Sales Performance Report",
    description: "Detailed sales metrics including pipeline, conversions, and team performance",
    type: "sales_performance",
    lastRun: new Date(Date.now() - 604800000),
    schedule: "Weekly",
  },
  {
    id: "3",
    name: "Call Analytics Dashboard",
    description: "Communication metrics with response times and call volume analysis",
    type: "call_analytics",
    schedule: "Daily",
  },
  {
    id: "4",
    name: "Task Completion Metrics",
    description: "Team productivity and task management overview",
    type: "task_completion",
    lastRun: new Date(Date.now() - 172800000),
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function formatValue(value: number, format: string): string {
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "duration":
      return `${value}s`;
    default:
      return value >= 1000
        ? `${(value / 1000).toFixed(1)}k`
        : value.toLocaleString();
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// =============================================================================
// Components
// =============================================================================

function KpiCard({ kpi }: { kpi: KpiItem }) {
  const progressToTarget = kpi.targetValue
    ? Math.min((kpi.value / kpi.targetValue) * 100, 100)
    : null;

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {kpi.name}
        </span>
        {kpi.status === "warning" && (
          <AlertCircle className="w-4 h-4 text-yellow-500" />
        )}
        {kpi.status === "critical" && (
          <AlertCircle className="w-4 h-4 text-red-500" />
        )}
        {kpi.status === "success" && (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        )}
      </div>

      <div className="text-2xl font-bold">
        {formatValue(kpi.value, kpi.format)}
      </div>

      {kpi.trend && (
        <div className="flex items-center gap-2 mt-2">
          {kpi.trend === "up" ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : kpi.trend === "down" ? (
            <TrendingDown className="w-4 h-4 text-red-500" />
          ) : null}
          {kpi.trendPercentage !== undefined && (
            <span
              className={cn(
                "text-sm",
                kpi.trend === "up" && "text-green-500",
                kpi.trend === "down" && "text-red-500"
              )}
            >
              {kpi.trend === "up" ? "+" : ""}
              {kpi.trendPercentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {progressToTarget !== null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              Target: {formatValue(kpi.targetValue!, kpi.format)}
            </span>
            <span>{progressToTarget.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progressToTarget >= 100
                  ? "bg-green-500"
                  : progressToTarget >= 75
                  ? "bg-primary"
                  : progressToTarget >= 50
                  ? "bg-yellow-500"
                  : "bg-red-500"
              )}
              style={{ width: `${progressToTarget}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
      <p className="font-medium text-sm mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">
              {typeof entry.value === "number"
                ? entry.value.toLocaleString()
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportTemplateCard({ template }: { template: ReportTemplate }) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "financial_overview":
        return <BarChart3 className="w-5 h-5" />;
      case "sales_performance":
        return <TrendingUp className="w-5 h-5" />;
      case "call_analytics":
        return <LineChart className="w-5 h-5" />;
      case "task_completion":
        return <Target className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          {getTypeIcon(template.type)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{template.name}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {template.description}
          </p>
          <div className="flex items-center gap-3 mt-3">
            {template.schedule && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {template.schedule}
              </Badge>
            )}
            {template.lastRun && (
              <span className="text-xs text-muted-foreground">
                Last run: {formatTimeAgo(template.lastRun)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
        <Button variant="default" size="sm" className="flex-1">
          <Eye className="w-4 h-4 mr-1" />
          View
        </Button>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm">
          <Send className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function ReportsDashboardPage() {
  const [dateRange, setDateRange] = React.useState("last_30_days");
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const handleExport = (format: string) => {
    // Generate export data
    const exportData = {
      kpis: kpiData,
      revenue: revenueChartData,
      expenses: expenseBreakdownData,
      tasks: taskCompletionData,
      generatedAt: new Date().toISOString(),
      dateRange,
    };

    if (format === "json") {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === "csv") {
      // Convert to CSV format
      const csvRows = ["metric,value,previousValue,trend"];
      kpiData.forEach((kpi) => {
        csvRows.push(
          `"${kpi.name}",${kpi.value},${kpi.previousValue || ""},${kpi.trend || ""}`
        );
      });
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reporting Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics and customizable reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="last_7_days">Last 7 days</SelectItem>
              <SelectItem value="last_30_days">Last 30 days</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="this_quarter">This quarter</SelectItem>
              <SelectItem value="this_year">This year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("w-4 h-4", isRefreshing && "animate-spin")}
            />
          </Button>
          <Select onValueChange={handleExport}>
            <SelectTrigger className="w-[130px]">
              <Download className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">Export CSV</SelectItem>
              <SelectItem value="json">Export JSON</SelectItem>
              <SelectItem value="pdf">Export PDF</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Report</DialogTitle>
                <DialogDescription>
                  Configure a new custom report with your preferred metrics and
                  visualizations.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="report-name">Report Name</Label>
                  <Input id="report-name" placeholder="Enter report name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-type">Report Type</Label>
                  <Select>
                    <SelectTrigger id="report-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="financial_overview">
                        Financial Overview
                      </SelectItem>
                      <SelectItem value="sales_performance">
                        Sales Performance
                      </SelectItem>
                      <SelectItem value="call_analytics">
                        Call Analytics
                      </SelectItem>
                      <SelectItem value="task_completion">
                        Task Completion
                      </SelectItem>
                      <SelectItem value="custom">Custom Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => setCreateDialogOpen(false)}>
                  Create Report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Key Performance Indicators</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiData.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      </section>

      {/* Charts Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Revenue vs Expenses</h3>
              <p className="text-sm text-muted-foreground">
                Monthly financial overview
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <Download className="w-4 h-4" />
            </Button>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  className="text-xs fill-muted-foreground"
                  tick={{ fill: "currentColor" }}
                />
                <YAxis
                  className="text-xs fill-muted-foreground"
                  tick={{ fill: "currentColor" }}
                  tickFormatter={(value) =>
                    value >= 1000 ? `$${value / 1000}k` : `$${value}`
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#ec4899"
                  fill="#ec4899"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Expense Breakdown</h3>
              <p className="text-sm text-muted-foreground">
                Current month expenses by category
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <Download className="w-4 h-4" />
            </Button>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={expenseBreakdownData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={60}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} (${(((percent ?? 0) * 100)).toFixed(0)}%)`
                  }
                >
                  {expenseBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Completion Chart */}
        <div className="bg-card border rounded-lg p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Task Completion Overview</h3>
              <p className="text-sm text-muted-foreground">
                Weekly task status breakdown
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <Download className="w-4 h-4" />
            </Button>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskCompletionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  className="text-xs fill-muted-foreground"
                  tick={{ fill: "currentColor" }}
                />
                <YAxis
                  className="text-xs fill-muted-foreground"
                  tick={{ fill: "currentColor" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  dataKey="completed"
                  name="Completed"
                  fill="#22c55e"
                  stackId="a"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="pending"
                  name="Pending"
                  fill="#eab308"
                  stackId="a"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="overdue"
                  name="Overdue"
                  fill="#ef4444"
                  stackId="a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Report Templates Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Report Templates</h2>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportTemplates.map((template) => (
            <ReportTemplateCard key={template.id} template={template} />
          ))}
        </div>
      </section>

      {/* Scheduled Reports Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Scheduled Reports</h2>
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Schedule
          </Button>
        </div>
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left text-sm font-medium text-muted-foreground p-4">
                  Report
                </th>
                <th className="text-left text-sm font-medium text-muted-foreground p-4">
                  Schedule
                </th>
                <th className="text-left text-sm font-medium text-muted-foreground p-4">
                  Recipients
                </th>
                <th className="text-left text-sm font-medium text-muted-foreground p-4">
                  Last Sent
                </th>
                <th className="text-left text-sm font-medium text-muted-foreground p-4">
                  Status
                </th>
                <th className="text-right text-sm font-medium text-muted-foreground p-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span className="font-medium">Monthly Financial Summary</span>
                  </div>
                </td>
                <td className="p-4 text-muted-foreground">
                  1st of every month, 9:00 AM
                </td>
                <td className="p-4 text-muted-foreground">
                  finance@company.com, cfo@company.com
                </td>
                <td className="p-4 text-muted-foreground">Jan 1, 2024</td>
                <td className="p-4">
                  <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                    Active
                  </Badge>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="font-medium">Weekly Sales Report</span>
                  </div>
                </td>
                <td className="p-4 text-muted-foreground">
                  Every Monday, 8:00 AM
                </td>
                <td className="p-4 text-muted-foreground">
                  sales-team@company.com
                </td>
                <td className="p-4 text-muted-foreground">Jan 8, 2024</td>
                <td className="p-4">
                  <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                    Active
                  </Badge>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <LineChart className="w-4 h-4 text-primary" />
                    <span className="font-medium">Daily Call Analytics</span>
                  </div>
                </td>
                <td className="p-4 text-muted-foreground">
                  Every day, 6:00 PM
                </td>
                <td className="p-4 text-muted-foreground">
                  ops-manager@company.com
                </td>
                <td className="p-4 text-muted-foreground">Jan 10, 2024</td>
                <td className="p-4">
                  <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                    Paused
                  </Badge>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
