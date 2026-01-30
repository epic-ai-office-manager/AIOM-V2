/**
 * useOcrProcessing Hook
 *
 * Provides state management and utilities for OCR receipt processing.
 * Handles image processing, OCR extraction, and data correction flow.
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { processReceiptImageFn, submitReceiptCorrectionFn } from '~/fn/ocr-processing';
import { fileToBase64, getMimeType } from '~/lib/ocr-service';
import type {
  ReceiptExtractionResult,
  CorrectedReceiptData,
  OcrProcessingOptions,
} from '~/lib/ocr-service/types';

// ============================================================================
// Types
// ============================================================================

export type OcrProcessingStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'reviewing'
  | 'submitting'
  | 'completed'
  | 'error';

export interface OcrProcessingState {
  status: OcrProcessingStatus;
  imagePreviewUrl: string | null;
  extractionResult: ReceiptExtractionResult | null;
  extractionId: string | null;
  correctedData: CorrectedReceiptData | null;
  error: string | null;
  processingTimeMs: number | null;
}

export interface UseOcrProcessingOptions {
  /** Callback when extraction is complete */
  onExtractionComplete?: (result: ReceiptExtractionResult) => void;
  /** Callback when correction is submitted */
  onCorrectionSubmitted?: (data: CorrectedReceiptData) => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** OCR processing options */
  ocrOptions?: OcrProcessingOptions;
}

export interface UseOcrProcessingReturn {
  // State
  state: OcrProcessingState;
  status: OcrProcessingStatus;
  isProcessing: boolean;
  isReviewing: boolean;

  // Actions
  processImage: (file: File | Blob) => Promise<void>;
  processBase64Image: (
    base64: string,
    mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  ) => Promise<void>;
  submitCorrection: (data: CorrectedReceiptData) => Promise<void>;
  reset: () => void;
  skipReview: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useOcrProcessing(
  options: UseOcrProcessingOptions = {}
): UseOcrProcessingReturn {
  const { onExtractionComplete, onCorrectionSubmitted, onError, ocrOptions } = options;

  // State
  const [state, setState] = useState<OcrProcessingState>({
    status: 'idle',
    imagePreviewUrl: null,
    extractionResult: null,
    extractionId: null,
    correctedData: null,
    error: null,
    processingTimeMs: null,
  });

  // Process image mutation
  const processImageMutation = useMutation({
    mutationFn: async ({
      base64,
      mimeType,
    }: {
      base64: string;
      mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    }) => {
      const result = await processReceiptImageFn({
        data: {
          imageBase64: base64,
          mimeType,
          options: ocrOptions,
        },
      });
      return result;
    },
    onSuccess: (result) => {
      if (result.success && result.data) {
        setState((prev) => ({
          ...prev,
          status: 'reviewing',
          extractionResult: result.data ?? null,
          extractionId: result.extractionId,
          processingTimeMs: result.processingTimeMs || null,
          error: null,
        }));
        onExtractionComplete?.(result.data);
      } else {
        const errorMsg = result.error || 'Processing failed';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMsg,
        }));
        onError?.(errorMsg);
      }
    },
    onError: (error) => {
      const errorMsg = error instanceof Error ? error.message : 'Processing failed';
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMsg,
      }));
      onError?.(errorMsg);
    },
  });

  // Submit correction mutation
  const submitCorrectionMutation = useMutation({
    mutationFn: async (data: CorrectedReceiptData) => {
      if (!state.extractionId || !state.extractionResult) {
        throw new Error('No extraction to correct');
      }
      const result = await submitReceiptCorrectionFn({
        data: {
          extractionId: state.extractionId,
          originalData: state.extractionResult,
          correctedData: data,
        },
      });
      return result;
    },
    onSuccess: (result) => {
      if (result.success && result.correctedData) {
        setState((prev) => ({
          ...prev,
          status: 'completed',
          correctedData: result.correctedData,
          error: null,
        }));
        onCorrectionSubmitted?.(result.correctedData);
      } else {
        const errorMsg = result.error || 'Submission failed';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMsg,
        }));
        onError?.(errorMsg);
      }
    },
    onError: (error) => {
      const errorMsg = error instanceof Error ? error.message : 'Submission failed';
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMsg,
      }));
      onError?.(errorMsg);
    },
  });

  // Process image from File/Blob
  const processImage = useCallback(
    async (file: File | Blob) => {
      try {
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);

        setState((prev) => ({
          ...prev,
          status: 'uploading',
          imagePreviewUrl: previewUrl,
          error: null,
        }));

        // Convert to base64
        const base64 = await fileToBase64(file);
        const mimeType = file instanceof File ? getMimeType(file) : 'image/jpeg';

        setState((prev) => ({
          ...prev,
          status: 'processing',
        }));

        // Process the image
        await processImageMutation.mutateAsync({ base64, mimeType });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to process image';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMsg,
        }));
        onError?.(errorMsg);
      }
    },
    [processImageMutation, onError]
  );

  // Process image from base64
  const processBase64Image = useCallback(
    async (
      base64: string,
      mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    ) => {
      try {
        setState((prev) => ({
          ...prev,
          status: 'processing',
          error: null,
        }));

        await processImageMutation.mutateAsync({ base64, mimeType });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to process image';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMsg,
        }));
        onError?.(errorMsg);
      }
    },
    [processImageMutation, onError]
  );

  // Submit correction
  const submitCorrection = useCallback(
    async (data: CorrectedReceiptData) => {
      setState((prev) => ({
        ...prev,
        status: 'submitting',
      }));

      await submitCorrectionMutation.mutateAsync(data);
    },
    [submitCorrectionMutation]
  );

  // Reset state
  const reset = useCallback(() => {
    // Revoke preview URL if exists
    if (state.imagePreviewUrl) {
      URL.revokeObjectURL(state.imagePreviewUrl);
    }

    setState({
      status: 'idle',
      imagePreviewUrl: null,
      extractionResult: null,
      extractionId: null,
      correctedData: null,
      error: null,
      processingTimeMs: null,
    });
  }, [state.imagePreviewUrl]);

  // Skip review and use extracted data as-is
  const skipReview = useCallback(() => {
    if (state.extractionResult) {
      const data: CorrectedReceiptData = {
        amount: state.extractionResult.amount?.value || null,
        currency: state.extractionResult.amount?.currency || 'USD',
        vendor: state.extractionResult.vendor?.name || '',
        date: state.extractionResult.date?.value || new Date().toISOString().split('T')[0],
      };

      setState((prev) => ({
        ...prev,
        status: 'completed',
        correctedData: data,
      }));

      onCorrectionSubmitted?.(data);
    }
  }, [state.extractionResult, onCorrectionSubmitted]);

  return {
    state,
    status: state.status,
    isProcessing:
      state.status === 'uploading' ||
      state.status === 'processing' ||
      state.status === 'submitting',
    isReviewing: state.status === 'reviewing',

    processImage,
    processBase64Image,
    submitCorrection,
    reset,
    skipReview,
  };
}

export default useOcrProcessing;
