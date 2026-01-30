import * as React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, AlertCircle, Download } from "lucide-react";
import { cn } from "~/lib/utils";
import type { WidgetDefinition, WidgetProps } from "../types";
import { Button } from "~/components/ui/button";

/**
 * Chart Types
 */
export type ReportChartType = "bar" | "line" | "area" | "pie" | "stacked_bar";

/**
 * Chart Data Series
 */
export interface ChartSeries {
  name: string;
  dataKey: string;
  color?: string;
  stackId?: string;
}

/**
 * Report Chart Data
 */
export interface ReportChartData {
  title?: string;
  subtitle?: string;
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: ChartSeries[];
  total?: number;
}

/**
 * Report Chart Config
 */
export interface ReportChartConfig {
  chartType: ReportChartType;
  showLegend: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  showValues: boolean;
  colorScheme: "default" | "blue" | "green" | "purple" | "rainbow";
  animated: boolean;
  stacked: boolean;
}

/**
 * Color schemes
 */
const colorSchemes = {
  default: ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308"],
  blue: ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"],
  green: ["#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534"],
  purple: ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6"],
  rainbow: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"],
};

/**
 * Custom Tooltip
 */
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

/**
 * Bar Chart Component
 */
function BarChartView({
  data,
  xAxisKey,
  series,
  config,
  colors,
}: {
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: ChartSeries[];
  config: ReportChartConfig;
  colors: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        {config.showGrid && (
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        )}
        <XAxis
          dataKey={xAxisKey}
          className="text-xs fill-muted-foreground"
          tick={{ fill: "currentColor" }}
        />
        <YAxis
          className="text-xs fill-muted-foreground"
          tick={{ fill: "currentColor" }}
        />
        {config.showTooltip && <Tooltip content={<CustomTooltip />} />}
        {config.showLegend && (
          <Legend wrapperStyle={{ fontSize: "12px" }} />
        )}
        {series.map((s, index) => (
          <Bar
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.name}
            fill={s.color || colors[index % colors.length]}
            stackId={config.stacked ? "stack" : undefined}
            animationDuration={config.animated ? 1000 : 0}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Line Chart Component
 */
function LineChartView({
  data,
  xAxisKey,
  series,
  config,
  colors,
}: {
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: ChartSeries[];
  config: ReportChartConfig;
  colors: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        {config.showGrid && (
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        )}
        <XAxis
          dataKey={xAxisKey}
          className="text-xs fill-muted-foreground"
          tick={{ fill: "currentColor" }}
        />
        <YAxis
          className="text-xs fill-muted-foreground"
          tick={{ fill: "currentColor" }}
        />
        {config.showTooltip && <Tooltip content={<CustomTooltip />} />}
        {config.showLegend && (
          <Legend wrapperStyle={{ fontSize: "12px" }} />
        )}
        {series.map((s, index) => (
          <Line
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.name}
            stroke={s.color || colors[index % colors.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            animationDuration={config.animated ? 1000 : 0}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Area Chart Component
 */
function AreaChartView({
  data,
  xAxisKey,
  series,
  config,
  colors,
}: {
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: ChartSeries[];
  config: ReportChartConfig;
  colors: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        {config.showGrid && (
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        )}
        <XAxis
          dataKey={xAxisKey}
          className="text-xs fill-muted-foreground"
          tick={{ fill: "currentColor" }}
        />
        <YAxis
          className="text-xs fill-muted-foreground"
          tick={{ fill: "currentColor" }}
        />
        {config.showTooltip && <Tooltip content={<CustomTooltip />} />}
        {config.showLegend && (
          <Legend wrapperStyle={{ fontSize: "12px" }} />
        )}
        {series.map((s, index) => {
          const color = s.color || colors[index % colors.length];
          return (
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              stackId={config.stacked ? "stack" : undefined}
              animationDuration={config.animated ? 1000 : 0}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Pie Chart Component
 */
function PieChartView({
  data,
  xAxisKey,
  series,
  config,
  colors,
}: {
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: ChartSeries[];
  config: ReportChartConfig;
  colors: string[];
}) {
  // For pie charts, we use the first series and xAxisKey as label
  const firstSeries = series[0];
  const pieData = data.map((item, index) => ({
    name: item[xAxisKey] as string,
    value: item[firstSeries.dataKey] as number,
    color: colors[index % colors.length],
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          innerRadius={config.stacked ? 50 : 0}
          paddingAngle={2}
          animationDuration={config.animated ? 1000 : 0}
          label={config.showValues ? ({ name, percent }) =>
            `${name} (${(((percent ?? 0) * 100)).toFixed(0)}%)` : false
          }
          labelLine={config.showValues}
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        {config.showTooltip && <Tooltip content={<CustomTooltip />} />}
        {config.showLegend && (
          <Legend wrapperStyle={{ fontSize: "12px" }} />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * Report Chart Widget Component
 */
function ReportChartWidgetComponent({
  data,
  isLoading,
  error,
  instance,
  size,
}: WidgetProps<ReportChartData, ReportChartConfig>) {
  const config = instance.config as unknown as ReportChartConfig;
  const colors = colorSchemes[config.colorScheme];

  // Sample data for demonstration
  const sampleData: ReportChartData = {
    title: "Monthly Performance",
    subtitle: "Revenue vs Expenses",
    data: [
      { month: "Jan", revenue: 12400, expenses: 8400, profit: 4000 },
      { month: "Feb", revenue: 15600, expenses: 9200, profit: 6400 },
      { month: "Mar", revenue: 18200, expenses: 10100, profit: 8100 },
      { month: "Apr", revenue: 17800, expenses: 9800, profit: 8000 },
      { month: "May", revenue: 21000, expenses: 11200, profit: 9800 },
      { month: "Jun", revenue: 24500, expenses: 12000, profit: 12500 },
    ],
    xAxisKey: "month",
    series: [
      { name: "Revenue", dataKey: "revenue" },
      { name: "Expenses", dataKey: "expenses" },
      { name: "Profit", dataKey: "profit" },
    ],
  };

  const displayData = data ?? sampleData;
  const chartHeight = size === "small" ? 180 : size === "medium" ? 240 : 320;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="animate-pulse w-full h-40 bg-muted rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-destructive">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  const renderChart = () => {
    const commonProps = {
      data: displayData.data,
      xAxisKey: displayData.xAxisKey,
      series: displayData.series,
      config,
      colors,
    };

    switch (config.chartType) {
      case "bar":
      case "stacked_bar":
        return <BarChartView {...commonProps} />;
      case "line":
        return <LineChartView {...commonProps} />;
      case "area":
        return <AreaChartView {...commonProps} />;
      case "pie":
        return <PieChartView {...commonProps} />;
      default:
        return <BarChartView {...commonProps} />;
    }
  };

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      {(displayData.title || displayData.subtitle) && (
        <div className="flex items-start justify-between">
          <div>
            {displayData.title && (
              <h3 className="font-semibold text-sm">{displayData.title}</h3>
            )}
            {displayData.subtitle && (
              <p className="text-xs text-muted-foreground">{displayData.subtitle}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Chart */}
      <div style={{ height: chartHeight }} className="w-full">
        {renderChart()}
      </div>
    </div>
  );
}

/**
 * Report Chart Widget Definition
 */
export const ReportChartWidgetDefinition: WidgetDefinition<
  ReportChartData,
  ReportChartConfig
> = {
  id: "report-chart",
  name: "Report Chart",
  description: "Advanced charts for reporting with multiple chart types",
  category: "analytics",
  defaultSize: "medium",
  supportedSizes: ["small", "medium", "large", "full"],
  icon: BarChart3,
  dataRequirements: [
    {
      key: "chartData",
      label: "Chart Data",
      description: "Data to visualize in the chart",
      required: true,
      type: "query",
    },
  ],
  configOptions: [
    {
      key: "chartType",
      label: "Chart Type",
      description: "Type of chart to display",
      type: "select",
      defaultValue: "bar",
      options: [
        { label: "Bar Chart", value: "bar" },
        { label: "Stacked Bar", value: "stacked_bar" },
        { label: "Line Chart", value: "line" },
        { label: "Area Chart", value: "area" },
        { label: "Pie Chart", value: "pie" },
      ],
    },
    {
      key: "showLegend",
      label: "Show Legend",
      description: "Display chart legend",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "showGrid",
      label: "Show Grid",
      description: "Display grid lines",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "showTooltip",
      label: "Show Tooltip",
      description: "Display tooltips on hover",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "showValues",
      label: "Show Values",
      description: "Display values on chart",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "colorScheme",
      label: "Color Scheme",
      description: "Color palette for the chart",
      type: "select",
      defaultValue: "default",
      options: [
        { label: "Default", value: "default" },
        { label: "Blue", value: "blue" },
        { label: "Green", value: "green" },
        { label: "Purple", value: "purple" },
        { label: "Rainbow", value: "rainbow" },
      ],
    },
    {
      key: "animated",
      label: "Animated",
      description: "Enable chart animations",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "stacked",
      label: "Stacked",
      description: "Stack data series",
      type: "boolean",
      defaultValue: false,
    },
  ],
  component: ReportChartWidgetComponent,
  defaultConfig: {
    chartType: "bar",
    showLegend: true,
    showGrid: true,
    showTooltip: true,
    showValues: false,
    colorScheme: "default",
    animated: true,
    stacked: false,
  },
  supportsRefresh: true,
  minRefreshInterval: 60000,
};
