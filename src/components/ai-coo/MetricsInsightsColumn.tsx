import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react';

interface MetricTile {
  label: string;
  value: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  sparkline?: number[];
}

interface InsightCard {
  id: string;
  icon: 'lightbulb';
  borderColor: string;
  title: string;
  explanation: string;
  actionLabel: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskColor: string;
}

export function MetricsInsightsColumn() {
  // Fetch real metrics from API
  const { data, isLoading } = useQuery({
    queryKey: ['ai-coo-daily-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/ai-coo/daily-metrics');
      if (!response.ok) throw new Error('Failed to fetch daily metrics');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Transform API data to component format
  const metricsData = data?.metrics || {};
  const todaysImpact: MetricTile[] = [
    metricsData.actionsCompleted || { label: 'Actions Completed', value: '0', trend: { direction: 'neutral', value: '0%' } },
    metricsData.automated || { label: 'Automated', value: '0', trend: { direction: 'neutral', value: '0%' } },
    metricsData.ownerApprovals || { label: 'Owner Approvals', value: '0', trend: { direction: 'neutral', value: 'avg' } },
    metricsData.revenueProtected || { label: 'Revenue Protected', value: '$0', trend: { direction: 'neutral', value: 'at risk' } },
    metricsData.timeSaved || { label: 'Time Saved', value: '0 hrs', trend: { direction: 'neutral', value: '0%' } },
    metricsData.successRate || { label: 'Success Rate', value: '0%', trend: { direction: 'neutral', value: '0%' } },
  ];

  const insights: InsightCard[] = data?.insights || [];
  const patterns = data?.patterns || [];

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-sm text-gray-500">Loading metrics...</p>
        </div>
      ) : (
        <>
          {/* Today's Impact */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-4 text-sm font-medium text-gray-500">TODAY'S IMPACT</h3>

            <div className="space-y-3">
              {todaysImpact.map((metric) => (
                <MetricTileComponent key={metric.label} {...metric} />
              ))}
            </div>
          </div>

          {/* AI Learnings */}
          {insights.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-4 text-sm font-medium text-gray-500">AI LEARNINGS</h3>

              <div className="space-y-3">
                {insights.map((insight) => (
                  <InsightCardComponent key={insight.id} {...insight} />
                ))}
              </div>
            </div>
          )}

          {/* Patterns */}
          {patterns.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-4 text-sm font-medium text-gray-500">PATTERNS</h3>

              <div className="space-y-3">
                {patterns.map((pattern: any) => (
                  <div key={pattern.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{pattern.label}</span>
                    <span className={`text-sm font-medium ${pattern.color}`}>
                      {pattern.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricTileComponent({ label, value, trend, sparkline }: MetricTile) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.direction === 'up')
      return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
    if (trend.direction === 'down')
      return <TrendingDown className="h-3.5 w-3.5 text-red-600" />;
    return <Minus className="h-3.5 w-3.5 text-gray-500" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.direction === 'up') return 'text-emerald-600';
    if (trend.direction === 'down') return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-2 text-xs text-gray-500">{label}</p>

      <div className="mb-2 flex items-end justify-between">
        <span className="text-2xl font-normal text-gray-900">{value}</span>
        {trend && (
          <div className="flex items-center gap-1">
            {getTrendIcon()}
            <span className={`text-xs ${getTrendColor()}`}>{trend.value}</span>
          </div>
        )}
      </div>

      {sparkline && (
        <div className="flex items-end gap-0.5 h-8">
          {sparkline.map((value, index) => (
            <div
              key={index}
              className="flex-1 bg-blue-500 opacity-60 rounded"
              style={{ height: `${(value / Math.max(...sparkline)) * 100}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCardComponent({
  borderColor,
  title,
  explanation,
  actionLabel,
  riskLevel,
  riskColor,
}: InsightCard) {
  const riskLabels = {
    low: 'Low risk',
    medium: 'Medium risk',
    high: 'High risk',
  };

  return (
    <div className={`rounded-lg border-l-4 ${borderColor} bg-white p-4`}>
      <div className="mb-3 flex gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
          <Lightbulb className="h-4 w-4 text-gray-600" />
        </div>

        <div className="flex-1">
          <p className="mb-2 text-sm leading-relaxed text-gray-900">{title}</p>

          <div className="flex gap-2">
            <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 mt-0.5" />
            <p className="text-xs leading-relaxed text-gray-500">{explanation}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          {actionLabel}
        </button>
        <span
          className={`rounded border px-2 py-1 text-xs font-medium ${riskColor}`}
        >
          {riskLabels[riskLevel]}
        </span>
      </div>
    </div>
  );
}
