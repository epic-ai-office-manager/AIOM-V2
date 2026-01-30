import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware } from "./middleware";
import {
  createQrPaymentRequest,
  updateQrPaymentRequest,
  deleteQrPaymentRequest,
  findQrPaymentById,
  findQrPaymentByQrCode,
  findQrPaymentByShortCode,
  findQrPaymentByIdWithMerchant,
  getAllQrPaymentRequests,
  getQrPaymentRequestsCount,
  getQrPaymentsByMerchant,
  getPendingQrPayments,
  cancelQrPayment,
  processQrPayment,
  refundQrPayment,
  isQrCodeUnique,
  isShortCodeUnique,
  type QrPaymentFilters,
} from "~/data-access/qr-payments";
import {
  findWalletByUserId,
  getOrCreateWallet,
  findWalletById,
} from "~/data-access/wallet";
import {
  debitWallet,
  creditWallet,
  WalletErrorCodes,
} from "~/data-access/wallet-balance-service";
import {
  QR_PAYMENT_STATUSES,
  QR_PAYMENT_TYPES,
  QR_PAYMENT_FEE_TYPES,
  QR_CODE_FORMATS,
  QR_PAYMENT_CURRENCIES,
  type QrMerchantInfo,
  type QrPaymentMetadata,
  type QrPaymentAttempt,
  type QrPaymentRefund,
} from "~/db/schema";
import { nanoid } from "nanoid";
import {
  generatePaymentQrCode,
  type QrCodeGenerationOptions,
} from "~/lib/qr-code-service";

// =============================================================================
// QR Payment Constants
// =============================================================================

export { QR_PAYMENT_STATUSES, QR_PAYMENT_TYPES, QR_PAYMENT_FEE_TYPES, QR_CODE_FORMATS, QR_PAYMENT_CURRENCIES };

// =============================================================================
// Zod Validation Schemas
// =============================================================================

/**
 * Merchant Address Schema
 */
const merchantAddressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().min(2).max(3), // ISO country code
});

/**
 * Merchant Information Schema
 */
export const merchantInfoSchema = z.object({
  merchantId: z.string().min(1, "Merchant ID is required"),
  merchantName: z.string().min(1, "Merchant name is required").max(200),
  merchantLogo: z.string().url().optional(),
  businessType: z.string().max(100).optional(),
  taxId: z.string().max(50).optional(),
  address: merchantAddressSchema.optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
  website: z.string().url().optional(),
});

/**
 * Payment Location Schema
 */
const paymentLocationSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * Payment Metadata Schema
 */
export const paymentMetadataSchema = z.object({
  orderId: z.string().max(100).optional(),
  invoiceNumber: z.string().max(100).optional(),
  productDescription: z.string().max(500).optional(),
  customerNote: z.string().max(500).optional(),
  merchantNote: z.string().max(500).optional(),
  callbackUrl: z.string().url().optional(),
  successRedirectUrl: z.string().url().optional(),
  failureRedirectUrl: z.string().url().optional(),
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().max(500).optional(),
  location: paymentLocationSchema.optional(),
  customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

/**
 * Payment Attempt Schema
 */
export const paymentAttemptSchema = z.object({
  id: z.string(),
  attemptedAt: z.string().datetime(),
  status: z.enum(["initiated", "processing", "completed", "failed"]),
  payerWalletId: z.string().optional(),
  payerId: z.string().optional(),
  paymentMethod: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  processingTimeMs: z.number().int().positive().optional(),
  transactionId: z.string().optional(),
});

/**
 * Refund Record Schema
 */
export const refundRecordSchema = z.object({
  id: z.string(),
  refundedAt: z.string().datetime(),
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: "Refund amount must be a positive number" }
  ),
  reason: z.string().min(1, "Refund reason is required").max(500),
  initiatedBy: z.string().min(1, "Initiator ID is required"),
  transactionId: z.string().optional(),
  status: z.enum(["pending", "completed", "failed"]),
});

/**
 * Amount validation helper
 */
const amountSchema = z.string().refine(
  (val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  },
  { message: "Amount must be a positive number" }
);

/**
 * Optional amount validation helper
 */
const optionalAmountSchema = z.string().refine(
  (val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  },
  { message: "Amount must be a non-negative number" }
).optional().nullable();

// =============================================================================
// Create QR Payment Request Schema
// =============================================================================

