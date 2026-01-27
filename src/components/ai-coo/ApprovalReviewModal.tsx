import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Check, X } from 'lucide-react';

interface Action {
  id: string;
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  estimatedImpact: string;
}

interface ApprovalReviewModalProps {
  open: boolean;
  onClose: () => void;
  actions: Action[];
  onApprove?: (actionIds: string[]) => void;
}

const riskConfig = {
  low: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Low',
  },
  medium: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    label: 'Medium',
  },
  high: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    label: 'High',
  },
};

export function ApprovalReviewModal({
  open,
  onClose,
  actions,
  onApprove,
}: ApprovalReviewModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelection = (actionId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(actionId)) {
      newSelected.delete(actionId);
    } else {
      newSelected.add(actionId);
    }
    setSelected(newSelected);
  };

  const handleApproveSelected = async () => {
    if (selected.size === 0) return;

    // Call the approval API for each selected action
    const actionIds = Array.from(selected);

    try {
      await Promise.all(
        actionIds.map(id =>
          fetch(`/api/ai-coo/actions/${id}/approve`, { method: 'POST' })
        )
      );

      // Call the onApprove callback
      onApprove?.(actionIds);

      // Show success toast (would use sonner in real implementation)
      console.log(`Approved ${selected.size} actions`);

      // Reset selection and close
      setSelected(new Set());
      onClose();
    } catch (error) {
      console.error('Failed to approve actions:', error);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Review Actions
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-gray-600">
                Select actions to approve. Each will execute independently.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </Dialog.Close>
          </div>

          {/* Actions List */}
          <div className="mt-6 max-h-[400px] space-y-3 overflow-y-auto">
            {actions.map((action) => {
              const isSelected = selected.has(action.id);
              const { bg, text, label } = riskConfig[action.risk];

              return (
                <div
                  key={action.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <Checkbox.Root
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(action.id)}
                      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 border-gray-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                    >
                      <Checkbox.Indicator>
                        <Check className="h-3 w-3 text-white" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>

                    {/* Action Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900">{action.title}</h4>
                      <p className="mt-1 text-sm text-gray-600">{action.description}</p>

                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className={`rounded px-2 py-0.5 ${bg} ${text}`}>
                          Risk: {label}
                        </span>
                        <span className="text-gray-500">{action.estimatedImpact}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {actions.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-500">
                No actions to review
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-600">
              {selected.size > 0 ? (
                <span className="font-medium">
                  {selected.size} action{selected.size > 1 ? 's' : ''} selected
                </span>
              ) : (
                <span>Select actions to approve</span>
              )}
            </div>

            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
              </Dialog.Close>

              <button
                onClick={handleApproveSelected}
                disabled={selected.size === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve {selected.size > 0 && `(${selected.size})`}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
