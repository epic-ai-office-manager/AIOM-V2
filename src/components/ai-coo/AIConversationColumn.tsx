import { useQuery } from '@tanstack/react-query';
import { AIDecisionCard } from './AIDecisionCard';

export function AIConversationColumn() {
  // Fetch real AI COO decision cards from API
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-coo-action-recommendations'],
    queryFn: async () => {
      const response = await fetch('/api/ai-coo/action-recommendations?status=pending_approval&limit=10');
      if (!response.ok) throw new Error('Failed to fetch action recommendations');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const decisionCards = data?.recommendations || [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-medium text-gray-900">AI COO Conversation</h2>
        <p className="text-sm text-gray-500">
          {isLoading ? 'Loading...' :
           error ? 'Error loading recommendations' :
           decisionCards.length > 0 ? `I need your input on ${decisionCards.length} situation${decisionCards.length > 1 ? 's' : ''}` :
           'No pending actions right now'}
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-sm text-gray-500">Loading recommendations...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-800">Failed to load recommendations. Please try refreshing.</p>
        </div>
      )}

      {/* Decision Cards */}
      {!isLoading && !error && decisionCards.map((card: any) => (
        <AIDecisionCard key={card.id} {...card} />
      ))}

      {/* Chat Input */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Ask me anything about your business..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Quick Action Buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
            Show all deals &gt;$50K
          </button>
          <button className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
            Overdue invoices
          </button>
          <button className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
            Team productivity
          </button>
        </div>
      </div>
    </div>
  );
}
