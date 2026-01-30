/**
 * CRM Call Logging Server Functions
 *
 * TanStack Start server functions for automatically logging
 * call summaries and notes to Odoo CRM with relationship linking
 * and activity timeline updates.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware } from "./middleware";
import {
  createCrmCallLogSync,
  findCrmCallLogSyncById,
  findCrmCallLogSyncByCallRecordId,
  findCrmCallLogSyncByIdWithRelations,
  getAllCrmCallLogSyncs,
  getPendingCrmCallLogSyncs,
  getFailedCrmCallLogSyncs,
  isCallRecordSynced,
  markSyncInProgress,
  markSyncSuccess,
  markSyncFailed,
  markSyncSkipped,
  resetSyncForRetry,
  getCrmCallLogSyncStats,
  getCrmCallLogSyncsByPartnerId,
  getCrmCallLogSyncsByLeadId,
  stringifySyncOptions,
  type CrmCallLogSyncFilters,
  type CrmSyncOptions,
} from "~/data-access/crm-call-logs";
import { findCallRecordById } from "~/data-access/call-records";
import { findCallSummaryByCallRecordIdParsed } from "~/data-access/call-summaries";
import { getOdooClient } from "~/data-access/odoo";
import {
  createCrmCallLoggingService,
  type CallLogEntry,
} from "~/lib/odoo/crm-call-logging";

// =============================================================================
// Types
// =============================================================================

// Sync status types
export const CRM_SYNC_STATUSES = [
  "pending",
  "syncing",
  "synced",
  "failed",
  "skipped",
] as const;
export type CrmSyncStatus = (typeof CRM_SYNC_STATUSES)[number];

// Sync options schema
const syncOptionsSchema = z.object({
  createPartnerIfNotFound: z.boolean().optional().default(false),
  createLeadIfNoOpen: z.boolean().optional().default(false),
  createActivity: z.boolean().optional().default(true),
  postMessage: z.boolean().optional().default(true),
  preferLeadOverPartner: z.boolean().optional().default(true),
});

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Internal function to perform the CRM sync logic
 */
