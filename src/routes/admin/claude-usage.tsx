/**
 * Claude Usage Dashboard Route
 * 
 * Admin page for monitoring Claude API costs and usage
 */

import { createFileRoute } from '@tanstack/react-router';
import { ClaudeUsageDashboard } from '~/components/admin/ClaudeUsageDashboard';

export const Route = createFileRoute('/admin/claude-usage')({
  component: ClaudeUsageDashboardPage,
});

function ClaudeUsageDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ClaudeUsageDashboard />
    </div>
  );
}
