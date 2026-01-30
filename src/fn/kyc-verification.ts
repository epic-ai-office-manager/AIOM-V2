/**
 * KYC Verification Server Functions
 *
 * Server functions for KYC verification operations including:
 * - Fetching pending KYC submissions for admin review
 * - Approving/rejecting KYC verifications
 * - Document verification
 * - Transaction limit management
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware, assertAdminMiddleware } from "./middleware";
import {
  getKycVerificationById,
  getKycVerificationByUserId,
  getKycVerificationWithRelations,
  getKycVerificationWithRelationsByUserId,
  getPendingKycVerificationsForReview,
  listKycVerifications,
  approveKycVerification,
  rejectKycVerification,
  updateKycVerification,
  verifyKycDocument,
  rejectKycDocument,
  getKycDocumentById,
  getKycDocumentsByVerificationId,
  getAllKycTierConfigs,
  checkTransactionLimits,
  getKycStatusSummary,
} from "~/data-access/kyc-verification";
import {
  KYC_VERIFICATION_STATUSES,
  KYC_TIER_LEVELS,
  KYC_DOCUMENT_TYPES,
} from "~/db/schema";

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const kycVerificationIdSchema = z.object({
  verificationId: z.string().min(1, "Verification ID is required"),
});

const kycApprovalSchema = z.object({
  verificationId: z.string().min(1, "Verification ID is required"),
  tierLevel: z.enum(KYC_TIER_LEVELS),
  comments: z.string().optional(),
});

const kycRejectionSchema = z.object({
  verificationId: z.string().min(1, "Verification ID is required"),
  reason: z.string().min(1, "Rejection reason is required"),
  details: z.string().optional(),
});

const documentVerificationSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  extractedData: z.record(z.string(), z.unknown()).optional(),
});

const documentRejectionSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  reason: z.string().min(1, "Rejection reason is required"),
});

const listKycSchema = z.object({
  status: z
    .enum(KYC_VERIFICATION_STATUSES)
    .or(z.array(z.enum(KYC_VERIFICATION_STATUSES)))
    .optional(),
  tierLevel: z.enum(KYC_TIER_LEVELS).optional(),
  page: z.number().positive().optional().default(1),
  limit: z.number().positive().max(100).optional().default(20),
  orderBy: z.enum(["createdAt", "submittedAt", "approvedAt"]).optional(),
  orderDir: z.enum(["asc", "desc"]).optional(),
});

const transactionLimitCheckSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  amount: z.number().positive("Amount must be positive"),
});

// ==========================================
// USER-FACING SERVER FUNCTIONS
// ==========================================

/**
 * Get the current user's KYC verification status and details
 */
export const getMyKycVerificationFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async ({ context }) => {
    const verification = await getKycVerificationWithRelationsByUserId(context.userId);

    if (!verification) {
      return {
        status: "not_started" as const,
        tierLevel: "none" as const,
        verification: null,
        documents: [],
      };
    }

    return {
      status: verification.status,
      tierLevel: verification.tierLevel,
      verification,
      documents: verification.documents || [],
    };
  });

/**
 * Get KYC status summary for the current user
 */
export const getMyKycStatusSummaryFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async ({ context }) => {
    return await getKycStatusSummary(context.userId);
  });

// ==========================================
// ADMIN SERVER FUNCTIONS
// ==========================================

/**
 * Get pending KYC verifications for admin review
 */
export const getPendingKycVerificationsFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ limit: z.number().positive().max(100).optional().default(50) }).optional())
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const limit = data?.limit ?? 50;
    const pending = await getPendingKycVerificationsForReview(limit);
    return pending;
  });

/**
 * List KYC verifications with filters (admin)
 */
export const listKycVerificationsFn = createServerFn({
  method: "GET",
})
  .inputValidator(listKycSchema)
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const result = await listKycVerifications({
      status: data.status,
      tierLevel: data.tierLevel,
      page: data.page,
      limit: data.limit,
      orderBy: data.orderBy,
      orderDir: data.orderDir,
    });

    return {
      data: result.data,
      total: result.total,
      page: data.page ?? 1,
      limit: data.limit ?? 20,
      totalPages: Math.ceil(result.total / (data.limit ?? 20)),
    };
  });

/**
 * Get KYC verification details with all relations (admin)
 */
export const getKycVerificationDetailsFn = createServerFn({
  method: "GET",
})
  .inputValidator(kycVerificationIdSchema)
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const verification = await getKycVerificationWithRelations(data.verificationId);

    if (!verification) {
      throw new Error("KYC verification not found");
    }

    return verification;
  });

/**
 * Start review of a KYC verification (admin)
 */