export const createQrPaymentRequestSchema = z.object({
  // Payment type
  type: z.enum(QR_PAYMENT_TYPES).default("dynamic"),

  // Amount details
  amount: amountSchema,
  currency: z.enum(QR_PAYMENT_CURRENCIES).default("USD"),

  // Optional flexible payment amounts
  minAmount: optionalAmountSchema,
  maxAmount: optionalAmountSchema,

  // Fee configuration
  feeAmount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: "Fee amount must be non-negative" }
  ).default("0.00"),
  feeType: z.enum(QR_PAYMENT_FEE_TYPES).default("fixed"),
  feePercentage: optionalAmountSchema,

  // Expiration (required for dynamic, optional for static)
  expiresAt: z.date().optional().nullable(),

  // Description and reference
  description: z.string().max(500).optional().or(z.literal("")),
  reference: z.string().max(100).optional().or(z.literal("")),

  // Merchant info (will be populated with authenticated user data)
  merchantInfo: merchantInfoSchema,

  // Additional metadata
  metadata: paymentMetadataSchema.optional(),

  // Notification settings
  notifyMerchantOnPayment: z.boolean().default(true),
  notifyPayerOnPayment: z.boolean().default(true),

  // QR code format
  qrCodeFormat: z.enum(QR_CODE_FORMATS).default("png"),
}).refine(
  (data) => {
    // For dynamic payments, expiration is required
    if (data.type === "dynamic" && !data.expiresAt) {
      return false;
    }
    return true;
  },
  {
    message: "Expiration date is required for dynamic QR payments",
    path: ["expiresAt"],
  }
).refine(
  (data) => {
    // If both min and max are provided, min must be less than max
    if (data.minAmount && data.maxAmount) {
      const min = parseFloat(data.minAmount);
      const max = parseFloat(data.maxAmount);
      return min < max;
    }
    return true;
  },
  {
    message: "Minimum amount must be less than maximum amount",
    path: ["minAmount"],
  }
);

export type CreateQrPaymentRequestFormData = z.infer<typeof createQrPaymentRequestSchema>;

// =============================================================================
// Update QR Payment Request Schema
// =============================================================================

export const updateQrPaymentRequestSchema = z.object({
  // Only updatable before payment
  amount: amountSchema.optional(),
  minAmount: optionalAmountSchema,
  maxAmount: optionalAmountSchema,
  description: z.string().max(500).optional(),
  reference: z.string().max(100).optional(),
  expiresAt: z.date().optional().nullable(),
  metadata: paymentMetadataSchema.optional(),
  notifyMerchantOnPayment: z.boolean().optional(),
  notifyPayerOnPayment: z.boolean().optional(),
});

export type UpdateQrPaymentRequestFormData = z.infer<typeof updateQrPaymentRequestSchema>;

// =============================================================================
// Process Payment Schema
// =============================================================================

export const processPaymentSchema = z.object({
  qrPaymentId: z.string().min(1, "QR Payment ID is required"),
  payerWalletId: z.string().min(1, "Payer wallet ID is required"),
  paidAmount: amountSchema,
  paidCurrency: z.enum(QR_PAYMENT_CURRENCIES),
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
});

export type ProcessPaymentFormData = z.infer<typeof processPaymentSchema>;

// =============================================================================
// Cancel Payment Schema
// =============================================================================

export const cancelPaymentSchema = z.object({
  qrPaymentId: z.string().min(1, "QR Payment ID is required"),
  reason: z.string().max(500).optional(),
});

export type CancelPaymentFormData = z.infer<typeof cancelPaymentSchema>;

// =============================================================================
// Refund Payment Schema
// =============================================================================

export const refundPaymentSchema = z.object({
  qrPaymentId: z.string().min(1, "QR Payment ID is required"),
  amount: amountSchema,
  reason: z.string().min(1, "Refund reason is required").max(500),
});

export type RefundPaymentFormData = z.infer<typeof refundPaymentSchema>;

// =============================================================================
// Query Filters Schema
// =============================================================================

