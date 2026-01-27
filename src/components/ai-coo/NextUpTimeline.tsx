import { Mail, Phone, CheckSquare, Bell } from 'lucide-react';
import { format } from 'date-fns';

interface TimelineItem {
  id: string;
  scheduledFor: Date;
  action: string;
  type: 'email' | 'call' | 'task' | 'reminder';
  target?: string;
}

interface NextUpTimelineProps {
  items: TimelineItem[];
}

const iconMap = {
  email: Mail,
  call: Phone,
  task: CheckSquare,
  reminder: Bell,
};

export function NextUpTimeline({ items }: NextUpTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-medium text-gray-900">Next Up (2 hours)</h3>
        <p className="mt-4 text-center text-sm text-gray-500">No scheduled actions</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-medium text-gray-900">Next Up (2 hours)</h3>

      <div className="mt-4 space-y-3">
        {items.map((item, index) => {
          const Icon = iconMap[item.type];
          const isLast = index === items.length - 1;

          return (
            <div key={item.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                {/* Connecting line */}
                {!isLast && <div className="w-0.5 flex-1 bg-gray-200" />}
              </div>

              <div className={`flex-1 ${!isLast ? 'pb-4' : ''}`}>
                <div className="text-xs text-gray-500">
                  {format(item.scheduledFor, 'h:mm a')}
                </div>
                <p className="mt-1 text-sm font-medium text-gray-900">{item.action}</p>
                {item.target && (
                  <p className="mt-0.5 text-xs text-gray-600">{item.target}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button className="mt-4 text-sm text-blue-600 hover:text-blue-700">
        View Full Calendar →
      </button>
    </div>
  );
}
