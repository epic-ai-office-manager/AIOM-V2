import { X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { StatusPill } from './StatusPill';
import { ActivityFeedRow } from './ActivityFeedRow';

interface OperatorStatusDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function OperatorStatusDrawer({ open, onClose }: OperatorStatusDrawerProps) {
  // Mock data - will be replaced with real data
  const currentlyExecuting = [
    {
      type: 'executing' as const,
      action: 'Sending email to Acme Corp',
      timestamp: new Date(Date.now() - 30000), // 30 seconds ago
    },
    {
      type: 'executing' as const,
      action: 'Creating follow-up task',
      timestamp: new Date(Date.now() - 15000), // 15 seconds ago
    },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed right-0 top-0 h-full w-[400px] bg-white shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 p-6">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Operator Status
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-gray-600">
                Currently active - Running normally
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-6" style={{ height: 'calc(100% - 89px)' }}>
            <div className="space-y-6">
              {/* Currently Executing */}
              <div>
                <h3 className="text-sm font-medium text-gray-900">Currently Executing</h3>
                {currentlyExecuting.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {currentlyExecuting.map((activity, index) => (
                      <ActivityFeedRow key={index} {...activity} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">No actions currently executing</p>
                )}
              </div>

              {/* System Health */}
              <div>
                <h3 className="text-sm font-medium text-gray-900">System Health</h3>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
                    <span className="text-sm text-gray-700">Odoo Connection</span>
                    <StatusPill status="active" showLabel />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
                    <span className="text-sm text-gray-700">AI Service</span>
                    <StatusPill status="active" showLabel />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
                    <span className="text-sm text-gray-700">Email Service</span>
                    <StatusPill status="paused" showLabel />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
                    <span className="text-sm text-gray-700">Database</span>
                    <StatusPill status="active" showLabel />
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-2">
                <button className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                  Emergency Stop
                </button>
                <button className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Pause All Operations
                </button>
                <button className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  View Full Activity Log
                </button>
                <button className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Guardrails Settings
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