export const qrPaymentFiltersSchema = z.object({
  merchantId: z.string().optional(),
  payerId: z.string().optional(),
  status: z.enum(QR_PAYMENT_STATUSES).optional(),
  type: z.enum(QR_PAYMENT_TYPES).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  isExpired: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique QR code identifier
 */
function generateQrCode(): string {
  return `QR-${nanoid(16)}`;
}

/**
 * Generate a short code for manual entry
 */
function generateShortCode(): string {
  return `PAY-${nanoid(6).toUpperCase()}`;
}

// =============================================================================
// Server Functions
// =============================================================================

/**
 * Create a new QR payment request
 */
export const createQrPaymentRequestFn = createServerFn({
  method: "POST",
})
  .inputValidator(createQrPaymentRequestSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    // Generate unique identifiers
    let qrCode = generateQrCode();
    let shortCode = generateShortCode();

    // Ensure uniqueness
    while (!(await isQrCodeUnique(qrCode))) {
      qrCode = generateQrCode();
    }
    while (!(await isShortCodeUnique(shortCode))) {
      shortCode = generateShortCode();
    }

    const paymentData = {
      id: crypto.randomUUID(),
      qrCode,
      shortCode,
      type: data.type,
      merchantId: context.userId,
      merchantInfo: JSON.stringify(data.merchantInfo),
      amount: data.amount,
      currency: data.currency,
      minAmount: data.minAmount || null,
      maxAmount: data.maxAmount || null,
      feeAmount: data.feeAmount,
      feeType: data.feeType,
      feePercentage: data.feePercentage || null,
      status: "pending" as const,
      expiresAt: data.expiresAt || null,
      isExpired: false,
      description: data.description || null,
      reference: data.reference || null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      notifyMerchantOnPayment: data.notifyMerchantOnPayment,
      notifyPayerOnPayment: data.notifyPayerOnPayment,
      qrCodeFormat: data.qrCodeFormat,
    };

    const newQrPayment = await createQrPaymentRequest(paymentData);
    return newQrPayment;
  });

/**
 * Get QR payment request by ID
 */
export const getQrPaymentByIdFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ id: z.string() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const qrPayment = await findQrPaymentByIdWithMerchant(data.id);
    if (!qrPayment) {
      throw new Error("QR payment request not found");
    }
    return qrPayment;
  });

/**
 * Get QR payment request by QR code (public endpoint for payers)
 */
export const getQrPaymentByQrCodeFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ qrCode: z.string() }))
  .handler(async ({ data }) => {
    const qrPayment = await findQrPaymentByQrCode(data.qrCode);
    if (!qrPayment) {
      throw new Error("QR payment request not found");
    }

    // Check if expired
    if (qrPayment.expiresAt && new Date() > qrPayment.expiresAt) {
      throw new Error("QR payment request has expired");
    }

    // Check status
    if (qrPayment.status !== "pending") {
      throw new Error(`QR payment request is ${qrPayment.status}`);
    }

    return qrPayment;
  });

/**
 * Get QR payment request by short code
 */
export const getQrPaymentByShortCodeFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ shortCode: z.string() }))
  .handler(async ({ data }) => {
    const qrPayment = await findQrPaymentByShortCode(data.shortCode);
    if (!qrPayment) {
      throw new Error("QR payment request not found");
    }

    // Check if expired
    if (qrPayment.expiresAt && new Date() > qrPayment.expiresAt) {
      throw new Error("QR payment request has expired");
    }

    // Check status
    if (qrPayment.status !== "pending") {
      throw new Error(`QR payment request is ${qrPayment.status}`);
    }

    return qrPayment;
  });

/**
 * Get all QR payment requests with filters
 */
export const getQrPaymentRequestsFn = createServerFn()
  .inputValidator(qrPaymentFiltersSchema.optional())
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const filters: QrPaymentFilters = {
      merchantId: data?.merchantId,
      payerId: data?.payerId,
      status: data?.status,
      type: data?.type,
      startDate: data?.startDate,
      endDate: data?.endDate,
      isExpired: data?.isExpired,
      limit: data?.limit ?? 50,
      offset: data?.offset ?? 0,
    };
    return await getAllQrPaymentRequests(filters);
  });

/**
 * Get QR payment requests count
 */
export const getQrPaymentRequestsCountFn = createServerFn()
  .inputValidator(qrPaymentFiltersSchema.optional())
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const filters: QrPaymentFilters = {
      merchantId: data?.merchantId,
      payerId: data?.payerId,
      status: data?.status,
      type: data?.type,
      isExpired: data?.isExpired,
    };
    return await getQrPaymentRequestsCount(filters);
  });

/**
 * Get current user's QR payment requests (as merchant)
 */
