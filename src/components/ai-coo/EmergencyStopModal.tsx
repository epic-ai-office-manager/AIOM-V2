import { AlertTriangle } from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

interface EmergencyStopModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export function EmergencyStopModal({ open, onClose, onConfirm }: EmergencyStopModalProps) {
  const handleEmergencyStop = async () => {
    try {
      // Call API to pause all operations
      await fetch('/api/ai-coo/emergency-stop', { method: 'POST' });

      // Call the onConfirm callback if provided
      onConfirm?.();

      // Close the modal
      onClose();

      // Show success toast (would use sonner in real implementation)
      console.log('All operations paused');
    } catch (error) {
      console.error('Failed to stop operations:', error);
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={onClose}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>

            <div className="flex-1">
              <AlertDialog.Title className="text-lg font-semibold text-gray-900">
                Emergency Stop
              </AlertDialog.Title>

              <AlertDialog.Description className="mt-2 text-sm text-gray-600">
                This will immediately pause all autonomous operations:

                <ul className="mt-3 list-inside list-disc space-y-1 text-sm">
                  <li>Stop all in-progress actions</li>
                  <li>Cancel queued actions</li>
                  <li>Prevent new actions from starting</li>
                </ul>

                <p className="mt-3 text-sm font-medium text-gray-900">
                  You can resume operations later from the settings panel.
                </p>
              </AlertDialog.Description>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
            </AlertDialog.Cancel>

            <AlertDialog.Action asChild>
              <button
                onClick={handleEmergencyStop}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Stop All Operations
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
