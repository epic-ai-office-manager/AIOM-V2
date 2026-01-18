/**
 * Claude Usage Dashboard Component
 * 
 * Real-time cost tracking and usage analytics for Claude API
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

interface UsageStats {
  period: string;
  summary: {
    totalCost: number;
    totalRequests: number;
    totalTokens: number;
    averageCostPerRequest: number;
    cacheEfficiency: string;
    cacheEfficiencyRaw: number;
  };
  byUseCase: Array<{
    name: string;
    cost: number;
    requests: number;
    tokens: number;
    avgCostPerRequest: number;
    avgDurationMs: number;
  }>;
  projectedMonthlyCost: number;
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
  }>;
}

export function ClaudeUsageDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analytics/claude-usage?period=${period}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const exportData = (format: 'csv' | 'json') => {
    window.open(`/api/analytics/claude-usage-export?period=${period}&format=${format}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading usage statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="text-red-600 font-semibold">Error Loading Stats</div>
            <div className="text-sm text-gray-600 mt-2">{error}</div>
            {error.includes('SDK client not enabled') && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="text-sm">
                  <strong>Migration Required:</strong> Set <code className="bg-gray-100 px-1">USE_SDK_CLIENT=true</code> in your .env file to enable usage tracking.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Claude API Usage</h1>
          <p className="text-gray-600 mt-1">Cost tracking and performance analytics</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={period} 
            onChange={e => setPeriod(e.target.value)} 
            className="border border-gray-300 rounded-lg px-4 py-2 bg-white"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button 
            onClick={() => exportData('csv')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Alerts */}
      {stats.alerts.length > 0 && (
        <div className="space-y-2">
          {stats.alerts.map((alert, idx) => (
            <div 
              key={idx}
              className={`p-4 rounded-lg border ${
                alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {alert.type === 'error' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span>{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats.summary.totalCost.toFixed(2)}</div>
            <div className="text-sm text-gray-500 mt-1">
              Projected: ${stats.projectedMonthlyCost.toFixed(2)}/mo
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.summary.totalRequests.toLocaleString()}</div>
            <div className="text-sm text-gray-500 mt-1">
              Avg: ${stats.summary.averageCostPerRequest.toFixed(4)}/req
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Cache Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.summary.cacheEfficiency}</div>
            <div className="text-sm mt-1">
              {stats.summary.cacheEfficiencyRaw > 80 ? (
                <span className="text-green-600">✅ Excellent</span>
              ) : stats.summary.cacheEfficiencyRaw > 50 ? (
                <span className="text-yellow-600">⚠️ Good</span>
              ) : (
                <span className="text-red-600">🚨 Needs optimization</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Budget Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${
              stats.projectedMonthlyCost < 36 ? 'text-green-600' : 
              stats.projectedMonthlyCost < 50 ? 'text-yellow-600' : 
              'text-red-600'
            }`}>
              {stats.projectedMonthlyCost < 36 ? '✅' : stats.projectedMonthlyCost < 50 ? '⚠️' : '🚨'}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Target: $36/month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Use Case Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Use Case</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Use Case</th>
                  <th className="text-right p-3 font-medium">Requests</th>
                  <th className="text-right p-3 font-medium">Total Cost</th>
                  <th className="text-right p-3 font-medium">Avg/Request</th>
                  <th className="text-right p-3 font-medium">Tokens</th>
                  <th className="text-right p-3 font-medium">Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {stats.byUseCase.map(uc => (
                  <tr key={uc.name} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{uc.name}</td>
                    <td className="text-right p-3">{uc.requests}</td>
                    <td className="text-right p-3 font-mono">${uc.cost.toFixed(4)}</td>
                    <td className="text-right p-3 font-mono text-sm">${uc.avgCostPerRequest.toFixed(4)}</td>
                    <td className="text-right p-3">{uc.tokens.toLocaleString()}</td>
                    <td className="text-right p-3">{uc.avgDurationMs.toFixed(0)}ms</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold border-t-2">
                  <td className="p-3">TOTAL</td>
                  <td className="text-right p-3">{stats.summary.totalRequests}</td>
                  <td className="text-right p-3 font-mono">${stats.summary.totalCost.toFixed(4)}</td>
                  <td className="text-right p-3 font-mono text-sm">${stats.summary.averageCostPerRequest.toFixed(4)}</td>
                  <td className="text-right p-3">{stats.summary.totalTokens.toLocaleString()}</td>
                  <td className="text-right p-3">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cost Savings Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">💡</div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Cost Optimization Tips</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Cache efficiency &gt;80%</strong> = 90% cost savings on cached tokens</li>
                <li>• Review system prompts to maximize cacheable content</li>
                <li>• Use Haiku model for simple queries (10x cheaper)</li>
                <li>• Batch similar requests to improve cache hit rate</li>
                <li>• Monitor high-cost use cases for optimization opportunities</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
