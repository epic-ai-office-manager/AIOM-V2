/**
 * AI Conversations Data Access Layer
 * Database operations for AI conversation management
 */

import { eq, and, desc, asc, sql, isNull, gte, lte } from "drizzle-orm";
import { database } from "~/db";
import {
  aiConversation,
  aiMessage,
  aiToolCall,
  aiUserPreference,
  aiConversationContext,
  type AIConversation,
  type CreateAIConversationData,
  type UpdateAIConversationData,
  type AIMessage,
  type CreateAIMessageData,
  type UpdateAIMessageData,
  type AIToolCall,
  type CreateAIToolCallData,
  type UpdateAIToolCallData,
  type AIUserPreference,
  type CreateAIUserPreferenceData,
  type UpdateAIUserPreferenceData,
  type AIConversationContext,
  type CreateAIConversationContextData,
  type UpdateAIConversationContextData,
  type ConversationStatus,
  type MessageRole,
  type ToolCallStatus,
} from "~/db/schema";

// ============================================================================
// Types
// ============================================================================

export type AIConversationWithMessages = AIConversation & {
  messages: AIMessage[];
};

export type AIConversationWithDetails = AIConversation & {
  messages: AIMessage[];
  toolCalls: AIToolCall[];
  contexts: AIConversationContext[];
};

export type AIMessageWithToolCalls = AIMessage & {
  toolCalls: AIToolCall[];
};

// ============================================================================
// AI Conversation CRUD Operations
// ============================================================================

/**
 * Create a new AI conversation
 */
