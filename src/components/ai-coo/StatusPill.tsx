import { motion } from 'framer-motion';

interface StatusPillProps {
  status: 'active' | 'paused' | 'error';
  showLabel?: boolean;
}

const config = {
  active: {
    bg: 'bg-emerald-500',
    ringColor: 'rgba(16, 185, 129, 0.75)',
    label: 'Active',
    textColor: 'text-emerald-700',
  },
  paused: {
    bg: 'bg-gray-400',
    ringColor: 'rgba(156, 163, 175, 0)',
    label: 'Paused',
    textColor: 'text-gray-600',
  },
  error: {
    bg: 'bg-red-500',
    ringColor: 'rgba(239, 68, 68, 0.75)',
    label: 'Error',
    textColor: 'text-red-700',
  },
};

export function StatusPill({ status, showLabel = false }: StatusPillProps) {
  const { bg, ringColor, label, textColor } = config[status];
  const shouldAnimate = status === 'active' || status === 'error';

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-2 w-2">
        <div className={`h-2 w-2 rounded-full ${bg}`} />
        {shouldAnimate && (
          <motion.span
            className={`absolute inset-0 rounded-full ${bg}`}
            animate={{
              scale: [1, 2, 2],
              opacity: [0.75, 0, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        )}
      </div>
      {showLabel && (
        <span className={`text-sm font-medium ${textColor}`}>{label}</span>
      )}
    </div>
  );
}