async function performCrmSync(
  callRecordId: string,
  userId: string,
  options?: CrmSyncOptions
): Promise<{
  success: boolean;
  syncId: string;
  isExisting?: boolean;
  partnerId?: number;
  leadId?: number;
  activityId?: number;
  messageId?: number;
  details?: Record<string, unknown>;
  error?: string;
}> {
  // Check if already synced
  const existingSync = await findCrmCallLogSyncByCallRecordId(callRecordId);
  if (existingSync && existingSync.status === "synced") {
    return {
      success: true,
      syncId: existingSync.id,
      isExisting: true,
    };
  }

  // Get the call record
  const callRecord = await findCallRecordById(callRecordId);
  if (!callRecord) {
    throw new Error("Call record not found");
  }

  // Get call summary if available
  const callSummary = await findCallSummaryByCallRecordIdParsed(callRecordId);

  // Create or update sync record
  let syncRecord = existingSync;
  if (!syncRecord) {
    syncRecord = await createCrmCallLogSync({
      callRecordId,
      userId,
      status: "pending",
      syncOptions: options ? stringifySyncOptions(options) : null,
    });
  }

  // Mark as syncing
  await markSyncInProgress(syncRecord.id);

  try {
    // Get Odoo client
    const odooClient = await getOdooClient();
    const crmService = createCrmCallLoggingService(odooClient);

    // Build call log entry
    const callLogEntry: CallLogEntry = {
      callRecordId: callRecord.id,
      direction: callRecord.direction as "inbound" | "outbound",
      duration: callRecord.duration,
      callTimestamp: callRecord.callTimestamp,
      callerId: callRecord.callerId,
      callerName: callRecord.callerName || undefined,
      recipientId: callRecord.recipientId || undefined,
      recipientName: callRecord.recipientName || undefined,
      summary: callSummary?.summary || callRecord.summary || undefined,
      keyPoints: callSummary?.keyPoints?.map((kp) => kp.content) || undefined,
      actionItems:
        callSummary?.actionItems?.map((ai) => ({
          title: ai.title,
          description: ai.description,
          dueDate: ai.dueDate,
          priority: ai.priority,
        })) || undefined,
      sentiment: callSummary?.sentiment as
        | "positive"
        | "neutral"
        | "negative"
        | "mixed"
        | undefined,
      notes: undefined,
      recordingUrl: callRecord.recordingUrl || undefined,
      status: callRecord.status,
    };

    // Log to CRM
    const result = await crmService.logCallToCrm(callLogEntry, options || {});

    if (result.success) {
      // Mark as synced
      await markSyncSuccess(syncRecord.id, {
        partnerId: result.partnerId,
        partnerName: result.details?.partnerName,
        leadId: result.leadId,
        leadName: result.details?.leadName,
        activityId: result.activityId,
        messageId: result.messageId,
      });

      return {
        success: true,
        syncId: syncRecord.id,
        partnerId: result.partnerId,
        leadId: result.leadId,
        activityId: result.activityId,
        messageId: result.messageId,
        details: result.details,
      };
    } else {
      // Mark as failed
      await markSyncFailed(
        syncRecord.id,
        result.error || "Unknown error",
        result.errorCode
      );

      return {
        success: false,
        syncId: syncRecord.id,
        error: result.error || "Failed to log call to CRM",
      };
    }
  } catch (error) {
    // Mark as failed
    await markSyncFailed(
      syncRecord.id,
      error instanceof Error ? error.message : "Unknown error",
      "SYNC_ERROR"
    );

    return {
      success: false,
      syncId: syncRecord.id,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Query Server Functions
// =============================================================================

/**
 * Get a CRM call log sync record by ID
 */
export const getCrmCallLogSyncByIdFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ id: z.string() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const sync = await findCrmCallLogSyncById(data.id);
    if (!sync) {
      throw new Error("CRM call log sync record not found");
    }
    return sync;
  });

/**
 * Get a CRM call log sync record with relations
 */
export const getCrmCallLogSyncWithRelationsFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ id: z.string() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const sync = await findCrmCallLogSyncByIdWithRelations(data.id);
    if (!sync) {
      throw new Error("CRM call log sync record not found");
    }
    return sync;
  });

/**
 * Get CRM call log sync record by call record ID
 */
export const getCrmCallLogSyncByCallRecordIdFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ callRecordId: z.string() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    return await findCrmCallLogSyncByCallRecordId(data.callRecordId);
  });

/**
 * Check if a call record has been synced to CRM
 */
export const isCallRecordSyncedFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ callRecordId: z.string() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    return await isCallRecordSynced(data.callRecordId);
  });

/**
 * Get all CRM call log sync records with filters
 */
export const getCrmCallLogSyncsFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z
      .object({
        status: z.enum(CRM_SYNC_STATUSES).optional(),
        odooPartnerId: z.number().optional(),
        odooLeadId: z.number().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        hasError: z.boolean().optional(),
        limit: z.number().int().positive().max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
      .optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const filters: CrmCallLogSyncFilters = {
      userId: context.userId,
      status: data?.status,
      odooPartnerId: data?.odooPartnerId,
      odooLeadId: data?.odooLeadId,
      startDate: data?.startDate ? new Date(data.startDate) : undefined,
      endDate: data?.endDate ? new Date(data.endDate) : undefined,
      hasError: data?.hasError,
      limit: data?.limit || 50,
      offset: data?.offset || 0,
    };

    return await getAllCrmCallLogSyncs(filters);
  });

/**
 * Get CRM call log sync statistics
 */
export const getCrmCallLogSyncStatsFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    return await getCrmCallLogSyncStats(
      context.userId,
      data?.startDate ? new Date(data.startDate) : undefined,
      data?.endDate ? new Date(data.endDate) : undefined
    );
  });

/**
 * Get failed CRM call log sync records
 */
export const getFailedCrmCallLogSyncsFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z
      .object({
        limit: z.number().int().positive().max(100).optional().default(50),
      })
      .optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    return await getFailedCrmCallLogSyncs(context.userId, data?.limit || 50);
  });

/**
 * Get CRM call log syncs by Odoo partner ID
 */
export const getCrmCallLogSyncsByPartnerIdFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      partnerId: z.number(),
      limit: z.number().int().positive().max(100).optional().default(50),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    return await getCrmCallLogSyncsByPartnerId(data.partnerId, data.limit);
  });

/**
 * Get CRM call log syncs by Odoo lead ID
 */
export const getCrmCallLogSyncsByLeadIdFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      leadId: z.number(),
      limit: z.number().int().positive().max(100).optional().default(50),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    return await getCrmCallLogSyncsByLeadId(data.leadId, data.limit);
  });

// =============================================================================
// Mutation Server Functions
// =============================================================================

/**
 * Log a call to Odoo CRM
 */
export const logCallToCrmFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      callRecordId: z.string().min(1, "Call record ID is required"),
      options: syncOptionsSchema.optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const result = await performCrmSync(
      data.callRecordId,
      context.userId,
      data.options
    );

    if (!result.success) {
      throw new Error(result.error || "Failed to log call to CRM");
    }

    return result as any;
  });

/**
 * Retry a failed CRM call log sync
 */
export const retryCrmCallLogSyncFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      id: z.string().min(1, "Sync record ID is required"),
      options: syncOptionsSchema.optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const syncRecord = await findCrmCallLogSyncById(data.id);
    if (!syncRecord) {
      throw new Error("CRM call log sync record not found");
    }

    if (syncRecord.status !== "failed" && syncRecord.status !== "skipped") {
      throw new Error("Can only retry failed or skipped sync records");
    }

    // Reset for retry
    await resetSyncForRetry(data.id);

    // Retry the sync using the internal function
    const result = await performCrmSync(
      syncRecord.callRecordId,
      context.userId,
      data.options
    );

    if (!result.success) {
      throw new Error(result.error || "Failed to retry CRM sync");
    }

    return result as any;
  });

/**
 * Bulk log calls to CRM
 */
export const bulkLogCallsToCrmFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      callRecordIds: z
        .array(z.string())
        .min(1, "At least one call record ID is required")
        .max(50, "Maximum 50 call records per batch"),
      options: syncOptionsSchema.optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const callRecordId of data.callRecordIds) {
      try {
        const result = await performCrmSync(
          callRecordId,
          context.userId,
          data.options
        );
        results.push({ callRecordId, ...result });
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        results.push({
          callRecordId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        failureCount++;
      }
    }

    return {
      results: results as any,
      successCount,
      failureCount,
      totalProcessed: data.callRecordIds.length,
    };
  });

/**
 * Process pending CRM call log syncs (for background jobs)
 */
export const processPendingCrmSyncsFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      maxAttempts: z.number().int().positive().max(10).optional().default(3),
      batchSize: z.number().int().positive().max(100).optional().default(50),
      options: syncOptionsSchema.optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const pendingSyncs = await getPendingCrmCallLogSyncs(
      data.maxAttempts,
      data.batchSize
    );

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const sync of pendingSyncs) {
      try {
        const result = await performCrmSync(
          sync.callRecordId,
          context.userId,
          data.options
        );
        results.push({ ...result, syncId: result.syncId || sync.id });
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        results.push({
          syncId: sync.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        failureCount++;
      }
    }

    return {
      results: results as any,
      successCount,
      failureCount,
      totalProcessed: pendingSyncs.length,
    };
  });

/**
 * Skip a CRM call log sync
 */
export const skipCrmCallLogSyncFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      id: z.string().min(1, "Sync record ID is required"),
      reason: z.string().min(1, "Reason is required").max(500),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const syncRecord = await findCrmCallLogSyncById(data.id);
    if (!syncRecord) {
      throw new Error("CRM call log sync record not found");
    }

    await markSyncSkipped(data.id, data.reason);

    return { success: true };
  });