export const getMyQrPaymentRequestsFn = createServerFn()
  .inputValidator(
    z.object({
      status: z.enum(QR_PAYMENT_STATUSES).optional(),
      type: z.enum(QR_PAYMENT_TYPES).optional(),
      limit: z.number().int().positive().max(100).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    }).optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    return await getQrPaymentsByMerchant(context.userId, {
      status: data?.status,
      type: data?.type,
      limit: data?.limit ?? 50,
      offset: data?.offset ?? 0,
    });
  });

/**
 * Update a QR payment request
 */
export const updateQrPaymentRequestFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      id: z.string(),
      ...updateQrPaymentRequestSchema.shape,
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const existing = await findQrPaymentById(data.id);
    if (!existing) {
      throw new Error("QR payment request not found");
    }

    // Only merchant can update
    if (existing.merchantId !== context.userId) {
      throw new Error("You don't have permission to update this QR payment request");
    }

    // Can only update pending payments
    if (existing.status !== "pending") {
      throw new Error("Can only update pending QR payment requests");
    }

    const { id, ...updateData } = data;
    const updated = await updateQrPaymentRequest(id, {
      ...updateData,
      metadata: updateData.metadata ? JSON.stringify(updateData.metadata) : undefined,
    });

    return updated;
  });

/**
 * Cancel a QR payment request
 */
export const cancelQrPaymentRequestFn = createServerFn({
  method: "POST",
})
  .inputValidator(cancelPaymentSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const existing = await findQrPaymentById(data.qrPaymentId);
    if (!existing) {
      throw new Error("QR payment request not found");
    }

    // Only merchant can cancel
    if (existing.merchantId !== context.userId) {
      throw new Error("You don't have permission to cancel this QR payment request");
    }

    // Can only cancel pending payments
    if (existing.status !== "pending") {
      throw new Error("Can only cancel pending QR payment requests");
    }

    const cancelled = await cancelQrPayment(data.qrPaymentId, context.userId, data.reason);
    return cancelled;
  });

/**
 * Delete a QR payment request
 */