export const startKycReviewFn = createServerFn({
  method: "POST",
})
  .inputValidator(kycVerificationIdSchema)
  .middleware([assertAdminMiddleware])
  .handler(async ({ data, context }) => {
    const verification = await getKycVerificationById(data.verificationId);

    if (!verification) {
      throw new Error("KYC verification not found");
    }

    if (verification.status !== "submitted") {
      throw new Error("Only submitted verifications can be started for review");
    }

    const updated = await updateKycVerification(
      data.verificationId,
      {
        status: "under_review",
        reviewStartedAt: new Date(),
        reviewedById: context.userId,
      },
      context.userId,
      "admin",
      "Started review"
    );

    return updated;
  });

/**
 * Approve a KYC verification (admin)
 */
export const approveKycVerificationFn = createServerFn({
  method: "POST",
})
  .inputValidator(kycApprovalSchema)
  .middleware([assertAdminMiddleware])
  .handler(async ({ data, context }) => {
    const verification = await getKycVerificationById(data.verificationId);

    if (!verification) {
      throw new Error("KYC verification not found");
    }

    if (verification.status !== "under_review" && verification.status !== "submitted") {
      throw new Error("Only submitted or under review verifications can be approved");
    }

    const approved = await approveKycVerification(
      data.verificationId,
      context.userId,
      data.tierLevel,
      data.comments
    );

    return approved;
  });

/**
 * Reject a KYC verification (admin)
 */
export const rejectKycVerificationFn = createServerFn({
  method: "POST",
})
  .inputValidator(kycRejectionSchema)
  .middleware([assertAdminMiddleware])
  .handler(async ({ data, context }) => {
    const verification = await getKycVerificationById(data.verificationId);

    if (!verification) {
      throw new Error("KYC verification not found");
    }

    if (verification.status !== "under_review" && verification.status !== "submitted") {
      throw new Error("Only submitted or under review verifications can be rejected");
    }

    const rejected = await rejectKycVerification(
      data.verificationId,
      context.userId,
      data.reason,
      data.details ? { details: data.details } : undefined
    );

    return rejected;
  });

/**
 * Verify a KYC document (admin)
 */
export const verifyKycDocumentFn = createServerFn({
  method: "POST",
})
  .inputValidator(documentVerificationSchema)
  .middleware([assertAdminMiddleware])
  .handler(async ({ data, context }) => {
    const document = await getKycDocumentById(data.documentId);

    if (!document) {
      throw new Error("Document not found");
    }

    if (document.status !== "pending") {
      throw new Error("Only pending documents can be verified");
    }

    const verified = await verifyKycDocument(
      data.documentId,
      context.userId,
      data.extractedData
    );

    return verified;
  });

/**
 * Reject a KYC document (admin)
 */
export const rejectKycDocumentFn = createServerFn({
  method: "POST",
})
  .inputValidator(documentRejectionSchema)
  .middleware([assertAdminMiddleware])
  .handler(async ({ data, context }) => {
    const document = await getKycDocumentById(data.documentId);

    if (!document) {
      throw new Error("Document not found");
    }

    if (document.status !== "pending") {
      throw new Error("Only pending documents can be rejected");
    }

    const rejected = await rejectKycDocument(
      data.documentId,
      context.userId,
      data.reason
    );

    return rejected;
  });

/**
 * Get all KYC tier configurations (admin)
 */
export const getKycTierConfigsFn = createServerFn({
  method: "GET",
})
  .middleware([assertAdminMiddleware])
  .handler(async () => {
    const configs = await getAllKycTierConfigs();
    return configs;
  });

/**
 * Check transaction limits for a user (admin)
 */
export const checkUserTransactionLimitsFn = createServerFn({
  method: "GET",
})
  .inputValidator(transactionLimitCheckSchema)
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const result = await checkTransactionLimits(data.userId, String(data.amount));
    return result;
  });

// ==========================================
// KYC STATISTICS (Admin Dashboard)
// ==========================================

/**
 * Get KYC verification statistics for admin dashboard
 */
export const getKycVerificationStatsFn = createServerFn({
  method: "GET",
})
  .middleware([assertAdminMiddleware])
  .handler(async () => {
    // Get counts for different statuses
    const [pending, underReview, approved, rejected] = await Promise.all([
      listKycVerifications({ status: "submitted", limit: 1 }),
      listKycVerifications({ status: "under_review", limit: 1 }),
      listKycVerifications({ status: "approved", limit: 1 }),
      listKycVerifications({ status: "rejected", limit: 1 }),
    ]);

    // Get pending queue for urgent items
    const pendingQueue = await getPendingKycVerificationsForReview(10);

    return {
      pendingCount: pending.total,
      underReviewCount: underReview.total,
      approvedCount: approved.total,
      rejectedCount: rejected.total,
      totalPendingReview: pending.total + underReview.total,
      recentSubmissions: pendingQueue,
    };
  });
