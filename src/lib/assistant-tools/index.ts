/**
 * Assistant Tools
 *
 * Tools for AI assistant operations including task creation, email drafting,
 * expense logging, inbox summarization, and system health checks.
 * These tools are exposed through conversational interfaces (web, Telegram).
 *
 * @module assistant-tools
 */

import { getToolRegistry } from "../tool-registry";

// Export all tool definitions
export {
  createTaskTool,
  summarizeInboxThreadTool,
  draftEmailTool,
  createExpenseTool,
  systemHealthCheckTool,
  assistantTools,
  getAssistantToolCount,
} from "./definitions";

// Import for registration
import { assistantTools } from "./definitions";

/**
 * Register all assistant tools with the global tool registry
 */
export function registerAssistantTools(): void {
  const registry = getToolRegistry();

  for (const tool of assistantTools) {
    if (!registry.has(tool.id)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registry.register(tool as any);
    }
  }
}

/**
 * Unregister all assistant tools from the global tool registry
 */
export function unregisterAssistantTools(): void {
  const registry = getToolRegistry();

  for (const tool of assistantTools) {
    registry.unregister(tool.id);
  }
}

/**
 * Check if assistant tools are registered
 */
export function areAssistantToolsRegistered(): boolean {
  const registry = getToolRegistry();
  return assistantTools.every((tool) => registry.has(tool.id));
}

/**
 * Get assistant tools in Claude-compatible format
 */
export function getAssistantClaudeTools() {
  const registry = getToolRegistry();

  // Register if not already registered
  if (!areAssistantToolsRegistered()) {
    registerAssistantTools();
  }

  // Return only assistant tools
  return assistantTools.map((tool) => ({
    name: tool.id,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}
