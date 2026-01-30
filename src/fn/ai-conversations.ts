/**
 * AI Conversation Server Functions
 * Server-side functions for managing AI conversations with persistence
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware } from "./middleware";
import { privateEnv } from "~/config/privateEnv";
import {
  getClaudeClient,
  formatClaudeError,
  prepareConversationForCaching,
  calculateCacheStats,
  type Message,
  type ClaudeModel,
  type SystemMessage,
  type ContentBlock,
  type CacheStats,
} from "~/lib/claude";
import {
  createAIConversation,
  findAIConversationsForUser,
  findAIConversationByIdForUser,
  getAIConversationWithMessages,
  updateAIConversation,
  archiveAIConversation,
  deleteAIConversation,
  createAIMessage,
  getNextSequenceNumber,
  updateConversationTokens,
  updateAIMessageFeedback,
  getOrCreateAIUserPreference,
  updateAIUserPreference,
  findAIUserPreference,
  getTokenUsageForUser,
  getRecentAIConversationsSummary,
  createAIToolCall,
  completeAIToolCall,
  failAIToolCall,
  getAIConversationCountForUser,
  type AIConversationWithMessages,
} from "~/data-access/ai-conversations";
import type {
  AIConversation,
  AIMessage,
  AIUserPreference,
  ConversationStatus,
  MessageRole,
} from "~/db/schema";

// ============================================================================
// Zod Schemas
// ============================================================================

const messageRoleSchema = z.enum(["user", "assistant", "system", "tool"]);

const contentBlockSchema = z.union([
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("tool_result"),
    tool_use_id: z.string(),
    content: z.union([z.string(), z.array(z.object({ type: z.literal("text"), text: z.string() }))]),
    is_error: z.boolean().optional(),
  }),
]);

const modelSchema = z.enum([
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
]);

const conversationStatusSchema = z.enum(["active", "archived", "deleted"]);

// ============================================================================
// Conversation CRUD Functions
// ============================================================================

/**
 * Create a new AI conversation
 */
export const createAIConversationFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      title: z.string().optional(),
      systemPrompt: z.string().optional(),
      modelId: modelSchema.optional(),
      contextMetadata: z.string().optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const conversation = await createAIConversation({
        id: crypto.randomUUID(),
        userId: context.userId,
        title: data.title,
        systemPrompt: data.systemPrompt,
        modelId: data.modelId,
        contextMetadata: data.contextMetadata,
        status: "active",
      });

      return {
        success: true,
        conversation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create conversation",
      };
    }
  });

/**
 * Get user's AI conversations list
 */
export const getAIConversationsFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      status: conversationStatusSchema.optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const conversations = await findAIConversationsForUser(context.userId, {
        status: data?.status,
        limit: data?.limit,
        offset: data?.offset,
      });

      return {
        success: true,
        conversations,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get conversations",
      };
    }
  });

/**
 * Get a single AI conversation with messages
 */
export const getAIConversationFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      id: z.string().uuid(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const conversation = await getAIConversationWithMessages(data.id, context.userId);

      if (!conversation) {
        return {
          success: false,
          error: "Conversation not found",
        };
      }

      return {
        success: true,
        conversation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get conversation",
      };
    }
  });

/**
 * Update an AI conversation
 */
export const updateAIConversationFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      title: z.string().optional(),
      summary: z.string().optional(),
      systemPrompt: z.string().optional(),
      modelId: modelSchema.optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const conversation = await updateAIConversation(data.id, context.userId, {
        title: data.title,
        summary: data.summary,
        systemPrompt: data.systemPrompt,
        modelId: data.modelId,
      });

      if (!conversation) {
        return {
          success: false,
          error: "Conversation not found",
        };
      }

      return {
        success: true,
        conversation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update conversation",
      };
    }
  });

/**
 * Archive an AI conversation
 */
export const archiveAIConversationFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      id: z.string().uuid(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const conversation = await archiveAIConversation(data.id, context.userId);

      if (!conversation) {
        return {
          success: false,
          error: "Conversation not found",
        };
      }

      return {
        success: true,
        conversation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to archive conversation",
      };
    }
  });

/**
 * Delete an AI conversation (soft delete)
 */
export const deleteAIConversationFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      id: z.string().uuid(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const conversation = await deleteAIConversation(data.id, context.userId);

      if (!conversation) {
        return {
          success: false,
          error: "Conversation not found",
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete conversation",
      };
    }
  });

// ============================================================================
// Message Functions
// ============================================================================

/**
 * Send a message in an AI conversation and get a response
 */