export const deleteQrPaymentRequestFn = createServerFn({
  method: "POST",
})
  .inputValidator(z.object({ id: z.string() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const existing = await findQrPaymentById(data.id);
    if (!existing) {
      throw new Error("QR payment request not found");
    }

    // Only merchant can delete
    if (existing.merchantId !== context.userId) {
      throw new Error("You don't have permission to delete this QR payment request");
    }

    // Can only delete pending or cancelled payments
    if (!["pending", "cancelled", "expired"].includes(existing.status)) {
      throw new Error("Cannot delete processed QR payment requests");
    }

    await deleteQrPaymentRequest(data.id);
    return { success: true };
  });

/**
 * Process a payment (payer making payment)
 *
 * This function:
 * 1. Validates the QR payment request
 * 2. Debits the payer's wallet
 * 3. Credits the merchant's wallet
 * 4. Updates the QR payment status to completed
 */
export const processQrPaymentFn = createServerFn({
  method: "POST",
})
  .inputValidator(processPaymentSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const qrPayment = await findQrPaymentById(data.qrPaymentId);
    if (!qrPayment) {
      throw new Error("QR payment request not found");
    }

    // Check if expired
    if (qrPayment.expiresAt && new Date() > qrPayment.expiresAt) {
      throw new Error("QR payment request has expired");
    }

    // Check status
    if (qrPayment.status !== "pending") {
      throw new Error(`QR payment request is ${qrPayment.status}`);
    }

    // Prevent self-payment
    if (qrPayment.merchantId === context.userId) {
      throw new Error("Cannot pay your own QR payment request");
    }

    // Validate amount for flexible payments
    const paidAmount = parseFloat(data.paidAmount);
    if (qrPayment.minAmount || qrPayment.maxAmount) {
      if (qrPayment.minAmount && paidAmount < parseFloat(qrPayment.minAmount)) {
        throw new Error(`Amount must be at least ${qrPayment.minAmount} ${data.paidCurrency}`);
      }
      if (qrPayment.maxAmount && paidAmount > parseFloat(qrPayment.maxAmount)) {
        throw new Error(`Amount must be at most ${qrPayment.maxAmount} ${data.paidCurrency}`);
      }
    }

    // Calculate fee (if applicable)
    let feeAmount = 0;
    if (qrPayment.feeType === "fixed" && qrPayment.feeAmount) {
      feeAmount = parseFloat(qrPayment.feeAmount);
    } else if (qrPayment.feeType === "percentage" && qrPayment.feePercentage) {
      feeAmount = (paidAmount * parseFloat(qrPayment.feePercentage)) / 100;
    }

    // Net amount after fee (merchant receives this)
    const netAmount = paidAmount - feeAmount;

    // Verify payer wallet exists and belongs to the current user
    const payerWallet = await findWalletById(data.payerWalletId);
    if (!payerWallet) {
      throw new Error("Payer wallet not found");
    }
    if (payerWallet.userId !== context.userId) {
      throw new Error("Wallet does not belong to the current user");
    }

    // Get or create merchant's wallet
    const merchantWallet = await getOrCreateWallet(qrPayment.merchantId, data.paidCurrency);

    // Step 1: Debit payer's wallet (with overdraft prevention)
    const debitResult = await debitWallet({
      walletId: data.payerWalletId,
      amount: data.paidAmount,
      type: "transfer_out",
      description: `QR Payment to ${qrPayment.merchantId} - ${qrPayment.description || qrPayment.reference || qrPayment.shortCode}`,
      reference: `QR-${qrPayment.shortCode}`,
      idempotencyKey: `debit-${data.idempotencyKey}`,
      metadata: {
        qrPaymentId: qrPayment.id,
        merchantId: qrPayment.merchantId,
        shortCode: qrPayment.shortCode,
        feeAmount: feeAmount.toFixed(2),
      },
      actorId: context.userId,
      actorType: "user",
    });

    if (!debitResult.success) {
      // Map wallet error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        [WalletErrorCodes.INSUFFICIENT_FUNDS]: "Insufficient balance in your wallet",
        [WalletErrorCodes.WALLET_FROZEN]: "Your wallet is frozen. Please contact support.",
        [WalletErrorCodes.WALLET_SUSPENDED]: "Your wallet is suspended. Please contact support.",
        [WalletErrorCodes.WALLET_CLOSED]: "Your wallet is closed.",
        [WalletErrorCodes.TRANSACTION_LIMIT_EXCEEDED]: "Transaction amount exceeds your limit",
        [WalletErrorCodes.DAILY_LIMIT_EXCEEDED]: "Daily transaction limit exceeded",
        [WalletErrorCodes.MONTHLY_LIMIT_EXCEEDED]: "Monthly transaction limit exceeded",
      };

      const errorMessage = debitResult.errorCode
        ? errorMessages[debitResult.errorCode] || debitResult.error
        : debitResult.error;

      throw new Error(errorMessage || "Payment failed: Could not debit wallet");
    }

    // Step 2: Credit merchant's wallet (net amount after fee)
    const creditResult = await creditWallet({
      walletId: merchantWallet.id,
      amount: netAmount.toFixed(2),
      type: "transfer_in",
      description: `QR Payment received from ${context.userId} - ${qrPayment.description || qrPayment.reference || qrPayment.shortCode}`,
      reference: `QR-${qrPayment.shortCode}`,
      idempotencyKey: `credit-${data.idempotencyKey}`,
      metadata: {
        qrPaymentId: qrPayment.id,
        payerId: context.userId,
        shortCode: qrPayment.shortCode,
        grossAmount: data.paidAmount,
        feeAmount: feeAmount.toFixed(2),
        netAmount: netAmount.toFixed(2),
      },
      actorId: context.userId,
      actorType: "user",
    });

    if (!creditResult.success) {
      // Note: In a real scenario, we would need to reverse the debit here
      // For now, we log the error but proceed since debit was successful
      console.error("Failed to credit merchant wallet:", creditResult.error);
      // We could implement a reversal mechanism here
      throw new Error("Payment processing error. Please contact support.");
    }

    // Step 3: Update QR payment status to completed
    const transactionId = debitResult.transaction?.id || crypto.randomUUID();

    const processed = await processQrPayment(data.qrPaymentId, {
      paidBy: context.userId,
      payerWalletId: data.payerWalletId,
      transactionId,
      paidAmount: data.paidAmount,
      paidCurrency: data.paidCurrency,
    });

    return {
      ...processed,
      payerTransaction: debitResult.transaction,
      merchantTransaction: creditResult.transaction,
      feeAmount: feeAmount.toFixed(2),
      netAmount: netAmount.toFixed(2),
    };
  });

/**
 * Refund a completed payment
 *
 * This function:
 * 1. Validates the refund request
 * 2. Debits the merchant's wallet (refund amount)
 * 3. Credits the payer's wallet (refund amount)
 * 4. Updates the QR payment refund tracking
 */
