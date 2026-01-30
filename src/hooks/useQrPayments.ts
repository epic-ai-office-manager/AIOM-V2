/**
 * QR Payment Hooks
 *
 * Custom React hooks for QR payment operations including:
 * - Creating payment requests
 * - Processing payments (with wallet integration)
 * - Managing QR code display
 * - Refunds
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  qrPaymentByIdQueryOptions,
  qrPaymentByQrCodeQueryOptions,
  qrPaymentByShortCodeQueryOptions,
  qrPaymentRequestsQueryOptions,
  qrPaymentCountQueryOptions,
  myQrPaymentRequestsQueryOptions,
  qrCodeImageQueryOptions,
  publicQrCodeQueryOptions,
  qrPaymentKeys,
  type QrPaymentStatus,
  type QrPaymentType,
  type QrPaymentFilters,
} from "~/queries/qr-payments";
import { walletBalanceKeys } from "~/queries/wallet-balance";
import {
  createQrPaymentRequestFn,
  updateQrPaymentRequestFn,
  cancelQrPaymentRequestFn,
  deleteQrPaymentRequestFn,
  processQrPaymentFn,
  refundQrPaymentFn,
  QR_PAYMENT_CURRENCIES,
  type CreateQrPaymentRequestFormData,
  type UpdateQrPaymentRequestFormData,
} from "~/fn/qr-payments";
import { getErrorMessage } from "~/utils/error";

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Hook to get a QR payment by ID
 */
export function useQrPayment(id: string) {
  return useQuery(qrPaymentByIdQueryOptions(id));
}

/**
 * Hook to get a QR payment by QR code (for scanning)
 */
export function useQrPaymentByQrCode(qrCode: string) {
  return useQuery(qrPaymentByQrCodeQueryOptions(qrCode));
}

/**
 * Hook to get a QR payment by short code (for manual entry)
 */
export function useQrPaymentByShortCode(shortCode: string) {
  return useQuery(qrPaymentByShortCodeQueryOptions(shortCode));
}

/**
 * Hook to get QR payment requests with filters
 */
export function useQrPaymentRequests(filters?: QrPaymentFilters) {
  return useQuery(qrPaymentRequestsQueryOptions(filters));
}

/**
 * Hook to get QR payment count
 */
export function useQrPaymentCount(filters?: QrPaymentFilters) {
  return useQuery(qrPaymentCountQueryOptions(filters));
}

/**
 * Hook to get current user's QR payment requests (as merchant)
 */
export function useMyQrPaymentRequests(options?: {
  status?: QrPaymentStatus;
  type?: QrPaymentType;
  limit?: number;
  offset?: number;
}) {
  return useQuery(myQrPaymentRequestsQueryOptions(options));
}

/**
 * Hook to get QR code image for a payment
 */
export function useQrCodeImage(
  qrPaymentId: string,
  options?: {
    format?: "png" | "svg";
    width?: number;
    baseUrl?: string;
  }
) {
  return useQuery(qrCodeImageQueryOptions(qrPaymentId, options));
}

/**
 * Hook to get public QR code (for display on payment page)
 */
export function usePublicQrCode(
  qrCode: string,
  options?: {
    format?: "png" | "svg";
    width?: number;
    baseUrl?: string;
  }
) {
  return useQuery(publicQrCodeQueryOptions(qrCode, options));
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Hook for creating a new QR payment request
 */
export function useCreateQrPaymentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQrPaymentRequestFormData) =>
      createQrPaymentRequestFn({ data }),
    onSuccess: (result) => {
      // Invalidate QR payment lists
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.myPayments({}) });

      toast.success("QR payment request created", {
        description: `Short code: ${result.shortCode}`,
      });
    },
    onError: (error) => {
      toast.error("Failed to create QR payment request", {
        description: getErrorMessage(error),
      });
    },
  });
}

/**
 * Hook for updating a QR payment request
 */
export function useUpdateQrPaymentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string } & UpdateQrPaymentRequestFormData) =>
      updateQrPaymentRequestFn({ data }),
    onSuccess: (result) => {
      // Invalidate specific payment and lists
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.detail(result.id) });
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.myPayments({}) });

      toast.success("QR payment request updated");
    },
    onError: (error) => {
      toast.error("Failed to update QR payment request", {
        description: getErrorMessage(error),
      });
    },
  });
}

/**
 * Hook for cancelling a QR payment request
 */
export function useCancelQrPaymentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { qrPaymentId: string; reason?: string }) =>
      cancelQrPaymentRequestFn({ data }),
    onSuccess: (result) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.detail(result.id) });
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.myPayments({}) });

      toast.success("QR payment request cancelled");
    },
    onError: (error) => {
      toast.error("Failed to cancel QR payment request", {
        description: getErrorMessage(error),
      });
    },
  });
}

