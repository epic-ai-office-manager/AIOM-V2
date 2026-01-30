/**
 * OCR Receipt Processing Demo Page
 *
 * Demonstrates the OCR receipt processing feature with:
 * - Image upload/capture
 * - OCR extraction using Claude Vision
 * - Manual correction interface
 * - Result display
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Camera,
  FileImage,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { ReceiptDataCorrection } from '~/components/ReceiptDataCorrection';
import { useOcrProcessing } from '~/hooks/useOcrProcessing';
import { cn } from '~/lib/utils';
import type { CorrectedReceiptData } from '~/lib/ocr-service/types';

export const Route = createFileRoute('/demo/ocr-receipt')({
  component: OcrReceiptDemo,
});

function OcrReceiptDemo() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [completedReceipts, setCompletedReceipts] = useState<
    Array<{ data: CorrectedReceiptData; imageUrl: string }>
  >([]);

  const {
    state,
    status,
    isProcessing,
    isReviewing,
    processImage,
    submitCorrection,
    reset,
    skipReview,
  } = useOcrProcessing({
    onExtractionComplete: (result) => {
      console.log('Extraction complete:', result);
    },
    onCorrectionSubmitted: (data) => {
      console.log('Correction submitted:', data);
      // Add to completed receipts
      if (state.imagePreviewUrl) {
        setCompletedReceipts((prev) => [
          ...prev,
          { data, imageUrl: state.imagePreviewUrl! },
        ]);
      }
    },
    onError: (error) => {
      console.error('OCR Error:', error);
    },
  });

  const isSubmitting = status === 'submitting';

  // Handle file selection
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        processImage(file);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processImage]
  );

  // Handle confirmation
  const handleConfirm = useCallback(
    (data: CorrectedReceiptData) => {
      submitCorrection(data);
    },
    [submitCorrection]
  );

  // Handle new receipt after completion
  const handleNewReceipt = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">OCR Receipt Processing</h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Upload a receipt image and our AI will automatically extract the vendor,
            amount, and date. Review and correct the results before saving.
          </p>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="file-input"
        />

        {/* Main Content Area */}
        {status === 'idle' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Receipt Image</CardTitle>
              <CardDescription>
                Select an image of your receipt to extract data automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                data-testid="upload-area"
              >
                <FileImage className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports JPEG, PNG, GIF, WebP (max 5MB)
                </p>
                <div className="flex items-center justify-center gap-4 mt-6">
                  <Button variant="outline" size="lg" data-testid="upload-button">
                    <Upload className="h-5 w-5 mr-2" />
                    Choose File
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing State */}
        {(status === 'uploading' || status === 'processing') && (
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                <p className="text-lg font-medium mb-2">
                  {status === 'uploading' ? 'Preparing image...' : 'Extracting data...'}
                </p>
                <p className="text-sm text-muted-foreground">
                  This may take a few seconds
                </p>
                {state.imagePreviewUrl && (
                  <div className="mt-6 rounded-lg overflow-hidden border max-w-xs mx-auto">
                    <img
                      src={state.imagePreviewUrl}
                      alt="Receipt preview"
                      className="w-full object-contain max-h-48"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review State */}
        {status === 'reviewing' && state.extractionResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Data Extracted Successfully
              </CardTitle>
              <CardDescription>
                Review the extracted data and make any necessary corrections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReceiptDataCorrection
                extractionResult={state.extractionResult}
                imageUrl={state.imagePreviewUrl || undefined}
                onConfirm={handleConfirm}
                onCancel={reset}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        )}

        {/* Submitting State */}
        {status === 'submitting' && (
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Saving receipt data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed State */}
        {status === 'completed' && state.correctedData && (
          <Card data-testid="completed-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Receipt Saved Successfully
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor</p>
                    <p className="font-medium" data-testid="completed-vendor">
                      {state.correctedData.vendor}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-medium" data-testid="completed-amount">
                      {state.correctedData.currency}{' '}
                      {state.correctedData.amount?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium" data-testid="completed-date">
                      {state.correctedData.date}
                    </p>
                  </div>
                  {state.correctedData.category && (
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <p className="font-medium">{state.correctedData.category}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-4 pt-4">
                  <Button onClick={handleNewReceipt} data-testid="new-receipt-button">
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Process Another Receipt
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {status === 'error' && (
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                Processing Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {state.error || 'An error occurred while processing the receipt.'}
              </p>
              <Button onClick={reset} variant="outline" data-testid="retry-button">
                <RefreshCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Previously Processed Receipts */}
        {completedReceipts.length > 0 && status !== 'reviewing' && (
          <Card>
            <CardHeader>
              <CardTitle>Processed Receipts</CardTitle>
              <CardDescription>
                {completedReceipts.length} receipt(s) processed in this session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completedReceipts.map((receipt, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-3 bg-muted rounded-lg"
                    data-testid={`processed-receipt-${index}`}
                  >
                    <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={receipt.imageUrl}
                        alt="Receipt"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{receipt.data.vendor}</p>
                      <p className="text-sm text-muted-foreground">
                        {receipt.data.currency}{' '}
                        {receipt.data.amount?.toFixed(2) || '0.00'} on{' '}
                        {receipt.data.date}
                      </p>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Info */}
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>AI-powered OCR using Claude Vision for accurate extraction</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Automatic extraction of vendor, amount, date, and line items</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Confidence scores for each extracted field</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Manual correction interface for reviewing and fixing data</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Validation to catch common extraction errors</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
