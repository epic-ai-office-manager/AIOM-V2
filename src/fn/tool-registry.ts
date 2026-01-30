/**
 * Tool Registry Server Functions
 * TanStack server functions for tool registry operations
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: Zod 4 type inference creates stricter Record types that conflict with
// TanStack's expected types. Using 'any' assertions for runtime compatibility.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware, assertAdminMiddleware } from "./middleware";
import {
  getToolRegistry,
  type ToolCategory,
  toolCategorySchema,
  createToolContext,
} from "~/lib/tool-registry";
import { isUserAdmin } from "~/data-access/users";
import { registerFinancialTools } from "~/lib/financial-tools";
import { registerExampleTools } from "~/lib/tool-registry/example-tools";
import { registerTaskManagementTools } from "~/lib/task-management-tools";
import { registerAssistantTools } from "~/lib/assistant-tools";

// ============================================================================
// Tool Initialization
// ============================================================================

let toolsInitialized = false;

/**
 * Ensure all tools are registered before use
 */
function ensureToolsRegistered(): void {
  if (!toolsInitialized) {
    registerExampleTools();
    registerFinancialTools();
    registerTaskManagementTools();
    registerAssistantTools();
    toolsInitialized = true;
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all available tools (public definitions only)
 */
export const getToolsFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z
      .object({
        category: toolCategorySchema.optional(),
        enabledOnly: z.boolean().optional().default(true),
        tags: z.array(z.string()).optional(),
      })
      .optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }): Promise<any> => {
    ensureToolsRegistered();
    const registry = getToolRegistry();
    const isAdmin = await isUserAdmin(context.userId);

    // Get tools with filters
    const tools = registry.getPublicDefinitions({
      category: data?.category,
      enabled: data?.enabledOnly !== false ? true : undefined,
      tags: data?.tags,
    });

    // Filter by permission based on user's access level
    return tools.filter((tool) => {
      if (tool.permission === "admin") {
        return isAdmin;
      }
      if (tool.permission === "system") {
        return false; // Never expose system tools to clients
      }
      return true;
    });
  });

/**
 * Get a single tool by ID
 */
export const getToolByIdFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ toolId: z.string().min(1) }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }): Promise<any> => {
    ensureToolsRegistered();
    const registry = getToolRegistry();
    const tool = registry.get(data.toolId);

    if (!tool) {
      return null;
    }

    // Check permission
    const isAdmin = await isUserAdmin(context.userId);
    if (tool.permission === "admin" && !isAdmin) {
      return null;
    }
    if (tool.permission === "system") {
      return null;
    }

    // Return public definition (without handler)
    const { handler, formatter, ...publicTool } = tool;
    return publicTool;
  });

/**
 * Get tools in Claude-compatible format
 */
export const getClaudeToolsFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z
      .object({
        category: toolCategorySchema.optional(),
        tags: z.array(z.string()).optional(),
      })
      .optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }): Promise<any> => {
    ensureToolsRegistered();
    const registry = getToolRegistry();
    const isAdmin = await isUserAdmin(context.userId);

    // Get enabled Claude tools
    const tools = registry.getClaudeTools({
      category: data?.category,
      tags: data?.tags,
    });

    // Filter based on permissions (need to get full definitions for this)
    const allTools = registry.getAll({ enabled: true });
    const accessibleToolIds = allTools
      .filter((tool) => {
        if (tool.permission === "admin") return isAdmin;
        if (tool.permission === "system") return false;
        return true;
      })
      .map((tool) => tool.id);

    return tools.filter((tool) => accessibleToolIds.includes(tool.name));
  });

/**
 * Get tool categories with counts
 */
export const getToolCategoriesFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async (): Promise<any> => {
    ensureToolsRegistered();
    const registry = getToolRegistry();
    const categories = registry.getCategories();

    return Array.from(categories.entries()).map(([category, count]) => ({
      category: category as ToolCategory,
      count,
    }));
  });

/**
 * Search tools by query
 */
export const searchToolsFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ query: z.string().min(1).max(100) }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }): Promise<any> => {
    ensureToolsRegistered();
    const registry = getToolRegistry();
    const isAdmin = await isUserAdmin(context.userId);

    const tools = registry.search(data.query);

    // Filter by permission and return public definitions
    return tools
      .filter((tool) => {
        if (tool.permission === "admin") return isAdmin;
        if (tool.permission === "system") return false;
        return true;
      })
      .map((tool) => {
        const { handler, formatter, ...publicTool } = tool;
        return publicTool;
      });
  });

// ============================================================================
// Execution Functions
// ============================================================================

/**
 * Execute a tool
 */
export const executeToolFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      toolId: z.string().min(1),
      input: z.record(z.string(), z.unknown()),
      timeoutMs: z.number().int().positive().max(300000).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }): Promise<any> => {
    ensureToolsRegistered();
    const registry = getToolRegistry();
    const isAdmin = await isUserAdmin(context.userId);

    // Create tool context
    const toolContext = createToolContext(context.userId, {
      isAdmin,
    });

    try {
      const { result, formatted } = await registry.execute(
        data.toolId,
        data.input,
        toolContext,
        { timeoutMs: data.timeoutMs }
      );

      return {
        success: result.success,
        result,
        formatted,
      };
    } catch (error) {
      return {
        success: false,
        result: undefined,
        formatted: undefined,
        error: error instanceof Error ? error.message : "Tool execution failed",
      };
    }
  });

// ============================================================================
// Admin Functions
// ============================================================================

/**
 * Enable a tool (admin only)
 */
export const enableToolFn = createServerFn({
  method: "POST",
})
  .inputValidator(z.object({ toolId: z.string().min(1) }))
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    ensureToolsRegistered();
    const registry = getToolRegistry();
    const success = registry.enable(data.toolId);
    return { success };
  });

/**
 * Disable a tool (admin only)
 */
export const disableToolFn = createServerFn({
  method: "POST",
})
  .inputValidator(z.object({ toolId: z.string().min(1) }))
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    ensureToolsRegistered();
    const registry = getToolRegistry();
    const success = registry.disable(data.toolId);
    return { success };
  });

/**
 * Get registry statistics (admin only)
 */
export const getRegistryStatsFn = createServerFn({
  method: "GET",
})
  .middleware([assertAdminMiddleware])
  .handler(async () => {
    ensureToolsRegistered();
    const registry = getToolRegistry();

    const allTools = registry.getAll();
    const enabledTools = registry.getAll({ enabled: true });
    const categories = registry.getCategories();

    return {
      totalTools: allTools.length,
      enabledTools: enabledTools.length,
      disabledTools: allTools.length - enabledTools.length,
      categoryCounts: Array.from(categories.entries()).map(([category, count]) => ({
        category: category as ToolCategory,
        count,
      })),
    };
  });
