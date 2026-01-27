import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface PriorityBadgeProps {
  priority: 'critical' | 'attention' | 'info' | 'automated';
}

const priorityConfig = {
  critical: {
    badge: 'bg-red-100 text-red-600',
    icon: AlertCircle,
    label: 'Critical',
    shouldPulse: true,
    pulseColor: 'rgba(239, 68, 68, 0.7)',
  },
  attention: {
    badge: 'bg-amber-100 text-amber-600',
    icon: AlertCircle,
    label: 'Attention',
    shouldPulse: false,
    pulseColor: 'rgba(245, 158, 11, 0)',
  },
  info: {
    badge: 'bg-blue-100 text-blue-600',
    icon: Info,
    label: 'Info',
    shouldPulse: false,
    pulseColor: 'rgba(59, 130, 246, 0)',
  },
  automated: {
    badge: 'bg-gray-100 text-gray-600',
    icon: CheckCircle2,
    label: 'Automated',
    shouldPulse: false,
    pulseColor: 'rgba(107, 114, 128, 0)',
  },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <motion.div
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${config.badge}`}
      animate={
        config.shouldPulse
          ? {
              boxShadow: [
                `0 0 0 0 ${config.pulseColor}`,
                `0 0 0 10px rgba(239, 68, 68, 0)`,
              ],
            }
          : {}
      }
      transition={
        config.shouldPulse
          ? {
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeOut',
            }
          : {}
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </motion.div>
  );
}
