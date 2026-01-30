/**
 * Claude API Server Functions
 * Server-side functions for interacting with Claude API
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
  type Tool,
  type ToolChoice,
  type ClaudeModel,
  type SystemMessage,
  type MessageResponse,
  type CacheStats,
} from "~/lib/claude";

// ============================================================================
// Zod Schemas
// ============================================================================

const contentBlockSchema = z.union([
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    source: z.object({
      type: z.enum(["base64", "url"]),
      media_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
      data: z.string().optional(),
      url: z.string().optional(),
    }),
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

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string(), z.array(contentBlockSchema)]),
});

const toolInputSchemaSchema = z.object({
  type: z.literal("object"),
  properties: z.record(z.string(), z.object({
    type: z.string(),
    description: z.string().optional(),
    enum: z.array(z.string()).optional(),
    items: z.record(z.string(), z.unknown()).optional(),
    required: z.boolean().optional(),
  })),
  required: z.array(z.string()).optional(),
});

const toolSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: toolInputSchemaSchema,
});

const toolChoiceSchema = z.union([
  z.object({ type: z.literal("auto") }),
  z.object({ type: z.literal("any") }),
  z.object({ type: z.literal("tool"), name: z.string() }),
  z.object({ type: z.literal("none") }),
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

// ============================================================================
// Result Types
// ============================================================================

export type SendClaudeMessageResult =
  | {
      success: true;
      response: {
        id: string;
        content: MessageResponse["content"];
        model: string;
        stopReason: string | null;
        usage: MessageResponse["usage"];
      };
      cacheStats?: CacheStats;
    }
  | {
      success: false;
      error: string;
    };

export type SendClaudeMessageWithToolsResult =
  | {
      success: true;
      response: {
        id: string;
        content: MessageResponse["content"];
        model: string;
        stopReason: string | null;
        usage: MessageResponse["usage"];
      };
    }
  | {
      success: false;
      error: string;
    };

export type CompleteWithClaudeResult =
  | {
      success: true;
      text: string;
    }
  | {
      success: false;
      error: string;
    };

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Send a message to Claude and get a response
 */
export const sendClaudeMessageFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      messages: z.array(messageSchema),
      model: modelSchema.optional(),
      maxTokens: z.number().min(1).max(8192).optional(),
      system: z.string().optional(),
      temperature: z.number().min(0).max(1).optional(),
      enableCaching: z.boolean().optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const client = getClaudeClient(privateEnv.ANTHROPIC_API_KEY);

      // Prepare messages with caching if enabled
      let messages: Message[] = data.messages as Message[];
      let systemMessages: string | SystemMessage[] | undefined = data.system;

      if (data.enableCaching && messages.length > 2) {
        const cached = prepareConversationForCaching(messages, {
          minTokensPerCache: 1024,
          maxCacheBreakpoints: 4,
        });
        messages = cached.messages;
      }

      const response = await client.createMessage({
        messages,
        model: data.model as ClaudeModel | undefined,
        maxTokens: data.maxTokens,
        system: systemMessages,
        temperature: data.temperature,
        userId: context.userId,
      });

      // Calculate cache stats if caching was used
      let cacheStats: CacheStats | undefined;
      if (data.enableCaching && response.usage.cache_read_input_tokens !== undefined) {
        cacheStats = calculateCacheStats(response.usage);
      }

      const result = {
        success: true as const,
        response: {
          id: response.id,
          content: response.content as any,
          model: response.model,
          stopReason: response.stop_reason,
          usage: response.usage,
        },
        cacheStats,
      };
      return result;
    } catch (error) {
      const result = {
        success: false as const,
        error: formatClaudeError(error),
      };
      return result;
    }
  });

/**
 * Send a message to Claude with tools
 */
export const sendClaudeMessageWithToolsFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      messages: z.array(messageSchema),
      tools: z.array(toolSchema),
      toolChoice: toolChoiceSchema.optional(),
      model: modelSchema.optional(),
      maxTokens: z.number().min(1).max(8192).optional(),
      system: z.string().optional(),
      temperature: z.number().min(0).max(1).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const client = getClaudeClient(privateEnv.ANTHROPIC_API_KEY);

      const response = await client.createMessage({
        messages: data.messages as Message[],
        tools: data.tools as Tool[],
        toolChoice: data.toolChoice as ToolChoice | undefined,
        model: data.model as ClaudeModel | undefined,
        maxTokens: data.maxTokens,
        system: data.system,
        temperature: data.temperature,
        userId: context.userId,
      });

      const result = {
        success: true as const,
        response: {
          id: response.id,
          content: response.content as any,
          model: response.model,
          stopReason: response.stop_reason,
          usage: response.usage,
        },
      };
      return result;
    } catch (error) {
      const result = {
        success: false as const,
        error: formatClaudeError(error),
      };
      return result;
    }
  });

/**
 * Simple text completion
 */
export const completeWithClaudeFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      prompt: z.string().min(1).max(100000),
      model: modelSchema.optional(),
      maxTokens: z.number().min(1).max(8192).optional(),
      system: z.string().optional(),
      temperature: z.number().min(0).max(1).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    try {
      const client = getClaudeClient(privateEnv.ANTHROPIC_API_KEY);

      const response = await client.complete(data.prompt, {
        model: data.model as ClaudeModel | undefined,
        maxTokens: data.maxTokens,
        system: data.system,
        temperature: data.temperature,
      });

      const result: CompleteWithClaudeResult = {
        success: true,
        text: response,
      };
      return result;
    } catch (error) {
      const result: CompleteWithClaudeResult = {
        success: false,
        error: formatClaudeError(error),
      };
      return result;
    }
  });

/**
 * Get available Claude models
 */
export const getClaudeModelsFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async () => {
    return {
      models: [
        { id: "claude-sonnet-4-20250514", name: "Claude 4 Sonnet", description: "Latest and most capable" },
        { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "Advanced reasoning" },
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Balanced performance" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", description: "Fast and efficient" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Most powerful Claude 3" },
        { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", description: "Balanced Claude 3" },
        { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Fastest Claude 3" },
      ],
    };
  });

/**
 * Check if the Claude API key is configured
 */
export const checkClaudeConfigFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async () => {
    const isConfigured = !!privateEnv.ANTHROPIC_API_KEY;
    return {
      isConfigured,
      message: isConfigured
        ? "Claude API is configured and ready to use"
        : "Claude API key is not configured. Please add ANTHROPIC_API_KEY to your environment.",
    };
  });

// ============================================================================
// Type Exports for Queries
// ============================================================================

// SendClaudeMessageResult, SendClaudeMessageWithToolsResult, and CompleteWithClaudeResult
// are defined at the top of this file with explicit type unions

export type GetClaudeModelsResult = Awaited<ReturnType<typeof getClaudeModelsFn>>;
export type CheckClaudeConfigResult = Awaited<ReturnType<typeof checkClaudeConfigFn>>;
