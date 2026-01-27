import { Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedRowProps {
  type: 'executing' | 'queued' | 'completed' | 'failed';
  action: string;
  timestamp: Date;
  details?: {
    target?: string;
    amount?: number;
    duration?: number;
  };
  error?: string;
}

const config = {
  executing: {
    icon: Loader2,
    iconClass: 'h-4 w-4 animate-spin text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  queued: {
    icon: Clock,
    iconClass: 'h-4 w-4 text-gray-500',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
  },
  completed: {
    icon: CheckCircle2,
    iconClass: 'h-4 w-4 text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  failed: {
    icon: XCircle,
    iconClass: 'h-4 w-4 text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
};

export function ActivityFeedRow({
  type,
  action,
  timestamp,
  details,
  error,
}: ActivityFeedRowProps) {
  const { icon: Icon, iconClass, bg, border } = config[type];

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${bg} ${border}`}>
      <div className="flex-shrink-0">
        <Icon className={iconClass} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{action}</p>

        {details && (
          <div className="mt-1 text-xs text-gray-600">
            {details.target && <span>Customer: {details.target}</span>}
            {details.amount && (
              <span className={details.target ? 'ml-2' : ''}>
                Amount: ${details.amount.toLocaleString()}
              </span>
            )}
            {details.duration && type === 'completed' && (
              <span className="ml-2">
                ({details.duration}ms)
              </span>
            )}
          </div>
        )}

        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}

        <p className="mt-1 text-xs text-gray-500">
          {formatDistanceToNow(timestamp, { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
