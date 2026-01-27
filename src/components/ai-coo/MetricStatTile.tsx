import { TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MetricStatTileProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  sparklineData?: number[];
  icon?: React.ReactNode;
}

export function MetricStatTile({
  label,
  value,
  trend,
  trendValue,
  sparklineData,
  icon,
}: MetricStatTileProps) {
  // Transform sparkline data for recharts
  const chartData = sparklineData?.map((value, index) => ({
    index,
    value,
  })) || [];

  const sparklineColor =
    trend === 'up' ? '#10B981' :
    trend === 'down' ? '#EF4444' :
    '#6B7280';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {icon}
      </div>

      <div className="mt-2 flex items-end justify-between">
        <div>
          <div className="text-2xl font-semibold text-gray-900">{value}</div>

          {trend && trendValue && (
            <div className={`mt-1 flex items-center gap-1 text-xs ${
              trend === 'up' ? 'text-green-600' :
              trend === 'down' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {trend === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="h-6 w-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
