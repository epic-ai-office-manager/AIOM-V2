import { Lightbulb, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface InsightCardProps {
  insight: string;
  category: 'pattern' | 'optimization' | 'warning' | 'success';
  supportingData?: string;
  actionable?: {
    label: string;
    action: () => void;
  };
}

const config = {
  pattern: {
    icon: Lightbulb,
    iconClass: 'h-5 w-5 text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  optimization: {
    icon: Zap,
    iconClass: 'h-5 w-5 text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'h-5 w-5 text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'h-5 w-5 text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
};

export function InsightCard({ insight, category, supportingData, actionable }: InsightCardProps) {
  const { icon: Icon, iconClass, bg, border } = config[category];

  return (
    <div className={`rounded-lg border p-4 ${bg} ${border}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Icon className={iconClass} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{insight}</p>

          {supportingData && (
            <p className="mt-2 text-xs text-gray-600">{supportingData}</p>
          )}

          {actionable && (
            <button
              onClick={actionable.action}
              className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              {actionable.label} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
