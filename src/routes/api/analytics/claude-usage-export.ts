/**
 * Claude Usage Export API
 * 
 * Export detailed usage data as CSV for billing and analysis
 */

import { createFileRoute } from '@tanstack/react-router';
import { getClaudeSDKClient } from '~/lib/claude/sdk-client';
import { isUsingSDKClient } from '~/lib/claude/migration-wrapper';

export const Route = createFileRoute('/api/analytics/claude-usage-export')({
  server: {
    handlers: {
      GET: async ({ request }) => {
    try {
      // Check if SDK client is enabled
      if (!isUsingSDKClient()) {
        return new Response('SDK client not enabled', { status: 400 });
      }

      const url = new URL(request.url);
      const period = url.searchParams.get('period') || '30d';
      const format = url.searchParams.get('format') || 'csv';
      
      // Calculate since date
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
          since.setFullYear(2000);
          break;
      }
      
      const client = getClaudeSDKClient();
      const stats = client.getUsageStats(period === 'all' ? undefined : since);
      
      if (format === 'csv') {
        const csv = generateCSV(stats);
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename=claude-usage-${period}.csv`,
          },
        });
      } else if (format === 'json') {
        return Response.json(stats, {
          headers: {
            'Content-Disposition': `attachment; filename=claude-usage-${period}.json`,
          },
        });
      } else {
        return new Response('Invalid format. Use csv or json', { status: 400 });
      }
    } catch (error) {
      console.error('[Claude Usage Export Error]', error);
      return new Response('Failed to export usage data', { status: 500 });
    }
      },
    },
  },
});

/**
 * Generate CSV from usage stats
 */
function generateCSV(stats: any): string {
  const rows = [
    'Use Case,Requests,Total Cost,Avg Cost Per Request,Total Tokens,Avg Duration (ms)',
  ];
  
  for (const [name, data] of Object.entries(stats.byUseCase)) {
    const useCaseData = data as any;
    rows.push(
      `"${name}",${useCaseData.requests},$${useCaseData.cost.toFixed(4)},$${(useCaseData.cost / useCaseData.requests).toFixed(4)},${useCaseData.tokens},${useCaseData.avgDurationMs.toFixed(0)}`
    );
  }
  
  // Add summary row
  rows.push('');
  rows.push(`TOTAL,${stats.totalRequests},$${stats.totalCost.toFixed(4)},$${(stats.totalCost / stats.totalRequests).toFixed(4)},${stats.totalTokens},-`);
  rows.push(`Cache Efficiency,-,${stats.cacheEfficiency.toFixed(1)}%,-,-,-`);
  
  return rows.join('\n');
}
