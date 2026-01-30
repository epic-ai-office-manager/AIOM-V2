import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware } from "./middleware";
import {
  findUserUnifiedInboxThreads,
  findUnifiedInboxThreadById,
  getUnifiedInboxSummary,
  getTotalUnreadCount,
  getUnreadCountBySourceType,
  markThreadAsRead,
  toggleThreadPinned,
  toggleThreadMuted,
  archiveThread,
  syncAllUnifiedInboxThreads,
  syncDirectMessageThreads,
  syncOdooDiscussThreads,
  syncNotificationThreads,
  getUnifiedInboxThreadWithMessages,
  getMessagesForThread,
} from "~/data-access/unified-inbox";
import type { UnifiedInboxSourceType, UnifiedInboxThreadStatus, UnifiedInboxThread } from "~/db/schema";

// =============================================================================
// Thread List Operations
// =============================================================================

/**
 * Get unified inbox threads for the current user
 */
export const getUnifiedInboxThreadsFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      sourceTypes: z
        .array(
          z.enum([
            "direct_message",
            "odoo_discuss",
            "system_notification",
            "push_notification",
          ])
        )
        .optional(),
      status: z.array(z.enum(["active", "archived", "muted"])).optional(),
      unreadOnly: z.boolean().optional(),
      pinnedOnly: z.boolean().optional(),
      searchQuery: z.string().optional(),
      limit: z.number().optional().default(50),
      offset: z.number().optional().default(0),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }): Promise<UnifiedInboxThread[]> => {
    return await findUserUnifiedInboxThreads(context.userId, {
      sourceTypes: data.sourceTypes as UnifiedInboxSourceType[],
      status: data.status as UnifiedInboxThreadStatus[],
      unreadOnly: data.unreadOnly,
      pinnedOnly: data.pinnedOnly,
      searchQuery: data.searchQuery,
      limit: data.limit,
      offset: data.offset,
    });
  });

/**
 * Get a single unified inbox thread with messages
 */
export const getUnifiedInboxThreadFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      threadId: z.string().min(1, "Thread ID is required"),
      messageLimit: z.number().optional().default(50),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const thread = await getUnifiedInboxThreadWithMessages(
      data.threadId,
      context.userId,
      data.messageLimit
    );

    if (!thread) {
      throw new Error("Thread not found or access denied");
    }

    return thread;
  });

/**
 * Get messages for a specific thread (for pagination/loading more)
 */
export const getThreadMessagesFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      threadId: z.string().min(1, "Thread ID is required"),
      limit: z.number().optional().default(50),
      offset: z.number().optional().default(0),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const thread = await findUnifiedInboxThreadById(data.threadId);

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== context.userId) {
      throw new Error("Access denied");
    }

    return await getMessagesForThread(thread, context.userId, data.limit, data.offset);
  });

// =============================================================================
// Summary and Counts
// =============================================================================

/**
 * Get unified inbox summary with unread counts
 */
export const getUnifiedInboxSummaryFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async ({ context }) => {
    return await getUnifiedInboxSummary(context.userId);
  });

/**
 * Get total unread count across all sources
 */
export const getUnifiedInboxUnreadCountFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async ({ context }) => {
    const count = await getTotalUnreadCount(context.userId);
    return { count };
  });

/**
 * Get unread counts broken down by source type
 */
export const getUnreadCountsBySourceFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async ({ context }) => {
    return await getUnreadCountBySourceType(context.userId);
  });

// =============================================================================
// Thread Actions
// =============================================================================

/**
 * Mark a thread as read (reset unread count)
 */
export const markThreadAsReadFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      threadId: z.string().min(1, "Thread ID is required"),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const thread = await findUnifiedInboxThreadById(data.threadId);

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== context.userId) {
      throw new Error("Access denied");
    }

    await markThreadAsRead(data.threadId);
    return { success: true };
  });

/**
 * Toggle pin status for a thread
 */
export const toggleThreadPinnedFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      threadId: z.string().min(1, "Thread ID is required"),
      isPinned: z.boolean(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const thread = await findUnifiedInboxThreadById(data.threadId);

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== context.userId) {
      throw new Error("Access denied");
    }

    const updated = await toggleThreadPinned(data.threadId, data.isPinned);
    return updated;
  });

/**
 * Toggle mute status for a thread
 */
export const toggleThreadMutedFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      threadId: z.string().min(1, "Thread ID is required"),
      isMuted: z.boolean(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const thread = await findUnifiedInboxThreadById(data.threadId);

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== context.userId) {
      throw new Error("Access denied");
    }

    const updated = await toggleThreadMuted(data.threadId, data.isMuted);
    return updated;
  });

/**
 * Archive a thread
 */
export const archiveThreadFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      threadId: z.string().min(1, "Thread ID is required"),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const thread = await findUnifiedInboxThreadById(data.threadId);

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== context.userId) {
      throw new Error("Access denied");
    }

    const updated = await archiveThread(data.threadId);
    return updated;
  });

// =============================================================================
// Sync Operations
// =============================================================================

/**
 * Sync all unified inbox threads from all sources
 */
export const syncUnifiedInboxFn = createServerFn({
  method: "POST",
})
  .middleware([authenticatedMiddleware])
  .handler(async ({ context }) => {
    const result = await syncAllUnifiedInboxThreads(context.userId);
    return result;
  });

/**
 * Sync threads from a specific source
 */
export const syncThreadsBySourceFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      sourceType: z.enum([
        "direct_message",
        "odoo_discuss",
        "system_notification",
      ]),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    let syncedCount: number;

    switch (data.sourceType) {
      case "direct_message":
        syncedCount = await syncDirectMessageThreads(context.userId);
        break;
      case "odoo_discuss":
        syncedCount = await syncOdooDiscussThreads(context.userId);
        break;
      case "system_notification":
        syncedCount = await syncNotificationThreads(context.userId);
        break;
      default:
        throw new Error("Invalid source type");
    }

    return { sourceType: data.sourceType, syncedCount };
  });