export const sendAIMessageFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      conversationId: z.string().uuid(),
      content: z.string().min(1).max(100000),
      model: modelSchema.optional(),
      temperature: z.number().min(0).max(1).optional(),
      maxTokens: z.number().min(1).max(8192).optional(),
      enableCaching: z.boolean().optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      // Get the conversation
      const conversation = await getAIConversationWithMessages(data.conversationId, context.userId);

      if (!conversation) {
        return {
          success: false,
          error: "Conversation not found",
        };
      }

      // Get the next sequence number
      const nextSeq = await getNextSequenceNumber(data.conversationId);

      // Create user message in database
      const userMessage = await createAIMessage({
        id: crypto.randomUUID(),
        conversationId: data.conversationId,
        role: "user",
        content: data.content,
        sequenceNumber: nextSeq,
      });

      // Prepare messages for Claude API
      const apiMessages: Message[] = [
        ...conversation.messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content: data.content },
      ];

      // Apply caching if enabled
      let preparedMessages = apiMessages;
      if (data.enableCaching && apiMessages.length > 2) {
        const cached = prepareConversationForCaching(apiMessages, {
          minTokensPerCache: 1024,
          maxCacheBreakpoints: 4,
        });
        preparedMessages = cached.messages;
      }

      // Get Claude client and send message
      const client = getClaudeClient(privateEnv.ANTHROPIC_API_KEY);
      const model = data.model || (conversation.modelId as ClaudeModel) || undefined;

      const response = await client.createMessage({
        messages: preparedMessages,
        model,
        maxTokens: data.maxTokens,
        system: conversation.systemPrompt || undefined,
        temperature: data.temperature,
        userId: context.userId,
      });

      // Extract text content from response
      const textContent = response.content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("");

      // Create assistant message in database
      const assistantMessage = await createAIMessage({
        id: crypto.randomUUID(),
        conversationId: data.conversationId,
        role: "assistant",
        content: textContent,
        sequenceNumber: nextSeq + 1,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        metadata: JSON.stringify({
          model: response.model,
          stopReason: response.stop_reason,
        }),
      });

      // Update conversation token counts
      await updateConversationTokens(
        data.conversationId,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      // Calculate cache stats if caching was used
      let cacheStats: CacheStats | undefined;
      if (data.enableCaching && response.usage.cache_read_input_tokens !== undefined) {
        cacheStats = calculateCacheStats(response.usage);
      }

      return {
        success: true,
        userMessage,
        assistantMessage,
        response: {
          id: response.id,
          content: response.content as any,
          model: response.model,
          stopReason: response.stop_reason,
          usage: response.usage,
        },
        cacheStats,
      };
    } catch (error) {
      return {
        success: false,
        error: formatClaudeError(error),
      };
    }
  });

/**
 * Add feedback to a message
 */
export const addMessageFeedbackFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      messageId: z.string().uuid(),
      rating: z.number().min(1).max(5).optional(),
      text: z.string().max(1000).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    try {
      const message = await updateAIMessageFeedback(data.messageId, {
        rating: data.rating,
        text: data.text,
      });

      if (!message) {
        return {
          success: false,
          error: "Message not found",
        };
      }

      return {
        success: true,
        message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add feedback",
      };
    }
  });

// ============================================================================
// User Preference Functions
// ============================================================================

/**
 * Get user's AI preferences
 */
export const getAIUserPreferenceFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async ({ context }) => {
    try {
      const preferences = await getOrCreateAIUserPreference(context.userId);

      return {
        success: true,
        preferences,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get preferences",
      };
    }
  });

/**
 * Update user's AI preferences
 */
export const updateAIUserPreferenceFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      preferredModel: modelSchema.optional(),
      defaultSystemPrompt: z.string().max(10000).optional(),
      responsePreferences: z.string().optional(), // JSON string
      enableContextMemory: z.boolean().optional(),
      maxContextMessages: z.number().min(1).max(200).optional(),
      saveConversationHistory: z.boolean().optional(),
      allowDataTraining: z.boolean().optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      // Ensure preferences exist
      await getOrCreateAIUserPreference(context.userId);

      const preferences = await updateAIUserPreference(context.userId, data);

      if (!preferences) {
        return {
          success: false,
          error: "Failed to update preferences",
        };
      }

      return {
        success: true,
        preferences,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update preferences",
      };
    }
  });

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Get token usage statistics for the current user
 */
export const getTokenUsageFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }).optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const usage = await getTokenUsageForUser(context.userId, {
        startDate: data?.startDate ? new Date(data.startDate) : undefined,
        endDate: data?.endDate ? new Date(data.endDate) : undefined,
      });

      return {
        success: true,
        usage,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get usage statistics",
      };
    }
  });

/**
 * Get recent conversations summary
 */
export const getRecentConversationsSummaryFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      limit: z.number().min(1).max(50).optional(),
    }).optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const conversations = await getRecentAIConversationsSummary(
        context.userId,
        data?.limit || 10
      );

      return {
        success: true,
        conversations,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get recent conversations",
      };
    }
  });

/**
 * Get conversation count
 */
export const getConversationCountFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      status: conversationStatusSchema.optional(),
    }).optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const count = await getAIConversationCountForUser(context.userId, data?.status);

      return {
        success: true,
        count,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get conversation count",
      };
    }
  });

// ============================================================================
// Type Exports
// ============================================================================

// Explicit result types for better type inference
export type CreateAIConversationResult =
  | { success: true; conversation: AIConversation }
  | { success: false; error: string };

export type GetAIConversationsResult =
  | { success: true; conversations: AIConversation[] }
  | { success: false; error: string };

export type GetAIConversationResult =
  | { success: true; conversation: AIConversationWithMessages }
  | { success: false; error: string };

export type UpdateAIConversationResult =
  | { success: true; conversation: AIConversation }
  | { success: false; error: string };

export type SendAIMessageResult =
  | {
      success: true;
      userMessage: AIMessage;
      assistantMessage: AIMessage;
      response: {
        id: string;
        content: ContentBlock[];
        model: string;
        stopReason: string | null;
        usage: { input_tokens: number; output_tokens: number };
      };
      cacheStats?: CacheStats;
    }
  | { success: false; error: string };

export type GetAIUserPreferenceResult =
  | { success: true; preferences: AIUserPreference }
  | { success: false; error: string };

export type UpdateAIUserPreferenceResult =
  | { success: true; preferences: AIUserPreference }
  | { success: false; error: string };

export type GetTokenUsageResult =
  | { success: true; usage: { totalInputTokens: number; totalOutputTokens: number; conversationCount: number } }
  | { success: false; error: string };
