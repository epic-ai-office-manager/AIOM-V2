/**
 * Mobile Expense Request Creation Page
 *
 * Mobile-optimized form for submitting new expense requests
 * with integrated receipt capture functionality.
 */

import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Camera, Loader2, Receipt, X } from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { redirect } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { useCreateExpenseRequest } from "~/hooks/useExpenseRequests";
import { ExpenseRequestForm, type ExpenseRequestSubmitData } from "~/components/ExpenseRequestForm";
import { ReceiptCapture } from "~/components/ReceiptCapture";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import type { MediaUploadResult } from "~/utils/storage/media-helpers";

export const Route = createFileRoute("/mobile/expenses/new")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: "/mobile/expenses/new" },
      });
    }
  },
  component: NewMobileExpensePage,
});

function NewMobileExpensePage() {
  const navigate = useNavigate();
  const createExpenseRequest = useCreateExpenseRequest();
  const [showReceiptCapture, setShowReceiptCapture] = React.useState(false);
  const [capturedReceipts, setCapturedReceipts] = React.useState<MediaUploadResult[]>([]);

  const handleSubmit = async (data: ExpenseRequestSubmitData) => {
    // Use captured receipt URL if available
    const receiptUrl = capturedReceipts.length > 0
      ? capturedReceipts[0].fileKey
      : data.receiptUrl;

    await createExpenseRequest.mutateAsync({
      amount: data.amount,
      currency: data.currency,
      purpose: data.purpose,
      description: data.description,
      receiptUrl,
    });

    // Navigate back to expenses list on success
    navigate({ to: "/mobile/expenses" });
  };

  const handleReceiptCapture = (results: MediaUploadResult[]) => {
    setCapturedReceipts((prev) => [...prev, ...results]);
    setShowReceiptCapture(false);
  };

  const handleRemoveReceipt = (index: number) => {
    setCapturedReceipts((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/mobile/expenses">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">New Expense</h1>
              <p className="text-xs text-muted-foreground">
                Submit a new expense request
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Receipt Capture Quick Action */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => setShowReceiptCapture(true)}
            className="w-full h-20 flex flex-col items-center justify-center gap-2 border-dashed"
            type="button"
            data-testid="capture-receipt-btn"
          >
            <Camera className="h-6 w-6" />
            <span className="text-sm">Capture Receipt</span>
          </Button>
        </div>

        {/* Captured Receipts Preview */}
        {capturedReceipts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2">Captured Receipts</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {capturedReceipts.map((receipt, index) => (
                <div
                  key={receipt.fileKey}
                  className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border"
                >
                  <img
                    src={receipt.previewUrl ?? ""}
                    alt={`Receipt ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveReceipt(index)}
                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setShowReceiptCapture(true)}
                className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Expense Form */}
        <ExpenseRequestForm
          onSubmit={handleSubmit}
          isPending={createExpenseRequest.isPending}
          submitLabel="Submit Expense"
          onCancel={() => navigate({ to: "/mobile/expenses" })}
          cancelLabel="Cancel"
          defaultValues={
            capturedReceipts.length > 0
              ? { receiptUrl: capturedReceipts[0].fileKey }
              : undefined
          }
        />
      </div>

      {/* Receipt Capture Dialog */}
      <Dialog open={showReceiptCapture} onOpenChange={setShowReceiptCapture}>
        <DialogContent className="p-0 max-w-full h-[90vh] sm:max-w-lg">
          <ReceiptCapture
            maxReceipts={5}
            onUploadComplete={handleReceiptCapture}
            onClose={() => setShowReceiptCapture(false)}
            onError={(error) => console.error("Receipt capture error:", error)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