/**
 * Hook for deleting a QR payment request
 */
export function useDeleteQrPaymentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteQrPaymentRequestFn({ data: { id } }),
    onSuccess: (_, id) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.myPayments({}) });

      toast.success("QR payment request deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete QR payment request", {
        description: getErrorMessage(error),
      });
    },
  });
}

/**
 * Hook for processing a QR payment (paying)
 *
 * This is the main hook for payers to complete a payment:
 * - Debits the payer's wallet
 * - Credits the merchant's wallet
 * - Updates the QR payment status
 */
export function useProcessQrPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      qrPaymentId: string;
      payerWalletId: string;
      paidAmount: string;
      paidCurrency: typeof QR_PAYMENT_CURRENCIES[number];
      idempotencyKey: string;
    }) => processQrPaymentFn({ data }),
    onSuccess: (result, variables) => {
      // Invalidate QR payment queries
      queryClient.invalidateQueries({
        queryKey: qrPaymentKeys.detail(variables.qrPaymentId),
      });
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.lists() });

      // Invalidate wallet balance queries (both payer and merchant)
      queryClient.invalidateQueries({ queryKey: walletBalanceKeys.all });

      toast.success("Payment successful!", {
        description: `Paid ${variables.paidAmount} ${variables.paidCurrency}`,
      });
    },
    onError: (error) => {
      const message = getErrorMessage(error);

      // Check for specific wallet errors
      if (message.includes("Insufficient")) {
        toast.error("Insufficient balance", {
          description: "Please top up your wallet to complete this payment.",
        });
      } else if (message.includes("frozen") || message.includes("suspended")) {
        toast.error("Wallet unavailable", {
          description: message,
        });
      } else if (message.includes("expired")) {
        toast.error("Payment expired", {
          description: "This QR payment request has expired.",
        });
      } else {
        toast.error("Payment failed", {
          description: message,
        });
      }
    },
  });
}

/**
 * Hook for refunding a QR payment
 *
 * Merchants can use this to refund completed payments:
 * - Debits the merchant's wallet
 * - Credits the payer's wallet
 * - Tracks refund history
 */
export function useRefundQrPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      qrPaymentId: string;
      amount: string;
      reason: string;
    }) => refundQrPaymentFn({ data }),
    onSuccess: (result, variables) => {
      // Invalidate QR payment queries
      queryClient.invalidateQueries({
        queryKey: qrPaymentKeys.detail(variables.qrPaymentId),
      });
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: qrPaymentKeys.myPayments({}) });

      // Invalidate wallet balance queries
      queryClient.invalidateQueries({ queryKey: walletBalanceKeys.all });

      toast.success("Refund processed", {
        description: `Refunded ${variables.amount}`,
      });
    },
    onError: (error) => {
      const message = getErrorMessage(error);

      if (message.includes("Insufficient")) {
        toast.error("Insufficient balance for refund", {
          description: "Your wallet doesn't have enough funds to process this refund.",
        });
      } else {
        toast.error("Refund failed", {
          description: message,
        });
      }
    },
  });
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to generate a unique idempotency key for payments
 */
export function usePaymentIdempotencyKey() {
  const generateKey = () => `pay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return { generateKey };
}

/**
 * Hook to scan and validate a QR code
 */
export function useScanQrCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (qrCodeOrUrl: string) => {
      // Try to extract QR code from URL or use directly
      let qrCode = qrCodeOrUrl;

      // If it's a URL, extract the QR code
      if (qrCodeOrUrl.startsWith("http")) {
        const urlParts = qrCodeOrUrl.split("/");
        const payIndex = urlParts.indexOf("pay");
        if (payIndex >= 0 && urlParts[payIndex + 1]) {
          qrCode = urlParts[payIndex + 1];
        }
      }

      // Look up the payment
      const result = await queryClient.fetchQuery(
        qrPaymentByQrCodeQueryOptions(qrCode)
      );

      return result;
    },
    onError: (error) => {
      const message = getErrorMessage(error);

      if (message.includes("expired")) {
        toast.error("QR code expired", {
          description: "This payment request has expired.",
        });
      } else if (message.includes("not found")) {
        toast.error("Invalid QR code", {
          description: "This QR code is not recognized.",
        });
      } else {
        toast.error("Scan failed", {
          description: message,
        });
      }
    },
  });
}

// =============================================================================
// Re-export types
// =============================================================================

export type { QrPaymentStatus, QrPaymentType, QrPaymentFilters };