export const refundQrPaymentFn = createServerFn({
  method: "POST",
})
  .inputValidator(refundPaymentSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const qrPayment = await findQrPaymentById(data.qrPaymentId);
    if (!qrPayment) {
      throw new Error("QR payment request not found");
    }

    // Only merchant can refund
    if (qrPayment.merchantId !== context.userId) {
      throw new Error("You don't have permission to refund this payment");
    }

    // Can only refund completed payments
    if (qrPayment.status !== "completed") {
      throw new Error("Can only refund completed payments");
    }

    // Check if already fully refunded
    if (qrPayment.isFullyRefunded) {
      throw new Error("Payment has already been fully refunded");
    }

    // Validate we have payer information
    if (!qrPayment.paidBy || !qrPayment.payerWalletId) {
      throw new Error("Cannot refund: payer information is missing");
    }

    // Validate refund amount
    const paidAmount = parseFloat(qrPayment.paidAmount || "0");
    const alreadyRefunded = parseFloat(qrPayment.refundedAmount);
    const refundAmount = parseFloat(data.amount);

    if (refundAmount + alreadyRefunded > paidAmount) {
      throw new Error("Refund amount exceeds remaining refundable amount");
    }

    // Get merchant wallet
    const merchantWallet = await findWalletByUserId(context.userId);
    if (!merchantWallet) {
      throw new Error("Merchant wallet not found");
    }

    // Generate idempotency key for this refund
    const refundId = crypto.randomUUID();
    const idempotencyKey = `refund-${qrPayment.id}-${refundId}`;

    // Step 1: Debit merchant's wallet for refund
    const merchantDebitResult = await debitWallet({
      walletId: merchantWallet.id,
      amount: data.amount,
      type: "reversal",
      description: `Refund for QR Payment ${qrPayment.shortCode} - ${data.reason}`,
      reference: `REFUND-${qrPayment.shortCode}`,
      idempotencyKey: `merchant-debit-${idempotencyKey}`,
      metadata: {
        qrPaymentId: qrPayment.id,
        payerId: qrPayment.paidBy,
        shortCode: qrPayment.shortCode,
        refundReason: data.reason,
        refundId,
      },
      actorId: context.userId,
      actorType: "user",
    });

    if (!merchantDebitResult.success) {
      const errorMessages: Record<string, string> = {
        [WalletErrorCodes.INSUFFICIENT_FUNDS]: "Insufficient balance to process refund",
        [WalletErrorCodes.WALLET_FROZEN]: "Merchant wallet is frozen",
        [WalletErrorCodes.WALLET_SUSPENDED]: "Merchant wallet is suspended",
      };

      const errorMessage = merchantDebitResult.errorCode
        ? errorMessages[merchantDebitResult.errorCode] || merchantDebitResult.error
        : merchantDebitResult.error;

      throw new Error(errorMessage || "Refund failed: Could not debit merchant wallet");
    }

    // Step 2: Credit payer's wallet for refund
    const payerCreditResult = await creditWallet({
      walletId: qrPayment.payerWalletId,
      amount: data.amount,
      type: "reversal",
      description: `Refund from ${context.userId} for QR Payment ${qrPayment.shortCode}`,
      reference: `REFUND-${qrPayment.shortCode}`,
      idempotencyKey: `payer-credit-${idempotencyKey}`,
      metadata: {
        qrPaymentId: qrPayment.id,
        merchantId: qrPayment.merchantId,
        shortCode: qrPayment.shortCode,
        refundReason: data.reason,
        refundId,
      },
      actorId: context.userId,
      actorType: "user",
    });

    if (!payerCreditResult.success) {
      // Log error but continue - merchant already debited
      console.error("Failed to credit payer wallet for refund:", payerCreditResult.error);
      throw new Error("Refund processing error. Please contact support.");
    }

    // Step 3: Create refund record
    const refundRecord: QrPaymentRefund = {
      id: refundId,
      refundedAt: new Date().toISOString(),
      amount: data.amount,
      reason: data.reason,
      initiatedBy: context.userId,
      transactionId: merchantDebitResult.transaction?.id,
      status: "completed",
    };

    // Get existing refunds
    const existingRefunds: QrPaymentRefund[] = qrPayment.refunds
      ? JSON.parse(qrPayment.refunds)
      : [];

    const newRefunds = [...existingRefunds, refundRecord];
    const totalRefunded = (alreadyRefunded + refundAmount).toFixed(2);
    const isFullyRefunded = parseFloat(totalRefunded) >= paidAmount;

    const refunded = await refundQrPayment(data.qrPaymentId, {
      refundedAmount: totalRefunded,
      refunds: JSON.stringify(newRefunds),
      isFullyRefunded,
    });

    return {
      ...refunded,
      merchantTransaction: merchantDebitResult.transaction,
      payerTransaction: payerCreditResult.transaction,
    };
  });

