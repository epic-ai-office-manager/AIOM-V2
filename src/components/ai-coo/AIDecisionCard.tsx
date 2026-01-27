import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';
import * as Collapsible from '@radix-ui/react-collapsible';

interface RecommendedAction {
  step: number;
  description: string;
  status: 'needs_approval' | 'draft' | 'auto_executable';
}

interface AIDecisionCardProps {
  id: string;
  priority: 'critical' | 'attention' | 'info' | 'automated';
  title: string;
  body: string;
  impacted: string;
  sources: string;
  riskAssessment: string;
  recommendedPlan: RecommendedAction[];
}

const statusConfig = {
  needs_approval: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    label: 'Needs approval',
  },
  draft: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    label: 'Draft ready',
  },
  auto_executable: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    label: 'Auto-executable',
  },
};

const borderColors = {
  critical: 'border-l-red-500',
  attention: 'border-l-amber-500',
  info: 'border-l-blue-500',
  automated: 'border-l-gray-500',
};

export function AIDecisionCard({
  id,
  priority,
  title,
  body,
  impacted,
  sources,
  riskAssessment,
  recommendedPlan,
}: AIDecisionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate one-line summary from body (first sentence)
  const summary = body.split('.')[0] + '.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border border-gray-200 border-l-4 ${borderColors[priority]} bg-white p-5 transition-shadow hover:shadow-md`}
    >
      <Collapsible.Root open={isExpanded} onOpenChange={setIsExpanded}>
        {/* Priority Badge */}
        <div className="mb-4">
          <PriorityBadge priority={priority} />
        </div>

        {/* Title */}
        <h3 className="mb-3 text-base font-medium text-gray-900">{title}</h3>

        {/* Summary (always visible) */}
        <p className="mb-4 text-sm leading-relaxed text-gray-600">{summary}</p>

        {/* Collapsible Content */}
        <Collapsible.Content>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                {/* Full Body (only show if different from summary) */}
                {body !== summary && (
                  <p className="mb-4 text-sm leading-relaxed text-gray-600">{body}</p>
                )}

                {/* Impacted & Sources */}
                <div className="mb-4 space-y-0.5 text-xs text-gray-500">
                  <div className="flex gap-2">
                    <span className="font-medium">Impacted:</span>
                    <span>{impacted}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium">Sources:</span>
                    <span>{sources}</span>
                  </div>
                </div>

                {/* Risk Assessment Box */}
                <div className="mb-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-900">{riskAssessment}</p>
                </div>

                {/* Recommended Plan */}
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-gray-500">Recommended Plan:</p>
                  <div className="space-y-3">
                    {recommendedPlan.map((action) => (
                      <div key={action.step} className="flex gap-3">
                        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                          {action.step}
                        </div>
                        <div className="flex-1">
                          <p className="mb-1 text-sm text-gray-900">{action.description}</p>
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${statusConfig[action.status].bg} ${statusConfig[action.status].text} ${statusConfig[action.status].border}`}
                          >
                            {statusConfig[action.status].label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Collapsible.Content>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Approve & Execute
          </button>
          <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Review Each
          </button>
          <button className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Sparkles className="mr-1 h-4 w-4" />
            Ask AI
          </button>
          <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50">
            Dismiss
          </button>
        </div>

        {/* Expand/Collapse Toggle */}
        <Collapsible.Trigger asChild>
          <button className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show Details
              </>
            )}
          </button>
        </Collapsible.Trigger>
      </Collapsible.Root>
    </motion.div>
  );
}