export async function createAIConversation(
  data: CreateAIConversationData
): Promise<AIConversation> {
  const [result] = await database
    .insert(aiConversation)
    .values({
      ...data,
      id: data.id || crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result;
}

/**
 * Find an AI conversation by ID
 */
export async function findAIConversationById(
  id: string
): Promise<AIConversation | null> {
  const [result] = await database
    .select()
    .from(aiConversation)
    .where(eq(aiConversation.id, id))
    .limit(1);

  return result || null;
}

/**
 * Find an AI conversation by ID with user ownership check
 */
export async function findAIConversationByIdForUser(
  id: string,
  userId: string
): Promise<AIConversation | null> {
  const [result] = await database
    .select()
    .from(aiConversation)
    .where(
      and(
        eq(aiConversation.id, id),
        eq(aiConversation.userId, userId),
        isNull(aiConversation.deletedAt)
      )
    )
    .limit(1);

  return result || null;
}

/**
 * Find AI conversations for a user
 */
export async function findAIConversationsForUser(
  userId: string,
  options: {
    status?: ConversationStatus;
    limit?: number;
    offset?: number;
  } = {}
): Promise<AIConversation[]> {
  const { status = "active", limit = 50, offset = 0 } = options;

  return database
    .select()
    .from(aiConversation)
    .where(
      and(
        eq(aiConversation.userId, userId),
        eq(aiConversation.status, status),
        isNull(aiConversation.deletedAt)
      )
    )
    .orderBy(desc(aiConversation.lastMessageAt), desc(aiConversation.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get or create a dedicated "Assistant Proposals" conversation for a user
 * Reuses existing conversation if found, otherwise creates new one
 */
export async function getOrCreateAssistantProposalConversation(
  userId: string
): Promise<AIConversation> {
  // Try to find existing "Assistant Proposals" conversation
  const [existing] = await database
    .select()
    .from(aiConversation)
    .where(
      and(
        eq(aiConversation.userId, userId),
        eq(aiConversation.title, "Assistant Proposals"),
        isNull(aiConversation.deletedAt)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  // Create new conversation
  return createAIConversation({
    id: crypto.randomUUID(),
    userId,
    title: "Assistant Proposals",
    status: "active",
  });
}

/**
 * Get AI conversation with messages
 */
export async function getAIConversationWithMessages(
  id: string,
  userId: string
): Promise<AIConversationWithMessages | null> {
  const conversation = await findAIConversationByIdForUser(id, userId);
  if (!conversation) return null;

  const messages = await database
    .select()
    .from(aiMessage)
    .where(eq(aiMessage.conversationId, id))
    .orderBy(asc(aiMessage.sequenceNumber));

  return {
    ...conversation,
    messages,
  };
}

/**
 * Get AI conversation with full details
 */
export async function getAIConversationWithDetails(
  id: string,
  userId: string
): Promise<AIConversationWithDetails | null> {
  const conversation = await findAIConversationByIdForUser(id, userId);
  if (!conversation) return null;

  const [messages, toolCalls, contexts] = await Promise.all([
    database
      .select()
      .from(aiMessage)
      .where(eq(aiMessage.conversationId, id))
      .orderBy(asc(aiMessage.sequenceNumber)),
    database
      .select()
      .from(aiToolCall)
      .where(eq(aiToolCall.conversationId, id))
      .orderBy(asc(aiToolCall.createdAt)),
    database
      .select()
      .from(aiConversationContext)
      .where(eq(aiConversationContext.conversationId, id))
      .orderBy(desc(aiConversationContext.priority)),
  ]);

  return {
    ...conversation,
    messages,
    toolCalls,
    contexts,
  };
}

/**
 * Update an AI conversation
 */
export async function updateAIConversation(
  id: string,
  userId: string,
  data: UpdateAIConversationData
): Promise<AIConversation | null> {
  const [result] = await database
    .update(aiConversation)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiConversation.id, id),
        eq(aiConversation.userId, userId)
      )
    )
    .returning();

  return result || null;
}

/**
 * Archive an AI conversation
 */
export async function archiveAIConversation(
  id: string,
  userId: string
): Promise<AIConversation | null> {
  return updateAIConversation(id, userId, {
    status: "archived",
    archivedAt: new Date(),
  });
}

/**
 * Soft delete an AI conversation
 */
export async function deleteAIConversation(
  id: string,
  userId: string
): Promise<AIConversation | null> {
  return updateAIConversation(id, userId, {
    status: "deleted",
    deletedAt: new Date(),
  });
}

/**
 * Update conversation token counts
 */
export async function updateConversationTokens(
  id: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  await database
    .update(aiConversation)
    .set({
      totalInputTokens: sql`${aiConversation.totalInputTokens} + ${inputTokens}`,
      totalOutputTokens: sql`${aiConversation.totalOutputTokens} + ${outputTokens}`,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiConversation.id, id));
}

/**
 * Get conversation count for a user
 */
export async function getAIConversationCountForUser(
  userId: string,
  status?: ConversationStatus
): Promise<number> {
  const conditions = [
    eq(aiConversation.userId, userId),
    isNull(aiConversation.deletedAt),
  ];

  if (status) {
    conditions.push(eq(aiConversation.status, status));
  }

  const [result] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(aiConversation)
    .where(and(...conditions));

  return result?.count || 0;
}

// ============================================================================
// AI Message CRUD Operations
// ============================================================================

/**
 * Create a new AI message
 */
export async function createAIMessage(
  data: CreateAIMessageData
): Promise<AIMessage> {
  const [result] = await database
    .insert(aiMessage)
    .values({
      ...data,
      id: data.id || crypto.randomUUID(),
      createdAt: new Date(),
    })
    .returning();

  // Update conversation's last message timestamp
  await database
    .update(aiConversation)
    .set({
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiConversation.id, data.conversationId));

  return result;
}

/**
 * Create multiple AI messages in a batch
 */
export async function createAIMessages(
  messages: CreateAIMessageData[]
): Promise<AIMessage[]> {
  if (messages.length === 0) return [];

  const messagesWithIds = messages.map((msg) => ({
    ...msg,
    id: msg.id || crypto.randomUUID(),
    createdAt: new Date(),
  }));

  const results = await database
    .insert(aiMessage)
    .values(messagesWithIds)
    .returning();

  // Update conversation timestamps for all affected conversations
  const conversationIds = [...new Set(messages.map((m) => m.conversationId))];
  for (const convId of conversationIds) {
    await database
      .update(aiConversation)
      .set({
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiConversation.id, convId));
  }

  return results;
}

/**
 * Find an AI message by ID
 */
export async function findAIMessageById(id: string): Promise<AIMessage | null> {
  const [result] = await database
    .select()
    .from(aiMessage)
    .where(eq(aiMessage.id, id))
    .limit(1);

  return result || null;
}

/**
 * Find messages for a conversation
 */
export async function findAIMessagesForConversation(
  conversationId: string,
  options: {
    limit?: number;
    offset?: number;
    role?: MessageRole;
  } = {}
): Promise<AIMessage[]> {
  const { limit = 100, offset = 0, role } = options;

  const conditions = [eq(aiMessage.conversationId, conversationId)];
  if (role) {
    conditions.push(eq(aiMessage.role, role));
  }

  return database
    .select()
    .from(aiMessage)
    .where(and(...conditions))
    .orderBy(asc(aiMessage.sequenceNumber))
    .limit(limit)
    .offset(offset);
}

/**
 * Get the next sequence number for a conversation
 */
export async function getNextSequenceNumber(
  conversationId: string
): Promise<number> {
  const [result] = await database
    .select({ maxSeq: sql<number>`COALESCE(MAX(${aiMessage.sequenceNumber}), 0)` })
    .from(aiMessage)
    .where(eq(aiMessage.conversationId, conversationId));

  return (result?.maxSeq || 0) + 1;
}

/**
 * Update message feedback
 */
export async function updateAIMessageFeedback(
  id: string,
  feedback: { rating?: number; text?: string }
): Promise<AIMessage | null> {
  const [result] = await database
    .update(aiMessage)
    .set({
      feedbackRating: feedback.rating,
      feedbackText: feedback.text,
    })
    .where(eq(aiMessage.id, id))
    .returning();

  return result || null;
}

/**
 * Get message count for a conversation
 */
export async function getAIMessageCountForConversation(
  conversationId: string
): Promise<number> {
  const [result] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(aiMessage)
    .where(eq(aiMessage.conversationId, conversationId));

  return result?.count || 0;
}

// ============================================================================
// AI Tool Call CRUD Operations
// ============================================================================

/**
 * Create a new tool call
 */
export async function createAIToolCall(
  data: CreateAIToolCallData
): Promise<AIToolCall> {
  const [result] = await database
    .insert(aiToolCall)
    .values({
      ...data,
      id: data.id || crypto.randomUUID(),
      createdAt: new Date(),
    })
    .returning();

  return result;
}

/**
 * Find a tool call by toolCallId (idempotency key)
 */
export async function findAIToolCallByToolCallId(
  toolCallId: string
): Promise<AIToolCall | null> {
  const [result] = await database
    .select()
    .from(aiToolCall)
    .where(eq(aiToolCall.toolCallId, toolCallId))
    .limit(1);

  return result || null;
}

/**
 * Find a tool call by ID (primary key)
 */
export async function findAIToolCallById(
  id: string
): Promise<AIToolCall | null> {
  const [result] = await database
    .select()
    .from(aiToolCall)
    .where(eq(aiToolCall.id, id))
    .limit(1);

  return result || null;
}

/**
 * Update a tool call
 */
export async function updateAIToolCall(
  id: string,
  data: UpdateAIToolCallData
): Promise<AIToolCall | null> {
  const [result] = await database
    .update(aiToolCall)
    .set(data)
    .where(eq(aiToolCall.id, id))
    .returning();

  return result || null;
}

/**
 * Complete a tool call with result
 */
export async function completeAIToolCall(
  id: string,
  result: unknown,
  durationMs?: number
): Promise<AIToolCall | null> {
  return updateAIToolCall(id, {
    outputResult: typeof result === "string" ? result : JSON.stringify(result),
    status: "completed",
    completedAt: new Date(),
    durationMs,
  });
}

/**
 * Mark a tool call as failed
 */
export async function failAIToolCall(
  id: string,
  errorMessage: string
): Promise<AIToolCall | null> {
  return updateAIToolCall(id, {
    status: "failed",
    errorMessage,
    completedAt: new Date(),
  });
}

/**
 * Find tool calls for a message
 */
export async function findAIToolCallsForMessage(
  messageId: string
): Promise<AIToolCall[]> {
  return database
    .select()
    .from(aiToolCall)
    .where(eq(aiToolCall.messageId, messageId))
    .orderBy(asc(aiToolCall.createdAt));
}

/**
 * Find tool calls for a conversation
 */
export async function findAIToolCallsForConversation(
  conversationId: string,
  options: {
    status?: ToolCallStatus;
    limit?: number;
  } = {}
): Promise<AIToolCall[]> {
  const { status, limit = 100 } = options;

  const conditions = [eq(aiToolCall.conversationId, conversationId)];
  if (status) {
    conditions.push(eq(aiToolCall.status, status));
  }

  return database
    .select()
    .from(aiToolCall)
    .where(and(...conditions))
    .orderBy(desc(aiToolCall.createdAt))
    .limit(limit);
}

// ============================================================================
// AI User Preference CRUD Operations
// ============================================================================

/**
 * Get or create user preferences
 */
export async function getOrCreateAIUserPreference(
  userId: string
): Promise<AIUserPreference> {
  const [existing] = await database
    .select()
    .from(aiUserPreference)
    .where(eq(aiUserPreference.id, userId))
    .limit(1);

  if (existing) return existing;

  const [result] = await database
    .insert(aiUserPreference)
    .values({
      id: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result;
}

/**
 * Update user preferences
 */
export async function updateAIUserPreference(
  userId: string,
  data: UpdateAIUserPreferenceData
): Promise<AIUserPreference | null> {
  const [result] = await database
    .update(aiUserPreference)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(aiUserPreference.id, userId))
    .returning();

  return result || null;
}

/**
 * Find user preference
 */
export async function findAIUserPreference(
  userId: string
): Promise<AIUserPreference | null> {
  const [result] = await database
    .select()
    .from(aiUserPreference)
    .where(eq(aiUserPreference.id, userId))
    .limit(1);

  return result || null;
}

// ============================================================================
// AI Conversation Context CRUD Operations
// ============================================================================

/**
 * Create conversation context
 */
export async function createAIConversationContext(
  data: CreateAIConversationContextData
): Promise<AIConversationContext> {
  const [result] = await database
    .insert(aiConversationContext)
    .values({
      ...data,
      id: data.id || crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result;
}

/**
 * Update conversation context
 */
export async function updateAIConversationContext(
  id: string,
  data: UpdateAIConversationContextData
): Promise<AIConversationContext | null> {
  const [result] = await database
    .update(aiConversationContext)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(aiConversationContext.id, id))
    .returning();

  return result || null;
}

/**
 * Upsert conversation context by type and key
 */
export async function upsertAIConversationContext(
  conversationId: string,
  contextType: string,
  contextKey: string,
  contextValue: string,
  priority?: number
): Promise<AIConversationContext> {
  // Check if context exists
  const [existing] = await database
    .select()
    .from(aiConversationContext)
    .where(
      and(
        eq(aiConversationContext.conversationId, conversationId),
        eq(aiConversationContext.contextType, contextType),
        eq(aiConversationContext.contextKey, contextKey)
      )
    )
    .limit(1);

  if (existing) {
    const [result] = await database
      .update(aiConversationContext)
      .set({
        contextValue,
        priority: priority ?? existing.priority,
        updatedAt: new Date(),
      })
      .where(eq(aiConversationContext.id, existing.id))
      .returning();
    return result;
  }

  return createAIConversationContext({
    id: crypto.randomUUID(),
    conversationId,
    contextType,
    contextKey,
    contextValue,
    priority: priority ?? 0,
  });
}

/**
 * Find contexts for a conversation
 */
export async function findAIConversationContexts(
  conversationId: string,
  options: {
    contextType?: string;
    includeExpired?: boolean;
  } = {}
): Promise<AIConversationContext[]> {
  const { contextType, includeExpired = false } = options;

  const conditions = [eq(aiConversationContext.conversationId, conversationId)];

  if (contextType) {
    conditions.push(eq(aiConversationContext.contextType, contextType));
  }

  if (!includeExpired) {
    conditions.push(
      sql`(${aiConversationContext.expiresAt} IS NULL OR ${aiConversationContext.expiresAt} > NOW())`
    );
  }

  return database
    .select()
    .from(aiConversationContext)
    .where(and(...conditions))
    .orderBy(desc(aiConversationContext.priority));
}

/**
 * Delete conversation context
 */
export async function deleteAIConversationContext(
  id: string
): Promise<boolean> {
  const result = await database
    .delete(aiConversationContext)
    .where(eq(aiConversationContext.id, id));

  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete expired contexts
 */
export async function deleteExpiredAIConversationContexts(): Promise<number> {
  const result = await database
    .delete(aiConversationContext)
    .where(lte(aiConversationContext.expiresAt, new Date()));

  return result.rowCount ?? 0;
}

// ============================================================================
// Statistics & Analytics
// ============================================================================

/**
 * Get token usage statistics for a user
 */
export async function getTokenUsageForUser(
  userId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{ totalInputTokens: number; totalOutputTokens: number; conversationCount: number }> {
  const conditions = [
    eq(aiConversation.userId, userId),
    isNull(aiConversation.deletedAt),
  ];

  if (options.startDate) {
    conditions.push(gte(aiConversation.createdAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(aiConversation.createdAt, options.endDate));
  }

  const [result] = await database
    .select({
      totalInputTokens: sql<number>`COALESCE(SUM(${aiConversation.totalInputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`COALESCE(SUM(${aiConversation.totalOutputTokens}), 0)::int`,
      conversationCount: sql<number>`COUNT(*)::int`,
    })
    .from(aiConversation)
    .where(and(...conditions));

  return {
    totalInputTokens: result?.totalInputTokens || 0,
    totalOutputTokens: result?.totalOutputTokens || 0,
    conversationCount: result?.conversationCount || 0,
  };
}

/**
 * Get recent conversations summary for a user
 */
export async function getRecentAIConversationsSummary(
  userId: string,
  limit: number = 10
): Promise<Array<Pick<AIConversation, "id" | "title" | "summary" | "lastMessageAt" | "createdAt">>> {
  return database
    .select({
      id: aiConversation.id,
      title: aiConversation.title,
      summary: aiConversation.summary,
      lastMessageAt: aiConversation.lastMessageAt,
      createdAt: aiConversation.createdAt,
    })
    .from(aiConversation)
    .where(
      and(
        eq(aiConversation.userId, userId),
        eq(aiConversation.status, "active"),
        isNull(aiConversation.deletedAt)
      )
    )
    .orderBy(desc(aiConversation.lastMessageAt), desc(aiConversation.createdAt))
    .limit(limit);
}
