/**
 * Claude Usage Analytics API
 * 
 * Provides cost tracking and usage statistics for Claude API calls
 */

import { createFileRoute } from '@tanstack/react-router';
import { getClaudeSDKClient } from '~/lib/claude/sdk-client';
import { isUsingSDKClient } from '~/lib/claude/migration-wrapper';

export const Route = createFileRoute('/api/analytics/claude-usage')({
  server: {
    handlers: {
      GET: async ({ request }) => {
    try {
      // Check if SDK client is enabled
      if (!isUsingSDKClient()) {
        return Response.json({
          error: 'SDK client not enabled. Set USE_SDK_CLIENT=true to track usage.',
          migrationStatus: 'legacy',
        }, { status: 400 });
      }

      const url = new URL(request.url);
      const period = url.searchParams.get('period') || '7d';
      
      // Calculate since date based on period
      const since = new Date();
      switch (period) {
        case '24h':
          since.setHours(since.getHours() - 24);
          break;
        case '7d':
          since.setDate(since.getDate() - 7);
          break;
        case '30d':
          since.setDate(since.getDate() - 30);
          break;
        case 'all':
          since.setFullYear(2000); // Get all data
          break;
        default:
          since.setDate(since.getDate() - 7);
      }
      
      const client = getClaudeSDKClient();
      const stats = client.getUsageStats(period === 'all' ? undefined : since);
      
      // Calculate days in period for projection
      const daysSince = period === 'all' 
        ? 30 
        : (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24);
      
      const projectedMonthlyCost = daysSince > 0 
        ? (stats.totalCost / daysSince) * 30 
        : 0;
      
      return Response.json({
        period,
        summary: {
          totalCost: stats.totalCost,
          totalRequests: stats.totalRequests,
          totalTokens: stats.totalTokens,
          averageCostPerRequest: stats.totalRequests > 0 
            ? stats.totalCost / stats.totalRequests 
            : 0,
          cacheEfficiency: `${stats.cacheEfficiency.toFixed(1)}%`,
          cacheEfficiencyRaw: stats.cacheEfficiency,
        },
        byUseCase: Object.entries(stats.byUseCase)
          .map(([name, data]) => ({
            name,
            cost: data.cost,
            requests: data.requests,
            tokens: data.tokens,
            avgCostPerRequest: data.cost / data.requests,
            avgDurationMs: data.avgDurationMs,
          }))
          .sort((a, b) => b.cost - a.cost),
        projectedMonthlyCost,
        alerts: generateAlerts(stats, projectedMonthlyCost),
      });
    } catch (error) {
      console.error('[Claude Usage API Error]', error);
      return Response.json({
        error: 'Failed to fetch usage statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
      },
    },
  },
});

/**
 * Generate alerts based on usage patterns
 */
function generateAlerts(stats: any, projectedMonthlyCost: number): Array<{
  type: 'warning' | 'error' | 'info';
  message: string;
}> {
  const alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string }> = [];
  
  // Cost alerts
  if (projectedMonthlyCost > 100) {
    alerts.push({
      type: 'error',
      message: `Projected monthly cost ($${projectedMonthlyCost.toFixed(2)}) exceeds $100 budget`,
    });
  } else if (projectedMonthlyCost > 50) {
    alerts.push({
      type: 'warning',
      message: `Projected monthly cost ($${projectedMonthlyCost.toFixed(2)}) approaching budget limit`,
    });
  }
  
  // Cache efficiency alerts
  if (stats.cacheEfficiency < 50) {
    alerts.push({
      type: 'warning',
      message: `Low cache efficiency (${stats.cacheEfficiency.toFixed(1)}%). Review system prompts.`,
    });
  } else if (stats.cacheEfficiency > 80) {
    alerts.push({
      type: 'info',
      message: `Excellent cache efficiency (${stats.cacheEfficiency.toFixed(1)}%)`,
    });
  }
  
  // High-cost use case alerts
  for (const [name, data] of Object.entries(stats.byUseCase)) {
    const useCaseData = data as any;
    if (useCaseData.cost > 10) {
      alerts.push({
        type: 'warning',
        message: `Use case "${name}" has high cost: $${useCaseData.cost.toFixed(2)}`,
      });
    }
  }
  
  return alerts;
}