// =============================================================================
// QR Code Image Generation
// =============================================================================

/**
 * Generate QR code image for a payment request
 */
export const generateQrCodeImageFn = createServerFn()
  .inputValidator(
    z.object({
      qrPaymentId: z.string().min(1, "QR Payment ID is required"),
      format: z.enum(["png", "svg"]).optional().default("png"),
      width: z.number().int().min(100).max(1000).optional().default(300),
      baseUrl: z.string().url().optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const qrPayment = await findQrPaymentById(data.qrPaymentId);
    if (!qrPayment) {
      throw new Error("QR payment request not found");
    }

    // Only merchant can generate QR code for their own payments
    if (qrPayment.merchantId !== context.userId) {
      throw new Error("You don't have permission to generate QR code for this payment request");
    }

    // Parse merchant info
    let merchantName = "Unknown";
    try {
      const merchantInfo = JSON.parse(qrPayment.merchantInfo) as QrMerchantInfo;
      merchantName = merchantInfo.merchantName;
    } catch {
      // Use default
    }

    // Generate QR code
    const qrCodeResult = await generatePaymentQrCode(
      {
        paymentId: qrPayment.id,
        qrCode: qrPayment.qrCode,
        shortCode: qrPayment.shortCode ?? "",
        amount: qrPayment.amount,
        currency: qrPayment.currency,
        merchantName,
        description: qrPayment.description || undefined,
        baseUrl: data.baseUrl,
      },
      {
        format: data.format,
        width: data.width,
      }
    );

    return {
      qrPaymentId: qrPayment.id,
      qrCode: qrPayment.qrCode,
      shortCode: qrPayment.shortCode,
      imageData: qrCodeResult.data,
      format: qrCodeResult.format,
      paymentUrl: qrCodeResult.content,
    };
  });

/**
 * Get QR code for public display (no auth required, for scanning)
 */
export const getPublicQrCodeFn = createServerFn()
  .inputValidator(
    z.object({
      qrCode: z.string().min(1, "QR Code is required"),
      format: z.enum(["png", "svg"]).optional().default("png"),
      width: z.number().int().min(100).max(1000).optional().default(300),
      baseUrl: z.string().url().optional(),
    })
  )
  .handler(async ({ data }) => {
    const qrPayment = await findQrPaymentByQrCode(data.qrCode);
    if (!qrPayment) {
      throw new Error("QR payment request not found");
    }

    // Check if expired
    if (qrPayment.expiresAt && new Date() > qrPayment.expiresAt) {
      throw new Error("QR payment request has expired");
    }

    // Only show for pending payments
    if (qrPayment.status !== "pending") {
      throw new Error(`QR payment request is ${qrPayment.status}`);
    }

    // Parse merchant info
    let merchantName = "Unknown";
    try {
      const merchantInfo = JSON.parse(qrPayment.merchantInfo) as QrMerchantInfo;
      merchantName = merchantInfo.merchantName;
    } catch {
      // Use default
    }

    // Generate QR code
    const qrCodeResult = await generatePaymentQrCode(
      {
        paymentId: qrPayment.id,
        qrCode: qrPayment.qrCode,
        shortCode: qrPayment.shortCode ?? "",
        amount: qrPayment.amount,
        currency: qrPayment.currency,
        merchantName,
        description: qrPayment.description || undefined,
        baseUrl: data.baseUrl,
      },
      {
        format: data.format,
        width: data.width,
      }
    );

    return {
      qrCode: qrPayment.qrCode,
      shortCode: qrPayment.shortCode,
      amount: qrPayment.amount,
      currency: qrPayment.currency,
      merchantName,
      description: qrPayment.description,
      expiresAt: qrPayment.expiresAt,
      imageData: qrCodeResult.data,
      format: qrCodeResult.format,
    };
  });

// Export types for use in components
export type { QrMerchantInfo, QrPaymentMetadata, QrPaymentAttempt, QrPaymentRefund };
