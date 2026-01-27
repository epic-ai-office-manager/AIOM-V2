import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'happening_now' | 'upcoming' | 'recent';
  icon: 'mail' | 'phone' | 'check' | 'clock' | 'alert';
  iconColor: string;
  title: string;
  subtitle: string;
  status?: 'running' | 'queued' | 'succeeded';
  time?: string;
}

const iconMap = {
  mail: Mail,
  phone: Phone,
  check: CheckCircle2,
  clock: Clock,
  alert: AlertCircle,
};

export function LiveActivityColumn() {
  // Fetch real activity feed from API
  const { data, isLoading } = useQuery({
    queryKey: ['ai-coo-activity-feed'],
    queryFn: async () => {
      const response = await fetch('/api/ai-coo/activity-feed');
      if (!response.ok) throw new Error('Failed to fetch activity feed');
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for real-time feel
  });

  const happeningNow: ActivityItem[] = data?.happening_now || [];
  const upcoming: ActivityItem[] = data?.upcoming || [];
  const recent: ActivityItem[] = data?.recent || [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-6 text-lg font-medium text-gray-900">Live Activity</h2>

      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-sm text-gray-500">Loading activity...</p>
        </div>
      ) : (
        <>
          {/* Happening Now */}
          <div className="mb-6">
            <p className="mb-3 text-xs font-medium text-gray-500">HAPPENING NOW</p>
            {happeningNow.length > 0 ? (
              <div className="space-y-3">
                {happeningNow.map((item: ActivityItem) => (
                  <ActivityRow key={item.id} {...item} />
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">No active operations</p>
            )}
          </div>

          {/* Next 2 Hours */}
          <div className="mb-6">
            <p className="mb-3 text-xs font-medium text-gray-500">NEXT 2 HOURS</p>
            {upcoming.length > 0 ? (
              <div className="space-y-1">
                {upcoming.map((item: ActivityItem) => (
                  <UpcomingActivityRow key={item.id} {...item} />
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">No upcoming actions scheduled</p>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <p className="mb-3 text-xs font-medium text-gray-500">RECENT ACTIVITY</p>
            {recent.length > 0 ? (
              <div className="space-y-2">
                {recent.map((item: ActivityItem) => (
                  <ActivityRow key={item.id} {...item} />
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">No recent activity</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityRow({ icon, iconColor, title, subtitle, status }: ActivityItem) {
  const Icon = iconMap[icon];

  return (
    <div className="flex gap-3 rounded-lg p-3 hover:bg-gray-50">
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1">
        <p className="text-sm text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      {status === 'running' && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        </div>
      )}

      {status === 'succeeded' && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        </div>
      )}

      {status === 'queued' && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
          <Clock className="h-4 w-4 text-gray-600" />
        </div>
      )}
    </div>
  );
}

function UpcomingActivityRow({ icon, iconColor, title, subtitle, time }: ActivityItem) {
  const Icon = iconMap[icon];

  return (
    <div className="flex gap-4 rounded-lg p-2 hover:bg-gray-50">
      <p className="w-12 text-xs text-gray-500">{time}</p>

      <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${iconColor}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="flex-1">
        <p className="text-sm text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}
