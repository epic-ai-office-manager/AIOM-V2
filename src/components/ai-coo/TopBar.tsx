import { useState } from 'react';
import { Bell, Pause, Settings, Clock } from 'lucide-react';
import { StatusPill } from './StatusPill';
import { OperatorStatusDrawer } from './OperatorStatusDrawer';

export function TopBar() {
  const [showDrawer, setShowDrawer] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo & Status */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-medium text-gray-900">AI Operator</h1>

            <button
              onClick={() => setShowDrawer(true)}
              className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 hover:bg-emerald-200 transition-colors cursor-pointer"
            >
              <StatusPill status="active" />
              <span className="text-sm font-medium text-emerald-700">Active</span>
            </button>
          </div>

        {/* Center: Search Bar */}
        <div className="relative flex-1 max-w-[576px] mx-8">
          <input
            type="text"
            placeholder="Search or ask a question..."
            className="w-full rounded-lg border-0 bg-gray-100 px-10 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50">
            <Clock className="h-4 w-4" />
            Activity Log
          </button>

          <button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50">
            <Pause className="h-4 w-4" />
            Pause
          </button>

          <button className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100">
            <Bell className="h-4 w-4 text-gray-700" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              3
            </span>
          </button>

          <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100">
            <Settings className="h-4 w-4 text-gray-700" />
          </button>
        </div>
      </div>
    </div>

      {/* Operator Status Drawer */}
      <OperatorStatusDrawer open={showDrawer} onClose={() => setShowDrawer(false)} />
    </>
  );
}
